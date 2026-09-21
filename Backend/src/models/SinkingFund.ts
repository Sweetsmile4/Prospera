import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  targetAmount: { type: Number, min: 0.01, required: true },
  currentAmount: { type: Number, default: 0, min: 0 },
  targetDate: { type: Date, required: true },
  monthlyContribution: { type: Number, default: 0, min: 0 },
  linkedAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
  status: { type: String, enum: ["active", "completed", "paused", "archived"], default: "active" },
}, { timestamps: true });
schema.index({ userId: 1, status: 1 });
export const SinkingFund = model("SinkingFund", schema);