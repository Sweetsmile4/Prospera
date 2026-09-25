import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { processDueRecurring } from "../services/recurring";

export const systemRouter = Router();

systemRouter.post("/recurring/process", asyncHandler(async (_req, res) => {
  const result = await processDueRecurring();
  res.json({ success: true, data: result });
}));

systemRouter.get("/recurring/status", asyncHandler(async (_req, res) => {
  const { RecurringTransaction } = await import("../models/RecurringTransaction.js");
  const due = await RecurringTransaction.countDocuments({ isActive: true, autoCreate: true, nextRunDate: { $lte: new Date() } });
  res.json({ success: true, data: { job: "recurring-processor", due, worker: "internal" } });
}));