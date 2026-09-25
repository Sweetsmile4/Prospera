import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../models/User";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Budget } from "../models/Budget";
import { Goal } from "../models/Goal";
import { Transaction } from "../models/Transaction";
import { RecurringTransaction } from "../models/RecurringTransaction";
import { Liability } from "../models/Liability";
import { Notification } from "../models/Notification";
import { FinancialPreference } from "../models/FinancialPreference";
import { refreshNotifications } from "./notifications";
import { createTransaction } from "./transactions";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let replSet: MongoMemoryReplSet;
let userId: Types.ObjectId;
let bank: any, foodCat: any;
let now: Date, dayOfMonth: number;

describe("Notification preferences", () => {
  beforeAll(async () => {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.MONGOMS_SYSTEM_BINARY || "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 });
    const user = await User.create({ name: "T", email: "nt@test.dev", passwordHash: "x" });
    userId = user._id;
    bank = await Account.create({ userId, name: "HDFC", type: "bank", openingBalance: 100000, currentBalance: 100000 });
    foodCat = await Category.create({ userId: null, name: "Food", type: "expense", isDefault: true });
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); if (replSet) await replSet.stop(); });
  beforeEach(async () => {
    await Promise.all([Notification, FinancialPreference, Budget, Goal, Transaction, RecurringTransaction, Liability].map(m => (m as any).deleteMany({})));
    now = new Date();
    dayOfMonth = now.getDate();
  });

  it("generates a budget alert when enabled and the budget is exceeded", async () => {
    await Budget.create({ userId, scope: "overall", month: now.getMonth() + 1, year: now.getFullYear(), limit: 1000 });
    await createTransaction(userId, { type: "expense", title: "Food", amount: 2000, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(now.getFullYear(), now.getMonth(), 10) });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "budget_exceeded" })).toBeTruthy();
  });

  it("respects a disabled budgetAlerts preference", async () => {
    await FinancialPreference.create({ userId, notificationPreferences: { budgetAlerts: false } });
    await Budget.create({ userId, scope: "overall", month: now.getMonth() + 1, year: now.getFullYear(), limit: 1000 });
    await createTransaction(userId, { type: "expense", title: "Food", amount: 2000, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(now.getFullYear(), now.getMonth(), 10) });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "budget_exceeded" })).toBeFalsy();
  });

  it("disabling a category preserves existing notification history", async () => {
    await FinancialPreference.create({ userId, notificationPreferences: { budgetAlerts: false } });
    await Notification.create({ userId, type: "budget_exceeded", title: "Overall spending budget exceeded", message: "Existing", actionUrl: "/budgets", isRead: false, eventKey: "budget_exceeded:old" });
    const before = await Notification.countDocuments({ userId });
    await Budget.create({ userId, scope: "overall", month: now.getMonth() + 1, year: now.getFullYear(), limit: 1000 });
    await createTransaction(userId, { type: "expense", title: "Food", amount: 2000, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(now.getFullYear(), now.getMonth(), 10) });
    await refreshNotifications(userId);
    const after = await Notification.countDocuments({ userId });
    expect(after).toBe(before);
    expect(await Notification.exists({ userId, type: "budget_exceeded", title: "Overall spending budget exceeded" })).toBeTruthy();
  });

  it("uses defaults (all on) when no preference document exists", async () => {
    await Budget.create({ userId, scope: "overall", month: now.getMonth() + 1, year: now.getFullYear(), limit: 100 });
    await createTransaction(userId, { type: "expense", title: "Food", amount: 500, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(now.getFullYear(), now.getMonth(), 10) });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "budget_exceeded" })).toBeTruthy();
  });

  it("respects disabled billReminders", async () => {
    const due = new Date(now.getTime() + 2 * 864e5);
    await RecurringTransaction.create({ userId, title: "Netflix", type: "expense", amount: 649, accountId: bank._id, frequency: "monthly", startDate: now, nextRunDate: due, isBill: true, isActive: true, autoCreate: false });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "bill_due" })).toBeTruthy();
    await Notification.deleteMany({});
    await FinancialPreference.create({ userId, notificationPreferences: { billReminders: false } });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "bill_due" })).toBeFalsy();
  });

  it("respects disabled debtReminders", async () => {
    await FinancialPreference.create({ userId, notificationPreferences: { debtReminders: false } });
    const lastDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const paymentDay = dayOfMonth < lastDate ? dayOfMonth + 1 : 1;
    await Liability.create({ userId, name: "Loan", type: "education loan", originalAmount: 50000, outstandingAmount: 40000, interestRate: 8.5, emiAmount: 2500, paymentDay });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "loan_due" })).toBeFalsy();
  });

  it("respects enabled debtReminders", async () => {
    await FinancialPreference.create({ userId, notificationPreferences: { debtReminders: true } });
    const lastDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const paymentDay = dayOfMonth < lastDate ? dayOfMonth + 1 : 1;
    await Liability.create({ userId, name: "Loan", type: "education loan", originalAmount: 50000, outstandingAmount: 40000, interestRate: 8.5, emiAmount: 2500, paymentDay });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "loan_due" })).toBeTruthy();
  });

  it("respects disabled goalMilestones", async () => {
    await FinancialPreference.create({ userId, notificationPreferences: { goalMilestones: false } });
    const goal = await Goal.create({ userId, name: "Emergency Fund", targetAmount: 2000 });
    await createTransaction(userId, { type: "saving", title: "Contribution", amount: 2000, accountId: String(bank._id), goalId: String(goal._id), transactionDate: now });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "goal_reached" })).toBeFalsy();
    await Notification.deleteMany({});
    await FinancialPreference.updateOne({ userId }, { notificationPreferences: { goalMilestones: true } });
    await refreshNotifications(userId);
    expect(await Notification.exists({ userId, type: "goal_reached" })).toBeTruthy();
  });
});