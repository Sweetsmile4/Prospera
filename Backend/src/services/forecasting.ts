import {Types} from "mongoose";
import {RecurringTransaction} from "../models/RecurringTransaction";
import {Transaction} from "../models/Transaction";
import {Liability} from "../models/Liability";
import {Account} from "../models/Account";
import {Goal} from "../models/Goal";
import {SinkingFund} from "../models/SinkingFund";
import {getFinancialPreference} from "./financialPreferences";
import {nextDate} from "./recurring";
import {calculateImpact} from "./transactions";
import {liquidTypes,roundMoney,monthStart,monthEnd,periodFacts} from "./planningFacts";
import {AppError} from "../utils/errors";

export type CashFlowEvent={date:string;description:string;amount:number;cashImpact:number;type:"income"|"expense"|"saving"|"investment"|"transfer"|"debt";balance:number;actionUrl:string;overdue:boolean};
export type CashFlowForecast={status:"ok"|"insufficient_data";events:CashFlowEvent[];openingBalance:number;projectedBalance:number;startDate:string;endDate:string;assumptions:string[]};
export function expandDates(start:Date,frequency:string,anchor:Date,end:Date,stop?:Date|null){
 const dates:Date[]=[];let date=new Date(start);
 for(let i=0;i<4000&&date<=end&&(!stop||date<=stop);i++){dates.push(date);date=nextDate(date,frequency,anchor);}
 return dates;
}
export async function forecastCashFlow(userId:Types.ObjectId,days=30,asOf=new Date()):Promise<CashFlowForecast>{
 if(!Number.isInteger(days)||days<0||days>366)throw new AppError(400,"Forecast horizon must be 0–366 days");
 const end=new Date(asOf.getTime()+days*86400000);
 const accounts=await Account.find({userId,isActive:true}),pref=await getFinancialPreference(userId);
 const liquid=new Set(accounts.filter(a=>(liquidTypes as readonly string[]).includes(a.type)).map(a=>a.id));
 const openingBalance=roundMoney(accounts.filter(a=>liquid.has(a.id)).reduce((s,a)=>s+a.currentBalance,0));
 const rules=await RecurringTransaction.find({userId,isActive:true,nextRunDate:{$lte:end}});
 const events:CashFlowEvent[]=[];
 const add=(date:Date,description:string,amount:number,cashImpact:number,type:CashFlowEvent["type"],actionUrl:string)=>{
  events.push({date:(date<asOf?asOf:date).toISOString(),description,amount:roundMoney(amount),cashImpact:roundMoney(cashImpact),type,balance:0,actionUrl,overdue:date<asOf});
 };
 for(const rule of rules){
  // Due dates that were already recorded manually are not projected again.
  const recorded=await Transaction.find({userId,recurringTransactionId:rule._id,scheduledDate:{$gte:rule.nextRunDate,$lte:end}}).select("scheduledDate");
  const paid=new Set(recorded.map(t=>t.scheduledDate?.toISOString()));
  const changes=calculateImpact({type:rule.type,title:rule.title,amount:rule.amount,accountId:String(rule.accountId),destinationAccountId:rule.destinationAccountId?String(rule.destinationAccountId):undefined,transactionDate:asOf});
  const delta=[...changes].reduce((sum,[id,amount])=>sum+(liquid.has(String(id))?amount:0),0);
  for(const date of expandDates(rule.nextRunDate,rule.frequency,rule.startDate,end,rule.endDate))
   if(!paid.has(date.toISOString()))add(date,rule.title,rule.amount,delta,rule.type,"/recurring");
 }
 const debts=await Liability.find({userId,status:"active",outstandingAmount:{$gt:0},emiAmount:{$gt:0}});
 for(const debt of debts){
  let remaining=debt.outstandingAmount;
  for(let month=monthStart(asOf);month<=end;month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1))){
   const day=debt.paymentDay||debt.dueDay||monthEnd(month).getUTCDate();
   const date=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(day,monthEnd(month).getUTCDate())));
   if(date>end||(debt.endDate&&date>debt.endDate))continue;
   const payments=await Transaction.aggregate([{$match:{userId,"metadata.liabilityId":debt._id,"metadata.kind":"liability_payment",transactionDate:{$gte:month,$lte:monthEnd(month)}}},{$group:{_id:null,total:{$sum:"$amount"}}}]);
   const due=Math.max(0,Math.min(debt.emiAmount-(payments[0]?.total||0),remaining*(1+debt.interestRate/1200)));
   if(due>0){add(date,debt.name+" EMI",due,-due,"debt","/liabilities");remaining=Math.max(0,remaining-due+remaining*debt.interestRate/1200);}
  }
 }
 const goals=await Goal.find({userId,status:"active"}),funds=await SinkingFund.find({userId,status:"active"});
 for(let month=monthStart(asOf);month<=end;month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1))){
  const due=monthEnd(month);if(due>end)continue;
  const actual=await periodFacts(userId,month,new Date(Math.min(asOf.getTime(),due.getTime())));
  const planned=(type:string)=>events.filter(e=>e.type===type&&e.cashImpact<0&&e.date.slice(0,7)===month.toISOString().slice(0,7)).reduce((s,e)=>s-e.cashImpact,0);
  const goalTargets=goals.reduce((s,g)=>s+g.monthlyTarget,0)+funds.reduce((s,f)=>s+f.monthlyContribution,0);
  const saving=Math.max(0,Math.max(pref.monthlySavingsTarget,goalTargets)-Math.max(0,actual.savings)-planned("saving"));
  const investing=Math.max(0,pref.monthlyInvestmentTarget-Math.max(0,actual.investments)-planned("investment"));
  if(saving)add(due,"Remaining savings plan",saving,-saving,"saving","/goals");
  if(investing)add(due,"Remaining investment plan",investing,-investing,"investment","/investments");
 }
 events.sort((a,b)=>a.date.localeCompare(b.date)||a.cashImpact-b.cashImpact);
 let balance=openingBalance;for(const event of events){balance=roundMoney(balance+event.cashImpact);event.balance=balance;}
 return {status:liquid.size&&events.length?"ok":"insufficient_data",events,openingBalance,projectedBalance:balance,startDate:asOf.toISOString(),endDate:end.toISOString(),assumptions:["Projection only; no transactions are created.","Only active bank, cash and wallet balances are spendable.","Overdue obligations are placed today; outflows precede income on the same date.","Unlinked debt payments are conservatively assumed to use spendable cash.","Monthly targets are floors, not additions to scheduled contributions.","Unscheduled day-to-day spending is not included in this known-commitments forecast."]};
}
export async function forecastMonth(userId:Types.ObjectId){
 const now=new Date(),to=monthEnd(now),actual=await periodFacts(userId,monthStart(now),now);
 const forecast=await forecastCashFlow(userId,Math.ceil((to.getTime()-now.getTime())/86400000),now);
 const events=forecast.events.filter(e=>new Date(e.date)<=to);
 const sum=(type:string)=>events.filter(e=>e.type===type).reduce((s,e)=>s+e.amount,0);
 const expected={income:sum("income"),expenses:sum("expense"),savings:sum("saving"),investments:sum("investment"),debtPayments:sum("debt")};
 return {status:forecast.status,actual,expected,income:actual.income+expected.income,expenses:actual.expenses+expected.expenses,savings:actual.savings+expected.savings,investments:actual.investments+expected.investments,debtPayments:actual.debtPayments+expected.debtPayments,projectedRemaining:roundMoney(forecast.openingBalance+events.reduce((s,e)=>s+e.cashImpact,0)),netWorthDirection:"unknown",assumptions:forecast.assumptions};
}
