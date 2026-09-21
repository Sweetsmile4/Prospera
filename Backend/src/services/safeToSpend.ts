import {Types} from "mongoose";
import {getFinancialPreference} from "./financialPreferences";
import {forecastCashFlow} from "./forecasting";
import {getEmergencyFundStatus} from "./emergencyFund";
import {Account} from "../models/Account";
import {Transaction} from "../models/Transaction";
import {SinkingFund} from "../models/SinkingFund";
import {liquidTypes,roundMoney} from "./planningFacts";

export type SafeToSpend={
 status:"ok"|"insufficient_data";availableCash:number;upcomingBills:number;plannedDebtPayments:number;
 plannedSavings:number;plannedInvestments:number;essentialReserve:number;expectedIncome:number;safeToSpend:number;
 shortfall:number;until:string;reasons:string[];breakdown:{label:string;amount:number;type:"add"|"subtract"}[];
};
export async function calculateSafeToSpend(userId:Types.ObjectId):Promise<SafeToSpend>{
 const now=new Date(),pref=await getFinancialPreference(userId),forecast=await forecastCashFlow(userId,90,now);
 const reasons:string[]=[];
 const nextIncome=forecast.events.find(e=>e.type==="income"&&e.cashImpact>0&&!e.overdue);
 const until=nextIncome?new Date(nextIncome.date):new Date(now.getTime()+30*86400000);
 if(!nextIncome)reasons.push("Configure upcoming recurring income; a 30-day obligation horizon is shown.");
 const accounts=await Account.find({userId,isActive:true,type:{$in:liquidTypes}});
 if(!accounts.length)reasons.push("Add a spendable bank, cash or wallet account.");
 const spendable=accounts.filter(a=>String(a._id)!==String(pref.emergencyFundAccountId));
 const reserved=await SinkingFund.find({userId,linkedAccountId:{$in:spendable.map(a=>a._id)}});
 const availableCash=roundMoney(spendable.reduce((s,a)=>s+a.currentBalance,0)-reserved.reduce((s,f)=>s+f.currentAmount,0));
 // Do not make future income spendable before it arrives.
 const obligations=forecast.events.filter(e=>new Date(e.date)<=until&&e.cashImpact<0);
 const sum=(types:string[])=>roundMoney(obligations.filter(e=>types.includes(e.type)).reduce((s,e)=>s-e.cashImpact,0));
 const upcomingBills=sum(["expense","transfer"]),plannedDebtPayments=sum(["debt"]),plannedSavings=sum(["saving"]),plannedInvestments=sum(["investment"]);
 const emergency=await getEmergencyFundStatus(userId);
 const days=Math.max(1,(until.getTime()-now.getTime())/86400000);
 // Baseline reserve is deliberately additional to bills; conservative, never a promise of safety.
 const essentialReserve=roundMoney(pref.safeToSpendReserve+emergency.monthlyEssentials*days/30.4375);
 if(emergency.monthlyEssentials===0&&pref.safeToSpendReserve===0)reasons.push("Set a spending reserve or provide essential-expense history.");
 const count=await Transaction.countDocuments({userId,transactionDate:{$lte:now}});
 if(!count)reasons.push("Record actual transactions to establish the financial baseline.");
 const remaining=availableCash-upcomingBills-plannedDebtPayments-plannedSavings-plannedInvestments-essentialReserve;
 const breakdown:SafeToSpend["breakdown"]=[
 {label:"Spendable cash (designated emergency account excluded)",amount:availableCash,type:"add"},
 {label:"Upcoming expenses and outgoing transfers",amount:upcomingBills,type:"subtract"},
 {label:"Debt payments",amount:plannedDebtPayments,type:"subtract"},
 {label:"Savings plan",amount:plannedSavings,type:"subtract"},
 {label:"Investment plan",amount:plannedInvestments,type:"subtract"},
 {label:"Additional essential-spending and configured reserve",amount:essentialReserve,type:"subtract"}];
 return {status:reasons.length?"insufficient_data":"ok",availableCash,upcomingBills,plannedDebtPayments,plannedSavings,plannedInvestments,essentialReserve,expectedIncome:0,safeToSpend:Math.max(0,roundMoney(remaining)),shortfall:Math.max(0,roundMoney(-remaining)),until:until.toISOString(),reasons,breakdown};
}
