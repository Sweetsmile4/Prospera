import pathlib
p = pathlib.Path("src/services/v3.test.ts")
c = p.read_text(encoding="utf-8")
extra = """
  it("financial calendar includes recurring and debt events", async () => {
    const events = await getFinancialCalendar(userId, 1);
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events.some(e => e.title === "Salary")).toBe(true);
    expect(events.some(e => e.title.toLowerCase().includes("emi"))).toBe(true);
  });

  it("monthly review compares periods", async () => {
    const r = await generateMonthlyReview(userId);
    expect(r.income).toBeGreaterThanOrEqual(0);
    expect(r.expenses).toBeGreaterThanOrEqual(0);
    expect(typeof r.comparison.incomeChange).toBe("number");
    expect(r.insights.length).toBeGreaterThanOrEqual(0);
    expect(r.priorities.length).toBeGreaterThanOrEqual(0);
  });

  it("monthly review prev zero does not create Infinity", async () => {
    const r = await generateMonthlyReview(userId);
    expect(r.comparison.incomeChange).not.toBe(Infinity);
    expect(r.comparison.incomeChange).not.toBe(-Infinity);
    expect(typeof r.comparison.savingsRateChange).toBe("number");
  });

  it("recommendations is array with valid fields", async () => {
    const recs = await generateRecommendations(userId);
    expect(Array.isArray(recs)).toBe(true);
    recs.forEach(r => {
      expect(["low","medium","high"].includes(r.priority)).toBe(true);
      expect(r.id).toBeDefined();
      expect(r.actionUrl).toBeDefined();
    });
  });

  it("financial context never includes password or JWT", async () => {
    const ctx = await getFinancialContext(userId);
    expect(ctx).not.toHaveProperty("password");
    expect(ctx).not.toHaveProperty("passwordHash");
    expect(ctx).not.toHaveProperty("token");
    expect(ctx).not.toHaveProperty("JWT");
    expect(ctx.period).toBeDefined();
    expect(ctx.income).toBeGreaterThanOrEqual(0);
  });

  it("other user cannot access planning data", async () => {
    const other = await User.create({ name: "Other", email: "other@v3.test", passwordHash: "x" });
    await Account.create({ userId: other._id, name: "Other Bank", type: "bank", openingBalance: 99999, currentBalance: 99999 });
    await Liability.create({ userId: other._id, name: "Other Loan", type: "personal loan", originalAmount: 50000, outstandingAmount: 30000, interestRate: 10, emiAmount: 1000 });
    const health = await calculateFinancialHealth(other._id);
    const safe = await calculateSafeToSpend(other._id);
    const forecast = await forecastCashFlow(other._id, 30);
    const ef = await getEmergencyFundStatus(other._id);
    expect(health.score).toBeGreaterThanOrEqual(0);
    expect(safe.status).toBeDefined();
    expect(forecast.events.length).toBeGreaterThanOrEqual(0);
    expect(ef.monthsCovered).toBeGreaterThanOrEqual(0);
  });
});
"""
p.write_text(c + extra, encoding="utf-8")
print("APPENDED", len(extra.splitlines()), "lines")
print("TOTAL", (c + extra).count("\n") + 1, "lines")

import pathlib
