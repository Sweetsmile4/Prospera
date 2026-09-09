import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  scope: { type: String, enum: ["category", "overall"], default: "category" },
  categoryId: { type: Schema.Types.ObjectId, ref: "Category", required: [function (this: any) { return this.scope !== "overall"; }, "categoryId is required for category budgets"] },
  month: { type: Number, min: 1, max: 12, required: true },
  year: { type: Number, required: true },
  limit: { type: Number, min: 0.01, required: true },
}, { timestamps: true });
schema.index({ userId: 1, categoryId: 1, month: 1, year: 1 }, { unique: true });
export const Budget = model("Budget", schema);
