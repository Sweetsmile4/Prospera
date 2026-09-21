import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { Budget } from "../models/Budget";
import { Goal } from "../models/Goal";
import { Liability } from "../models/Liability";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { getFinancialPreference } from "./financialPreferences";

export type Recommendation = { id: string; type: string; priority: "low" | "medium" | "high"; title: string; description: string; reason: string; potentialImpact: string; actionUrl: string };

export async function generateRecommendations(userId: Types.ObjectId): Promise<Recommendation[]> {
  const recs: Recommendation[] = [];
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const pref = await getFinancialPreference(userId);

  const txData = await Transaction.aggregate([{ $match: { userId, transactionDate: { $gte: from, $lte: to } } }, { $group: { _id: "$type", total: { $sum: "$amount" } } }]);
  const byType: Record<string, number> = {}; for (const r of txData) byType[r._id] = r.total;
  const income = byType.income || 0, expenses = byType.expense || 0, savings = byType.saving || 0, investments = byType.investment || 0;
  const savingsRate = income > 0 ? ((savings + investments) / income) * 100 : 0;

  if (savingsRate < 20 && income > 0) {
    recs.push({ id: "increase-savings", type: "savings", priority: "high", title: "Increase your savings rate", description: `Your current savings rate is ${savingsRate.toFixed(1)}%. Aim for at least 20%.`, reason: "Building savings improves financial security.", potentialImpact: `Saving 20% would mean ₹${Math.round(income * 0.2).toLocaleString("en-IN")}/month.`, actionUrl: "/budgets" });
  }

  const budgets = await Budget.find({ userId, month: now.getMonth() + 1, year: now.getFullYear() });
  for (const b of budgets) {
    const spent = await Transaction.aggregate([{ $match: { userId, type: "expense", categoryId: b.scope === "overall" ? { $exists: true } : b.categoryId, transactionDate: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    const total = spent[0]?.total || 0;
    if (total > b.limit) {
      recs.push({ id: `budget-${b._id}`, type: "budget", priority: "high", title: "Budget exceeded", description: `You spent ₹${total.toLocaleString("en-IN")} against your ₹${b.limit.toLocaleString("en-IN")} limit.`, reason: "Staying within budget helps control spending.", potentialImpact: "Review transactions to identify reductions.", actionUrl: "/budgets" });
    } else if (total > b.limit * 0.8) {
      recs.push({ id: `budget-warning-${b._id}`, type: "budget", priority: "medium", title: "Budget approaching limit", description: `You've used ${Math.round((total / b.limit) * 100)}% of your budget.`, reason: "You may exceed your budget by month-end.", potentialImpact: "Slow spending in this category.", actionUrl: "/budgets" });
    }
  }

  const bills = await RecurringTransaction.find({ userId, isBill: true, isActive: true });
  const monthlyBills = bills.reduce((s, b) => s + (b.frequency === "yearly" ? b.amount / 12 : b.amount), 0);
  if (monthlyBills > income * 0.1) {
    recs.push({ id: "review-subscriptions", type: "subscription", priority: "medium", title: "Review subscriptions", description: `Subscriptions cost ₹${Math.round(monthlyBills).toLocaleString("en-IN")}/month.`, reason: "High subscription costs reduce savings potential.", potentialImpact: "Cancel unused subscriptions to save more.", actionUrl: "/recurring" });
  }

  const debts = await Liability.find({ userId, status: "active" });
  const highInterestDebts = debts.filter(d => d.interestRate > 12);
  if (highInterestDebts.length > 0) {
    recs.push({ id: "pay-high-interest", type: "debt", priority: "high", title: "Pay high-interest debt", description: `You have ${highInterestDebts.length} debt(s) with interest > 12%.`, reason: "High-interest debt grows quickly and costs more over time.", potentialImpact: "Paying early saves on interest.", actionUrl: "/liabilities" });
  }

  const goals = await Goal.find({ userId, status: "active" });
  for (const g of goals) {
    if (g.monthlyTarget > 0 && g.targetDate) {
      const monthsLeft = Math.max(1, Math.ceil((g.targetDate.getTime() - now.getTime()) / (30 * 86400000)));
      const saved = await Transaction.aggregate([{ $match: { userId, type: "saving", goalId: g._id } }, { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$metadata.kind", "goal_withdrawal"] }, { $multiply: ["$amount", -1] }, "$amount"] } } } }]);
      const current = saved[0]?.total || 0;
      const remaining = g.targetAmount - current;
      const required = remaining / monthsLeft;
      if (required > g.monthlyTarget) {
        recs.push({ id: `goal-${g._id}`, type: "goal", priority: "medium", title: `Increase ${g.name} contributions`, description: `You need ₹${Math.round(required).toLocaleString("en-IN")}/month to reach your target on time.`, reason: "You're behind schedule for this goal.", potentialImpact: "Increase monthly contributions.", actionUrl: "/goals" });
      }
    }
  }

  return recs.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]);
}