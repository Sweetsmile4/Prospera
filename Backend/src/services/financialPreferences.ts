import { Types } from "mongoose";
import { FinancialPreference } from "../models/FinancialPreference";
import { Category } from "../models/Category";
import { Goal } from "../models/Goal";
import { Account } from "../models/Account";
import { AppError } from "../utils/errors";

export const defaultPreferences = {
  essentialCategories: [] as string[],
  emergencyFundTargetMonths: 6,
  preferredDebtStrategy: "avalanche" as const,
  monthlySavingsTarget: 0,
  monthlyInvestmentTarget: 0,
  safeToSpendReserve: 0,
  notificationPreferences: {
    budgetAlerts: true,
    billReminders: true,
    goalMilestones: true,
    debtReminders: true,
    unusualSpending: true,
    monthlyReview: true,
  },
  fireSettings: {
    expectedAnnualReturn: 10,
    inflationRate: 6,
    safeWithdrawalRate: 4,
  },
};

export async function getFinancialPreference(userId: Types.ObjectId) {
  const pref = await FinancialPreference.findOne({ userId });
  // Reading a forecast or simulation must not persist defaults.
  return pref || new FinancialPreference({ userId, ...defaultPreferences });
}

export async function updateFinancialPreference(userId: Types.ObjectId, data: any) {
  const existing = await getFinancialPreference(userId);
  const allowed = ["essentialCategories", "emergencyFundTargetMonths", "emergencyFundGoalId", "emergencyFundAccountId", "preferredDebtStrategy", "monthlySavingsTarget", "monthlyInvestmentTarget", "safeToSpendReserve", "notificationPreferences", "fireSettings"];
  const update = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  if (data.essentialCategories !== undefined) {
    const ids = [...new Set(data.essentialCategories.map(String))];
    if (ids.some(id => !Types.ObjectId.isValid(String(id)))) throw new AppError(400, "Invalid essential categories");
    const valid = await Category.countDocuments({ _id: { $in: ids }, $or: [{userId}, {userId:null}], type: "expense", isActive: true });
    if (valid !== ids.length) throw new AppError(400, "Invalid essential categories");
    update.essentialCategories = ids;
    update.essentialCategoriesConfigured = true;
  }
  if (update.emergencyFundGoalId && (!Types.ObjectId.isValid(String(update.emergencyFundGoalId)) || !await Goal.exists({_id:update.emergencyFundGoalId,userId,status:{$ne:"archived"}}))) throw new AppError(400,"Invalid emergency fund goal");
  if (update.emergencyFundAccountId && (!Types.ObjectId.isValid(String(update.emergencyFundAccountId)) || !await Account.exists({_id:update.emergencyFundAccountId,userId,isActive:true,type:{$in:["bank","cash","wallet","savings"]}}))) throw new AppError(400,"Invalid emergency fund account");
  const goalId=update.emergencyFundGoalId===null?null:update.emergencyFundGoalId||existing.emergencyFundGoalId;
  const accountId=update.emergencyFundAccountId===null?null:update.emergencyFundAccountId||existing.emergencyFundAccountId;
  if(goalId&&accountId) throw new AppError(400,"Choose one emergency fund: an account or a goal");
  if(update.notificationPreferences) update.notificationPreferences={...existing.toObject().notificationPreferences,...update.notificationPreferences as object};
  if(update.fireSettings) update.fireSettings={...existing.toObject().fireSettings,...update.fireSettings as object};
  Object.assign(existing, update);
  await existing.save();
  return existing;
}

export async function getEssentialCategoryIds(userId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const pref = await getFinancialPreference(userId);
  const ids = pref.essentialCategories.map((c: any) => String(c));
  if (pref.essentialCategoriesConfigured || ids.length > 0) {
    const found = await Category.find({ _id: { $in: pref.essentialCategories }, $or:[{userId},{userId:null}], type:"expense", isActive: true }).select("_id");
    return found.map(c => c._id);
  }
  const defaults = await Category.find({ isDefault: true, isEssential: true, type: "expense", isActive: true }).select("_id");
  return defaults.map(c => c._id);
}
