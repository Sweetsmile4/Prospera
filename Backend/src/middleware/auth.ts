import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { AppError } from "../utils/errors";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : undefined;
  if (!token) return next(new AppError(401, "Authentication required"));
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "") as { sub: string };
    req.userId = new Types.ObjectId(payload.sub); next();
  } catch { next(new AppError(401, "Invalid or expired token")); }
};
