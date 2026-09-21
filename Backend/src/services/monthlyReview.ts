import {Types} from "mongoose";
import {Transaction} from "../models/Transaction";
import {NetWorthSnapshot} from "../models/NetWorthSnapshot";
import {Goal} from "../models/Goal";
import {periodFacts,budgetFacts,monthStart,monthEnd} from "./planningFacts";
import {AppError} from "../utils/errors";
export async function generateMonthlyReview(userId:Types.ObjectId,year?:number,month?:number){
 const now=new Date(),y=year??now.getUTCFullYear(),m=month??now.getUTCMonth();
 if(!Number.isInteger(y)||y<2000||y>2100||!Number.isInteger(m)||m<0||m>11)throw new AppError(400,"Invalid review month");
 const from=new Date(Date.UTC(y,m,1)),to=new Date(Math.min(monthEnd(from).getTime(),now.getTime())),prevFrom=new Date(Date.UTC(y,m-1,1)),prevTo=new Date(from.getTime()-1);
 const [current,previous,budgets,goals,opening,closing]=await Promise.all([
 periodFacts(userId,from,to),periodFacts(userId,prevFrom,prevTo),budgetFacts(userId,from),Goal.find({userId,createdAt:{$lte:to}}),
 NetWorthSnapshot.findOne({userId,snapshotDate:{$lt:from}}).sort({snapshotDate:-1}),NetWorthSnapshot.findOne({userId,snapshotDate:{$gte:from,$lte:to}}).sort({snapshotDate:-1})]);
 const sums=await Transaction.aggregate([{$match:{userId,type:"saving",goalId:{$in:goals.map(g=>g._id)},transactionDate:{$lte:to}}},{$group:{_id:"$goalId",value:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]);
 const goalProgress=goals.map(g=>({name:g.name,progress:Math.max(0,(sums.find(s=>String(s._id)===g.id)?.value||0)/g.targetAmount*100)}));
 const exceeded=budgets.filter(b=>b.spent>b.limit).length,netWorthChange=opening&&closing?closing.netWorth-opening.netWorth:null;
 const pct=(a:number,b:number)=>b>0?(a-b)/b*100:null;
 const insights:string[]=[],priorities:string[]=[];
 if(previous.income>0&&current.income!==previous.income)insights.push("Income "+(current.income>previous.income?"increased":"decreased")+" by "+Math.abs(pct(current.income,previous.income)!).toFixed(1)+"%.");
 if(previous.expenses>0&&current.expenses!==previous.expenses)insights.push("Expenses "+(current.expenses>previous.expenses?"increased":"decreased")+" by "+Math.abs(pct(current.expenses,previous.expenses)!).toFixed(1)+"%.");
 if(budgets.length)insights.push((budgets.length-exceeded)+" of "+budgets.length+" budgets stayed within limits.");
 if(exceeded)priorities.push("Review "+exceeded+" exceeded budget(s).");
 if(current.income>0&&current.savingsRate<20)priorities.push("Review your saving and investment targets against this month's income.");
 const behind=goals.filter(g=>g.targetDate&&g.targetDate<=to&&(sums.find(s=>String(s._id)===g.id)?.value||0)<g.targetAmount);
 if(behind.length)priorities.push("Revisit "+behind.length+" goal target date(s) that have passed.");
 return {period:y+"-"+String(m+1).padStart(2,"0"),...current,previous,debtReduction:current.debtPrincipal,netWorthChange,budgetPerformance:{total:budgets.length,within:budgets.length-exceeded,exceeded,items:budgets},goalProgress,comparison:{incomeChange:pct(current.income,previous.income),expenseChange:pct(current.expenses,previous.expenses),savingsRateChange:current.savingsRate-previous.savingsRate},insights,priorities:priorities.slice(0,3),isPartial:to.getTime()<monthEnd(from).getTime()};
}
