import {Types} from "mongoose";
import {Liability} from "../models/Liability";
import {Goal} from "../models/Goal";
import {Transaction} from "../models/Transaction";
import {getEmergencyFundStatus} from "./emergencyFund";
import {periodFacts,budgetFacts,monthStart,monthEnd} from "./planningFacts";
export type HealthScore={
 status:"ok"|"insufficient_data";score:number;rating:"poor"|"fair"|"good"|"excellent";
 breakdown:Record<string,{score:number;max:number;detail:string}>;explanation:string[];
};
export async function calculateFinancialHealth(userId:Types.ObjectId):Promise<HealthScore>{
 const now=new Date(),from=monthStart(now);
 const [facts,emergency,budgets,debts,goals,count]=await Promise.all([
 periodFacts(userId,from,now),getEmergencyFundStatus(userId),budgetFacts(userId,now),
 Liability.find({userId,status:"active",outstandingAmount:{$gt:0}}),
 Goal.find({userId,status:"active"}),Transaction.countDocuments({userId,transactionDate:{$lte:now}})]);
 const savingsRate=facts.savingsRate;
 const savingsScore=savingsRate>=30?25:savingsRate>=20?20:savingsRate>=10?14:savingsRate>0?7:0;
 const emergencyScore=emergency.status==="ok"&&emergency.monthsCovered!==null?Math.round(Math.min(1,Math.max(0,emergency.monthsCovered/emergency.targetMonths))*20):0;
 const payments=debts.reduce((s,d)=>s+d.emiAmount,0),ratio=facts.income>0?payments/facts.income:null;
 const highInterest=debts.some(d=>d.interestRate>12);
 const debtScore=!debts.length?20:ratio===null?0:Math.max(0,(ratio<=.2?20:ratio<=.36?15:ratio<=.5?8:2)-(highInterest?4:0));
 const exceeded=budgets.filter(b=>b.spent>b.limit).length,budgetScore=budgets.length?Math.round(15*(1-exceeded/budgets.length)):15;
 let observed=0,positive=0;
 for(let i=1;i<=3;i++){const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-i,1));
  if(await Transaction.exists({userId,transactionDate:{$gte:date,$lte:monthEnd(date)}})){observed++;const f=await periodFacts(userId,date,monthEnd(date));if(f.cashFlow>=0)positive++;}}
 const stabilityScore=observed?Math.round(10*positive/observed):0;
 const sums=await Transaction.aggregate([{$match:{userId,goalId:{$in:goals.map(g=>g._id)},type:"saving",transactionDate:{$lte:now}}},{$group:{_id:"$goalId",saved:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]);
 const progress=goals.length?goals.reduce((s,g)=>s+Math.min(1,Math.max(0,(sums.find(x=>String(x._id)===g.id)?.saved||0)/g.targetAmount)),0)/goals.length:0;
 const breakdown={
 savingsRate:{score:savingsScore,max:25,detail:facts.income>0?savingsRate.toFixed(1)+"% net saving/investment contributions relative to income":"No recorded income this month"},
 emergencyFund:{score:emergencyScore,max:20,detail:emergency.status==="ok"?emergency.monthsCovered!.toFixed(1)+" months of designated emergency savings":emergency.reasons.join(" ")},
 debtBurden:{score:debtScore,max:20,detail:!debts.length?"No active tracked debt":ratio===null?"Debt exists but income is missing":(ratio*100).toFixed(1)+"% required payments / income"+(highInterest?"; high-interest debt adjustment −4":"")},
 budgetDiscipline:{score:budgetScore,max:15,detail:budgets.length?exceeded+" of "+budgets.length+" budgets exceeded":"No budgets configured; no penalty applied"},
 cashFlowStability:{score:stabilityScore,max:10,detail:positive+" nonnegative cash-flow months out of "+observed+" observed completed months"},
 goalProgress:{score:Math.round(progress*10),max:10,detail:Math.round(progress*100)+"% mean completion across "+goals.length+" active goals"}
 };
 const score=count?Math.max(0,Math.min(100,Object.values(breakdown).reduce((s,b)=>s+b.score,0))):0;
 return {status:!count||!observed?"insufficient_data":"ok",score,rating:score>=80?"excellent":score>=60?"good":score>=40?"fair":"poor",breakdown,explanation:Object.values(breakdown).map(b=>b.detail)};
}
