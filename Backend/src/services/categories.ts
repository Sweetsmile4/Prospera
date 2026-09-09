import { Category } from "../models/Category";
export const defaults = {
  expense: ["Food", "Shopping", "Travel", "Rent", "Bills", "Subscriptions", "Entertainment", "Healthcare", "Education", "Other"],
  income: ["Salary", "Freelance", "Bonus", "Interest", "Refund", "Other"],
  investment: ["Mutual Fund", "SIP", "Stock", "FD", "RD", "Gold", "PPF", "Other"],
} as const;
export const ensureDefaultCategories = async () => {
  for (const [type, names] of Object.entries(defaults)) for (const name of names)
    await Category.updateOne({ userId: null, type, name } as any, { $setOnInsert: { userId: null, type, name, isDefault: true } }, { upsert: true });
};
