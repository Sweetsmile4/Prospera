import type { ClientSession,Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { SinkingFund } from "../models/SinkingFund";
import { Account } from "../models/Account";
import { NetWorthSnapshot } from "../models/NetWorthSnapshot";
import { Liability } from "../models/Liability"; import { InvestmentHolding } from "../models/InvestmentHolding";
export const readNetWorth=(userId:Types.ObjectId)=>captureNetWorth(userId,undefined,false);

export async function captureNetWorth(userId:Types.ObjectId,session?:ClientSession,capture=true){
  const accounts=await Account.find({userId}).session(session||null); const holdings=await InvestmentHolding.find({userId}).session(session||null); const debts=await Liability.find({userId}).session(session||null);
  const reserves=await Transaction.aggregate([{$match:{userId,type:"saving",goalId:{$ne:null},destinationAccountId:null}},{$group:{_id:null,total:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]).session(session||null);
  const goalReserves=reserves[0]?.total||0;
  const funds=await SinkingFund.find({userId,linkedAccountId:null}).session(session||null);
  const sinkingReserves=funds.reduce((sum,f)=>sum+f.currentAmount,0);
  const linked=new Set(holdings.map(h=>String(h.accountId)).filter(Boolean));const accountAssets=accounts.reduce((sum,a)=>sum+(a.type==="investment"&&linked.has(String(a._id))?0:a.currentBalance),0),investmentAssets=holdings.reduce((s,h)=>s+h.currentValue,0),assets=accountAssets+investmentAssets+goalReserves+sinkingReserves,liabilities=debts.reduce((s,d)=>s+d.outstandingAmount,0),netWorth=assets-liabilities;
  const now=new Date(),snapshotDate=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  if(capture) await NetWorthSnapshot.findOneAndUpdate({userId,snapshotDate},{assets,liabilities,netWorth},{upsert:true,returnDocument: "after",session});
  return {assets,liabilities,netWorth,accounts,holdings,debts,assetBreakdown:{accounts:accountAssets,investments:investmentAssets,goalReserves,sinkingReserves}};
}
