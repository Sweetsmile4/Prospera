import { Schema, model } from "mongoose";
export const transactionTypes = ["income", "expense", "saving", "investment", "transfer"] as const;
const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: transactionTypes, required: true, index: true },
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0.01 },
  accountId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  destinationAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
  goalId: { type: Schema.Types.ObjectId, ref: "Goal" },
  description: { type: String, trim: true },
  originalDescription: { type: String, trim: true },
  normalizedMerchant: { type: String, trim: true, index: true },
  attentionFlags: [{ type: String, enum: ["uncategorized", "possible_duplicate", "possible_subscription", "unusual", "large_transaction"] }],
  attentionResolved: [{ type: String }],
  source: { type: String, enum: ["manual", "recurring", "import"], default: "manual", index: true },
  tags: { type: [String], default: [] },
  referenceNumber: { type: String, trim: true },
  recurringTransactionId: { type: Schema.Types.ObjectId, ref: "RecurringTransaction" },
  importBatchId: { type: Schema.Types.ObjectId, ref: "ImportBatch" },
  scheduledDate: Date,
  metadata: {
    kind: { type: String, enum: ["liability_payment", "goal_withdrawal", "investment_activity", "sinking_fund_contribution"] },
    sinkingFundId: { type: Schema.Types.ObjectId, ref: "SinkingFund" },
    liabilityId: { type: Schema.Types.ObjectId, ref: "Liability" },
    investmentHoldingId: { type: Schema.Types.ObjectId, ref: "InvestmentHolding" },
    principalAmount: Number, interestAmount: Number, activity: String, units: Number, costBasis: Number,
  },
  transactionDate: { type: Date, required: true, index: true },
}, { timestamps: true });
transactionSchema.index({ userId: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, type: 1, transactionDate: -1 });
transactionSchema.index({ userId: 1, accountId: 1, transactionDate: -1 });
transactionSchema.index({ recurringTransactionId: 1, scheduledDate: 1 }, { unique: true, sparse: true });
export const Transaction = model("Transaction", transactionSchema);
