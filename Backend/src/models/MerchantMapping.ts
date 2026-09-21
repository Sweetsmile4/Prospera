import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  originalDescription: { type: String, required: true, trim: true },
  normalizedMerchant: { type: String, required: true, trim: true },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category" },
  occurrenceCount: { type: Number, default: 1, min: 1 },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });
schema.index({ userId: 1, originalDescription: 1 }, { unique: true });
export const MerchantMapping = model("MerchantMapping", schema);
