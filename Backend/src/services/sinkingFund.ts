import { Types } from "mongoose";
import { SinkingFund } from "../models/SinkingFund";
import { createTransaction } from "./transactions";
import { AppError } from "../utils/errors";
import { validateReferences } from "./references";

export type SinkingFundView = {
  _id: string; name: string; targetAmount: number; currentAmount: number;
  targetDate: string; monthlyContribution: number; requiredMonthlyContribution: number;
  remainingAmount: number; monthsRemaining: number; status: string; progress: number;
};

export async function getSinkingFunds(userId: Types.ObjectId): Promise<SinkingFundView[]> {
  const funds = await SinkingFund.find({ userId, status: { $ne: "archived" } });
  return funds.map(f => {
    const remaining = Math.max(0, f.targetAmount - f.currentAmount);
    const now = new Date();
    const monthsRemaining = Math.max(0, Math.ceil((f.targetDate.getTime() - now.getTime()) / (30 * 86400000)));
    const requiredMonthly = monthsRemaining > 0 ? remaining / monthsRemaining : remaining;
    return {
      _id: f._id.toString(), name: f.name, targetAmount: f.targetAmount, currentAmount: f.currentAmount,
      targetDate: f.targetDate.toISOString().slice(0, 10), monthlyContribution: f.monthlyContribution,
      requiredMonthlyContribution: Math.round(requiredMonthly), remainingAmount: Math.round(remaining),
      monthsRemaining, status: f.status, progress: f.targetAmount > 0 ? Math.min(100, (f.currentAmount / f.targetAmount) * 100) : 0,
    };
  });
}

export async function createSinkingFund(userId: Types.ObjectId, data: any) {
  await validateReferences(userId,{...data,accountId:data.linkedAccountId});
  const fund = await SinkingFund.create({ ...data, currentAmount:0, userId });
  return fund;
}

export async function contributeToSinkingFund(userId: Types.ObjectId, id: string, amount: number, accountId: string, date: Date) {
  const fund = await SinkingFund.findOne({ _id: id, userId });
  if (!fund) throw new AppError(404, "Sinking fund not found");
  if (fund.status !== "active") throw new AppError(400, "Fund is not active");
  await createTransaction(userId, { type: "saving", title: `${fund.name} contribution`, amount, accountId, destinationAccountId:fund.linkedAccountId?String(fund.linkedAccountId):undefined, transactionDate: date,metadata:{kind:"sinking_fund_contribution",sinkingFundId:fund.id} });
  return SinkingFund.findOne({_id:fund._id,userId});
}
