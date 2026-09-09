import { Types } from "mongoose"; import { totals } from "./analytics"; import { Liability } from "../models/Liability"; import { RecurringTransaction } from "../models/RecurringTransaction"; import { Budget } from "../models/Budget"; import { Goal } from "../models/Goal"; import { Transaction } from "../models/Transaction"; import { NetWorthSnapshot } from "../models/NetWorthSnapshot";
const inr=(n:number)=>`₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
export async function financialInsights(userId:Types.ObjectId,date=new Date()){
 const start=new Date(date.getFullYear(),date.getMonth(),1),prevStart=new Date(date.getFullYear(),date.getMonth()-1,1),prevEnd=new Date(date.getFullYear(),date.getMonth(),0,23,59,59),today=new Date(),soon=new Date(today.getTime()+7*864e5);
 const [current,previous,debt,subscriptions,budgets,categoryComparison,goals,history,upcomingBills]=await Promise.all([
  totals(userId,start,date),totals(userId,prevStart,prevEnd),
  Liability.aggregate([{$match:{userId,status:"active"}},{$group:{_id:null,total:{$sum:"$outstandingAmount"}}}]),
  RecurringTransaction.aggregate([{$match:{userId,isBill:true,isActive:true}},{$group:{_id:null,total:{$sum:"$amount"}}}]),
  Budget.find({userId,month:date.getMonth()+1,year:date.getFullYear()}).populate("categoryId"),
  Transaction.aggregate([{$match:{userId,type:"expense",transactionDate:{$gte:prevStart,$lte:prevEnd}}},{$group:{_id:"$categoryId",value:{$sum:"$amount"}}},{$lookup:{from:"categories",localField:"_id",foreignField:"_id",as:"category"}},{$project:{name:{$ifNull:[{$first:"$category.name"},"Other"]},value:1}},{$sort:{value:-1}},{$limit:1}]),
  Goal.find({userId,status:"active"}),
  NetWorthSnapshot.find({userId}).sort({snapshotDate:-1}).limit(2),
  RecurringTransaction.find({userId,isBill:true,isActive:true,nextRunDate:{$gte:today,$lte:soon}}).sort({nextRunDate:1})]);
 const items:string[]=[];
 if(previous.expenses>0){const change=(current.expenses-previous.expenses)/previous.expenses*100;items.push(`Your expenses ${change<=0?"decreased":"increased"} by ${Math.abs(change).toFixed(0)}% this month.`);}
 else if(current.expenses>0&&previous.expenses===0)items.push(`You recorded ${inr(current.expenses)} of expenses this month.`);
 if(categoryComparison[0]?.name!==undefined&&previous.expenses>0){const cat=categoryComparison[0];items.push(`Top expense last month was ${cat.name} at ${inr(cat.value)}.`);}
 if(previous.savingsRate!==current.savingsRate)items.push(`Your savings rate changed from ${previous.savingsRate.toFixed(1)}% to ${current.savingsRate.toFixed(1)}%.`);
 if(subscriptions[0]?.total)items.push(`Subscriptions cost ${inr(subscriptions[0].total)} per month.`);
 const budgetSpent=async(b:any)=>{const match:any={userId,type:"expense",transactionDate:{$gte:start,$lte:date}},catId=b.categoryId?._id??b.categoryId;if(b.scope!=="overall")match.categoryId=catId;const [r={spent:0}]=await Transaction.aggregate([{$match:match},{$group:{_id:null,spent:{$sum:"$amount"}}}]);return r.spent};
 for(const b of budgets){const spent=await budgetSpent(b),pct=b.limit?spent/b.limit*100:0,label=b.scope==="overall"?"overall spending":`${(b.categoryId as any)?.name||"this category"}`;if(pct>=100)items.push(`${label[0].toUpperCase()+label.slice(1)} is ${pct.toFixed(0)}% of the monthly budget.`);else if(pct>=80)items.push(`${label[0].toUpperCase()+label.slice(1)} is at ${pct.toFixed(0)}% of the monthly budget.`);}
 for(const g of goals){const [r={total:0}]=await Transaction.aggregate([{$match:{userId,type:"saving",goalId:g._id}},{$group:{_id:null,total:{$sum:{$cond:[{$eq:["$metadata.activity","withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]);if(g.targetAmount>0&&(r.total||0)>0)items.push(`Your ${g.name} goal is ${Math.min(100,Math.round((r.total||0)/g.targetAmount*100))}% complete.`);}
 if(history.length>=2&&(history[0].netWorth||0)!==(history[1].netWorth||0)){const change=(history[0].netWorth||0)-(history[1].netWorth||0);items.push(`Your net worth ${change>0?"increased":"decreased"} by ${inr(change)} since ${new Date(history[1].snapshotDate).toLocaleDateString("en-IN")}.`);}
 if(upcomingBills.length){const total=upcomingBills.reduce((s,b)=>s+b.amount,0);items.push(`${upcomingBills.length} bill${upcomingBills.length>1?"s":""} totaling ${inr(total)} are due in the next 7 days.`);}
 if(debt[0]?.total)items.push(`Your current outstanding debt is ${inr(debt[0].total)}.`);
 return items;
}
