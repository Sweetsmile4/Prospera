import { Types } from "mongoose";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Liability } from "../models/Liability";
import { Goal } from "../models/Goal";
import { SinkingFund } from "../models/SinkingFund";

export type CalendarEvent = { date: string; title: string; type: "income" | "bill" | "debt" | "goal" | "sinking"; amount: number; actionUrl?: string };

export async function getFinancialCalendar(userId: Types.ObjectId, monthsAhead = 1): Promise<CalendarEvent[]> {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + monthsAhead + 1, 0);
  const events: CalendarEvent[] = [];

  const recurring = await RecurringTransaction.find({ userId, isActive: true, nextRunDate: { $lte: end } });
  for (const r of recurring) {
    events.push({ date: r.nextRunDate.toISOString().slice(0, 10), title: r.title, type: r.type === "income" ? "income" : "bill", amount: r.amount, actionUrl: "/recurring" });
  }

  const debts = await Liability.find({ userId, status: "active", paymentDay: { $exists: true } });
  for (const d of debts) {
    const pd = new Date(now.getFullYear(), now.getMonth(), d.paymentDay!);
    if (pd < now) pd.setMonth(pd.getMonth() + 1);
    if (pd <= end) events.push({ date: pd.toISOString().slice(0, 10), title: `${d.name} EMI`, type: "debt", amount: d.emiAmount || 0, actionUrl: "/liabilities" });
  }

  const goals = await Goal.find({ userId, status: "active", targetDate: { $lte: end } });
  for (const g of goals) {
    events.push({ date: g.targetDate!.toISOString().slice(0, 10), title: `${g.name} target`, type: "goal", amount: g.targetAmount, actionUrl: "/goals" });
  }

  const sinkingFunds = await SinkingFund.find({ userId, status: "active", targetDate: { $lte: end } });
  for (const sf of sinkingFunds) {
    events.push({ date: sf.targetDate.toISOString().slice(0, 10), title: `${sf.name} due`, type: "sinking", amount: sf.targetAmount, actionUrl: "/sinking-funds" });
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}