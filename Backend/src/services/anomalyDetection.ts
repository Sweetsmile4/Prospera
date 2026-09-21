import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";

export type Anomaly = { type: "category_spike" | "large_transaction"; category?: string; title: string; amount: number; average: number; deviation: string; date: string };

export async function detectAnomalies(userId: Types.ObjectId): Promise<Anomaly[]> {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const anomalies: Anomaly[] = [];

  const categories = await Transaction.distinct("categoryId", { userId, type: "expense", categoryId: { $ne: null } });
  for (const catId of categories) {
    const thisMonthTotal = await Transaction.aggregate([
      { $match: { userId, type: "expense", categoryId: catId, transactionDate: { $gte: thisMonth } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const prevMonths = await Transaction.aggregate([
      { $match: { userId, type: "expense", categoryId: catId, transactionDate: { $gte: threeMonthsAgo, $lt: thisMonth } } },
      { $group: { _id: { month: { $month: "$transactionDate" } }, total: { $sum: "$amount" } } },
    ]);
    const thisTotal = thisMonthTotal[0]?.total || 0;
    if (prevMonths.length >= 2 && thisTotal > 0) {
      const avgPrev = prevMonths.reduce((s, m) => s + m.total, 0) / prevMonths.length;
      if (avgPrev > 0 && thisTotal > avgPrev * 1.5) {
        const cat = await Transaction.findOne({ categoryId: catId }).populate("categoryId");
        anomalies.push({ type: "category_spike", category: (cat as any)?.categoryId?.name || "Unknown", title: "", amount: thisTotal, average: Math.round(avgPrev), deviation: `${Math.round((thisTotal / avgPrev - 1) * 100)}%`, date: thisMonth.toISOString().slice(0, 10) });
      }
    }
  }

  const avgTxns = await Transaction.aggregate([
    { $match: { userId, type: "expense", transactionDate: { $gte: threeMonthsAgo } } },
    { $group: { _id: null, avg: { $avg: "$amount" }, stdDev: { $stdDevPop: "$amount" } } },
  ]);
  const avg = avgTxns[0]?.avg || 0;
  const stdDev = avgTxns[0]?.stdDev || 0;
  const threshold = avg + 2 * stdDev;
  const largeTxns = await Transaction.find({ userId, type: "expense", transactionDate: { $gte: thisMonth }, amount: { $gt: threshold } }).populate("categoryId");
  for (const t of largeTxns) {
    anomalies.push({ type: "large_transaction", category: (t as any).categoryId?.name, title: t.title, amount: t.amount, average: Math.round(avg), deviation: `${Math.round((t.amount / avg - 1) * 100)}%`, date: t.transactionDate.toISOString().slice(0, 10) });
  }
  return anomalies;
}