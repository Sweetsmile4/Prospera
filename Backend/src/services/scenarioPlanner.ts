import {Types} from "mongoose";
import {z} from "zod";
import {Transaction} from "../models/Transaction";
import {periodFacts,monthStart,roundMoney} from "./planningFacts";
export const scenarioSchema=z.object({
 incomeChangePercent:z.number().min(-100).max(1000).default(0),
 expenseReductionPercent:z.number().min(0).max(100).default(0),
 additionalSavings:z.number().nonnegative().default(0),
 additionalInvestments:z.number().nonnegative().default(0),
 additionalDebtPayment:z.number().nonnegative().default(0),
});
export async function simulateScenario(userId:Types.ObjectId,input:unknown){
 const assumptions=scenarioSchema.parse(input),end=monthStart(),from=new Date(Date.UTC(end.getUTCFullYear(),end.getUTCMonth()-3,1));
 const history=await Transaction.aggregate([{$match:{userId,transactionDate:{$gte:from,$lt:end}}},{$group:{_id:{$dateToString:{format:"%Y-%m",date:"$transactionDate"}}}}]);
 const count=history.length,facts=await periodFacts(userId,from,new Date(end.getTime()-1));
 const baseline={income:facts.income/(count||1),expenses:facts.expenses/(count||1),savings:facts.savings/(count||1),investments:facts.investments/(count||1),debtPayments:facts.debtPayments/(count||1)};
 const projected={income:baseline.income*(1+assumptions.incomeChangePercent/100),expenses:baseline.expenses*(1-assumptions.expenseReductionPercent/100),savings:baseline.savings+assumptions.additionalSavings,investments:baseline.investments+assumptions.additionalInvestments,debtPayments:baseline.debtPayments+assumptions.additionalDebtPayment};
 const remaining=(x:typeof baseline)=>roundMoney(x.income-x.expenses-x.savings-x.investments-x.debtPayments);
 return {status:count?"ok":"insufficient_data",historyMonths:count,baseline,projected,baselineRemaining:remaining(baseline),projectedRemaining:remaining(projected),annualCashDifference:roundMoney((remaining(projected)-remaining(baseline))*12),assumptions,notes:["Simulation only; accounts, transactions and plans are unchanged.","Baseline is the mean of observed completed months in the last three months.","Additional savings, investments and debt payments are separate cash allocations, not lifestyle expenses."]};
}
