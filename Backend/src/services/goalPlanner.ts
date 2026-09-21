import {Types} from "mongoose";
import {Goal} from "../models/Goal";
import {Transaction} from "../models/Transaction";
import {AppError} from "../utils/errors";
async function goalFacts(userId:Types.ObjectId,goalId:string){
 if(!Types.ObjectId.isValid(goalId))throw new AppError(400,"Invalid goal ID");
 const goal=await Goal.findOne({_id:goalId,userId,status:{$ne:"archived"}});
 if(!goal)throw new AppError(404,"Goal not found");
 const saved=await Transaction.aggregate([{$match:{userId,type:"saving",goalId:goal._id}},{$group:{_id:null,total:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]);
 const currentAmount=saved[0]?.total||0;return {goal,currentAmount,remaining:Math.max(0,goal.targetAmount-currentAmount)};
}
export async function simulateGoalPlan(userId:Types.ObjectId,goalId:string,monthlyContribution:number){
 if(!Number.isFinite(monthlyContribution)||monthlyContribution<0)throw new AppError(400,"Contribution must be nonnegative");
 const {goal,currentAmount,remaining}=await goalFacts(userId,goalId);
 const monthsToReach=remaining===0?0:monthlyContribution>0?Math.ceil(remaining/monthlyContribution):null;
 let estimatedDate:string|null=null;
 if(monthsToReach!==null&&monthsToReach<=1200){const date=new Date();date.setUTCMonth(date.getUTCMonth()+monthsToReach);estimatedDate=date.toISOString().slice(0,10);}
 return {targetAmount:goal.targetAmount,currentAmount,remaining,monthlyContribution,monthsToReach,estimatedDate,feasible:estimatedDate!==null};
}
export async function requiredMonthlyForGoal(userId:Types.ObjectId,goalId:string,target?:Date){
 const {goal,currentAmount,remaining}=await goalFacts(userId,goalId),date=target||goal.targetDate;
 if(!date||!Number.isFinite(date.getTime()))throw new AppError(400,"Choose a target date");
 const monthsAvailable=Math.max(0,Math.ceil((date.getTime()-Date.now())/(30.4375*86400000)));
 return {targetAmount:goal.targetAmount,currentAmount,remaining,monthsAvailable,requiredMonthly:remaining===0?0:monthsAvailable?Math.ceil(remaining/monthsAvailable*100)/100:null,targetDate:date.toISOString().slice(0,10),overdue:date.getTime()<Date.now()};
}
