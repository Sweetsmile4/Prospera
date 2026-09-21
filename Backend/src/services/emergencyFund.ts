import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { Account } from "../models/Account";
import { Goal } from "../models/Goal";
import { getFinancialPreference, getEssentialCategoryIds } from "./financialPreferences";
import { monthStart, roundMoney } from "./planningFacts";

export type EmergencyFundStatus = {
 status:"ok"|"insufficient_data"; reasons:string[];
 currentAmount:number;monthlyEssentials:number;monthsCovered:number|null;
 targetMonths:number;targetAmount:number;gap:number;estimatedCompletionDate:string|null;
 historyMonths:number;monthlyContribution:number;
};
export async function getEmergencyFundStatus(userId:Types.ObjectId):Promise<EmergencyFundStatus>{
 const pref=await getFinancialPreference(userId), now=new Date(), reasons:string[]=[];
 let currentAmount=0,monthlyContribution=pref.monthlySavingsTarget;
 if(pref.emergencyFundGoalId){
  const goal=await Goal.findOne({_id:pref.emergencyFundGoalId,userId,status:{$ne:"archived"}});
  if(goal){
   const saved=await Transaction.aggregate([{$match:{userId,goalId:goal._id,type:"saving",transactionDate:{$lte:now}}},{$group:{_id:null,total:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]);
   currentAmount=Math.max(0,saved[0]?.total||0);monthlyContribution=goal.monthlyTarget;
  }else reasons.push("The selected emergency goal is unavailable.");
 }else if(pref.emergencyFundAccountId){
  const account=await Account.findOne({_id:pref.emergencyFundAccountId,userId,isActive:true,type:{$in:["bank","cash","wallet","savings"]}});
  if(account)currentAmount=Math.max(0,account.currentBalance);else reasons.push("The selected emergency account is unavailable.");
 }else reasons.push("Choose an account or goal for emergency savings.");
 const ids=await getEssentialCategoryIds(userId);
 if(!ids.length)reasons.push("Choose essential expense categories.");
 const end=monthStart(now),start=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-3,1));
 const earliest=await Transaction.findOne({userId,transactionDate:{$lt:end}}).sort({transactionDate:1}).select("transactionDate");
 let historyMonths=0;
 if(earliest){const first=monthStart(earliest.transactionDate);historyMonths=Math.min(3,Math.max(0,(end.getUTCFullYear()-first.getUTCFullYear())*12+end.getUTCMonth()-first.getUTCMonth()));}
 if(!historyMonths)reasons.push("Add a completed month of expense history.");
 const spending=await Transaction.aggregate([{$match:{userId,type:"expense",categoryId:{$in:ids},transactionDate:{$gte:start,$lt:end}}},{$group:{_id:null,total:{$sum:"$amount"}}}]);
 const monthlyEssentials=historyMonths?roundMoney((spending[0]?.total||0)/historyMonths):0;
 if(!monthlyEssentials)reasons.push("No positive essential spending baseline is available.");
 const targetMonths=pref.emergencyFundTargetMonths,targetAmount=roundMoney(monthlyEssentials*targetMonths),gap=Math.max(0,targetAmount-currentAmount);
 const monthsCovered=monthlyEssentials>0?currentAmount/monthlyEssentials:null;
 let estimatedCompletionDate:string|null=null;
 if(!reasons.length&&monthlyContribution>0){const date=new Date(end);date.setUTCMonth(date.getUTCMonth()+Math.ceil(gap/monthlyContribution));estimatedCompletionDate=date.toISOString().slice(0,10);}
 return {status:reasons.length?"insufficient_data":"ok",reasons,currentAmount,monthlyEssentials,monthsCovered,targetMonths,targetAmount,gap,estimatedCompletionDate,historyMonths,monthlyContribution};
}
