import { Types } from "mongoose";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { createTransaction } from "./transactions";
import { AppError } from "../utils/errors";
export async function recordInvestmentActivity(userId:Types.ObjectId,id:string,input:{activity:"buy"|"sell"|"contribution"|"withdrawal";amount:number;units?:number;accountId:string;date:Date}) {
  const holding=await InvestmentHolding.findOne({_id:id,userId});
  if(!holding) throw new AppError(404,"Investment not found");
  const transaction=await createTransaction(userId,{type:"investment",title:`${holding.name} ${input.activity}`,amount:input.amount,accountId:input.accountId,transactionDate:input.date,metadata:{kind:"investment_activity",investmentHoldingId:id,activity:input.activity,units:input.units??0}});
  return {transaction,holding:await InvestmentHolding.findOne({_id:id,userId})};
}
