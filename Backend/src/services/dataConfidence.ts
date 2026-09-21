import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { Account } from "../models/Account";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Liability } from "../models/Liability";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { Budget } from "../models/Budget";

export type DataConfidence = {
  score: number;
  level: "low" | "medium" | "high";
  factors: { label: string; met: boolean; detail: string }[];
};

export async function getDataConfidence(userId: Types.ObjectId): Promise<DataConfidence> {
  const factors: DataConfidence["factors"] = [];
  const now = new Date();

  const accountCount = await Account.countDocuments({ userId, isActive: true });
  factors.push({ label: "Active accounts", met: accountCount > 0, detail: `${accountCount} active account(s)` });

  const txCount = await Transaction.countDocuments({ userId });
  const firstTx = await Transaction.findOne({ userId }).sort({ transactionDate: 1 }).select("transactionDate");
  const historyDays = firstTx ? Math.floor((now.getTime() - firstTx.transactionDate.getTime()) / 86400000) : 0;
  const hasHistory = historyDays >= 30;
  factors.push({ label: "Transaction history (30+ days)", met: hasHistory, detail: `${historyDays} day(s) of history, ${txCount} transaction(s)` });

  const classifiable = await Transaction.countDocuments({ userId, type:{$in:["income","expense"]} });
  const uncategorized = await Transaction.countDocuments({ userId, type:{$in:["income","expense"]}, categoryId: null });
  const categorizedRatio = classifiable > 0 ? (classifiable - uncategorized) / classifiable : 0;
  factors.push({ label: "Categorized transactions", met: categorizedRatio >= 0.8, detail: `${Math.round(categorizedRatio * 100)}% categorized` });

  const recurringIncome = await RecurringTransaction.countDocuments({ userId, type: "income", isActive: true });
  factors.push({ label: "Recurring income configured", met: recurringIncome > 0, detail: `${recurringIncome} recurring income source(s)` });

  const bills = await RecurringTransaction.countDocuments({ userId, isBill: true, isActive: true });
  factors.push({ label: "Bills configured", met: bills > 0, detail: `${bills} bill(s) configured` });

  const liabilities = await Liability.countDocuments({ userId, status: "active" });
  factors.push({ label: "Liabilities tracked", met: liabilities > 0, detail: `${liabilities} active liabilit(y/ies)` });

  const holdings = await InvestmentHolding.countDocuments({ userId });
  const stale = await InvestmentHolding.countDocuments({userId,updatedAt:{$lt:new Date(now.getTime()-90*86400000)}});
  factors.push({ label: "Investment values updated", met: holdings > 0 && stale === 0, detail: holdings ? `${stale} of ${holdings} holding value(s) older than 90 days` : "No holding values to assess" });

  const budgets = await Budget.countDocuments({ userId, month: now.getMonth() + 1, year: now.getFullYear() });
  factors.push({ label: "Budgets configured", met: budgets > 0, detail: `${budgets} budget(s) this month` });

  const metCount = factors.filter(f => f.met).length;
  const score = Math.round((metCount / factors.length) * 100);
  const level = score >= 75 ? "high" : score >= 50 ? "medium" : "low";
  return { score, level, factors };
}
