import type { RequestHandler } from "express";
import { AppError } from "../utils/errors";

export const requireCronSecret: RequestHandler = (req, _res, next) => {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers["x-cron-secret"];
  if (!secret) return next(new AppError(503, "Cron processing is not configured"));
  if (!supplied || supplied !== secret) return next(new AppError(401, "Invalid cron secret"));
  next();
};