import { Types } from "mongoose";
import { Transaction } from "../models/Transaction";
import { Account } from "../models/Account";
import { Budget } from "../models/Budget";
import { totals } from "./analytics";

export const liquidTypes = ["bank","cash","wallet"] as const;
export const roundMoney = (n:number) => Math.round((n + Number.EPSILON)*100)/100;
export const monthStart = (date=new Date()) => new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),1));
export const monthEnd = (date=new Date()) => new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1)-1);
export async function periodFacts(userId:Types.ObjectId,from:Date,to:Date) {
  const summary=await totals(userId,from,to);
  const debt=await Transaction.aggregate([
    {$match:{userId,"metadata.kind":"liability_payment",transactionDate:{$gte:from,$lte:to}}},
    {$group:{_id:null,payments:{$sum:"$amount"},principal:{$sum:{$ifNull:["$metadata.principalAmount","$amount"]}},interest:{$sum:{$ifNull:["$metadata.interestAmount",0]}}}}
  ]);
  const accounts=await Account.find({userId,type:{$in:liquidTypes}}).select("_id");
  const ids=accounts.map(a=>a._id);
  const flows=await Transaction.aggregate([
    {$match:{userId,transactionDate:{$gte:from,$lte:to}}},
    {$project:{amount:1,source:{$in:["$accountId",ids]},destination:{$in:["$destinationAccountId",ids]},type:1,reverse:{$or:[{$eq:["$metadata.kind","goal_withdrawal"]},{$and:[{$eq:["$metadata.kind","investment_activity"]},{$in:["$metadata.activity",["sell","withdrawal"]]}]}]}}},
    {$group:{_id:null,cashFlow:{$sum:{$multiply:["$amount",{$cond:["$reverse",{$subtract:[{$cond:["$source",1,0]},{$cond:["$destination",1,0]}]},{$cond:[{$eq:["$type","income"]},{$cond:["$source",1,0]},{$add:[{$cond:["$source",-1,0]},{$cond:[{$and:["$destination",{$in:["$type",["transfer","saving","investment"]]}]},1,0]}]}]}]}]}}}}
  ]);
  return {...summary,debtPayments:debt[0]?.payments||0,debtPrincipal:debt[0]?.principal||0,debtInterest:debt[0]?.interest||0,cashFlow:roundMoney(flows[0]?.cashFlow||0)};
}
export async function budgetFacts(userId:Types.ObjectId,date=new Date()) {
  const from=monthStart(date),to=monthEnd(date);
  const budgets=await Budget.find({userId,month:date.getUTCMonth()+1,year:date.getUTCFullYear()}).populate("categoryId");
  const rows=await Transaction.aggregate([{$match:{userId,type:"expense",transactionDate:{$gte:from,$lte:to}}},{$group:{_id:"$categoryId",spent:{$sum:"$amount"}}}]);
  const total=rows.reduce((s,r)=>s+r.spent,0);
  return budgets.map(b=>({id:b.id,name:(b.categoryId as any)?.name||"Overall spending",limit:b.limit,spent:b.scope==="overall"?total:rows.find(r=>String(r._id)===String((b.categoryId as any)?._id))?.spent||0}));
}
