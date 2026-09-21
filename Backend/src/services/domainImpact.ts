import { ClientSession, Types } from "mongoose";
import { Goal } from "../models/Goal";
import { SinkingFund } from "../models/SinkingFund";
import { Transaction } from "../models/Transaction";
import { Liability } from "../models/Liability";
import { InvestmentHolding } from "../models/InvestmentHolding";
import { AppError } from "../utils/errors";
import type { TxInput } from "./transactions";

// Stored deltas make reversals independent of later market valuations.
export async function applyDomainImpact(userId: Types.ObjectId, tx: TxInput, direction: 1|-1, session: ClientSession) {
  const m = tx.metadata;
  if(m?.kind==="sinking_fund_contribution"){
    if(tx.type!=="saving"||tx.goalId)throw new AppError(400,"Invalid sinking fund contribution");
    const fund=await SinkingFund.findOne({_id:m.sinkingFundId,userId}).session(session);
    if(!fund)throw new AppError(404,"Sinking fund not found");
    if(direction===1&&fund.status!=="active")throw new AppError(400,"Fund is not active");
    if(String(fund.linkedAccountId||"")!==String(tx.destinationAccountId||""))throw new AppError(400,"Contribution destination must match the fund account");
    const next=fund.currentAmount+tx.amount*direction;
    if(next<-.005)throw new AppError(409,"Cannot reverse a contribution that has already been used");
    fund.currentAmount=Math.max(0,Math.round(next*100)/100);
    if(fund.currentAmount>=fund.targetAmount)fund.status="completed";
    else if(fund.status==="completed")fund.status="active";
    await fund.save({session});
  }
  if(tx.goalId) {
    if(tx.type!=="saving" || (m?.kind && m.kind!=="goal_withdrawal")) throw new AppError(400,"Goals require saving transactions");
    const goal=await Goal.findOneAndUpdate({_id:tx.goalId,userId},{$inc:{ledgerVersion:1}},{session,returnDocument: "after"});
    if(!goal) throw new AppError(404,"Goal not found");
    const pool=await Transaction.aggregate([{$match:{userId,goalId:goal._id,type:"saving",destinationAccountId:tx.destinationAccountId ? new Types.ObjectId(String(tx.destinationAccountId)) : null}},{$group:{_id:null,total:{$sum:{$cond:[{$eq:["$metadata.kind","goal_withdrawal"]},{$multiply:["$amount",-1]},"$amount"]}}}}]).session(session);
    const delta=tx.amount*direction*(m?.kind==="goal_withdrawal"?-1:1);
    if((pool[0]?.total||0)+delta<-.005) throw new AppError(400,"Withdrawal or reversal exceeds savings in this goal funding account");
  }
  if(m?.kind==="goal_withdrawal" && (!tx.goalId || m.activity!=="withdrawal")) throw new AppError(400,"Invalid goal withdrawal");
  if (m?.kind === "liability_payment") {
    if (tx.type !== "saving" || tx.destinationAccountId || tx.goalId) throw new AppError(400,"Invalid debt payment structure");
    const principal = m.principalAmount ?? tx.amount - (m.interestAmount ?? 0);
    const interest = m.interestAmount ?? tx.amount - principal;
    if (principal < 0 || interest < 0 || Math.abs(principal + interest - tx.amount) > .005) throw new AppError(400,"Principal and interest must equal the payment");
    const debt = await Liability.findOne({_id:m.liabilityId,userId}).session(session);
    if (!debt) throw new AppError(404,"Liability not found");
    if (direction === 1 && principal > debt.outstandingAmount) throw new AppError(400,"Principal exceeds outstanding debt");
    debt.outstandingAmount = Math.round((debt.outstandingAmount - direction * principal)*100)/100;
    if (debt.outstandingAmount === 0) debt.status="paid";
    else if (debt.status === "paid") debt.status="active";
    await debt.save({session});
    m.principalAmount=principal; m.interestAmount=interest;
  }
  if (m?.kind === "investment_activity") {
    if (tx.type !== "investment" || tx.destinationAccountId || tx.goalId) throw new AppError(400,"Invalid investment activity structure");
    const h = await InvestmentHolding.findOne({_id:m.investmentHoldingId,userId}).session(session);
    if (!h) throw new AppError(404,"Investment not found");
    if (!["buy","sell","contribution","withdrawal"].includes(m.activity || "")) throw new AppError(400,"Invalid investment activity");
    const sale = ["sell","withdrawal"].includes(m.activity!);
    const units = m.units ?? 0;
    if (units < 0) throw new AppError(400,"Units must be nonnegative");
    if (direction === 1 && sale && (units > h.units || tx.amount > h.currentValue)) throw new AppError(400,"Withdrawal exceeds holding units or value");
    const cost = direction === 1 ? (sale ? (units > 0 && h.units > 0 ? h.investedAmount * units / h.units : h.currentValue > 0 ? h.investedAmount * tx.amount / h.currentValue : 0) : tx.amount) : (m.costBasis ?? tx.amount);
    const sign = (sale ? -1 : 1) * direction;
    if (h.investedAmount + sign*cost < -.005 || h.currentValue + sign*tx.amount < -.005 || h.units + sign*units < -.000001) throw new AppError(409,"Later investment activity prevents reversing this transaction");
    h.investedAmount = Math.max(0,h.investedAmount+sign*cost);
    h.currentValue = Math.max(0,h.currentValue+sign*tx.amount);
    h.units = Math.max(0,h.units+sign*units);
    h.averageBuyPrice = h.units ? h.investedAmount/h.units : 0;
    await h.save({session}); m.costBasis=cost;
  }
}
