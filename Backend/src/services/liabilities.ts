import { Types } from "mongoose";
import { Liability } from "../models/Liability";
import { createTransaction } from "./transactions";
import { AppError } from "../utils/errors";
export async function recordLiabilityPayment(userId:Types.ObjectId,id:string,input:{amount:number;principalAmount?:number;interestAmount?:number;accountId:string;date:Date}) {
  const debt=await Liability.findOne({_id:id,userId});
  if(!debt) throw new AppError(404,"Liability not found");
  const principal=input.principalAmount??input.amount-(input.interestAmount??0);
  const transaction=await createTransaction(userId,{type:"saving",title:`${debt.name} payment`,amount:input.amount,accountId:input.accountId,transactionDate:input.date,metadata:{kind:"liability_payment",liabilityId:id,principalAmount:principal,interestAmount:input.interestAmount??input.amount-principal,activity:"payment"}});
  return {transaction,liability:await Liability.findOne({_id:id,userId})};
}
