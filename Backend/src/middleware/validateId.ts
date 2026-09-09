import type { RequestHandler } from "express";
import { Types } from "mongoose";
import { AppError } from "../utils/errors";

export const validateId: RequestHandler = (req,_res,next) => {
  const id=String(req.params.id||"");
  if(!Types.ObjectId.isValid(id)) return next(new AppError(400,"Invalid resource ID"));
  next();
};
