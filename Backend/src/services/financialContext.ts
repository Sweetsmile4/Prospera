import {Types} from "mongoose";
import {calculateFinancialHealth} from "./financialHealth";
import {calculateSafeToSpend} from "./safeToSpend";
import {detectAnomalies} from "./anomalyDetection";
import {generateRecommendations} from "./recommendation";
import {generateMonthlyReview} from "./monthlyReview";
import {readNetWorth} from "./netWorth";
import {getFinancialCalendar} from "./financialCalendar";
export async function getFinancialContext(userId:Types.ObjectId){
 const [review,worth,health,safe,anomalies,recommendations,calendar]=await Promise.all([generateMonthlyReview(userId),readNetWorth(userId),calculateFinancialHealth(userId),calculateSafeToSpend(userId),detectAnomalies(userId),generateRecommendations(userId),getFinancialCalendar(userId,1)]);
 // Explicit allowlist: never serialize users, tokens, account details or raw documents.
 return {period:review.period,income:review.income,expenses:review.expenses,savings:review.savings,investments:review.investments,debt:worth.liabilities,netWorth:worth.netWorth,netWorthChange:review.netWorthChange,
 budgets:review.budgetPerformance.items.map(b=>({name:b.name,limit:b.limit,spent:b.spent})),goals:review.goalProgress,
 upcomingBills:calendar.filter(e=>e.type==="bill").map(e=>({name:e.title,amount:e.amount,due:e.date})),
 healthScore:{score:health.score,status:health.status},safeToSpend:{amount:safe.status==="ok"?safe.safeToSpend:null,status:safe.status},
 anomalies:anomalies.map(a=>({type:a.type,description:(a.category||a.title)+": "+a.deviation+" above average"})),
 recommendations:recommendations.map(r=>({title:r.title,priority:r.priority}))};
}
