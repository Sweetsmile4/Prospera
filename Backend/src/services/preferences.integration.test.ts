import {beforeAll,afterAll,describe,it,expect} from "vitest";
import mongoose,{Types} from "mongoose";
import {MongoMemoryReplSet} from "mongodb-memory-server";
import {FinancialPreference} from "../models/FinancialPreference";
import {Category} from "../models/Category";
import {Account} from "../models/Account";
import {getFinancialPreference,updateFinancialPreference,getEssentialCategoryIds} from "./financialPreferences";
import {getEmergencyFundStatus} from "./emergencyFund";
import {getDataConfidence} from "./dataConfidence";
import {Transaction} from "../models/Transaction";
import {RecurringTransaction} from "../models/RecurringTransaction";
import {InvestmentHolding} from "../models/InvestmentHolding";
import {Liability} from "../models/Liability";
import {forecastCashFlow,expandDates} from "./forecasting";
import {calculateSafeToSpend} from "./safeToSpend";
import {calculateFinancialHealth} from "./financialHealth";
import {amortize,planDebtPayoff} from "./debtPlanner";
import {createSinkingFund,contributeToSinkingFund} from "./sinkingFund";
import {deleteTransaction} from "./transactions";
import {captureNetWorth} from "./netWorth";
import {SinkingFund} from "../models/SinkingFund";

let db:MongoMemoryReplSet;
const user=new Types.ObjectId(),other=new Types.ObjectId();
beforeAll(async()=>{
 db=await MongoMemoryReplSet.create({binary:{systemBinary:process.env.MONGOMS_SYSTEM_BINARY||"C:\\Program Files\\MongoDB\\Server\\8.0\\bin\\mongod.exe"},replSet:{count:1}});
 await mongoose.connect(db.getUri());
},120000);
afterAll(async()=>{await mongoose.disconnect();if(db)await db.stop();});
describe("Planning preferences and missing-data safety",()=>{
 it("reading default preferences creates no records",async()=>{
  const before=await FinancialPreference.countDocuments();
  expect((await getFinancialPreference(user)).emergencyFundTargetMonths).toBe(6);
  expect(await FinancialPreference.countDocuments()).toBe(before);
 });
 it("rejects another user's category on the first save",async()=>{
  const category=await Category.create({userId:other,name:"Private",type:"expense"});
  await expect(updateFinancialPreference(user,{essentialCategories:[category.id]})).rejects.toThrow("Invalid essential");
  expect(await FinancialPreference.countDocuments({userId:user})).toBe(0);
 });
 it("rejects another user's emergency account",async()=>{
  const account=await Account.create({userId:other,name:"Private",type:"bank"});
  await expect(updateFinancialPreference(user,{emergencyFundAccountId:account.id})).rejects.toThrow("Invalid emergency");
 });
 it("explicit empty essential selection does not fall back to defaults",async()=>{
  await Category.create({userId:null,isDefault:true,isEssential:true,name:"Default essential",type:"expense"});
  await updateFinancialPreference(user,{essentialCategories:[]});
  expect(await getEssentialCategoryIds(user)).toEqual([]);
 });
 it("ignores a supplied userId and merges notification preferences",async()=>{
  const pref=await updateFinancialPreference(user,{userId:other,notificationPreferences:{budgetAlerts:false}});
  expect(String(pref.userId)).toBe(String(user));
  expect(pref.notificationPreferences?.budgetAlerts).toBe(false);
  expect(pref.notificationPreferences?.billReminders).toBe(true);
 });
 it("new user has low confidence and no invented emergency coverage",async()=>{
  const fresh=new Types.ObjectId();
  expect((await getDataConfidence(fresh)).level).toBe("low");
  const emergency=await getEmergencyFundStatus(fresh);
  expect(emergency.status).toBe("insufficient_data");
  expect(emergency.monthsCovered).toBeNull();
  expect(emergency.estimatedCompletionDate).toBeNull();
  expect(await FinancialPreference.countDocuments({userId:fresh})).toBe(0);
 });
 it("expands month-end schedules without drifting",()=>{
  expect(expandDates(new Date("2026-01-31"),"monthly",new Date("2026-01-31"),new Date("2026-03-31")).map(d=>d.toISOString().slice(0,10))).toEqual(["2026-01-31","2026-02-28","2026-03-31"]);
 });
 it("forecasts repeated bills and keeps internal transfers cash-neutral",async()=>{
  const id=new Types.ObjectId(),now=new Date(),first=new Date(now.getTime()+86400000);
  const bank=await Account.create({userId:id,name:"Bank",type:"bank",currentBalance:1000});
  const wallet=await Account.create({userId:id,name:"Wallet",type:"wallet",currentBalance:500});
  await Account.create({userId:id,name:"Locked",type:"investment",currentBalance:90000});
  await RecurringTransaction.create([
   {userId:id,title:"Weekly bill",type:"expense",amount:100,accountId:bank._id,frequency:"weekly",startDate:first,nextRunDate:first,isBill:true},
   {userId:id,title:"Transfer",type:"transfer",amount:200,accountId:bank._id,destinationAccountId:wallet._id,frequency:"monthly",startDate:first,nextRunDate:first}
  ]);
  const before=await Transaction.countDocuments({userId:id});
  const f=await forecastCashFlow(id,30,now);
  expect(f.openingBalance).toBe(1500);
  expect(f.events.filter(e=>e.description==="Weekly bill")).toHaveLength(5);
  expect(f.events.find(e=>e.description==="Transfer")?.cashImpact).toBe(0);
  expect(f.projectedBalance).toBe(1000);
  expect(await Transaction.countDocuments({userId:id})).toBe(before);
  expect(await FinancialPreference.countDocuments({userId:id})).toBe(0);
 });
 it("safe-to-spend excludes future salary, portfolios and credit limits",async()=>{
  const id=new Types.ObjectId(),date=new Date(),incomeDate=new Date(date.getTime()+10*86400000),billDate=new Date(date.getTime()+2*86400000);
  const bank=await Account.create({userId:id,name:"Bank",type:"bank",currentBalance:10000});
  await Account.create({userId:id,name:"Savings",type:"savings",currentBalance:50000});
  await InvestmentHolding.create({userId:id,name:"Fund",type:"mutual fund",currentValue:999999});
  await Liability.create({userId:id,name:"Card",type:"credit card",originalAmount:0,outstandingAmount:0,creditLimit:999999});
  await Transaction.create({userId:id,type:"income",title:"Past income",amount:10000,accountId:bank._id,transactionDate:date});
  await RecurringTransaction.create([
   {userId:id,title:"Salary",type:"income",amount:30000,accountId:bank._id,frequency:"monthly",startDate:incomeDate,nextRunDate:incomeDate},
   {userId:id,title:"Bill",type:"expense",amount:2000,accountId:bank._id,frequency:"monthly",startDate:billDate,nextRunDate:billDate,isBill:true}
  ]);
  await updateFinancialPreference(id,{safeToSpendReserve:1000});
  const safe=await calculateSafeToSpend(id);
  expect(safe.status).toBe("ok");
  expect(safe.availableCash).toBe(10000);
  expect(safe.expectedIncome).toBe(0);
  expect(safe.upcomingBills).toBe(2000);
  expect(safe.safeToSpend).toBe(7000);
 });
 it("health score does not reward debt with zero income",async()=>{
  const id=new Types.ObjectId();
  await Liability.create({userId:id,name:"Loan",type:"personal loan",originalAmount:1000,outstandingAmount:1000,emiAmount:200});
  const score=await calculateFinancialHealth(id);
  expect(score.breakdown.debtBurden.score).toBe(0);
  expect(score.status).toBe("insufficient_data");
  expect(score.score).toBeGreaterThanOrEqual(0);
  expect(score.score).toBeLessThanOrEqual(100);
 });
 it("pays debts concurrently and rolls freed minimums into the next debt",()=>{
  const result=amortize([{id:"a",name:"A",balance:100,rate:0,emi:50},{id:"b",name:"B",balance:300,rate:0,emi:50}],0);
  expect(result.complete).toBe(true);
  expect(result.timeline).toHaveLength(4);
  expect(result.totalInterest).toBe(0);
 });
 it("does not present an unpaid debt as paid off",()=>{
  const result=amortize([{id:"a",name:"A",balance:10000,rate:24,emi:10}],0);
  expect(result.complete).toBe(false);
 });
 it("unlinked sinking contribution and reversal preserve net worth",async()=>{
  const id=new Types.ObjectId(),account=await Account.create({userId:id,name:"Cash",type:"cash",currentBalance:1000});
  const fund=await createSinkingFund(id,{name:"Insurance",targetAmount:500,targetDate:new Date(Date.now()+90*86400000)});
  await contributeToSinkingFund(id,fund.id,200,account.id,new Date());
  expect((await Account.findById(account.id))?.currentBalance).toBe(800);
  expect((await SinkingFund.findById(fund.id))?.currentAmount).toBe(200);
  expect((await captureNetWorth(id)).netWorth).toBe(1000);
  const tx=await Transaction.findOne({userId:id,"metadata.sinkingFundId":fund._id});
  await deleteTransaction(id,tx!.id);
  expect((await Account.findById(account.id))?.currentBalance).toBe(1000);
  expect((await SinkingFund.findById(fund.id))?.currentAmount).toBe(0);
 });
 it("rejects another user's fund without reducing cash",async()=>{
  const id=new Types.ObjectId(),account=await Account.create({userId:id,name:"Cash",type:"cash",currentBalance:1000});
  const fund=await createSinkingFund(other,{name:"Private",targetAmount:500,targetDate:new Date(Date.now()+90*86400000)});
  await expect(contributeToSinkingFund(id,fund.id,200,account.id,new Date())).rejects.toThrow("not found");
  expect((await Account.findById(account.id))?.currentBalance).toBe(1000);
 });
});
