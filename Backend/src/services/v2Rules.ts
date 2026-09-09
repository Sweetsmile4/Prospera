export const normalizeDescription=(value:string)=>value.trim().toLowerCase().replace(/\s+/g," ");
export const duplicateKey=(account:string,date:Date,amount:number,description:string)=>`${account}|${date.toISOString().slice(0,10)}|${amount.toFixed(2)}|${normalizeDescription(description)}`;
export const liabilityPrincipal=(payment:number,interest=0,provided?:number)=>Math.max(0,provided??payment-interest);
export const investmentReturn=(invested:number,current:number)=>invested>0?(current-invested)/invested*100:0;
export const budgetState=(percent:number)=>percent>=100?"over":percent>=80?"warning":"safe";
export const netWorth=(assets:number,liabilities:number)=>assets-liabilities;
export const signedGoalAmount=(amount:number,activity?:string)=>activity==="withdrawal"?-amount:amount;
export const ownerFilter=(userId:string,id:string)=>({userId,id});
