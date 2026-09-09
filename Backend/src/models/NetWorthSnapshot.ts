import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  assets: { type: Number, required: true }, liabilities: { type: Number, default: 0 },
  netWorth: { type: Number, required: true }, snapshotDate: { type: Date, required: true },
}, { timestamps: true });
schema.index({ userId: 1, snapshotDate: 1 }, { unique: true });
export const NetWorthSnapshot = model("NetWorthSnapshot", schema);
