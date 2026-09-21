import { Types } from "mongoose";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Transaction } from "../models/Transaction";

export type SubscriptionAnalytics = {
  monthlyCost: number; annualCost: number; activeCount: number;
  subscriptions: { name: string; amount: number; frequency: string; nextDue: string }[];
};

export async function getSubscriptionAnalytics(userId: Types.ObjectId): Promise<SubscriptionAnalytics> {
  const bills = await RecurringTransaction.find({ userId, isBill: true, isActive: true });
  let monthlyCost = 0;
  const subscriptions = bills.map(b => {
    const monthly = b.frequency === "yearly" ? b.amount / 12 : b.frequency === "weekly" ? b.amount * 4.33 : b.frequency === "daily" ? b.amount * 30 : b.amount;
    monthlyCost += monthly;
    return { name: b.title, amount: b.amount, frequency: b.frequency, nextDue: b.nextRunDate.toISOString().slice(0, 10) };
  });
  return { monthlyCost: Math.round(monthlyCost), annualCost: Math.round(monthlyCost * 12), activeCount: bills.length, subscriptions };
}

export type PossibleSubscription = { description: string; amount: number; frequency: string; occurrences: number; lastDate: string };

export async function detectPossibleSubscriptions(userId: Types.ObjectId): Promise<PossibleSubscription[]> {
  const txns = await Transaction.find({ userId, type: "expense" }).sort({ transactionDate: -1 }).limit(500);
  const groups: Record<string, { amounts: number[]; dates: Date[] }> = {};
  for (const t of txns) {
    const key = t.title.trim().toLowerCase().replace(/\s+/g, " ");
    if (!groups[key]) groups[key] = { amounts: [], dates: [] };
    groups[key].amounts.push(t.amount);
    groups[key].dates.push(t.transactionDate);
  }
  const results: PossibleSubscription[] = [];
  for (const [desc, data] of Object.entries(groups)) {
    if (data.dates.length < 3) continue;
    const avgAmount = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    const variance = data.amounts.reduce((s, a) => s + Math.abs(a - avgAmount), 0) / data.amounts.length;
    if (variance / avgAmount > 0.3) continue;
    const sortedDates = data.dates.sort((a, b) => a.getTime() - b.getTime());
    let totalGap = 0;
    for (let i = 1; i < sortedDates.length; i++) totalGap += (sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / 86400000;
    const avgGap = totalGap / (sortedDates.length - 1);
    if (avgGap >= 25 && avgGap <= 35) {
      results.push({ description: desc, amount: Math.round(avgAmount), frequency: "monthly", occurrences: data.dates.length, lastDate: sortedDates[sortedDates.length - 1].toISOString().slice(0, 10) });
    }
  }
  return results;
}