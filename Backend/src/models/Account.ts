import { Schema, model } from "mongoose";

export const accountTypes = ["bank", "cash", "wallet", "savings", "investment"] as const;
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: accountTypes, required: true },
  institutionName: { type: String, trim: true },
  openingBalance: { type: Number, required: true, default: 0 },
  currentBalance: { type: Number, required: true, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
accountSchema.index({ userId: 1, name: 1 });
export const Account = model("Account", accountSchema);
