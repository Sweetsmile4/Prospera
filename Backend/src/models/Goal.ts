import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true, trim: true },
  targetAmount: { type: Number, min: 0.01, required: true },
  targetDate: Date,
  status: { type: String, enum: ["active", "completed", "paused", "archived"], default: "active" },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  ledgerVersion: { type: Number, default: 0 },
  monthlyTarget: { type: Number, min: 0, default: 0 },
}, { timestamps: true });
export const Goal = model("Goal", schema);
