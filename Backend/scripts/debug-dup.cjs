const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { Schema } = mongoose;
const fs = require("node:fs");
require("dotenv").config();

const debug = async () => {
  process.env.MONGOMS_SYSTEM_BINARY = fs.existsSync("C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe") ? "C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe" : undefined;
  const rs = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(rs.getUri(), { serverSelectionTimeoutMS: 30000 });
  // minimal models
  const userSchema = new Schema({ name: String }); const User = mongoose.model("User", userSchema);
  const accountSchema = new Schema({ userId: Schema.Types.ObjectId, name: String, type: String, openingBalance: Number, currentBalance: Number });
  const Account = mongoose.model("Account", accountSchema);
  const categorySchema = new Schema({ userId: Schema.Types.ObjectId, name: String, type: String, isDefault: Boolean });
  const Category = mongoose.model("Category", categorySchema);
  const txSchema = new Schema({ userId: Schema.Types.ObjectId, type: String, title: String, amount: Number, accountId: Schema.Types.ObjectId, categoryId: Schema.Types.ObjectId, transactionDate: Date }, { timestamps: true });
  const Transaction = mongoose.model("Transaction", txSchema);

  const u = await User.create({ name: "x" });
  const a = await Account.create({ userId: u._id, name: "SBI", type: "bank", openingBalance: 50000, currentBalance: 50000 });
  const cat = await Category.create({ userId: null, name: "Other", type: "expense", isDefault: true });
  const date = new Date(Date.now() - 5 * 864e5);
  const c = await Transaction.create({ userId: u._id, type: "expense", title: "Amazon  Shop", amount: 500, accountId: a._id, categoryId: cat._id, transactionDate: date });
  const row = { date, description: "  amazon   shop  ", amount: 500, type: "expense" };
  const dates = [date.getTime()];
  const existing = await Transaction.find({ userId: u._id, accountId: a._id, transactionDate: { $gte: new Date(Math.min(...dates)), $lte: new Date(Math.max(...dates) + 864e5) } });
  const norm = (v) => v.trim().toLowerCase().replace(/\s+/g, " ");
  const dup = existing.some(t => Math.abs(t.amount - row.amount) < 0.001 && new Date(t.transactionDate).toDateString() === row.date.toDateString() && norm(t.title) === norm(row.description));
  console.log("stored title:", JSON.stringify(c.title), "amount:", c.amount);
  console.log("existing count:", existing.length);
  console.log("dup detected:", dup);
  await mongoose.disconnect();
  await rs.stop();
};
debug().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });