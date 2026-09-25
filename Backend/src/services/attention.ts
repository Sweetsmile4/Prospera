import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { Category } from "../models/Category";
import { AppError } from "../utils/errors";

export const ATTENTION_FLAGS = ["uncategorized", "possible_duplicate", "possible_subscription", "unusual", "large_transaction"] as const;
export type AttentionFlag = (typeof ATTENTION_FLAGS)[number];

const WINDOW_DAYS = 90;

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

async function assignFlags(userId: Types.ObjectId, assigns: { txId: Types.ObjectId; flags: AttentionFlag[] }[]): Promise<number> {
  const ops = assigns
    .filter(a => a.flags.length)
    .map(a => ({
      updateOne: {
        filter: { _id: a.txId, userId },
        update: { $addToSet: { attentionFlags: { $each: a.flags as string[] } } },
      },
    }));
  if (!ops.length) return 0;
  const result = await Transaction.bulkWrite(ops, { ordered: false });
  return result.modifiedCount;
}

function dayStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function detectAttentionFlags(userId: Types.ObjectId, through: Date = new Date()): Promise<{ scanned: number; updated: number; byFlag: Record<string, number> }> {
  const cutoff = dayStart(new Date(through.getTime() - WINDOW_DAYS * 864e5));
  const byFlag: Record<string, number> = { uncategorized: 0, possible_duplicate: 0, possible_subscription: 0, unusual: 0, large_transaction: 0 };
  const assigns: { txId: Types.ObjectId; flags: AttentionFlag[] }[] = [];

  const txns = await Transaction.find({
    userId,
    transactionDate: { $gte: cutoff },
  }).select("_id type title amount accountId categoryId source recurringTransactionId normalizedMerchant originalDescription transactionDate attentionFlags attentionResolved");

  const live = new Map<string, typeof txns[0]>();
  for (const t of txns) live.set(t._id.toString(), t);

  const pick = (t: any, ...flags: AttentionFlag[]) => {
    const doc = live.get(t._id.toString());
    if (!doc) return;
    const fresh = flags.filter(f => !(doc.attentionFlags || []).includes(f) && !(doc.attentionResolved || []).includes(f));
    if (fresh.length) assigns.push({ txId: t._id, flags: fresh as AttentionFlag[] });
  };

  for (const t of txns) {
    const hasCategory = !!t.categoryId;
    if ((t.type === "income" || t.type === "expense") && !hasCategory) pick(t, "uncategorized");
  }

  const monthStart = new Date(through.getFullYear(), through.getMonth(), 1);
  const expenseStats = await Transaction.aggregate([
    { $match: { userId, type: "expense", transactionDate: { $gte: cutoff } } },
    { $group: { _id: null, avg: { $avg: "$amount" }, stdDev: { $stdDevPop: "$amount" }, count: { $sum: 1 } } },
  ]);
  const stat = expenseStats[0];
  if (stat && stat.count >= 5 && stat.avg > 0) {
    const threshold = stat.avg + 2 * (stat.stdDev || 0);
    const big = txns.filter(t => t.type === "expense" && t.transactionDate >= monthStart && t.amount > threshold);
    for (const t of big) pick(t, "large_transaction");
  }

  const categories = await Transaction.distinct("categoryId", { userId, type: "expense", categoryId: { $ne: null } });
  for (const catId of categories) {
    const thisMonthTotal = await Transaction.aggregate([
      { $match: { userId, type: "expense", categoryId: catId, transactionDate: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const prevFrom = new Date(through.getFullYear(), through.getMonth() - 2, 1);
    const prevTo = monthStart;
    const prevMonths = await Transaction.aggregate([
      { $match: { userId, type: "expense", categoryId: catId, transactionDate: { $gte: prevFrom, $lt: prevTo } } },
      { $group: { _id: { month: { $month: "$transactionDate" } }, total: { $sum: "$amount" } } },
    ]);
    const current = thisMonthTotal[0]?.total || 0;
    if (prevMonths.length >= 2 && current > 0) {
      const avgPrev = prevMonths.reduce((s, m) => s + m.total, 0) / prevMonths.length;
      if (avgPrev > 0 && current > avgPrev * 1.5) {
        for (const t of txns) {
          if (t.type === "expense" && String(t.categoryId) === String(catId) && t.transactionDate >= monthStart) pick(t, "unusual");
        }
      }
    }
  }

  const byKey = new Map<string, typeof txns[0][]>();
  for (const t of txns) {
    if (t.type !== "expense" && t.type !== "income") continue;
    const title = normalizeTitle(t.title || t.originalDescription || "");
    if (!title) continue;
    const key = `${String(t.accountId)}:${t.amount.toFixed(2)}:${dayStart(t.transactionDate).toISOString()}:${title}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(t);
    else byKey.set(key, [t]);
  }
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const ordered = [...group].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    for (let i = 1; i < ordered.length; i++) pick(ordered[i], "possible_duplicate");
  }

  const subKey = new Map<string, typeof txns[0][]>();
  for (const t of txns) {
    if (t.type !== "expense") continue;
    if (t.source === "recurring" || t.recurringTransactionId) continue;
    const merchant = (t.normalizedMerchant || t.title || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const key = `${merchant}:${t.amount.toFixed(2)}`;
    const bucket = subKey.get(key);
    if (bucket) bucket.push(t);
    else subKey.set(key, [t]);
  }
  for (const group of subKey.values()) {
    if (group.length < 3) continue;
    const ordered = [...group].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i++) gaps.push((ordered[i].transactionDate.getTime() - ordered[i - 1].transactionDate.getTime()) / 864e5);
    const avgGap = gaps.reduce((s, g) => s + g, 0) / gaps.length;
    if (avgGap >= 20 && avgGap <= 40) pick(ordered[ordered.length - 1], "possible_subscription");
  }

  const updated = await assignFlags(userId, assigns);
  for (const t of assigns) for (const f of t.flags) byFlag[f] = (byFlag[f] || 0) + 1;
  return { scanned: txns.length, updated, byFlag };
}

export async function getAttentionSummary(userId: Types.ObjectId, through: Date = new Date()) {
  await detectAttentionFlags(userId, through);
  const docs = await Transaction.aggregate([
    { $match: { userId, attentionFlags: { $ne: [] } } },
    { $unwind: "$attentionFlags" },
    { $group: { _id: "$attentionFlags", count: { $sum: 1 } } },
  ]);
  const byFlag: Record<string, number> = {};
  let total = 0;
  for (const { _id, count } of docs) {
    byFlag[_id] = count;
    total += count;
  }
  const unique = await Transaction.countDocuments({ userId, attentionFlags: { $ne: [] } });
  return { total: unique, byFlag };
}

export async function getAttentionItems(userId: Types.ObjectId, flag?: string, limit = 50, skip = 0) {
  const query: any = { userId, attentionFlags: { $ne: [] } };
  if (flag) query.attentionFlags = flag;
  const [items, total] = await Promise.all([
    Transaction.find(query)
      .populate("accountId destinationAccountId categoryId goalId")
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limit),
    Transaction.countDocuments(query),
  ]);
  return { items, total };
}

export async function resolveAttentionFlags(userId: Types.ObjectId, txId: string, flags: AttentionFlag[]) {
  if (!flags.length) throw new AppError(400, "No flags supplied");
  for (const f of flags) if (!ATTENTION_FLAGS.includes(f)) throw new AppError(400, `Unknown flag: ${f}`);
  return Transaction.findOneAndUpdate(
    { _id: txId, userId },
    { $pull: { attentionFlags: { $in: flags } }, $addToSet: { attentionResolved: { $each: flags } } },
    { returnDocument: "after" }
  );
}

export async function recategorizeAttentionTransaction(userId: Types.ObjectId, txId: string, categoryId: string) {
  if (!Types.ObjectId.isValid(categoryId)) throw new AppError(400, "Invalid category");
  const tx = await Transaction.findOne({ _id: txId, userId }).select("type");
  if (!tx) return null;
  const expectedType = tx.type === "income" ? "income" : tx.type === "expense" ? "expense" : undefined;
  if (!expectedType) throw new AppError(400, "Only income and expense transactions can be categorized");
  const cat = await Category.exists({ _id: categoryId, $or: [{ userId }, { userId: null }], type: expectedType, isActive: true });
  if (!cat) throw new AppError(400, "Category not found");
  return Transaction.findOneAndUpdate(
    { _id: txId, userId },
    { $set: { categoryId }, $pull: { attentionFlags: "uncategorized" }, $addToSet: { attentionResolved: "uncategorized" } },
    { returnDocument: "after" }
  );
}