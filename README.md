# Finora

Finora is a production-style personal finance manager focused on the complete picture: account balances, income, expenses, saving, investing, budgets, goals, net worth, and reports.

## Stack and structure

- `Frontend/`: Next.js App Router, strict TypeScript, Tailwind CSS, TanStack Query, Recharts
- `Backend/`: Express, TypeScript, MongoDB/Mongoose, JWT, bcrypt, Zod

The services are independently deployable to Vercel and Render/Railway. MongoDB Atlas replica sets are supported.

## Financial architecture

Transactions are the source of truth. `Account.currentBalance` is a transactionally maintained projection used for fast reads. Creating a transaction applies its balance impact inside a MongoDB session. Editing first reverses the complete old impact and then applies the new impact; deleting reverses it. Transfers and owned-account saving/investment movements debit their source and credit their destination, preserving net worth. Saving and investment without a destination debit the source because the external asset is not represented as an owned account.

Dashboard, report, budget, and goal values are aggregations, not manually stored totals. Budgets count only `expense`; goal progress counts linked `saving` transactions. The savings rate is `(saving + investment) / income × 100`, with zero income returning zero.

MongoDB transactions require a replica set. Atlas provides one by default; for local development, run MongoDB as a single-node replica set.

## Local setup

1. Copy `Backend/.env.example` to `Backend/.env` and set a strong `JWT_SECRET` and `MONGODB_URI`.
2. Copy `Frontend/.env.example` to `Frontend/.env.local`.
3. Run `npm install` in both `Backend` and `Frontend`.
4. Start the API with `npm run dev` in `Backend`.
5. Start Next.js with `npm run dev` in `Frontend`.
6. Open `http://localhost:3000` and register, or run `npm run seed` in `Backend` for optional demo data.

Run `npm test` and `npm run build` in `Backend`; run `npm run build` in `Frontend` for production checks.

## API

Authentication lives at `/api/auth/register`, `/login`, and `/me`. Authenticated resources use `/api/accounts`, `/transactions`, `/categories`, `/budgets`, `/goals`, `/dashboard/summary`, `/reports`, `/net-worth`, and `/net-worth/history`. Responses use `{ success, data }` or `{ success: false, message }`. The API derives user identity exclusively from the bearer JWT.

The V1 client includes account edit/reactivation/history, transaction detail/edit/delete with scalable filters and pagination, custom category management, monthly budget CRUD, goal lifecycle and contributions, deterministic dashboard alerts, net-worth snapshots, date-filtered reports, and profile settings.

## V3 functionality

V3 transforms Finora from a records-and-management tool into a decision-support tool. All V3 calculations are deterministic, explainable, and derived from real user data. No generative AI is used for any financial calculation.

### V3 features

1. **Financial Health Score** (0–100, fully explainable)
2. **Safe-to-Spend** — how much you can safely spend before the next expected income
3. **Cash Flow Forecasting** — next 7/30/60/90 days from recurring income, bills, debt, savings, and investment plans
4. **Monthly Financial Forecast** — actual-to-date vs. expected-to-date for the current month
5. **Emergency Fund Intelligence** — coverage months, gap, and estimated completion using user-selected essential categories
6. **Sinking Funds** — gradual saving for known future expenses with required monthly contribution
7. **Subscription Intelligence** — monthly/annual subscription cost and deterministic possible-subscription detection
8. **Unusual Spending Detection** — category spikes and large transactions vs. historical baselines
9. **Spending Trends** — increasing/decreasing/stable categories
10. **Debt Payoff Planner** — snowball/avalanche/custom simulation (read-only)
11. **Goal Planning Simulator** — "save ₹X → when?" and "by this date → how much per month?" (read-only)
12. **Investment Allocation Analysis** — allocation by type with concentration warnings (informational only)
13. **FIRE / Retirement Planner** — configurable assumptions, compound-growth projection
14. **Financial Calendar** — upcoming bills, EMIs, goals, and recurring events
15. **Monthly Financial Review** — month summary with prior-month comparison, insights, and priorities
16. **Smart Recommendations** — deterministic, data-backed action items with priority and impact
17. **Dashboard V3** — Safe-to-Spend, Financial Health, Smart Recommendations, Monthly Review
18. **Scenario Simulator** — read-only "what if" projections that never modify real data
19. **Financial Data Confidence** — how complete your data is (new users start "low")
20. **Merchant Normalization** — optional, non-destructive mapping of descriptions to a normalized merchant
21. **Financial Milestones** — subtle, professional celebrations of actual progress
22. **Financial Context Service** — structured, security-safe summary ready for a future AI assistant

### Financial Health Score formula

The score is the sum of six weighted, independently explainable components (max 100):

| Component | Points | Basis |
|---|---|---|
| Savings Rate | 25 | `(saving + investment) / income × 100`; ≥30% = 25, 20–29% = 20, 10–19% = 14, >0% = 7, ≤0% = poor (zero income handled safely) |
| Emergency Fund | 20 | proportional to `monthsCovered / targetMonths` (derived from essential monthly expenses) |
| Debt Burden | 20 | required debt payments vs. monthly income; high-interest debt penalized |
| Budget Discipline | 15 | `15 × (1 − exceededBudgets / totalConfiguredBudgets)`; unconfigured categories not penalized |
| Cash Flow Stability | 10 | months with positive cash flow out of observed months |
| Goal Progress | 10 | mean completion across active goals |

The API returns a `breakdown` with each component's score, max, and a human-readable `detail` so the user can always understand *why* the score is what it is.

### Safe-to-Spend calculation

```
availableCash (liquid, spendable accounts only)
− upcoming bills
− planned debt payments
− planned savings
− planned investments
− essential spending reserve (prorated to the horizon)
= Safe-to-Spend (clamped at 0; shortfall reported separately)
```

The calculation deliberately excludes investment portfolio value, locked savings, credit limits, and unused loan amounts. If data is insufficient it returns `status: "insufficient_data"` instead of inventing a value.

### Forecast methodology

- Recurring rules are expanded deterministically into dated events (day-of-month clamping for month ends).
- Debt EMIs are projected month-by-month using each liability's interest rate and outstanding balance.
- Remaining monthly savings/investment targets are added from financial preferences.
- Running balance starts from actual liquid cash; events never write Transaction records.
- **Forecast data is never mixed with actual transactions** — projected values are clearly labeled.

### Emergency Fund calculation

`monthsCovered = liquidEmergencySavings / averageEssentialMonthlyExpenses`. Essentials come from user-selected essential categories (defaults provided). Target months (default 6) come from financial preferences. `gap = target − current`; `estimatedCompletionDate` uses the observed monthly contribution rate. Zero essential expenses returns `insufficient_data`, never a misleading number.

### Sinking Funds

`requiredMonthlyContribution = (targetAmount − currentAmount) / monthsUntilTargetDate`. Contributions are recorded as saving-type transactions with `sinking_fund_contribution` metadata; fund balances are updated transactionally and contribute to net worth only when unlinked to an account.

### Anomaly detection methodology

- **category_spike**: current-month category total > 1.5× the average of the previous 2 months (needs 2+ months of history).
- **large_transaction**: individual expense > mean + 2 standard deviations of recent category expenses.
Neutral language is used; no fraud accusations are implied. No anomalies are reported without sufficient history.

### Debt planner algorithms

- **Snowball**: smallest outstanding balance first.
- **Avalanche**: highest interest rate first.
- **Custom**: user-supplied order.
The planner runs a month-by-month amortization (max 600 months) — minimums are paid, extra payments cascade, freed minimums roll into remaining debts. It returns payoff months, total interest, and interest saved vs. a zero-extra baseline. It is a pure simulation and never mutates liabilities.

### Goal simulator

- "If I save ₹X every month" → months to reach + estimated date.
- "Reach by DATE" → required monthly contribution.
Both are read-only; nothing about the goal is changed.

### FIRE assumptions

`FIRE number = annual expenses / safe withdrawal rate` (default 4%). Future portfolio uses compound growth with monthly contributions. All assumptions (ages, return, inflation, withdrawal rate) are editable in Financial Preferences or per-run. Results are labeled projections, not guarantees.

### Monthly Review

Period aggregation for income, expenses, savings, investments, debt reduction, net worth change, savings rate, budget performance, and goal progress, compared to the previous month. Percentage changes guard against zero/Infinity. Two to three data-backed priorities are generated (never generic filler).

### Recommendation rules

Each recommendation carries `id`, `type`, `priority (low/medium/high)`, `title`, `description`, `reason`, `potentialImpact`, and `actionUrl`. Rules include: savings rate < 20%, budget exceeded/approaching, subscriptions > 10% of income, high-interest debt > 12%, and goals behind schedule. No recommendation is generated without supporting data.

### Financial Data Confidence

Scores 0–100 across: active accounts, ≥30 days of history, ≥80% categorized transactions, recurring income configured, bills configured, liabilities tracked, investment freshness (≤90 days), and budgets configured. Levels: high ≥75, medium ≥50, low <50. A new user starts "low".

### Financial Context Service

`GET /api/financial-context` returns a structured, allow-listed summary (period, income, expenses, savings, investments, debt, net worth, budgets, goals, upcoming bills, health score, safe-to-spend, anomalies, recommendations). It never exposes passwords, JWTs, or authentication metadata. It is designed to be consumed later by a V4 AI assistant layer.

### Merchant normalization

Optional and non-destructive. Imports can store `originalDescription` and a derived `normalizedMerchant` (plus a user-editable `MerchantMapping`). The original description is never overwritten and no external AI is used — mapping is deterministic rule-based plus saved user history.

### V3 APIs

- `GET /api/financial-health`
- `GET /api/safe-to-spend`
- `GET /api/forecast/cash-flow?days=N` and `GET /api/forecast/month`
- `GET /api/emergency-fund`
- `GET/POST/PUT/DELETE /api/sinking-funds` (+ `/:id/contribute`, `/:id/history`)
- `GET /api/subscriptions/analytics` and `GET /api/subscriptions/detect`
- `GET /api/insights/anomalies`
- `POST /api/planning/debt`
- `POST /api/planning/goal/simulate` and `POST /api/planning/goal/required`
- `GET /api/planning/portfolio`
- `GET/POST /api/planning/fire`
- `POST /api/planning/scenario`
- `GET /api/calendar/financial?months=N`
- `GET /api/monthly-review?year=N&month=N`
- `GET /api/recommendations`
- `GET /api/financial-context`
- `GET/PUT /api/financial-preferences`
- `GET /api/data-confidence`
- `GET /api/merchants` (+ `PUT/DELETE /api/merchants/:id`, `POST /api/merchants/normalize`)
- `GET /api/milestones` (+ `POST /api/milestones/detect`)

### V3 frontend pages

- `/planning` — health score, safe-to-spend, confidence, cash-flow forecast, emergency fund, month-end forecast
- `/planning/debt` — debt payoff planner
- `/planning/fire` — FIRE projection
- `/planning/scenarios` — what-if simulator
- `/sinking-funds` — sinking fund CRUD and contributions
- `/monthly-review` — monthly financial review
- `/calendar` — financial calendar
- `/insights` — anomalies, subscription analytics, possible subscriptions
- `/settings/financial` — financial preferences
- Dashboard V3 — primary cards (net worth, safe-to-spend, health, cash flow), smart recommendations, insights

### V3 seed

`npm run seed:v3` seeds 6 months of realistic, varied transactions (salary, rent, food, transport, shopping, utilities, subscriptions, SIP, savings, emergency fund, goals, sinking funds) plus financial preferences — ideal for demoing forecasting, anomalies, and trends. It runs after the existing `npm run seed` (V1 + V2); the V1/V2 seed behavior is unchanged.

### Tests

`npm test` runs 118 tests covering V1, V2, and V3 — including financial-health bounds and zero-income handling, safe-to-spend exclusions and insufficient-data paths, forecast non-mutation, emergency-fund math, sinking-fund requirements, subscription annual cost, anomaly history thresholds, snowball/avalanche ordering and planner non-mutation, goal-simulator non-mutation, portfolio allocation totals, FIRE configurable/zero assumptions, scenario non-mutation, monthly-review comparison and Infinity guards, net-worth double-count guards, credit-card payment exclusion, investment-vs-expense distinction, cross-user isolation, financial-context security, notification-preference gating, attention-flag detection/resolution, and a cross-feature consistency regression (balances, analytics, budgets, net worth, forecast, safe-to-spend, and health score must agree after every transaction type).

## V3 roadmap

Direct bank/UPI/open-banking connections, live security prices or NAV, credit scoring, tax filing, OCR/SMS/email ingestion, household collaboration, and generative financial advice (powered by the Financial Context Service) remain intentionally deferred.

## Deployment and recurring processing

Deploy `Frontend` to Vercel with `NEXT_PUBLIC_API_URL` set to the public API URL. Deploy `Backend` to Render/Railway with the backend environment values, build command `npm ci && npm run build`, and start command `npm start`. Allow the backend origin in Atlas and set `FRONTEND_URL` to the Vercel domain.

Recurring transactions are processed by an internal worker: run `npm run process-recurring` once per day in production (e.g. a daily cron/Render cron job pointing at that command). The worker is self-contained — it connects to MongoDB and generates every user's due transactions; generation is idempotent (a unique compound index per rule + scheduled date), so repeated or overlapping runs are safe. For platforms that only support HTTP schedulers, the equivalent endpoint is `POST /api/system/recurring/process` guarded by the `x-cron-secret` header matching `CRON_SECRET` (403 if unmatched, 503 if `CRON_SECRET` is not configured). Health checks can poll `GET /api/system/recurring/status` with the same header.

## V2 functionality

V2 adds recurring transactions and bills, safe CSV/XLSX statement import with preview and duplicate decisions, transaction sources/tags/references, liabilities and credit-card payments, manually valued investment holdings, enhanced goals and withdrawals, in-app notifications, advanced reports, cash-flow analytics, CSV export, and deterministic financial insights.

Recurring rules store their next due date. Run `npm run process-recurring` locally or in production; the `POST /api/system/recurring/process` endpoint (guarded by `CRON_SECRET`) exists for HTTP-only schedulers. Generated transactions carry the recurring rule and scheduled date; a unique compound index makes generation idempotent.

Statement files are parsed in the browser with formulas disabled, limited to 5 MB and 5,000 rows, mapped by the user, sanitized, previewed by the API, and checked using account + date + amount + normalized description. Suspected duplicates are skipped unless the user explicitly selects “import anyway.” Imported transactions use the normal balance service and retain an import batch ID.

Liability payments use saving-style cash movement with `liability_payment` metadata, so principal repayment is not counted as lifestyle spending. The known principal portion reduces outstanding debt; when no split is supplied, payment minus stated interest is treated as principal. Credit-card bill payments follow the same rule and therefore do not double-count an expense recorded at purchase time.

Investment holdings use manually supplied current values. Contributions and buys reduce the selected cash account and increase invested/current holding values; sells and withdrawals increase cash and reduce holding values. Gain is current value minus invested amount and return is zero-safe.

Net worth is account assets plus holding value minus outstanding liabilities. When a holding is linked to an investment account, that account balance is excluded from the account subtotal to prevent double counting. Snapshots are refreshed after balance-affecting changes.

Insights and notifications are deterministic. They compare actual monthly totals and inspect budgets, goals, liabilities, recurring bills, and net-worth history. No generative AI is used.

### V2 APIs

- `/api/recurring` and `/api/recurring/process`
- `/api/imports/preview` and `/api/imports/commit`
- `/api/liabilities` and `/:id/payments`
- `/api/investments` and `/:id/activities`
- `/api/notifications`
- `/api/goals/:id/withdrawals`
- `/api/transactions/export/csv`

Set `CRON_SECRET` (required only if you call the `/api/system` cron endpoints; otherwise optional). Keep MongoDB configured as a replica set. Production should run the recurring worker (`npm run process-recurring`) on a daily schedule, or call the secret-protected system endpoint from an HTTP scheduler.
