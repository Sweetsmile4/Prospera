import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: [
    "first_10k_saved", "first_50k_saved", "first_100k_saved", "first_500k_saved", "first_1m_saved",
    "net_worth_50k", "net_worth_100k", "net_worth_500k", "net_worth_1m",
    "emergency_fund_1_month", "emergency_fund_3_months", "emergency_fund_6_months",
    "debt_50pct_repaid", "debt_fully_repaid",
    "goal_completed", "positive_net_worth",
    "first_transaction", "savings_rate_20pct"
  ], required: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  achievedAt: { type: Date, default: Date.now },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });
schema.index({ userId: 1, type: 1 }, { unique: true });
export const FinancialMilestone = model("FinancialMilestone", schema);
