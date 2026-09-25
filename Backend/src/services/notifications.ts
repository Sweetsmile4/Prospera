import { Types } from "mongoose";
import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { Goal } from "../models/Goal";
import { Liability } from "../models/Liability";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Notification } from "../models/Notification";
import { FinancialPreference } from "../models/FinancialPreference";

export const NOTIFICATION_PREFERENCE_DEFAULTS = {
  budgetAlerts: true,
  billReminders: true,
  goalMilestones: true,
  debtReminders: true,
  unusualSpending: true,
  monthlyReview: true,
} as const;

type PrefKey = keyof typeof NOTIFICATION_PREFERENCE_DEFAULTS;

function prefKeyFor(type: string): PrefKey | null {
  switch (type) {
    case "budget_exceeded":
    case "budget_warning":
      return "budgetAlerts";
    case "bill_due":
      return "billReminders";
    case "goal_reached":
      return "goalMilestones";
    case "loan_due":
      return "debtReminders";
    default:
      return null;
  }
}

async function once(userId: Types.ObjectId, type: string, title: string, message: string, actionUrl: string, eventKey: string) {
  await Notification.findOneAndUpdate(
    { userId, type, title, isRead: false },
    { $setOnInsert: { userId, type, title, message, actionUrl, isRead: false, eventKey } },
    { upsert: true }
  );
}

export async function refreshNotifications(userId: Types.ObjectId) {
  const pref = await FinancialPreference.findOne({ userId }).lean();
  const enabled = (type: string): boolean => {
    const key = prefKeyFor(type);
    if (key === null) return true;
    return (pref?.notificationPreferences?.[key] ?? NOTIFICATION_PREFERENCE_DEFAULTS[key]) !== false;
  };

  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const budgets = await Budget.find({ userId, month: now.getMonth() + 1, year: now.getFullYear() }).populate("categoryId");
  const budgetLabel = (b: any) => (b.scope === "overall" ? "Overall spending" : (b.categoryId as any).name);
  for (const b of budgets) {
    const match: any = { userId, type: "expense", transactionDate: { $gte: from, $lte: to } };
    if (b.scope !== "overall") match.categoryId = (b.categoryId as any)._id;
    const r = await Transaction.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]);
    const pct = (r[0]?.total || 0) / b.limit * 100;
    if (pct >= 100) {
      if (enabled("budget_exceeded")) await once(userId, "budget_exceeded", `${budgetLabel(b)} budget exceeded`, `Spending reached ${pct.toFixed(0)}% of the limit.`, "/budgets", `budget_exceeded:${b._id}`);
    } else if (pct >= 80) {
      if (enabled("budget_warning")) await once(userId, "budget_warning", `${budgetLabel(b)} budget warning`, `Spending reached ${pct.toFixed(0)}% of the limit.`, "/budgets", `budget_warning:${b._id}`);
    }
  }

  const goals = await Goal.find({ userId, status: "active" });
  for (const g of goals) {
    const x = await Transaction.aggregate([
      { $match: { userId, type: "saving", goalId: g._id } },
      { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$metadata.activity", "withdrawal"] }, { $multiply: ["$amount", -1] }, "$amount"] } } } },
    ]);
    if ((x[0]?.total || 0) >= g.targetAmount && enabled("goal_reached")) {
      await once(userId, "goal_reached", `${g.name} reached`, `You reached your savings target.`, "/goals", `goal_reached:${g._id}`);
    }
  }

  const soon = new Date(now.getTime() + 7 * 864e5);
  const bills = await RecurringTransaction.find({ userId, isBill: true, isActive: true, nextRunDate: { $gte: now, $lte: soon } });
  for (const b of bills) {
    if (!enabled("bill_due")) continue;
    await once(userId, "bill_due", `${b.title} due soon`, `₹${b.amount.toLocaleString("en-IN")} is due on ${b.nextRunDate.toLocaleDateString("en-IN")}.`, "/recurring", `bill_due:${b._id}:${b.nextRunDate.toISOString()}`);
  }

  const debts = await Liability.find({ userId, status: "active", paymentDay: { $exists: true } });
  for (const d of debts) {
    if (!enabled("loan_due")) continue;
    const due = new Date(now.getFullYear(), now.getMonth(), d.paymentDay!);
    if (due < now) due.setMonth(due.getMonth() + 1);
    if (due <= soon) await once(userId, "loan_due", `${d.name} payment due`, `${d.emiAmount ? `₹${d.emiAmount.toLocaleString("en-IN")}` : "A payment"} is due on ${due.toLocaleDateString("en-IN")}.`, "/liabilities", `loan_due:${d._id}:${due.toISOString()}`);
  }
}