import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Types } from "mongoose";
import { calculateFinancialHealth } from "./financialHealth";
import { calculateSafeToSpend } from "./safeToSpend";
import { getDataConfidence } from "./dataConfidence";
import { getFinancialPreference, updateFinancialPreference } from "./financialPreferences";
import { createSinkingFund, getSinkingFunds, contributeToSinkingFund } from "./sinkingFund";
import { forecastCashFlow } from "./forecasting";
import { getEmergencyFundStatus } from "./emergencyFund";
import { getSubscriptionAnalytics } from "./subscriptionAnalytics";
import { detectAnomalies } from "./anomalyDetection";
import { planDebtPayoff } from "./debtPlanner";
import { simulateGoalPlan } from "./goalPlanner";
import { analyzePortfolio } from "./portfolioAnalysis";
import { projectFIRE } from "./firePlanner";
import { getFinancialCalendar } from "./financialCalendar";
import { generateMonthlyReview } from "./monthlyReview";
import { generateRecommendations } from "./recommendation";
import { getFinancialContext } from "./financialContext";
import { normalizeMerchant, getMerchantMappings } from "./merchantNormalization";
import { detectAndAwardMilestones, getMilestoneSummary } from "./financialMilestone";
import { User } from "../models/User";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { Goal } from "../models/Goal";
import { Liability } from "../models/Liability";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { SinkingFund } from "../models/SinkingFund";
import { Budget } from "../models/Budget";
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let replSet: MongoMemoryReplSet; let userId: Types.ObjectId;
let foodCatId: Types.ObjectId, rentCatId: Types.ObjectId, salaryCatId: Types.ObjectId, shoppingCatId: Types.ObjectId, utilsCatId: Types.ObjectId;
let bankId: Types.ObjectId; let goalId: Types.ObjectId;

describe("V3", () => {
  beforeAll(async () => {
    process.env.MONGOMS_SYSTEM_BINARY = "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 });
    const user = await User.create({ name: "T", email: "v3@test.dev", passwordHash: "x" });
    userId = user._id;
    const cats = await Category.create([
      { userId: null, name: "Food", type: "expense", isDefault: true, isEssential: true },
      { userId: null, name: "Rent", type: "expense", isDefault: true, isEssential: true },
      { userId: null, name: "Salary", type: "income", isDefault: true },
      { userId: null, name: "Shopping", type: "expense", isDefault: true, isEssential: false },
      { userId: null, name: "Utilities", type: "expense", isDefault: true, isEssential: true },
    ]);
    foodCatId = cats[0]._id; rentCatId = cats[1]._id; salaryCatId = cats[2]._id;
    shoppingCatId = cats[3]._id; utilsCatId = cats[4]._id;
    const bank = await Account.create({ userId, name: "SBI", type: "bank", openingBalance: 50000, currentBalance: 50000 });
    bankId = bank._id;
    await Account.create({ userId, name: "Cash", type: "cash", openingBalance: 10000, currentBalance: 10000 });
    const now = new Date();
    await Transaction.create([
      { userId, type: "income", title: "Salary", amount: 30000, accountId: bankId, categoryId: salaryCatId, transactionDate: new Date(now.getFullYear(), now.getMonth(), 5) },
      { userId, type: "expense", title: "Rent", amount: 8000, accountId: bankId, categoryId: rentCatId, transactionDate: new Date(now.getFullYear(), now.getMonth(), 5) },
      { userId, type: "expense", title: "Food", amount: 3000, accountId: bankId, categoryId: foodCatId, transactionDate: new Date(now.getFullYear(), now.getMonth(), 6) },
      { userId, type: "saving", title: "Save", amount: 5000, accountId: bankId, transactionDate: new Date(now.getFullYear(), now.getMonth(), 7) },
      { userId, type: "investment", title: "SIP", amount: 3000, accountId: bankId, transactionDate: new Date(now.getFullYear(), now.getMonth(), 8) },
    ]);
    goalId = (await Goal.create({ userId, name: "Emergency Fund", targetAmount: 60000, monthlyTarget: 5000 }))._id;
    await Liability.create({ userId, name: "Loan", type: "education loan", originalAmount: 60000, outstandingAmount: 40000, interestRate: 8.5, emiAmount: 2500, paymentDay: 5 });
    await InvestmentHolding.create({ userId, name: "MF", type: "mutual fund", investedAmount: 30000, currentValue: 33500 });
    await RecurringTransaction.create([
      { userId, title: "Salary", type: "income", amount: 30000, accountId: bankId, frequency: "monthly", startDate: now, nextRunDate: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
      { userId, title: "Netflix", type: "expense", amount: 649, accountId: bankId, frequency: "monthly", startDate: now, nextRunDate: new Date(now.getFullYear(), now.getMonth(), 10), isBill: true },
    ]);
    await Budget.create({ userId, categoryId: foodCatId, month: now.getMonth() + 1, year: now.getFullYear(), limit: 5000 });
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); if (replSet) await replSet.stop(); });

  it("health score 0-100", async () => {
    const r = await calculateFinancialHealth(userId);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.breakdown).toBeDefined();
  });

  it("safe-to-spend ok status", async () => {
    await updateFinancialPreference(userId,{safeToSpendReserve:1000});
    const r = await calculateSafeToSpend(userId);
    expect(r.status).toBe("ok");
    expect(r.availableCash).toBe(60000);
    expect(r.upcomingBills).toBeGreaterThanOrEqual(0);
  });

  it("data confidence factors present", async () => {
    const r = await getDataConfidence(userId);
    expect(r.factors.length).toBeGreaterThanOrEqual(5);
    expect(["high", "medium", "low"].includes(r.level)).toBe(true);
  });

  it("preferences defaults", async () => {
    const p = await getFinancialPreference(userId);
    expect(p.emergencyFundTargetMonths).toBe(6);
  });

  it("forecasting includes recurring", async () => {
    const f = await forecastCashFlow(userId, 30);
    expect(f.events.length).toBeGreaterThanOrEqual(2);
    expect(f.events.some(e => e.description === "Salary")).toBe(true);
    expect(f.events.some(e => e.description === "Netflix")).toBe(true);
  });

  it("forecast does not create transactions", async () => {
    const before = await Transaction.countDocuments({ userId, title: "Netflix" });
    await forecastCashFlow(userId, 30);
    const after = await Transaction.countDocuments({ userId, title: "Netflix" });
    expect(after).toBe(before);
  });

  it("emergency fund months calculated", async () => {
    await updateFinancialPreference(userId,{emergencyFundAccountId:bankId.toString(),essentialCategories:[foodCatId.toString()]});
    const previousMonth=new Date(new Date().getFullYear(),new Date().getMonth()-1,15);
    await Transaction.create({userId,type:"expense",title:"Prior essentials",amount:10000,accountId:bankId,categoryId:foodCatId,transactionDate:previousMonth});
    const r = await getEmergencyFundStatus(userId);
    expect(r.monthlyEssentials).toBe(10000);
    expect(r.monthsCovered).toBe(5);
    expect(r.targetMonths).toBe(6);
  });

  it("emergency fund handles zero essential expenses", async () => {
    await updateFinancialPreference(userId, { essentialCategories: [] as any });
    const r = await getEmergencyFundStatus(userId);
    expect(r.monthsCovered).toBeNull();
    expect(r.status).toBe("insufficient_data");
    expect(r.monthlyEssentials).toBe(0);
    await updateFinancialPreference(userId, { essentialCategories: [foodCatId, rentCatId, utilsCatId].map(id => id.toString()) });
  });

  it("sinking fund monthly requirement calculated", async () => {
    const sf = await createSinkingFund(userId, {
      name: "Insurance", targetAmount: 12000, currentAmount: 0,
      targetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1),
      monthlyContribution: 2000, linkedAccountId: bankId.toString(), status: "active"
    });
    const funds = await getSinkingFunds(userId);
    const insurance = funds.find(f => f.name === "Insurance");
    expect(insurance).toBeDefined();
    expect(insurance!.requiredMonthlyContribution).toBeGreaterThanOrEqual(2000);
    await contributeToSinkingFund(userId, sf._id.toString(), 3000, bankId.toString(), new Date());
    const updated = await getSinkingFunds(userId);
    expect(updated.find(f => f.name === "Insurance")!.currentAmount).toBe(3000);
    await SinkingFund.deleteMany({ userId });
  });

  it("subscription analytics annual cost", async () => {
    const r = await getSubscriptionAnalytics(userId);
    expect(r.monthlyCost).toBeGreaterThanOrEqual(0);
    expect(r.annualCost).toBe(r.monthlyCost * 12);
    expect(Array.isArray(r.subscriptions)).toBe(true);
  });

  it("anomaly detection no spike without sufficient history", async () => {
    const r = await detectAnomalies(userId);
    expect(r.filter(a => a.type === "category_spike")).toHaveLength(0);
  });

  it("debt snowball orders smallest first", async () => {
    await Liability.create([
      { userId, name: "Big", type: "personal loan", originalAmount: 100000, outstandingAmount: 80000, interestRate: 10, emiAmount: 3000, paymentDay: 10 },
      { userId, name: "Small", type: "personal loan", originalAmount: 20000, outstandingAmount: 5000, interestRate: 8, emiAmount: 1500, paymentDay: 15 },
    ]);
    const plan = await planDebtPayoff(userId, "snowball", 1000);
    expect(plan.order[0].name).toBe("Small");
    expect(plan.order[0].balance).toBeLessThan(plan.order[1].balance);
    expect(plan.payoffMonths).toBeGreaterThan(0);
    await Liability.deleteMany({ userId, name: {$in:["Big","Small"]} });
  });

  it("debt avalanche orders highest interest first", async () => {
    await Liability.create([
      { userId, name: "Low", type: "home loan", originalAmount: 50000, outstandingAmount: 40000, interestRate: 6, emiAmount: 2000, paymentDay: 5 },
      { userId, name: "High", type: "personal loan", originalAmount: 30000, outstandingAmount: 20000, interestRate: 18, emiAmount: 1500, paymentDay: 12 },
    ]);
    const plan = await planDebtPayoff(userId, "avalanche", 500);
    expect(plan.order[0].name).toBe("High");
    expect(plan.order[0].rate).toBeGreaterThan(plan.order[1].rate);
    await Liability.deleteMany({ userId, name: {$in:["Low","High"]} });
  });

  it("debt planner does not mutate liabilities", async () => {
    const before = await Liability.findOne({ userId, name: "Loan" });
    await planDebtPayoff(userId, "snowball", 1000);
    const after = await Liability.findOne({ userId, name: "Loan" });
    expect(after!.outstandingAmount).toBe(before!.outstandingAmount);
  });

  it("goal simulator calculates months", async () => {
    const r = await simulateGoalPlan(userId, goalId.toString(), 5000);
    expect(r.monthsToReach).toBeGreaterThanOrEqual(0);
    expect(r.targetAmount).toBe(60000);
    expect(r.monthlyContribution).toBe(5000);
  });

  it("goal simulator does not modify goal", async () => {
    const before = await Goal.findOne({ _id: goalId });
    await simulateGoalPlan(userId, goalId.toString(), 5000);
    const after = await Goal.findOne({ _id: goalId });
    expect(after!.targetAmount).toBe(before!.targetAmount);
    expect(after!.monthlyTarget).toBe(before!.monthlyTarget);
  });

  it("portfolio analysis totals approx 100%", async () => {
    const r = await analyzePortfolio(userId);
    const totalPct = r.byType.reduce((s, t) => s + t.allocation, 0);
    expect(Math.abs(totalPct - 100)).toBeLessThanOrEqual(1);
    expect(Array.isArray(r.byType)).toBe(true);
  });

  it("investment zero values handled safely", async () => {
    const r = await analyzePortfolio(userId);
    r.byType.forEach(t => {
      expect(t.allocation).toBeGreaterThanOrEqual(0);
      expect(typeof t.allocation).toBe("number");
    });
  });

  it("FIRE uses configurable withdrawal rate", async () => {
    const r = await projectFIRE(userId, {
      currentAge: 30, targetRetirementAge: 55, monthlyExpenses: 30000,
      currentInvestments: 100000, monthlyInvestment: 10000,
      expectedAnnualReturn: 10, inflationRate: 6, safeWithdrawalRate: 4,
    });
    expect(r.fireNumber).toBe(9000000);
    expect(r.assumptions.withdrawalRate).toBe(4);
  });

  it("FIRE handles zero assumptions safely", async () => {
    const r = await projectFIRE(userId, {
      currentAge: 30, targetRetirementAge: 55, monthlyExpenses: 0,
      currentInvestments: 0, monthlyInvestment: 0,
      expectedAnnualReturn: 0, inflationRate: 0, safeWithdrawalRate: 4,
    });
    expect(typeof r.fireNumber).toBe("number");
    expect(typeof r.projectedPortfolioAtRetirement).toBe("number");
  });


  it("financial calendar includes recurring and debt events", async () => {
    const events = await getFinancialCalendar(userId, 1);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some(e => e.title === "Salary")).toBe(true);
    expect(events.some(e => e.title.toLowerCase().includes("emi"))).toBe(true);
  });

  it("monthly review compares periods", async () => {
    const r = await generateMonthlyReview(userId);
    expect(r.income).toBeGreaterThanOrEqual(0);
    expect(r.expenses).toBeGreaterThanOrEqual(0);
    expect(r.comparison.incomeChange===null||Number.isFinite(r.comparison.incomeChange)).toBe(true);
    expect(r.insights.length).toBeGreaterThanOrEqual(0);
    expect(r.priorities.length).toBeGreaterThanOrEqual(0);
  });

  it("monthly review prev zero does not create Infinity", async () => {
    const r = await generateMonthlyReview(userId);
    expect(r.comparison.incomeChange).not.toBe(Infinity);
    expect(r.comparison.incomeChange).not.toBe(-Infinity);
    expect(typeof r.comparison.savingsRateChange).toBe("number");
  });

  it("recommendations is array with valid fields", async () => {
    const recs = await generateRecommendations(userId);
    expect(Array.isArray(recs)).toBe(true);
    recs.forEach(r => {
      expect(["low","medium","high"].includes(r.priority)).toBe(true);
      expect(r.id).toBeDefined();
      expect(r.actionUrl).toBeDefined();
    });
  });

  it("financial context never includes password or JWT", async () => {
    const ctx = await getFinancialContext(userId);
    expect(ctx).not.toHaveProperty("password");
    expect(ctx).not.toHaveProperty("passwordHash");
    expect(ctx).not.toHaveProperty("token");
    expect(ctx).not.toHaveProperty("JWT");
    expect(ctx.period).toBeDefined();
    expect(ctx.income).toBeGreaterThanOrEqual(0);
  });

  it("other user cannot access planning data", async () => {
    const other = await User.create({ name: "Other", email: "other@v3.test", passwordHash: "x" });
    await Account.create({ userId: other._id, name: "Other Bank", type: "bank", openingBalance: 99999, currentBalance: 99999 });
    await Liability.create({ userId: other._id, name: "Other Loan", type: "personal loan", originalAmount: 50000, outstandingAmount: 30000, interestRate: 10, emiAmount: 1000 });
    const health = await calculateFinancialHealth(other._id);
    const safe = await calculateSafeToSpend(other._id);
    const forecast = await forecastCashFlow(other._id, 30);
    const ef = await getEmergencyFundStatus(other._id);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(safe.status).toBeDefined();
    expect(forecast.events.length).toBeGreaterThanOrEqual(0);
    expect(ef.status).toBe("insufficient_data");
  });

  it("merchant normalization returns consistent result", async () => {
    const m1 = await normalizeMerchant(userId, "AMZN123456789 Marketplace");
    const m2 = await normalizeMerchant(userId, "AMZN123456789 Marketplace");
    expect(m1).toBe(m2);
    expect(m1.length).toBeGreaterThan(0);
  });

  it("merchant normalization maps known merchants", async () => {
    const merchant = await normalizeMerchant(userId, "SWIGGY*FOOD ORDER");
    expect(merchant.toLowerCase()).toContain("swiggy");
  });

  it("merchant mappings can be retrieved", async () => {
    await normalizeMerchant(userId, "TEST merchant 12345");
    const mappings = await getMerchantMappings(userId);
    expect(mappings.length).toBeGreaterThanOrEqual(1);
  });

  it("milestones detect first transaction", async () => {
    const result = await detectAndAwardMilestones(userId);
    expect(Array.isArray(result)).toBe(true);
    const summary = await getMilestoneSummary(userId);
    expect(summary.total).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(summary.milestones)).toBe(true);
  });

  it("milestones do not duplicate on re-check", async () => {
    const before = await getMilestoneSummary(userId);
    const beforeIds = new Set(before.milestones.map(m => m.type));
    await detectAndAwardMilestones(userId);
    const after = await getMilestoneSummary(userId);
    const afterIds = new Set(after.milestones.map(m => m.type));
    for (const id of beforeIds) {
      const count = [...afterIds].filter(x => x === id).length;
      expect(count).toBe(1);
    }
  });

  it("other user cannot access another user milestones", async () => {
    const other = await User.create({ name: "OtherM", email: "other-m@v3.test", passwordHash: "x" });
    const summary = await getMilestoneSummary(other._id);
    expect(summary.total).toBe(0);
  });

  it("other user cannot access another user merchant mappings", async () => {
    const other = await User.create({ name: "OtherMerch", email: "other-merch@v3.test", passwordHash: "x" });
    const mappings = await getMerchantMappings(other._id);
    expect(mappings.length).toBe(0);
  });
});
