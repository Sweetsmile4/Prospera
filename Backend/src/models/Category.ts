import { Schema, model } from "mongoose";
export const categoryTypes = ["income", "expense", "investment"] as const;
const categorySchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: categoryTypes, required: true },
  icon: { type: String, default: "circle" },
  isDefault: { type: Boolean, default: false },
  isEssential: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
categorySchema.index({ userId: 1, name: 1, type: 1 }, { unique: true });
export const Category = model("Category", categorySchema);
