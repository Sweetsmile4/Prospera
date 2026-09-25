import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose, { Types } from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { User } from "../models/User";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Transaction } from "../models/Transaction";
import { createTransaction, updateTransaction } from "./transactions";
import { detectAttentionFlags, getAttentionSummary, getAttentionItems, resolveAttentionFlags, recategorizeAttentionTransaction } from "./attention";

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });
let replSet: MongoMemoryReplSet;
let userId: Types.ObjectId;
let bank: any, salaryCat: any;
const THROUGH = new Date(2026, 4, 15, 12, 0, 0);

describe("Attention flags", () => {
  beforeAll(async () => {
    process.env.MONGOMS_SYSTEM_BINARY = process.env.MONGOMS_SYSTEM_BINARY || "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe";
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(replSet.getUri(), { serverSelectionTimeoutMS: 30_000 });
    const user = await User.create({ name: "A", email: "att@test.dev", passwordHash: "x" });
    userId = user._id;
    bank = await Account.create({ userId, name: "SBI", type: "bank", openingBalance: 500000, currentBalance: 500000 });
    const foodCat = await Category.create({ userId: null, name: "Food", type: "expense", isDefault: true });
    const rentCat = await Category.create({ userId: null, name: "Rent", type: "expense", isDefault: true });
    salaryCat = await Category.create({ userId: null, name: "Salary", type: "income", isDefault: true });

    const y = THROUGH.getFullYear(), m = THROUGH.getMonth();
    await Transaction.create({ userId, type: "income", title: "Salary", amount: 50000, accountId: bank._id, transactionDate: new Date(y, m, 1) });
    await Transaction.create({ userId, type: "expense", title: "Zomato", amount: 200, accountId: bank._id, categoryId: foodCat._id, transactionDate: new Date(y, m, 2, 10, 0) });
    await Transaction.create({ userId, type: "expense", title: "Zomato", amount: 200, accountId: bank._id, categoryId: foodCat._id, transactionDate: new Date(y, m, 2, 11, 0) });
    await Transaction.create({ userId, type: "expense", title: "Rent", amount: 100, accountId: bank._id, categoryId: rentCat._id, transactionDate: new Date(y, m - 2, 5) });
    await Transaction.create({ userId, type: "expense", title: "Rent", amount: 100, accountId: bank._id, categoryId: rentCat._id, transactionDate: new Date(y, m - 1, 5) });
    await Transaction.create({ userId, type: "expense", title: "Rent", amount: 500, accountId: bank._id, categoryId: rentCat._id, transactionDate: new Date(y, m, 3) });
    for (let i = 0; i < 5; i++) {
      await Transaction.create({ userId, type: "expense", title: `Groceries ${i}`, amount: 100 + i, accountId: bank._id, categoryId: foodCat._id, transactionDate: new Date(y, m - 2 + Math.floor(i / 2), 1 + i * 2) });
    }
    await Transaction.create({ userId, type: "expense", title: "Groceries big", amount: 20000, accountId: bank._id, categoryId: foodCat._id, transactionDate: new Date(y, m, 4) });
    await createTransaction(userId, { type: "expense", title: "Netflix", amount: 649, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(2026, 2, 1), source: "manual" });
    await createTransaction(userId, { type: "expense", title: "Netflix", amount: 649, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(2026, 3, 1), source: "manual" });
    await createTransaction(userId, { type: "expense", title: "Netflix", amount: 649, accountId: String(bank._id), categoryId: String(foodCat._id), transactionDate: new Date(2026, 4, 1), source: "manual" });
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); if (replSet) await replSet.stop(); });
  beforeEach(async () => { await Transaction.updateMany({}, { $set: { attentionFlags: [], attentionResolved: [] } }); });

  it("detects uncategorized transactions", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const items = await getAttentionItems(userId, "uncategorized");
    expect(items.items.some((t: any) => t.title === "Salary")).toBe(true);
  });

  it("detects possible_duplicates on the second transaction of a same-day pair", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const items = await getAttentionItems(userId, "possible_duplicate");
    expect(items.items.length).toBe(1);
    expect(items.items[0].title).toBe("Zomato");
  });

  it("detects possible_subscription for recurring-like merchants", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const items = await getAttentionItems(userId, "possible_subscription");
    expect(items.items.length).toBe(1);
    expect(items.items[0].title).toBe("Netflix");
  });

  it("detects unusual category spikes", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const items = await getAttentionItems(userId, "unusual");
    const rentTxs = items.items.filter((t: any) => t.title === "Rent");
    expect(rentTxs.length).toBe(1);
    expect(rentTxs[0].amount).toBe(500);
  });

  it("detects large_transaction when spending far exceeds the mean", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const items = await getAttentionItems(userId, "large_transaction");
    expect(items.items.some((t: any) => t.amount === 20000)).toBe(true);
    expect(items.items.every((t: any) => t.amount === 20000 || t.title === "Rent")).toBe(true);
  });

  it("summary counts correctly", async () => {
    const summary = await getAttentionSummary(userId, THROUGH);
    expect(summary.byFlag.uncategorized).toBeGreaterThanOrEqual(1);
    expect(summary.byFlag.possible_duplicate).toBe(1);
    expect(summary.byFlag.possible_subscription).toBe(1);
    expect(summary.total).toBeGreaterThanOrEqual(5);
  });

  it("resolve removes flags and prevents re-detection", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const dupTx = (await getAttentionItems(userId, "possible_duplicate")).items[0];
    await resolveAttentionFlags(userId, dupTx._id.toString(), ["possible_duplicate"] as any);
    const after = await Transaction.findById(dupTx._id);
    expect(after!.attentionFlags).not.toContain("possible_duplicate");
    expect(after!.attentionResolved).toContain("possible_duplicate");
    await detectAttentionFlags(userId, THROUGH);
    const again = await Transaction.findById(dupTx._id);
    expect(again!.attentionFlags).not.toContain("possible_duplicate");
  });

  it("recategorize sets the category and resolves uncategorized", async () => {
    await detectAttentionFlags(userId, THROUGH);
    const uncTx = (await getAttentionItems(userId, "uncategorized")).items[0];
    await recategorizeAttentionTransaction(userId, uncTx._id.toString(), String(salaryCat._id));
    const after = await Transaction.findById(uncTx._id);
    expect(String(after!.categoryId)).toBe(String(salaryCat._id));
    expect(after!.attentionFlags).not.toContain("uncategorized");
  });
});