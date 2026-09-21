import { Types } from "mongoose";
import { FinancialMilestone } from "../models/FinancialMilestone";
import { Transaction } from "../models/Transaction";
import { Account } from "../models/Account";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { Liability } from "../models/Liability";
import { Goal } from "../models/Goal";
import { netWorth } from "./v2Rules";

type MilestoneType =
  | "first_10k_saved" | "first_50k_saved" | "first_100k_saved" | "first_500k_saved" | "first_1m_saved"
  | "net_worth_50k" | "net_worth_100k" | "net_worth_500k" | "net_worth_1m"
  | "emergency_fund_1_month" | "emergency_fund_3_months" | "emergency_fund_6_months"
  | "debt_50pct_repaid" | "debt_fully_repaid"
  | "goal_completed" | "positive_net_worth"
  | "first_transaction" | "savings_rate_20pct";

const MILESTONE_DEFINITIONS: Array<{
  type: MilestoneType;
  title: string;
  check: (data: FinancialData) => boolean;
}> = [
  { type: "first_10k_saved", title: "First ₹10,000 saved", check: d => d.totalSavings >= 10000 },
  { type: "first_50k_saved", title: "First ₹50,000 saved", check: d => d.totalSavings >= 50000 },
  { type: "first_100k_saved", title: "First ₹1,00,000 saved", check: d => d.totalSavings >= 100000 },
  { type: "first_500k_saved", title: "First ₹5,00,000 saved", check: d => d.totalSavings >= 500000 },
  { type: "first_1m_saved", title: "First ₹10,00,000 saved", check: d => d.totalSavings >= 1000000 },
  { type: "net_worth_50k", title: "Net worth reached ₹50,000", check: d => d.currentNetWorth >= 50000 },
  { type: "net_worth_100k", title: "Net worth reached ₹1,00,000", check: d => d.currentNetWorth >= 100000 },
  { type: "net_worth_500k", title: "Net worth reached ₹5,00,000", check: d => d.currentNetWorth >= 500000 },
  { type: "net_worth_1m", title: "Net worth reached ₹10,00,000", check: d => d.currentNetWorth >= 1000000 },
  { type: "positive_net_worth", title: "Achieved positive net worth", check: d => d.currentNetWorth > 0 && d.hadNegativeNetWorth },
  { type: "first_transaction", title: "First transaction recorded", check: d => d.totalTransactions >= 1 },
  { type: "savings_rate_20pct", title: "Savings rate reached 20%", check: d => d.savingsRate >= 20 },
  { type: "goal_completed", title: "First goal completed", check: d => d.completedGoals >= 1 },
  { type: "debt_fully_repaid", title: "All debt repaid", check: d => d.totalDebt === 0 && d.hadDebt },
  { type: "debt_50pct_repaid", title: "50% of debt repaid", check: d => d.debtPaidPct >= 50 },
  { type: "emergency_fund_1_month", title: "Emergency fund: 1 month covered", check: d => d.emergencyMonths >= 1 },
  { type: "emergency_fund_3_months", title: "Emergency fund: 3 months covered", check: d => d.emergencyMonths >= 3 },
  { type: "emergency_fund_6_months", title: "Emergency fund: 6 months covered", check: d => d.emergencyMonths >= 6 },
];

type FinancialData = {
  totalSavings: number;
  currentNetWorth: number;
  hadNegativeNetWorth: boolean;
  totalTransactions: number;
  savingsRate: number;
  completedGoals: number;
  totalDebt: number;
  hadDebt: boolean;
  debtPaidPct: number;
  emergencyMonths: number;
};

async function gatherFinancialData(userId: Types.ObjectId): Promise<FinancialData> {
  const accounts = await Account.find({ userId, isActive: true });
  const holdings = await InvestmentHolding.find({ userId });
  const liabilities = await Liability.find({ userId });

  const totalSavings = accounts
    .filter(a => ["bank", "cash", "wallet"].includes(a.type))
    .reduce((s, a) => s + a.currentBalance, 0);

  const investedValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalDebt = liabilities
    .filter(l => l.status === "active")
    .reduce((s, l) => s + l.outstandingAmount, 0);

  const accountAssets = accounts
    .filter(a => !(a.type === "investment" && holdings.some(h => h.accountId?.toString() === a._id.toString())))
    .reduce((s, a) => s + a.currentBalance, 0);

  const currentNetWorth = netWorth(accountAssets + investedValue, totalDebt);

  const txCount = await Transaction.countDocuments({ userId });

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const incomeAgg = await Transaction.aggregate([
    { $match: { userId, type: "income", transactionDate: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  const saveAgg = await Transaction.aggregate([
    { $match: { userId, type: { $in: ["saving", "investment"] }, transactionDate: { $gte: monthStart } } },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const income = incomeAgg[0]?.total || 0;
  const saved = saveAgg[0]?.total || 0;
  const savingsRate = income > 0 ? (saved / income) * 100 : 0;

  const completedGoals = await Goal.countDocuments({ userId, status: "completed" });

  const totalOriginalDebt = liabilities.reduce((s, l) => s + l.originalAmount, 0);
  const debtPaidPct = totalOriginalDebt > 0
    ? ((totalOriginalDebt - totalDebt) / totalOriginalDebt) * 100
    : 0;

  const existing = await FinancialMilestone.find({ userId });
  const hasPositiveNW = existing.some(m => m.type === "positive_net_worth");
  const hasNegativeNW = currentNetWorth < 0 || existing.some(m => m.type === "first_transaction" && !hasPositiveNW);

  const emergencyMonths = 0;

  return {
    totalSavings,
    currentNetWorth,
    hadNegativeNetWorth: hasNegativeNW,
    totalTransactions: txCount,
    savingsRate,
    completedGoals,
    totalDebt,
    hadDebt: totalOriginalDebt > 0,
    debtPaidPct,
    emergencyMonths,
  };
}

export async function detectAndAwardMilestones(userId: Types.ObjectId) {
  const data = await gatherFinancialData(userId);
  const existing = await FinancialMilestone.find({ userId });
  const achievedTypes = new Set(existing.map(m => m.type));

  const newMilestones: Array<{ type: MilestoneType; title: string }> = [];

  for (const def of MILESTONE_DEFINITIONS) {
    if (!achievedTypes.has(def.type) && def.check(data)) {
      newMilestones.push({ type: def.type, title: def.title });
    }
  }

  if (newMilestones.length > 0) {
    await FinancialMilestone.insertMany(
      newMilestones.map(m => ({
        userId,
        type: m.type,
        title: m.title,
        description: `Achieved on ${new Date().toLocaleDateString("en-IN")}`,
        achievedAt: new Date(),
      }))
    );
  }

  return newMilestones;
}

export async function getMilestones(userId: Types.ObjectId) {
  return FinancialMilestone.find({ userId }).sort({ achievedAt: -1 });
}

export async function getMilestoneSummary(userId: Types.ObjectId) {
  const milestones = await FinancialMilestone.find({ userId }).sort({ achievedAt: -1 });
  const latest = milestones[0] || null;
  return {
    total: milestones.length,
    latest,
    milestones,
  };
}
