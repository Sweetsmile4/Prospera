import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import fs from "node:fs";
import path from "node:path";
import jwt from "jsonwebtoken";
import request from "supertest";
import app from "../app";
import { User } from "../models/User";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Goal } from "../models/Goal";
import { Budget } from "../models/Budget";
import { Transaction } from "../models/Transaction";
import { Liability } from "../models/Liability";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Notification } from "../models/Notification";
import { ImportBatch } from "../models/ImportBatch";
import { createTransaction, updateTransaction } from "./transactions";
import { payOccurrence, processDueRecurring } from "./recurring";
import { recordLiabilityPayment } from "./liabilities";
import { recordInvestmentActivity } from "./investments";
import { captureNetWorth } from "./netWorth";
import { totals } from "./analytics";
import { refreshNotifications } from "./notifications";
import { ensureDefaultCategories } from "./categories";
import { AppError } from "../utils/errors";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

function resolveMongod(): string | undefined {
  if (process.env.MONGOMS_SYSTEM_BINARY) return process.env.MONGOMS_SYSTEM_BINARY;
  const scan = (root: string): string | undefined => {
    try {
      for (const entry of fs.readdirSync(root)) {
        const candidate = path.join(root, entry, "bin", "mongod.exe");
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch { /* directory may not exist */ }
    return undefined;
  };
  const programFiles = process.env.PROGRAMFILES || "C:\\Program Files";
  return scan(path.join(programFiles, "MongoDB", "Server")) || scan("C:\\Program Files (x86)\\MongoDB\\Server");
}

let replSet: MongoMemoryReplSet | undefined;
let userA: any, userB: any;
let accountA: any, cashA: any, savingsA: any, accountB: any;
let expenseCat: any, foodCat: any, incomeCat: any;

const token = (user: any) => jwt.sign({}, "test-secret", { subject: String(user._id) });

function categoryDoc(name: string, type = "expense"): any {
  return { userId: null, name, type, isDefault: true };
}

async function expense(userId: Types.ObjectId, accountId: string, amount: number, title: string, date?: Date, categoryId?: string) {
  return createTransaction(userId, { type: "expense", title, amount, accountId, categoryId: categoryId || String(expenseCat._id), transactionDate: date || new Date() });
}
describe("V2 integration: recurring, import, liabilities, investments, goals, budgets, net worth, ownership", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = "test-secret";
    const detected = resolveMongod();
    if (detected) process.env.MONGOMS_SYSTEM_BINARY = detected;
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
    
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 });
    await ensureDefaultCategories();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  });

  beforeEach(async () => {
    for (const model of [User, Account, Category, Goal, Budget, Transaction, Liability, InvestmentHolding, RecurringTransaction, Notification, ImportBatch]) {
      await (model as any).deleteMany({});
    }
    const cats = await Category.create([
      categoryDoc("Other", "expense"), categoryDoc("Food", "expense"), categoryDoc("Rent", "expense"), categoryDoc("Subscriptions", "expense"),
      categoryDoc("Salary", "income"), categoryDoc("Freelance", "income"), categoryDoc("SIP", "investment"),
    ]);
    expenseCat = cats[0]; foodCat = cats[1]; incomeCat = cats[4];
    const [a, b] = await User.create([{ name: "A", email: "a@test.dev", passwordHash: "x" }, { name: "B", email: "b@test.dev", passwordHash: "x" }]);
    userA = a; userB = b;
    const accounts = await Account.create([
      { userId: a._id, name: "SBI", type: "bank", openingBalance: 50000, currentBalance: 50000 },
      { userId: a._id, name: "Cash", type: "cash", openingBalance: 20000, currentBalance: 20000 },
      { userId: a._id, name: "Emergency", type: "savings", openingBalance: 31000, currentBalance: 31000 },
      { userId: b._id, name: "Other User Account", type: "bank", openingBalance: 9000, currentBalance: 9000 },
    ]);
    accountA = accounts[0]; cashA = accounts[1]; savingsA = accounts[2]; accountB = accounts[3];
  });
it("recurring expense generates exactly one transaction and decreases the account", async () => {
    const rule = await RecurringTransaction.create({ userId: userA._id, title: "Rent", type: "expense", amount: 8000, accountId: accountA._id, categoryId: expenseCat._id, frequency: "monthly", startDate: new Date(Date.now() - 40 * 864e5), nextRunDate: new Date(Date.now() - 30 * 864e5) });
    const first = await payOccurrence(userA._id, String(rule._id), rule.nextRunDate);
    expect(first.generated).toBe(true);
    const second = await payOccurrence(userA._id, String(rule._id), rule.nextRunDate);
    expect(second.generated).toBe(false);
    const txs = await Transaction.find({ userId: userA._id, recurringTransactionId: rule._id });
    expect(txs).toHaveLength(1);
    expect(txs[0].source).toBe("recurring");
    expect(txs[0].amount).toBe(8000);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(50000 - 8000, 2);
  });

  it("recurring salary increases the correct account", async () => {
    const rule = await RecurringTransaction.create({ userId: userA._id, title: "Salary", type: "income", amount: 25000, accountId: accountA._id, categoryId: incomeCat._id, frequency: "monthly", startDate: new Date(Date.now() - 40 * 864e5), nextRunDate: new Date(Date.now() - 30 * 864e5) });
    const result = await payOccurrence(userA._id, String(rule._id));
    expect(result.generated).toBe(true);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(50000 + 25000, 2);
  });

  it("the recurring processor cannot duplicate transactions across catch-up runs", async () => {
    await RecurringTransaction.create({ userId: userA._id, title: "Netflix", type: "expense", amount: 649, accountId: accountA._id, categoryId: expenseCat._id, frequency: "monthly", startDate: new Date(Date.now() - 90 * 864e5), nextRunDate: new Date(Date.now() - 75 * 864e5) });
    const first = await processDueRecurring(userA._id);
    expect(first.generated).toBeGreaterThan(0);
    const countAfterFirst = await Transaction.countDocuments({ userId: userA._id, source: "recurring" });
    const second = await processDueRecurring(userA._id);
    expect(second.generated).toBe(0);
    expect(await Transaction.countDocuments({ userId: userA._id, source: "recurring" })).toBe(countAfterFirst);
  });

  it("recurring processor respects autoCreate=false and endDate", async () => {
    await RecurringTransaction.create({ userId: userA._id, title: "Manual bill", type: "expense", amount: 500, accountId: accountA._id, frequency: "monthly", startDate: new Date(Date.now() - 40 * 864e5), nextRunDate: new Date(Date.now() - 30 * 864e5), autoCreate: false });
    const result = await processDueRecurring(userA._id);
    expect(result.generated).toBe(0);
    expect(await Transaction.countDocuments({ userId: userA._id })).toBe(0);
    const ended = await RecurringTransaction.create({ userId: userA._id, title: "Done", type: "expense", amount: 100, accountId: accountA._id, frequency: "monthly", startDate: new Date(Date.now() - 40 * 864e5), nextRunDate: new Date(Date.now() - 10 * 864e5), endDate: new Date(Date.now() - 20 * 864e5) });
    const endedResult = await payOccurrence(userA._id, String(ended._id));
    expect(endedResult.generated).toBe(false);
    expect((await RecurringTransaction.findById(ended._id) as any).isActive).toBe(false);
  });
it("import preview flags CSV-style duplicates using normalized description", async () => {
    const sameDay = new Date(Date.now() - 5 * 864e5);
    await expense(userA._id, String(accountA._id), 500, "Amazon  Shop", new Date(sameDay));
    const res = await request(app).post("/api/imports/preview").set("Authorization", `Bearer ${token(userA)}`).send({
      fileName: "aug.csv", accountId: String(accountA._id),
      rows: [
        { date: new Date(sameDay), description: "  amazon   shop  ", amount: 500, type: "expense" },
        { date: new Date(Date.now() - 3 * 864e5), description: "Fresh invoice", amount: 250, type: "expense" },
      ],
    });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data[0].possibleDuplicate).toBe(true);
    expect(data[1].possibleDuplicate).toBe(false);
  });

  it("importing an expense reduces the chosen account and records the batch", async () => {
    const res = await request(app).post("/api/imports/commit").set("Authorization", `Bearer ${token(userA)}`).send({
      fileName: "statement-aug.csv", accountId: String(accountA._id),
      rows: [
        { date: new Date(Date.now() - 4 * 864e5), description: "Big Bazaar", amount: 1200, type: "expense" },
        { date: new Date(Date.now() - 4 * 864e5), description: "Credit salary", amount: 3000, type: "income", skip: true },
      ],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.skipped).toBe(1);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(50000 - 1200, 2);
    const imported = await Transaction.findOne({ userId: userA._id, title: "Big Bazaar" }) as any;
    expect(imported).not.toBeNull();
    expect(imported.source).toBe("import");
    expect(String(imported.importBatchId)).toBe(String(res.body.data.batch._id));
    expect(await ImportBatch.countDocuments({ userId: userA._id })).toBe(1);
  });

  it("imported duplicate rows are skipped unless importAnyway is set", async () => {
    const row = { date: new Date(Date.now() - 2 * 864e5), description: "Swiggy", amount: 340, type: "expense" };
    await expense(userA._id, String(accountA._id), 340, "Swiggy", row.date);
    const preview = await request(app).post("/api/imports/preview").set("Authorization", `Bearer ${token(userA)}`).send({ fileName: "s.csv", accountId: String(accountA._id), rows: [{ ...row, date: row.date }] });
    expect(preview.body.data[0].possibleDuplicate).toBe(true);
    const skipped = await request(app).post("/api/imports/commit").set("Authorization", `Bearer ${token(userA)}`).send({ fileName: "s.csv", accountId: String(accountA._id), rows: [{ ...row }] });
    expect(skipped.body.data.imported).toBe(0);
    const forced = await request(app).post("/api/imports/commit").set("Authorization", `Bearer ${token(userA)}`).send({ fileName: "s.csv", accountId: String(accountA._id), rows: [{ ...row, importAnyway: true }] });
    expect(forced.body.data.imported).toBe(1);
  });
it("liability payment decreases outstanding balance and is not counted as an expense", async () => {
    const debt = await Liability.create({ userId: userA._id, name: "Education Loan", type: "education loan", originalAmount: 60000, outstandingAmount: 40000, interestRate: 8.5, emiAmount: 2500, paymentDay: 5, accountId: accountA._id });
    const before = (await Account.findById(accountA._id) as any).currentBalance;
    const result = await recordLiabilityPayment(userA._id, String(debt._id), { amount: 2500, principalAmount: 2000, interestAmount: 500, accountId: String(accountA._id), date: new Date() });
    expect((result.liability as any).outstandingAmount).toBeCloseTo(38000, 2);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(before - 2500, 2);
    const tx = await Transaction.findOne({ userId: userA._id, "metadata.kind": "liability_payment" }) as any;
    expect(tx).not.toBeNull();
    expect(tx.type).toBe("saving");
    expect(tx.metadata.principalAmount).toBeCloseTo(2000, 2);
    const totalsNow = await totals(userA._id, new Date(Date.now() - 15 * 864e5), new Date());
    expect(totalsNow.expenses).toBe(0);
    const worth = await captureNetWorth(userA._id);
    expect(worth.liabilities).toBeCloseTo(38000, 2);
  });

  it("credit card payment does not double-count card spending as a new expense", async () => {
    await expense(userA._id, String(accountA._id), 3000, "Card purchase", new Date(Date.now() - 10 * 864e5));
    const card = await Liability.create({ userId: userA._id, name: "Card", type: "credit card", originalAmount: 3000, outstandingAmount: 3000, creditLimit: 10000, statementDay: 1, dueDay: 15, accountId: accountA._id });
    await recordLiabilityPayment(userA._id, String(card._id), { amount: 3000, principalAmount: 3000, accountId: String(accountA._id), date: new Date() });
    const totalsNow = await totals(userA._id, new Date(Date.now() - 15 * 864e5), new Date());
    expect(totalsNow.expenses).toBeCloseTo(3000, 2);
    const payment = await Transaction.findOne({ userId: userA._id, "metadata.kind": "liability_payment" });
    expect(payment).not.toBeNull();
    expect((payment as any).type).toBe("saving");
    expect(totalsNow.expenses).not.toBeCloseTo(6000, 2);
  });

  it("investment contribution reduces cash and updates holding values", async () => {
    const holding = await InvestmentHolding.create({ userId: userA._id, name: "Mutual Fund", type: "mutual fund", investedAmount: 30000, currentValue: 33500, units: 100, accountId: accountA._id });
    const before = (await Account.findById(accountA._id) as any).currentBalance;
    await recordInvestmentActivity(userA._id, String(holding._id), { activity: "contribution", amount: 3000, accountId: String(accountA._id), date: new Date() });
    const after = await InvestmentHolding.findById(holding._id) as any;
    expect(after.investedAmount).toBeCloseTo(33000, 2);
    expect(after.currentValue).toBeCloseTo(36500, 2);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(before - 3000, 2);
  });

  it("investment sale increases cash and reduces holding values", async () => {
    const holding = await InvestmentHolding.create({ userId: userA._id, name: "Stock", type: "stock", investedAmount: 10000, currentValue: 12000, units: 10, accountId: accountA._id });
    const before = (await Account.findById(accountA._id) as any).currentBalance;
    await recordInvestmentActivity(userA._id, String(holding._id), { activity: "sell", amount: 2400, units: 2, accountId: String(accountA._id), date: new Date() });
    const after = await InvestmentHolding.findById(holding._id) as any;
    expect(after.investedAmount).toBeCloseTo(8000, 2);
    expect(after.currentValue).toBeCloseTo(9600, 2);
    expect(after.units).toBeCloseTo(8, 6);
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(before + 2400, 2);
  });
it("goal withdrawal reduces progress correctly and records history", async () => {
    const goal = await Goal.create({ userId: userA._id, name: "Emergency Fund", targetAmount: 80000, monthlyTarget: 5000 });
    await createTransaction(userA._id, { type: "saving", title: "contribution", amount: 40000, accountId: String(accountA._id), goalId: String(goal._id), transactionDate: new Date(Date.now() - 20 * 864e5) });
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(10000, 2);
    const withdraw = await createTransaction(userA._id, { type: "saving", title: "Emergency Fund withdrawal", amount: 5000, accountId: String(cashA._id), goalId: String(goal._id), transactionDate: new Date(), metadata: { kind: "goal_withdrawal", activity: "withdrawal" } });
    expect(withdraw.metadata!.kind).toBe("goal_withdrawal");
    const [aggregate] = await Transaction.aggregate([
      { $match: { userId: userA._id, type: "saving", goalId: goal._id } },
      { $group: { _id: null, total: { $sum: { $cond: [{ $eq: ["$metadata.kind", "goal_withdrawal"] }, { $multiply: ["$amount", -1] }, "$amount"] } } } },
    ]);
    expect(aggregate.total).toBeCloseTo(35000, 2);
    const worth = await captureNetWorth(userA._id);
    expect(worth.assetBreakdown.goalReserves).toBeCloseTo(35000, 2);
    const history = await Transaction.countDocuments({ userId: userA._id, goalId: goal._id });
    expect(history).toBeGreaterThanOrEqual(2);
  });

  it("budget notification thresholds fire at 90% and 100%", async () => {
    await Budget.create({ userId: userA._id, categoryId: foodCat._id, month: new Date().getMonth() + 1, year: new Date().getFullYear(), limit: 5000 });
    await expense(userA._id, String(accountA._id), 4500, "Groceries", new Date(), String(foodCat._id));
    await refreshNotifications(userA._id);
    expect(await Notification.countDocuments({ userId: userA._id, type: "budget_warning" })).toBe(1);
    await expense(userA._id, String(accountA._id), 900, "More groceries", new Date(), String(foodCat._id));
    await refreshNotifications(userA._id);
    expect(await Notification.countDocuments({ userId: userA._id, type: "budget_exceeded" })).toBe(1);
  });

  it("overall monthly spending budget is respected by notifications and analytics", async () => {
    await Budget.create({ userId: userA._id, scope: "overall", month: new Date().getMonth() + 1, year: new Date().getFullYear(), limit: 20000 });
    await expense(userA._id, String(accountA._id), 16000, "Rent", new Date());
    await refreshNotifications(userA._id);
    expect(await Notification.countDocuments({ userId: userA._id, type: "budget_warning" })).toBe(1);
    const list = await request(app).get("/api/budgets").set("Authorization", `Bearer ${token(userA)}`);
    expect(list.status).toBe(200);
    const overall = list.body.data.find((b: any) => b.scope === "overall");
    expect(overall.spent).toBeCloseTo(16000, 2);
    expect(overall.remaining).toBeCloseTo(4000, 2);
  });

  it("net worth equals assets minus liabilities and includes holdings", async () => {
    await InvestmentHolding.create({ userId: userA._id, name: "MF", type: "mutual fund", investedAmount: 30000, currentValue: 33500, accountId: accountA._id });
    await Liability.create({ userId: userA._id, name: "Loan", type: "personal loan", originalAmount: 50000, outstandingAmount: 40000, accountId: accountA._id });
    const worth = await captureNetWorth(userA._id);
    const accountAssets = 50000 + 20000 + 31000;
    expect(worth.assets).toBeCloseTo(accountAssets + 33500, 2);
    expect(worth.liabilities).toBeCloseTo(40000, 2);
    expect(worth.netWorth).toBeCloseTo(accountAssets + 33500 - 40000, 2);
  });
it("cannot create a transaction on another user's account", async () => {
    let thrown: unknown;
    try {
      await createTransaction(userB._id, { type: "expense", title: "Fraud", amount: 100, accountId: String(accountA._id), transactionDate: new Date() });
    } catch (e) { thrown = e; }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).statusCode).toBe(400);
  });

  it("user B cannot access user A's liabilities", async () => {
    const debt = await Liability.create({ userId: userA._id, name: "A loan", type: "personal loan", originalAmount: 10000, outstandingAmount: 9000 });
    const res = await request(app).put(`/api/liabilities/${debt._id}`).set("Authorization", `Bearer ${token(userB)}`).send({ outstandingAmount: 1000 });
    expect(res.status).toBe(404);
    const payment = await request(app).post(`/api/liabilities/${debt._id}/payments`).set("Authorization", `Bearer ${token(userB)}`).send({ amount: 1000, accountId: String(accountB._id), date: new Date() });
    expect(payment.status).toBe(404);
    expect((await Liability.findById(debt._id) as any).outstandingAmount).toBeCloseTo(9000, 2);
  });

  it("user B cannot access user A's investments", async () => {
    const holding = await InvestmentHolding.create({ userId: userA._id, name: "A MF", type: "mutual fund", investedAmount: 1000, currentValue: 1100 });
    const res = await request(app).put(`/api/investments/${holding._id}`).set("Authorization", `Bearer ${token(userB)}`).send({ currentValue: 5000 });
    expect(res.status).toBe(404);
    const activity = await request(app).post(`/api/investments/${holding._id}/activities`).set("Authorization", `Bearer ${token(userB)}`).send({ activity: "contribution", amount: 500, accountId: String(accountB._id), date: new Date() });
    expect(activity.status).toBe(404);
    expect((await InvestmentHolding.findById(holding._id) as any).currentValue).toBeCloseTo(1100, 2);
  });

  it("user B cannot pay user A's recurring rule", async () => {
    const rule = await RecurringTransaction.create({ userId: userA._id, title: "A bill", type: "expense", amount: 200, accountId: accountA._id, frequency: "monthly", startDate: new Date(Date.now() - 30 * 864e5), nextRunDate: new Date(Date.now() - 10 * 864e5) });
    const res = await request(app).post(`/api/recurring/${rule._id}/pay`).set("Authorization", `Bearer ${token(userB)}`).send({ scheduledDate: new Date() });
    expect([404, 409]).toContain(res.status);
    expect(await Transaction.countDocuments({ userId: userA._id, recurringTransactionId: rule._id })).toBe(0);
  });

  it("editing a transaction reverses the old impact and applies the new one", async () => {
    const created = await expense(userA._id, String(accountA._id), 2000, "Food", new Date(Date.now() - 3 * 864e5));
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(48000, 2);
    
    await updateTransaction(userA._id, String(created._id), { type: "expense", title: "Food bigger", amount: 3500, accountId: String(cashA._id), transactionDate: created.transactionDate });
    expect((await Account.findById(accountA._id) as any).currentBalance).toBeCloseTo(50000, 2);
    expect((await Account.findById(cashA._id) as any).currentBalance).toBeCloseTo(20000 - 3500, 2);
  });
});
