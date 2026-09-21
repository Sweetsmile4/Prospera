import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import { getFinancialPreference, updateFinancialPreference } from "../services/financialPreferences";
import { getDataConfidence } from "../services/dataConfidence";
import { calculateFinancialHealth } from "../services/financialHealth";
import { calculateSafeToSpend } from "../services/safeToSpend";
import { forecastCashFlow, forecastMonth } from "../services/forecasting";
import { getEmergencyFundStatus } from "../services/emergencyFund";
import { getSinkingFunds, createSinkingFund, contributeToSinkingFund } from "../services/sinkingFund";
import { getSubscriptionAnalytics, detectPossibleSubscriptions } from "../services/subscriptionAnalytics";
import { detectAnomalies } from "../services/anomalyDetection";
import { planDebtPayoff } from "../services/debtPlanner";
import { simulateGoalPlan, requiredMonthlyForGoal } from "../services/goalPlanner";
import { analyzePortfolio } from "../services/portfolioAnalysis";
import {simulateScenario} from "../services/scenarioPlanner";
import { projectFIRE, fireSchema } from "../services/firePlanner";
import { getFinancialCalendar } from "../services/financialCalendar";
import { generateMonthlyReview } from "../services/monthlyReview";
import { generateRecommendations } from "../services/recommendation";
import { getFinancialContext } from "../services/financialContext";
import { validateReferences } from "../services/references";
import { normalizeMerchant, getMerchantMappings, updateMerchantMapping, deleteMerchantMapping, applyMerchantNormalization } from "../services/merchantNormalization";
import { detectAndAwardMilestones, getMilestones, getMilestoneSummary } from "../services/financialMilestone";
import { MerchantMapping } from "../models/MerchantMapping";
import {SinkingFund} from "../models/SinkingFund";
import {Transaction} from "../models/Transaction";
import {AppError} from "../utils/errors";
import {validateId} from "../middleware/validateId";

export const v3Router = Router();
v3Router.post("/planning/fire",asyncHandler(async(req,res)=>res.json({success:true,data:await projectFIRE(req.userId,fireSchema.parse(req.body))})));
v3Router.post("/planning/scenario",asyncHandler(async(req,res)=>res.json({success:true,data:await simulateScenario(req.userId,req.body)})));
const fundUpdate=z.object({name:z.string().trim().min(1).max(100).optional(),targetAmount:z.number().positive().optional(),targetDate:z.coerce.date().optional(),monthlyContribution:z.number().nonnegative().optional(),status:z.enum(["active","paused","completed","archived"]).optional()});
v3Router.put("/sinking-funds/:id",validateId,asyncHandler(async(req,res)=>{
 const data=fundUpdate.parse(req.body);
 const fund=await SinkingFund.findOneAndUpdate({_id:req.params.id,userId:req.userId},data,{returnDocument:"after",runValidators:true});
 if(!fund)throw new AppError(404,"Sinking fund not found");
 res.json({success:true,data:fund});
}));
v3Router.delete("/sinking-funds/:id",validateId,asyncHandler(async(req,res)=>{
 const fund=await SinkingFund.findOneAndUpdate({_id:req.params.id,userId:req.userId},{status:"archived"},{returnDocument:"after"});
 if(!fund)throw new AppError(404,"Sinking fund not found");
 res.json({success:true,data:fund});
}));
v3Router.get("/sinking-funds/:id/history",validateId,asyncHandler(async(req,res)=>{
 if(!await SinkingFund.exists({_id:req.params.id,userId:req.userId}))throw new AppError(404,"Sinking fund not found");
 res.json({success:true,data:await Transaction.find({userId:req.userId,"metadata.sinkingFundId":req.params.id}).sort({transactionDate:-1}).limit(200)});
}));

const preferencesSchema = z.object({
  essentialCategories: z.array(z.string()).optional(),
  emergencyFundTargetMonths: z.number().int().min(1).max(24).optional(),
  emergencyFundGoalId: z.string().nullable().optional(),
  emergencyFundAccountId: z.string().nullable().optional(),
  preferredDebtStrategy: z.enum(["snowball", "avalanche", "custom"]).optional(),
  monthlySavingsTarget: z.number().nonnegative().optional(),
  monthlyInvestmentTarget: z.number().nonnegative().optional(),
  safeToSpendReserve: z.number().nonnegative().optional(),
  notificationPreferences: z.object({
    budgetAlerts: z.boolean().optional(), billReminders: z.boolean().optional(), goalMilestones: z.boolean().optional(),
    debtReminders: z.boolean().optional(), unusualSpending: z.boolean().optional(), monthlyReview: z.boolean().optional(),
  }).optional(),
  fireSettings: z.object({
    currentAge: z.number().int().min(18).max(100).optional(), retirementAge: z.number().int().min(30).max(100).optional(),
    expectedAnnualReturn: z.number().min(0).max(30).optional(), inflationRate: z.number().min(0).max(20).optional(), safeWithdrawalRate: z.number().min(1).max(10).optional(),
  }).optional(),
});

v3Router.get("/financial-preferences", asyncHandler(async (req, res) => res.json({ success: true, data: await getFinancialPreference(req.userId) })));
v3Router.put("/financial-preferences", asyncHandler(async (req, res) => { const data = preferencesSchema.parse(req.body); res.json({ success: true, data: await updateFinancialPreference(req.userId, data) }); }));
v3Router.get("/data-confidence", asyncHandler(async (req, res) => res.json({ success: true, data: await getDataConfidence(req.userId) })));
v3Router.get("/financial-health", asyncHandler(async (req, res) => res.json({ success: true, data: await calculateFinancialHealth(req.userId) })));
v3Router.get("/safe-to-spend", asyncHandler(async (req, res) => res.json({ success: true, data: await calculateSafeToSpend(req.userId) })));
v3Router.get("/forecast/cash-flow", asyncHandler(async (req, res) => res.json({ success: true, data: await forecastCashFlow(req.userId, Number(req.query.days) || 30) })));
v3Router.get("/forecast/month", asyncHandler(async (req, res) => res.json({ success: true, data: await forecastMonth(req.userId) })));
v3Router.get("/emergency-fund", asyncHandler(async (req, res) => res.json({ success: true, data: await getEmergencyFundStatus(req.userId) })));
v3Router.get("/sinking-funds", asyncHandler(async (req, res) => res.json({ success: true, data: await getSinkingFunds(req.userId) })));
v3Router.post("/sinking-funds", asyncHandler(async (req, res) => { const d = z.object({ name: z.string(), targetAmount: z.number().positive(), targetDate: z.coerce.date(), monthlyContribution: z.number().optional(), linkedAccountId: z.string().optional(), categoryId: z.string().optional() }).parse(req.body); await validateReferences(req.userId, d); res.status(201).json({ success: true, data: await createSinkingFund(req.userId, d) }); }));
v3Router.post("/sinking-funds/:id/contribute", asyncHandler(async (req, res) => { const d = z.object({ amount: z.number().positive(), accountId: z.string(), date: z.coerce.date() }).parse(req.body); res.status(201).json({ success: true, data: await contributeToSinkingFund(req.userId, req.params.id as string, d.amount, d.accountId, d.date) }); }));
v3Router.get("/subscriptions/analytics", asyncHandler(async (req, res) => res.json({ success: true, data: await getSubscriptionAnalytics(req.userId) })));
v3Router.get("/subscriptions/detect", asyncHandler(async (req, res) => res.json({ success: true, data: await detectPossibleSubscriptions(req.userId) })));
v3Router.get("/insights/anomalies", asyncHandler(async (req, res) => res.json({ success: true, data: await detectAnomalies(req.userId) })));
v3Router.post("/planning/debt", asyncHandler(async (req, res) => { const d = z.object({ strategy: z.enum(["snowball", "avalanche", "custom"]), extraPayment: z.number().nonnegative().default(0),customOrder:z.array(z.string()).default([]) }).parse(req.body); res.json({ success: true, data: await planDebtPayoff(req.userId, d.strategy, d.extraPayment,d.customOrder) }); }));
v3Router.post("/planning/goal/simulate", asyncHandler(async (req, res) => { const d = z.object({ goalId: z.string(), monthlyContribution: z.number().nonnegative() }).parse(req.body); res.json({ success: true, data: await simulateGoalPlan(req.userId, d.goalId, d.monthlyContribution) }); }));
v3Router.post("/planning/goal/required", asyncHandler(async (req, res) => { const d = z.object({ goalId: z.string(),targetDate:z.coerce.date().optional() }).parse(req.body); res.json({ success: true, data: await requiredMonthlyForGoal(req.userId, d.goalId,d.targetDate) }); }));
v3Router.get("/planning/portfolio", asyncHandler(async (req, res) => res.json({ success: true, data: await analyzePortfolio(req.userId) })));
v3Router.get("/planning/fire", asyncHandler(async (req, res) => res.json({ success: true, data: await projectFIRE(req.userId) })));
v3Router.get("/calendar/financial", asyncHandler(async (req, res) => res.json({ success: true, data: await getFinancialCalendar(req.userId, Number(req.query.months) || 1) })));
v3Router.get("/monthly-review", asyncHandler(async (req, res) => res.json({ success: true, data: await generateMonthlyReview(req.userId, req.query.year ? Number(req.query.year) : undefined, req.query.month ? Number(req.query.month) - 1 : undefined) })));
v3Router.get("/recommendations", asyncHandler(async (req, res) => res.json({ success: true, data: await generateRecommendations(req.userId) })));
v3Router.get("/financial-context", asyncHandler(async (req, res) => res.json({ success: true, data: await getFinancialContext(req.userId) })));

v3Router.get("/merchants", asyncHandler(async (req, res) => res.json({ success: true, data: await getMerchantMappings(req.userId) })));
v3Router.put("/merchants/:id", validateId, asyncHandler(async (req, res) => {
  const data = z.object({ normalizedMerchant: z.string().trim().min(1).max(100).optional(), categoryId: z.string().optional() }).parse(req.body);
  const mapping = await updateMerchantMapping(req.userId, req.params.id as string, data);
  if (!mapping) throw new AppError(404, "Merchant mapping not found");
  res.json({ success: true, data: mapping });
}));
v3Router.delete("/merchants/:id", validateId, asyncHandler(async (req, res) => {
  const mapping = await deleteMerchantMapping(req.userId, req.params.id as string);
  if (!mapping) throw new AppError(404, "Merchant mapping not found");
  res.json({ success: true, data: mapping });
}));
v3Router.post("/merchants/normalize", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await applyMerchantNormalization(req.userId) });
}));
v3Router.post("/merchants/normalize-one", asyncHandler(async (req, res) => {
  const d = z.object({ description: z.string().min(1) }).parse(req.body);
  res.json({ success: true, data: { normalizedMerchant: await normalizeMerchant(req.userId, d.description) } });
}));

v3Router.get("/milestones", asyncHandler(async (req, res) => res.json({ success: true, data: await getMilestoneSummary(req.userId) })));
v3Router.post("/milestones/detect", asyncHandler(async (req, res) => {
  const newMilestones = await detectAndAwardMilestones(req.userId);
  res.json({ success: true, data: { newMilestones, count: newMilestones.length } });
}));
