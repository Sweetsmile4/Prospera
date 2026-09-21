import { Types } from "mongoose";
import { InvestmentHolding } from "../models/InvestmentHolding";

export type PortfolioAllocation = {
  totalInvested: number; totalCurrentValue: number; totalGain: number; totalReturn: number;
  byType: { type: string; invested: number; currentValue: number; allocation: number; gain: number }[];
  concentrationWarnings: string[];
};

export async function analyzePortfolio(userId: Types.ObjectId): Promise<PortfolioAllocation> {
  const holdings = await InvestmentHolding.find({ userId });
  const totalInvested = holdings.reduce((s, h) => s + h.investedAmount, 0);
  const totalCurrentValue = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalGain = totalCurrentValue - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const byTypeMap: Record<string, { invested: number; currentValue: number }> = {};
  for (const h of holdings) {
    if (!byTypeMap[h.type]) byTypeMap[h.type] = { invested: 0, currentValue: 0 };
    byTypeMap[h.type].invested += h.investedAmount;
    byTypeMap[h.type].currentValue += h.currentValue;
  }
  const byType = Object.entries(byTypeMap).map(([type, data]) => ({
    type, invested: data.invested, currentValue: data.currentValue,
    allocation: totalCurrentValue > 0 ? Math.round((data.currentValue / totalCurrentValue) * 1000) / 10 : 0,
    gain: data.currentValue - data.invested,
  }));

  const concentrationWarnings: string[] = [];
  for (const item of byType) {
    if (item.allocation > 60) concentrationWarnings.push(`${Math.round(item.allocation)}% of portfolio is in ${item.type}.`);
  }
  return { totalInvested, totalCurrentValue, totalGain, totalReturn: Math.round(totalReturn * 10) / 10, byType, concentrationWarnings };
}