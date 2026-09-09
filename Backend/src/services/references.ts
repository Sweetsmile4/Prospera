import { Types } from "mongoose";
import { Account } from "../models/Account";
import { Goal } from "../models/Goal";
import { Category } from "../models/Category";
import { AppError } from "../utils/errors";

export async function validateReferences(userId:Types.ObjectId, data:any) {
  for (const key of ["accountId","destinationAccountId"]) if(data[key]) {
    if(!Types.ObjectId.isValid(String(data[key])) || !await Account.exists({_id:data[key],userId,isActive:true}))
      throw new AppError(400,"Account is invalid, inactive, or not yours");
  }
  if(data.goalId && (!Types.ObjectId.isValid(String(data.goalId)) || !await Goal.exists({_id:data.goalId,userId,status:{$ne:"archived"}}))) throw new AppError(400,"Invalid goal");
  if(data.categoryId && (!Types.ObjectId.isValid(String(data.categoryId)) || !await Category.exists({_id:data.categoryId,$or:[{userId},{userId:null}],isActive:true}))) throw new AppError(400,"Invalid category");
}
