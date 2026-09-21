import {Types} from "mongoose";
import {z} from "zod";
import {getFinancialPreference} from "./financialPreferences";
import {InvestmentHolding} from "../models/InvestmentHolding";
import {Account} from "../models/Account";
import {AppError} from "../utils/errors";
export const fireSchema=z.object({
 currentAge:z.number().int().min(18).max(100).optional(),targetRetirementAge:z.number().int().min(18).max(100).optional(),
 monthlyExpenses:z.number().nonnegative().optional(),currentInvestments:z.number().nonnegative().optional(),
 monthlyInvestment:z.number().nonnegative().optional(),expectedAnnualReturn:z.number().min(0).max(30).optional(),
 inflationRate:z.number().min(0).max(20).optional(),safeWithdrawalRate:z.number().positive().max(10).optional()
});
type Params=z.infer<typeof fireSchema>;
export type FIREProjection={status:"ok"|"insufficient_data";fireNumber:number;inflatedTarget:number;currentPortfolio:number;gap:number;yearsToFI:number|null;projectedPortfolioAtRetirement:number;monthlyContribution:number;monthlyExpenses:number;yearsRemaining:number;assumptions:{currentAge:number;retirementAge:number;annualReturn:number;inflation:number;withdrawalRate:number}};
export function projectPortfolio(initial:number,monthly:number,annualReturn:number,months:number){
 const rate=annualReturn/1200;
 return rate===0?initial+monthly*months:initial*Math.pow(1+rate,months)+monthly*(Math.pow(1+rate,months)-1)/rate;
}
export async function projectFIRE(userId:Types.ObjectId,raw?:Params):Promise<FIREProjection>{
 const params=fireSchema.parse(raw||{}),pref=await getFinancialPreference(userId),fire=pref.fireSettings;
 const holdings=await InvestmentHolding.find({userId}),accounts=await Account.find({userId,type:"investment"});
 const linked=new Set(holdings.map(h=>String(h.accountId)));
 const currentPortfolio=params.currentInvestments??(holdings.reduce((s,h)=>s+h.currentValue,0)+accounts.filter(a=>!linked.has(a.id)).reduce((s,a)=>s+a.currentBalance,0));
 const monthlyExpenses=params.monthlyExpenses??0,currentAge=params.currentAge??fire?.currentAge??30,retirementAge=params.targetRetirementAge??fire?.retirementAge??60;
 if(retirementAge<currentAge)throw new AppError(400,"Retirement age cannot be earlier than current age");
 const annualReturn=params.expectedAnnualReturn??fire?.expectedAnnualReturn??10,inflation=params.inflationRate??fire?.inflationRate??6,withdrawalRate=params.safeWithdrawalRate??fire?.safeWithdrawalRate??4;
 const monthlyContribution=params.monthlyInvestment??pref.monthlyInvestmentTarget,yearsRemaining=retirementAge-currentAge;
 const fireNumber=monthlyExpenses*12/(withdrawalRate/100),inflatedTarget=fireNumber*Math.pow(1+inflation/100,yearsRemaining);
 const projectedPortfolioAtRetirement=projectPortfolio(currentPortfolio,monthlyContribution,annualReturn,yearsRemaining*12);
 let yearsToFI:number|null=null;
 for(let months=0;months<=600;months++){if(projectPortfolio(currentPortfolio,monthlyContribution,annualReturn,months)>=fireNumber*Math.pow(1+inflation/100,months/12)){yearsToFI=months/12;break;}}
 return {status:params.monthlyExpenses===undefined?"insufficient_data":"ok",fireNumber:Math.round(fireNumber),inflatedTarget:Math.round(inflatedTarget),currentPortfolio:Math.round(currentPortfolio),gap:Math.round(Math.max(0,inflatedTarget-projectedPortfolioAtRetirement)),yearsToFI,projectedPortfolioAtRetirement:Math.round(projectedPortfolioAtRetirement),monthlyContribution,monthlyExpenses,yearsRemaining,assumptions:{currentAge,retirementAge,annualReturn,inflation,withdrawalRate}};
}
