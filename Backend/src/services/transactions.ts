import mongoose, { ClientSession, Types } from "mongoose";
import { Account } from "../models/Account";
import { Category } from "../models/Category";
import { Goal } from "../models/Goal";
import { Transaction } from "../models/Transaction";
import { AppError } from "../utils/errors";
import { captureNetWorth } from "./netWorth";
import { applyDomainImpact } from "./domainImpact";

export type TxInput = { type: "income"|"expense"|"saving"|"investment"|"transfer"; title: string; amount: number; accountId: string; destinationAccountId?: string; categoryId?: string; goalId?: string; description?: string; transactionDate: Date;source?:"manual"|"recurring"|"import";tags?:string[];referenceNumber?:string;recurringTransactionId?:string;importBatchId?:string;scheduledDate?:Date;metadata?:{kind:"liability_payment"|"goal_withdrawal"|"investment_activity"|"sinking_fund_contribution";sinkingFundId?:string;liabilityId?:string;investmentHoldingId?:string;principalAmount?:number;interestAmount?:number;activity?:string;units?:number;costBasis?:number} };
const impact = (t: TxInput, multiplier = 1) => {
  const changes = new Map<string, number>();
  const add = (id: string, amount: number) => changes.set(id, (changes.get(id) || 0) + amount * multiplier);
  if (t.type === "income") add(t.accountId, t.amount);
  else if (t.type === "expense") add(t.accountId, -t.amount);
  else if (t.type === "saving" && t.metadata?.kind === "goal_withdrawal") { add(t.accountId, t.amount); if(t.destinationAccountId) add(t.destinationAccountId,-t.amount); }
  else if (t.type === "investment" && ["sell","withdrawal"].includes(t.metadata?.activity||"")) add(t.accountId, t.amount);
  else if (t.type === "transfer" || t.type === "saving" || t.type === "investment") {
    add(t.accountId, -t.amount); if (t.destinationAccountId) add(t.destinationAccountId, t.amount);
  }
  return changes;
};
export const calculateImpact = impact;
export async function validateTransaction(userId: Types.ObjectId, input: TxInput, session?: ClientSession) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new AppError(400, "Amount must be greater than zero");
  if (input.destinationAccountId === input.accountId && input.metadata?.kind!=="sinking_fund_contribution") throw new AppError(400, "Source and destination accounts must differ");
  const ids = [...new Set([input.accountId, input.destinationAccountId].filter(Boolean))];
  const accounts = await Account.countDocuments({ _id: { $in: ids }, userId, isActive: true }).session(session || null);
  if (accounts !== ids.length) throw new AppError(400, "An account is invalid, inactive, or does not belong to you");
  if (input.type === "transfer" && !input.destinationAccountId) throw new AppError(400, "A destination account is required");
  if (input.categoryId) {
    const expected = input.type === "income" ? "income" : input.type === "expense" ? "expense" : input.type === "investment" ? "investment" : undefined;
    const category = await Category.findOne({ _id: input.categoryId, $or: [{ userId }, { userId: null }], isActive: true }).session(session || null);
    if (!category || (expected && category.type !== expected)) throw new AppError(400, "Invalid category for this transaction type");
  }
  if (input.goalId && !await Goal.exists({ _id: input.goalId, userId, status: { $ne: "archived" } }).session(session || null)) throw new AppError(400, "Invalid goal");
}
async function apply(changes: Map<string, number>, userId: Types.ObjectId, session: ClientSession) {
  for (const [id, delta] of changes) {
    const updated = await Account.findOneAndUpdate({ _id: id, userId }, { $inc: { currentBalance: delta } }, { session, returnDocument: "after" });
    if (!updated) throw new AppError(404, "Account not found");
  }
}
export async function createTransaction(userId: Types.ObjectId, input: TxInput) {
  return mongoose.connection.transaction(async session => { const tx=await createInSession(userId,input,session); await captureNetWorth(userId,session); return tx; });
}
export async function createInSession(userId:Types.ObjectId,input:TxInput,session:ClientSession) {
  await validateTransaction(userId,input,session);
  await apply(impact(input),userId,session);
  await applyDomainImpact(userId,input,1,session);
  const [tx]=await Transaction.create([{...input,userId}],{session}); return tx;
}
export async function updateTransaction(userId: Types.ObjectId, id: string, input: TxInput) {
  return mongoose.connection.transaction(async session => {
    const old = await Transaction.findOne({ _id: id, userId }).session(session || null); if (!old) throw new AppError(404, "Transaction not found");
    const previous = old.toObject() as unknown as TxInput;
    if (previous.metadata?.kind) input.metadata = {...previous.metadata,...input.metadata};
    input.source=previous.source; input.recurringTransactionId=previous.recurringTransactionId; input.importBatchId=previous.importBatchId; input.scheduledDate=previous.scheduledDate;
    await validateTransaction(userId, input, session);
    await apply(impact(previous,-1),userId,session);
    await applyDomainImpact(userId,previous,-1,session);
    await old.deleteOne({session});
    await apply(impact(input),userId,session);
    await applyDomainImpact(userId,input,1,session);
    for (const field of ["destinationAccountId","categoryId","goalId","description"]) old.set(field,undefined);
    const [updated]=await Transaction.create([{...old.toObject(),...input,updatedAt:new Date()}],{session}); await captureNetWorth(userId,session); return updated;
  });
}
export async function deleteTransaction(userId: Types.ObjectId, id: string) {
  return mongoose.connection.transaction(async session => { const old = await Transaction.findOne({ _id: id, userId }).session(session); if (!old) throw new AppError(404, "Transaction not found"); await apply(impact(old.toObject() as unknown as TxInput, -1), userId, session); await applyDomainImpact(userId,old.toObject() as unknown as TxInput,-1,session); await old.deleteOne({ session }); await captureNetWorth(userId,session); });
}
