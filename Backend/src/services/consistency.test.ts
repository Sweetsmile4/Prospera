import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../models/User";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Goal } from "../models/Goal";
import { Liability } from "../models/Liability";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { createTransaction } from "./transactions";
import { recordLiabilityPayment } from "./liabilities";
import { recordInvestmentActivity } from "./investments";
import { payOccurrence } from "./recurring";
import { createSinkingFund, contributeToSinkingFund } from "./sinkingFund";
import { captureNetWorth } from "./netWorth";
import { totals } from "./analytics";
import { budgetFacts, monthStart, monthEnd, roundMoney } from "./planningFacts";
import { forecastCashFlow } from "./forecasting";
import { calculateSafeToSpend } from "./safeToSpend";
import { calculateFinancialHealth } from "./financialHealth";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let replSet: MongoMemoryReplSet;
let userA: any, bank: any, cash: any, savings: any, investAcct: any;
let foodCat: any, salaryCat: any, shoppingCat: any;
let mf: any, loan: any, card: any, goal: any, fundId: string;
let now: Date, d1: Date;

function day(offset: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), Math.min(1 + offset, 27));
}

describe("Financial consistency regression", () => {
  beforeAll(async () => {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.MONGOMS_SYSTEM_BINARY || "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 });
    const user = await User.create({ name: "C", email: "consist@test.dev", passwordHash: "x" });
    userA = user;
    bank = await Account.create({ userId: userA._id, name: "Bank", type: "bank", openingBalance: 100000, currentBalance: 100000 });
    cash = await Account.create({ userId: userA._id, name: "Cash", type: "cash", openingBalance: 20000, currentBalance: 20000 });
    savings = await Account.create({ userId: userA._id, name: "Savings", type: "bank", openingBalance: 0, currentBalance: 0 });
    investAcct = await Account.create({ userId: userA._id, name: "Portfolio", type: "investment", openingBalance: 0, currentBalance: 0 });
    foodCat = await Category.create({ userId: null, name: "Food", type: "expense", isDefault: true, isEssential: true });
    salaryCat = await Category.create({ userId: null, name: "Salary", type: "income", isDefault: true });
    shoppingCat = await Category.create({ userId: null, name: "Shopping", type: "expense", isDefault: true });
    goal = await Goal.create({ userId: userA._id, name: "Emergency Fund", targetAmount: 10000, monthlyTarget: 1000 });
    loan = await Liability.create({ userId: userA._id, name: "Loan", type: "education loan", originalAmount: 20000, outstandingAmount: 20000, interestRate: 8.5, emiAmount: 2000, paymentDay: 27 });
    card = await Liability.create({ userId: userA._id, name: "Card", type: "credit card", originalAmount: 10000, outstandingAmount: 8000, interestRate: 0, emiAmount: 0, paymentDay: 28 });
    mf = await InvestmentHolding.create({ userId: userA._id, name: "MF", type: "mutual fund", investedAmount: 0, currentValue: 0, accountId: investAcct._id });
    await Budget.create({ userId: userA._id, categoryId: foodCat._id, month: new Date().getUTCMonth() + 1, year: new Date().getUTCFullYear(), limit: 3000 });
    now = new Date(); d1 = day(1);

    await createTransaction(userA._id, { type: "income", title: "Salary", amount: 5000, accountId: String(bank._id), categoryId: String(salaryCat._id), transactionDate: day(1) });
    await createTransaction(userA._id, { type: "expense", title: "Food", amount: 1000, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: day(2) });
    await createTransaction(userA._id, { type: "transfer", title: "Move to savings", amount: 2000, accountId: String(bank._id), destinationAccountId: String(savings._id), transactionDate: day(3) });
    await createTransaction(userA._id, { type: "saving", title: "General saving", amount: 1500, accountId: String(bank._id), transactionDate: day(4) });
    await recordInvestmentActivity(userA._id, String(mf._id), { activity: "contribution", amount: 1000, accountId: String(bank._id), date: day(5) });
    await createTransaction(userA._id, { type: "saving", title: "Emergency contribution", amount: 1000, accountId: String(bank._id), goalId: String(goal._id), transactionDate: day(6) });
    await createTransaction(userA._id, { type: "saving", title: "Emergency withdrawal", amount: 1000, accountId: String(cash._id), goalId: String(goal._id), transactionDate: day(7), metadata: { kind: "goal_withdrawal", activity: "withdrawal" } });
    await recordLiabilityPayment(userA._id, String(card._id), { amount: 5000, principalAmount: 5000, accountId: String(bank._id), date: day(8) });
    await recordLiabilityPayment(userA._id, String(loan._id), { amount: 2000, principalAmount: 1800, interestAmount: 200, accountId: String(bank._id), date: day(9) });

    const rule = await RecurringTransaction.create({ userId: userA._id, title: "Salary", type: "income", amount: 4000, accountId: bank._id, frequency: "monthly", startDate: d1, nextRunDate: new Date(Date.now() - 5000), isActive: true, autoCreate: true });
    await payOccurrence(userA._id, String(rule._id), undefined, now);
    await payOccurrence(userA._id, String(rule._id), undefined, now);

    await createTransaction(userA._id, { type: "expense", title: "Imported bill", amount: 500, accountId: String(bank._id), categoryId: String(shoppingCat._id), source: "import", referenceNumber: "REF1", transactionDate: day(11) });
    const fund = await createSinkingFund(userA._id, { name: "Trip", targetAmount: 10000, targetDate: new Date(now.getFullYear(), now.getMonth() + 6, 1), monthlyContribution: 1000 });
    fundId = String(fund._id);
    await contributeToSinkingFund(userA._id, fundId, 2000, String(bank._id), day(12));
  }, 120_000);

  afterAll(async () => { await mongoose.disconnect(); if (replSet) await replSet.stop(); });

  it("applies balance impacts exactly once across every transaction type", async () => {
    const b = (await Account.findById(bank._id))!, s = (await Account.findById(savings._id))!, c = (await Account.findById(cash._id))!, ia = (await Account.findById(investAcct._id))!;
    expect(b.currentBalance).toBe(93000); // income, expense, transfer, savings, investment, debt x2, recurring, import, sinking
    expect(s.currentBalance).toBe(2000); // transfer destination
    expect(c.currentBalance).toBe(21000); // goal withdrawal returns cash
    expect(ia.currentBalance).toBe(0); // linked holding excluded, not double-counted
  });

  it("loan and credit-card payments never count as expenses or as savings", async () => {
    const t = await totals(userA._id, monthStart(now), monthEnd(now));
    expect(t.income).toBe(9000); // salary 5000 + recurring 4000
    expect(t.expenses).toBe(1500); // food 1000 + imported 500 only
    expect(t.savings).toBe(3500); // general 1500 + goal 1000 - withdrawal 1000 + sinking 2000
    expect(t.investments).toBe(1000); // MF contribution only
  });

  it("goal progress counts contributions minus withdrawals exactly once", async () => {
    const agg = await Transaction.aggregate([
      { $match: { userId: userA._id, type: "saving", goalId: goal._id } },
      { $group: { _id: null, saved: { $sum: { $cond: [{ $eq: ["$metadata.kind", "goal_withdrawal"] }, { $multiply: ["$amount", -1] }, "$amount"] } } } },
    ]);
    expect(agg[0]?.saved || 0).toBe(0);
  });

  it("budgets count only real expenses, excluding debt payments and saving flows", async () => {
    const facts = await budgetFacts(userA._id, now);
    const food = facts.find((f: any) => f.name === "Food" || f.id === String(foodCat._id));
    expect(food?.spent).toBe(1000);
  });

  it("net worth reflects every movement without double counting", async () => {
    await captureNetWorth(userA._id);
    const worth = await captureNetWorth(userA._id, undefined, false);
    expect(worth.assets).toBe(119000); // bank 93000 + savings 2000 + cash 21000 + holding 1000 + sinking 2000
    expect(worth.liabilities).toBe(21200); // loan 18200 + card 3000
    expect(worth.netWorth).toBe(97800);
    expect(worth.assetBreakdown.goalReserves).toBe(0);
    expect(worth.assetBreakdown.sinkingReserves).toBe(2000);
  });

  it("forecasts never create transaction records", async () => {
    const before = await Transaction.countDocuments({ userId: userA._id });
    const forecast = await forecastCashFlow(userA._id, 30, now);
    const after = await Transaction.countDocuments({ userId: userA._id });
    expect(after).toBe(before);
    expect(forecast.events.every(e => ["income", "expense", "saving", "investment", "transfer", "debt"].includes(e.type))).toBe(true);
  });

  it("safe-to-spend never deducts more obligations than available cash", async () => {
    const s = await calculateSafeToSpend(userA._id);
    expect(s.availableCash).toBe(116000); // bank 93000 + cash 21000 + savings 2000
    const deducted = s.upcomingBills + s.plannedDebtPayments + s.plannedSavings + s.plannedInvestments + s.essentialReserve;
    expect(roundMoney(deducted)).toBeLessThanOrEqual(s.availableCash);
    expect(s.availableCash - s.safeToSpend).toBeLessThanOrEqual(roundMoney(deducted) + 1);
  });

  it("health score treats saving and investing correctly (not as spending)", async () => {
    const r = await calculateFinancialHealth(userA._id);
    expect(r.breakdown.savingsRate.score).toBe(25); // 50% savings+investment / income
    expect(r.breakdown.savingsRate.detail).toContain("50");
  });
});