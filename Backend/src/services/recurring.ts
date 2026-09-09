import mongoose,{Types} from "mongoose";
import {RecurringTransaction} from "../models/RecurringTransaction";
import {RecurringOccurrence} from "../models/RecurringOccurrence";
import {Transaction} from "../models/Transaction";
import {Notification} from "../models/Notification";
import {createInSession} from "./transactions";
import {captureNetWorth} from "./netWorth";
import {AppError} from "../utils/errors";

export function nextDate(date:Date,frequency:string,anchor:Date=date){
 const d=new Date(date);
 if(frequency==="daily")d.setUTCDate(d.getUTCDate()+1);
 else if(frequency==="weekly")d.setUTCDate(d.getUTCDate()+7);
 else {const day=anchor.getUTCDate();d.setUTCDate(1);if(frequency==="monthly")d.setUTCMonth(d.getUTCMonth()+1);else {d.setUTCFullYear(d.getUTCFullYear()+1);d.setUTCMonth(anchor.getUTCMonth());}
 d.setUTCDate(Math.min(day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate()));}
 return d;
}
export async function payOccurrence(userId:Types.ObjectId,id:string,expected?:Date,through=new Date()){
 return mongoose.connection.transaction(async session=>{
  const rule=await RecurringTransaction.findOne({_id:id,userId,isActive:true}).session(session);
  if(!rule)throw new AppError(404,"Active recurring item not found");
  const scheduled=new Date(rule.nextRunDate);
  if(expected&&scheduled.getTime()!==expected.getTime()){
   const previous=await RecurringOccurrence.findOne({userId,recurringTransactionId:rule._id,scheduledDate:expected}).session(session);
   if(previous)return {generated:false,alreadyPaid:true};
   throw new AppError(409,"Due date changed; refresh this bill");
  }
  if(!expected&&(!rule.autoCreate||scheduled>through))return {generated:false};
  if(rule.endDate&&scheduled>rule.endDate){rule.isActive=false;await rule.save({session});return {generated:false};}
  let existing=await RecurringOccurrence.findOne({recurringTransactionId:rule._id,scheduledDate:scheduled}).session(session);
  const legacy=await Transaction.findOne({userId,recurringTransactionId:rule._id,scheduledDate:scheduled}).session(session);
  let generated=false;
  if(!existing){
   const tx=legacy||await createInSession(userId,{title:rule.title,type:rule.type as any,amount:rule.amount,accountId:String(rule.accountId),destinationAccountId:rule.destinationAccountId?String(rule.destinationAccountId):undefined,categoryId:rule.categoryId?String(rule.categoryId):undefined,goalId:rule.goalId?String(rule.goalId):undefined,description:rule.notes||undefined,transactionDate:scheduled,source:"recurring",recurringTransactionId:String(rule._id),scheduledDate:scheduled},session);
   await RecurringOccurrence.create([{userId,recurringTransactionId:rule._id,scheduledDate:scheduled,transactionId:tx._id}],{session});
   generated=!legacy;
   await Notification.create([{userId,type:"recurring_generated",title:"Recurring transaction generated",message:rule.title+" was recorded.",actionUrl:"/transactions",eventKey:"recurring:"+rule.id+":"+scheduled.toISOString()}],{session});
  }
  rule.lastPaidDate=scheduled;rule.nextRunDate=nextDate(scheduled,rule.frequency,rule.startDate);
  if(rule.endDate&&rule.nextRunDate>rule.endDate)rule.isActive=false;
  await rule.save({session});await captureNetWorth(userId,session);
  return {generated,alreadyPaid:!generated};
 });
}
export async function processDueRecurring(userId?:Types.ObjectId,through=new Date()){
 const rules=await RecurringTransaction.find({...(userId?{userId}:{}),isActive:true,autoCreate:true,nextRunDate:{$lte:through}});
 let generated=0;const errors:{id:string;message:string}[]=[];
 for(const rule of rules){for(let i=0;i<366;i++){try{
  const result=await payOccurrence(rule.userId,rule.id,undefined,through);if(!result.generated)break;generated++;
 }catch(error:any){errors.push({id:rule.id,message:error.message});break;}}}
 return {processed:rules.length,generated,errors};
}
