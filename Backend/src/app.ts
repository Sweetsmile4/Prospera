import express from "express";
import cors from "cors";
import { requireAuth } from "./middleware/auth";
import { requireCronSecret } from "./middleware/cronSecret";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./routes/auth"; import { accountsRouter } from "./routes/accounts"; import { transactionsRouter } from "./routes/transactions"; import { categoriesRouter } from "./routes/categories"; import { budgetsRouter } from "./routes/budgets"; import { goalsRouter } from "./routes/goals"; import { analyticsRouter } from "./routes/analytics";
import { recurringRouter } from "./routes/recurring"; import { liabilitiesRouter } from "./routes/liabilities"; import { investmentsRouter } from "./routes/investments"; import { notificationsRouter } from "./routes/notifications"; import { importsRouter } from "./routes/imports"; import { v3Router } from "./routes/v3"; import { systemRouter } from "./routes/system";

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL?.split(",") || "http://localhost:3000" }));

app.use(express.json({limit:"5mb"}));

app.get("/api/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
app.use("/api/system", requireCronSecret, systemRouter);
app.use("/api/auth",authRouter); app.use("/api/accounts",requireAuth,accountsRouter); app.use("/api/transactions",requireAuth,transactionsRouter); app.use("/api/categories",requireAuth,categoriesRouter); app.use("/api/budgets",requireAuth,budgetsRouter); app.use("/api/goals",requireAuth,goalsRouter); app.use("/api/recurring",requireAuth,recurringRouter);app.use("/api/liabilities",requireAuth,liabilitiesRouter);app.use("/api/investments",requireAuth,investmentsRouter);app.use("/api/notifications",requireAuth,notificationsRouter);app.use("/api/imports",requireAuth,importsRouter);app.use("/api",requireAuth,analyticsRouter);app.use("/api",requireAuth,v3Router); app.use(notFound); app.use(errorHandler);

export default app;
