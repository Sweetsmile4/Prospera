import { describe,expect,it } from "vitest"; import { calculateImpact } from "./transactions"; import { countsTowardBudget,rate } from "./analytics";
const base={title:"x",amount:500,accountId:"a",transactionDate:new Date()}as const;
describe("financial rules",()=>{
it("income increases balance",()=>expect(calculateImpact({...base,type:"income"}).get("a")).toBe(500));
it("expense decreases balance",()=>expect(calculateImpact({...base,type:"expense"}).get("a")).toBe(-500));
it("transfer decreases source",()=>expect(calculateImpact({...base,type:"transfer",destinationAccountId:"b"}).get("a")).toBe(-500));
it("transfer increases destination",()=>expect(calculateImpact({...base,type:"transfer",destinationAccountId:"b"}).get("b")).toBe(500));
it("transfer preserves net worth",()=>expect([...calculateImpact({...base,type:"transfer",destinationAccountId:"b"}).values()].reduce((a,b)=>a+b,0)).toBe(0));
it("deleting an expense restores balance",()=>expect(calculateImpact({...base,type:"expense"},-1).get("a")).toBe(500));
it("editing reverses the old amount",()=>expect((calculateImpact({...base,type:"expense"},-1).get("a")||0)+(calculateImpact({...base,type:"expense",amount:700}).get("a")||0)).toBe(-200));
it("changing accounts moves impact",()=>{expect(calculateImpact({...base,type:"expense"},-1).get("a")).toBe(500);expect(calculateImpact({...base,type:"expense",accountId:"b"}).get("b")).toBe(-500)});
it("owned-account savings preserve net worth",()=>expect([...calculateImpact({...base,type:"saving",destinationAccountId:"b"}).values()].reduce((a,b)=>a+b,0)).toBe(0));
it("calculates savings rate safely",()=>{expect(rate(11800,25000)).toBeCloseTo(47.2);expect(rate(100,0)).toBe(0)});
it("budgets count expenses only",()=>{expect(countsTowardBudget("expense")).toBe(true);for(const type of["income","saving","investment","transfer"])expect(countsTowardBudget(type)).toBe(false)});
});
