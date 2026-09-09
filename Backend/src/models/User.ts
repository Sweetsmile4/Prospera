import { Schema, model } from "mongoose";

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  currency: { type: String, default: "INR" },
}, { timestamps: true });

export const User = model("User", userSchema);
