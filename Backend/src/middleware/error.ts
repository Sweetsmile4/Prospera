import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/errors";
export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, "Route not found"));
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return res.status(400).json({ success: false, message: err.issues[0]?.message || "Invalid input" });
  if (err?.name === "CastError") return res.status(400).json({ success: false, message: "Invalid resource ID" });
  if (err?.code === 11000) return res.status(409).json({ success: false, message: "A matching record already exists" });
  const status = err instanceof AppError ? err.statusCode : 500;
  if (status === 500) console.error(err);
  return res.status(status).json({ success: false, message: status === 500 ? "Something went wrong" : err.message });
};
