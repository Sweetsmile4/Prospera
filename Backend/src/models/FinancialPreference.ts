import { Schema, model } from "mongoose";
const schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  essentialCategories: [{ type: Schema.Types.ObjectId, ref: "Category" }],
  essentialCategoriesConfigured: { type: Boolean, default: false },
  emergencyFundTargetMonths: { type: Number, default: 6, min: 1, max: 24 },
  emergencyFundGoalId: { type: Schema.Types.ObjectId, ref: "Goal" },
  emergencyFundAccountId: { type: Schema.Types.ObjectId, ref: "Account" },
  preferredDebtStrategy: { type: String, enum: ["snowball", "avalanche", "custom"], default: "avalanche" },
  monthlySavingsTarget: { type: Number, default: 0, min: 0 },
  monthlyInvestmentTarget: { type: Number, default: 0, min: 0 },
  safeToSpendReserve: { type: Number, default: 0, min: 0 },
  notificationPreferences: {
    budgetAlerts: { type: Boolean, default: true },
    billReminders: { type: Boolean, default: true },
    goalMilestones: { type: Boolean, default: true },
    debtReminders: { type: Boolean, default: true },
    unusualSpending: { type: Boolean, default: true },
    monthlyReview: { type: Boolean, default: true },
  },
  fireSettings: {
    currentAge: { type: Number, min: 18, max: 100 },
    retirementAge: { type: Number, min: 30, max: 100 },
    expectedAnnualReturn: { type: Number, default: 10, min: 0, max: 30 },
    inflationRate: { type: Number, default: 6, min: 0, max: 20 },
    safeWithdrawalRate: { type: Number, default: 4, min: 1, max: 10 },
  },
}, { timestamps: true });
export const FinancialPreference = model("FinancialPreference", schema);
