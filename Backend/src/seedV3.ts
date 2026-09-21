import dotenv from "dotenv";
import { connectDatabase, disconnectDatabase } from "./config/database";
import { User } from "./models/User";
import { Account } from "./models/Account";
import { Category } from "./models/Category";
import { Transaction } from "./models/Transaction";
import { Goal } from "./models/Goal";
import { Budget } from "./models/Budget";
import { SinkingFund } from "./models/SinkingFund";
import { FinancialPreference } from "./models/FinancialPreference";
import { createTransaction } from "./services/transactions";

dotenv.config();

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function run() {
  await connectDatabase();
  const user = await User.findOne({ email: process.env.DEMO_EMAIL || "demo@finora.app" });
  if (!user) throw Error("Run V1 seed first");

  const accounts = await Account.find({ userId: user._id });
  const bank = accounts.find(a => a.type === "bank")!;
  const cash = accounts.find(a => a.type === "cash");
  const emergencyAcc = accounts.find(a => a.type === "savings");
  const investment = accounts.find(a => a.type === "investment");

  const cats = await Category.find({ userId: null });
  const cat = (name: string) => String(cats.find(c => c.name === name)!._id);

  await Promise.all([
    Transaction.deleteMany({ userId: user._id }),
    SinkingFund.deleteMany({ userId: user._id }),
  ]);

  const goal = await Goal.findOne({ userId: user._id, name: "Emergency Fund" })
    || await Goal.create({
      userId: user._id,
      name: "Emergency Fund",
      targetAmount: 90000,
      targetDate: new Date(Date.now() + 365 * 864e5),
      monthlyTarget: 5000,
    });

  const laptopGoal = await Goal.create({
    userId: user._id,
    name: "Laptop Replacement",
    targetAmount: 80000,
    targetDate: new Date(Date.now() + 240 * 864e5),
    monthlyTarget: 3000,
    priority: "medium",
  });

  const vacationGoal = await Goal.create({
    userId: user._id,
    name: "Vacation",
    targetAmount: 40000,
    targetDate: new Date(Date.now() + 180 * 864e5),
    monthlyTarget: 2000,
    priority: "low",
  });

  const sinkingFunds = await SinkingFund.create([
    {
      userId: user._id,
      name: "Annual Insurance",
      targetAmount: 15000,
      targetDate: new Date(Date.now() + 120 * 864e5),
      monthlyContribution: 1500,
      linkedAccountId: bank._id,
    },
    {
      userId: user._id,
      name: "Festival Expenses",
      targetAmount: 20000,
      targetDate: new Date(Date.now() + 60 * 864e5),
      monthlyContribution: 2000,
      linkedAccountId: bank._id,
    },
    {
      userId: user._id,
      name: "Vehicle Service",
      targetAmount: 8000,
      targetDate: new Date(Date.now() + 90 * 864e5),
      monthlyContribution: 1000,
      linkedAccountId: bank._id,
    },
  ]);

  await FinancialPreference.findOneAndUpdate(
    { userId: user._id },
    {
      essentialCategories: [cat("Food"), cat("Bills")],
      essentialCategoriesConfigured: true,
      emergencyFundTargetMonths: 6,
      emergencyFundGoalId: goal._id,
      emergencyFundAccountId: emergencyAcc?._id,
      preferredDebtStrategy: "avalanche",
      monthlySavingsTarget: 8000,
      monthlyInvestmentTarget: 5000,
      safeToSpendReserve: 5000,
      fireSettings: {
        currentAge: 28,
        retirementAge: 55,
        expectedAnnualReturn: 10,
        inflationRate: 6,
        safeWithdrawalRate: 4,
      },
    },
    { upsert: true }
  );

  const now = new Date();
  const income = 30000;

  for (let m = 5; m >= 0; m--) {
    const base = monthsAgo(m);
    const txBase = { transactionDate: base, accountId: String(bank._id) };

    await createTransaction(user._id, { ...txBase, type: "income", title: "Salary", amount: income + randomBetween(-2000, 3000), categoryId: cat("Salary") });

    const rent = 8000;
    const rentDate = new Date(base);
    rentDate.setDate(5);
    await createTransaction(user._id, { ...txBase, transactionDate: rentDate, type: "expense", title: "Rent", amount: rent, categoryId: cat("Rent") });

    const foodMonths = [3500, 4200, 3800, 5100, 3200, 7200];
    const foodDate = new Date(base);
    foodDate.setDate(10);
    await createTransaction(user._id, { ...txBase, transactionDate: foodDate, type: "expense", title: "Groceries", amount: foodMonths[m], categoryId: cat("Food") });

    if (m % 2 === 0) {
      const transportDate = new Date(base);
      transportDate.setDate(15);
      await createTransaction(user._id, { ...txBase, transactionDate: transportDate, type: "expense", title: "Metro Pass", amount: randomBetween(800, 1200), categoryId: cat("Travel") });
    }

    const shoppingDate = new Date(base);
    shoppingDate.setDate(20);
    await createTransaction(user._id, { ...txBase, transactionDate: shoppingDate, type: "expense", title: "Shopping", amount: m === 2 ? 15000 : randomBetween(500, 3000), categoryId: cat("Shopping") });

    const utilDate = new Date(base);
    utilDate.setDate(8);
    await createTransaction(user._id, { ...txBase, transactionDate: utilDate, type: "expense", title: "Electricity", amount: randomBetween(800, 1500), categoryId: cat("Bills") });

    if (m % 3 === 0) {
      const medDate = new Date(base);
      medDate.setDate(12);
      await createTransaction(user._id, { ...txBase, transactionDate: medDate, type: "expense", title: "Doctor Visit", amount: randomBetween(500, 1500), categoryId: cat("Healthcare") });
    }

    const sipDate = new Date(base);
    sipDate.setDate(15);
    await createTransaction(user._id, { ...txBase, transactionDate: sipDate, type: "investment", title: "Monthly SIP", amount: 3000, categoryId: cat("SIP"), destinationAccountId: investment ? String(investment._id) : undefined });

    const saveDate = new Date(base);
    saveDate.setDate(18);
    await createTransaction(user._id, { ...txBase, transactionDate: saveDate, type: "saving", title: "Emergency fund contribution", amount: 2500, goalId: String(goal._id), destinationAccountId: emergencyAcc ? String(emergencyAcc._id) : undefined });

    if (m > 0) {
      const laptopDate = new Date(base);
      laptopDate.setDate(22);
      await createTransaction(user._id, { ...txBase, transactionDate: laptopDate, type: "saving", title: "Laptop fund", amount: 1500, goalId: String(laptopGoal._id) });
    }

    if (m % 2 === 0) {
      const netflixDate = new Date(base);
      netflixDate.setDate(1);
      await createTransaction(user._id, { ...txBase, transactionDate: netflixDate, type: "expense", title: "Netflix", amount: 649, categoryId: cat("Subscriptions") });
    }

    if (cash) {
      const cashDate = new Date(base);
      cashDate.setDate(25);
      await createTransaction(user._id, { ...txBase, transactionDate: cashDate, type: "expense", title: "Dining Out", amount: randomBetween(500, 2000), categoryId: cat("Food"), accountId: String(cash._id) });
    }
  }

  const budgetMonth = now.getMonth() + 1;
  const budgetYear = now.getFullYear();
  await Promise.all([
    Budget.findOneAndUpdate(
      { userId: user._id, categoryId: cat("Food"), month: budgetMonth, year: budgetYear },
      { limit: 5000 },
      { upsert: true, new: true }
    ),
    Budget.findOneAndUpdate(
      { userId: user._id, categoryId: cat("Shopping"), month: budgetMonth, year: budgetYear },
      { limit: 3000 },
      { upsert: true, new: true }
    ),
    Budget.findOneAndUpdate(
      { userId: user._id, categoryId: cat("Travel"), month: budgetMonth, year: budgetYear },
      { limit: 2000 },
      { upsert: true, new: true }
    ),
  ]);

  console.log(`V3 seed complete for ${process.env.DEMO_EMAIL || "demo@finora.app"}`);
  console.log(`- 6 months of realistic transactions`);
  console.log(`- Emergency Fund goal + laptop + vacation goals`);
  console.log(`- 3 sinking funds`);
  console.log(`- Financial preferences configured`);
  console.log(`- Monthly budgets set`);
  await disconnectDatabase();
}

run().catch(e => { console.error(e); process.exit(1); });
