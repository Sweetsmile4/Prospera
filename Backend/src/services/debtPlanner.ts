import {Types} from "mongoose";
import {Liability} from "../models/Liability";
import {AppError} from "../utils/errors";
import {roundMoney} from "./planningFacts";
type Debt={id:string;name:string;balance:number;rate:number;emi:number};
export type DebtPlan={strategy:string;status:"ok"|"insufficient_data"|"not_amortizing";order:Debt[];totalInterest:number;interestSaved:number|null;payoffMonths:number|null;debtFreeDate:string|null;monthlyPayment:number;timeline:{month:number;balance:number;interest:number;payment:number}[];assumptions:string[]};
export function amortize(debts:Debt[],extra:number){
 const balances=debts.map(d=>d.balance),budget=debts.reduce((s,d)=>s+d.emi,0)+extra;
 const timeline:DebtPlan["timeline"]=[];let totalInterest=0;
 for(let month=1;month<=600&&balances.some(b=>b>.005);month++){
  let interest=0,payment=0,available=budget;
  debts.forEach((d,i)=>{const charge=roundMoney(balances[i]*d.rate/1200);balances[i]=roundMoney(balances[i]+charge);interest+=charge;});
  debts.forEach((d,i)=>{const pay=Math.min(balances[i],d.emi,available);balances[i]=roundMoney(balances[i]-pay);available-=pay;payment+=pay;});
  for(let i=0;i<balances.length&&available>.005;i++){const pay=Math.min(balances[i],available);balances[i]=roundMoney(balances[i]-pay);available-=pay;payment+=pay;}
  totalInterest=roundMoney(totalInterest+interest);
  timeline.push({month,balance:roundMoney(balances.reduce((s,b)=>s+b,0)),interest:roundMoney(interest),payment:roundMoney(payment)});
  if(payment<=interest&&month>1)break;
 }
 return {complete:balances.every(b=>b<=.005),totalInterest,timeline};
}
export async function planDebtPayoff(userId:Types.ObjectId,strategy:"snowball"|"avalanche"|"custom",extraPayment=0,customOrder:string[]=[]):Promise<DebtPlan>{
 if(!Number.isFinite(extraPayment)||extraPayment<0)throw new AppError(400,"Extra payment must be nonnegative");
 const docs=await Liability.find({userId,status:"active",outstandingAmount:{$gt:0}});
 const order:Debt[]=docs.map(d=>({id:d.id,name:d.name,balance:d.outstandingAmount,rate:d.interestRate,emi:d.emiAmount}));
 if(strategy==="snowball")order.sort((a,b)=>a.balance-b.balance||a.id.localeCompare(b.id));
 else if(strategy==="avalanche")order.sort((a,b)=>b.rate-a.rate||a.balance-b.balance);
 else if(strategy==="custom"){
  if(new Set(customOrder).size!==order.length||customOrder.length!==order.length||customOrder.some(id=>!order.some(d=>d.id===id)))throw new AppError(400,"Custom order must contain each of your active debts exactly once");
  order.sort((a,b)=>customOrder.indexOf(a.id)-customOrder.indexOf(b.id));
 }
 const assumptions=["Simulation only; no liabilities or payments are changed.","Monthly interest is APR / 12, before payments; excludes fees and variable rates.","Minimum payments are paid on every debt; remaining budget follows the selected priority.","Freed minimum payments roll into the remaining debts; maximum projection is 600 months."];
 if(order.some(d=>d.emi<=0))return {strategy,status:"insufficient_data",order,totalInterest:0,interestSaved:null,payoffMonths:null,debtFreeDate:null,monthlyPayment:0,timeline:[],assumptions:[...assumptions,"Set minimum monthly payments for every debt."]};
 const result=amortize(order,extraPayment),base=amortize(order,0),months=result.complete?result.timeline.length:null;
 const date=new Date();if(months!==null)date.setUTCMonth(date.getUTCMonth()+months);
 return {strategy,status:result.complete?"ok":"not_amortizing",order,totalInterest:result.totalInterest,interestSaved:result.complete&&base.complete?roundMoney(base.totalInterest-result.totalInterest):null,payoffMonths:months,debtFreeDate:months!==null?date.toISOString().slice(0,10):null,monthlyPayment:roundMoney(order.reduce((s,d)=>s+d.emi,0)+extraPayment),timeline:result.timeline,assumptions};
}
