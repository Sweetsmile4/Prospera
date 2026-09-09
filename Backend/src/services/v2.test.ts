import{describe,expect,it}from"vitest";import{nextDate}from"./recurring";import{budgetState,duplicateKey,investmentReturn,liabilityPrincipal,netWorth,ownerFilter,signedGoalAmount}from"./v2Rules";import{calculateImpact}from"./transactions";
describe("V2 financial rules",()=>{
it("advances recurring monthly dates",()=>expect(nextDate(new Date("2026-01-15"),"monthly").getMonth()).toBe(1));
it("produces one idempotency key per recurring schedule date",()=>expect(duplicateKey("a",new Date("2026-08-01"),500," Netflix ")).toBe(duplicateKey("a",new Date("2026-08-01"),500,"netflix")));
it("recurring expense decreases its account",()=>expect(calculateImpact({type:"expense",title:"Rent",amount:8000,accountId:"a",transactionDate:new Date(),source:"recurring"}).get("a")).toBe(-8000));
it("recurring salary increases its account",()=>expect(calculateImpact({type:"income",title:"Salary",amount:25000,accountId:"a",transactionDate:new Date(),source:"recurring"}).get("a")).toBe(25000));
it("CSV duplicate identity includes account date amount and normalized description",()=>expect(duplicateKey("a",new Date("2026-08-01"),100,"Shop")).not.toBe(duplicateKey("b",new Date("2026-08-01"),100,"Shop")));
it("imported expenses use normal account impact",()=>expect(calculateImpact({type:"expense",title:"Shop",amount:100,accountId:"a",transactionDate:new Date(),source:"import"}).get("a")).toBe(-100));
it("liability payments derive principal without counting interest",()=>expect(liabilityPrincipal(2500,500)).toBe(2000));
it("credit card payment is not an expense",()=>expect(calculateImpact({type:"saving",title:"Card payment",amount:1000,accountId:"a",transactionDate:new Date(),metadata:{kind:"liability_payment",activity:"payment"}}).get("a")).toBe(-1000));
it("investment contribution updates its cash impact",()=>expect(calculateImpact({type:"investment",title:"SIP",amount:3000,accountId:"a",transactionDate:new Date(),metadata:{kind:"investment_activity",activity:"contribution"}}).get("a")).toBe(-3000));
it("goal withdrawal reduces progress and restores cash",()=>{expect(signedGoalAmount(500,"withdrawal")).toBe(-500);expect(calculateImpact({type:"saving",title:"Withdraw",amount:500,accountId:"a",transactionDate:new Date(),metadata:{kind:"goal_withdrawal",activity:"withdrawal"}}).get("a")).toBe(500)});
it("budget notification thresholds are deterministic",()=>{expect(budgetState(79)).toBe("safe");expect(budgetState(80)).toBe("warning");expect(budgetState(100)).toBe("over")});
it("net worth includes liabilities",()=>expect(netWorth(100000,40000)).toBe(60000));
it("investment return handles zero invested",()=>expect(investmentReturn(0,100)).toBe(0));
it("ownership filters cannot substitute another user",()=>{expect(ownerFilter("user-a","liability-1").userId).toBe("user-a");expect(ownerFilter("user-a","investment-1").userId).not.toBe("user-b")});
});
