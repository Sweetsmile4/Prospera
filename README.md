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

## Deployment

Deploy `Frontend` to Vercel with `NEXT_PUBLIC_API_URL` set to the public API URL. Deploy `Backend` to Render/Railway with the backend environment values, build command `npm ci && npm run build`, and start command `npm start`. Allow the backend origin in Atlas and set `FRONTEND_URL` to the Vercel domain.

## V2 roadmap

## V2 functionality

V2 adds recurring transactions and bills, safe CSV/XLSX statement import with preview and duplicate decisions, transaction sources/tags/references, liabilities and credit-card payments, manually valued investment holdings, enhanced goals and withdrawals, in-app notifications, advanced reports, cash-flow analytics, CSV export, and deterministic financial insights.

Recurring rules store their next due date. Run `npm run process-recurring` locally or invoke the authenticated processor endpoint from a scheduler. Generated transactions carry the recurring rule and scheduled date; a unique compound index makes generation idempotent.

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

No new environment variables are required. A production deployment should call the recurring processor from an authenticated scheduled job and keep MongoDB configured as a replica set.

## V3 roadmap

Direct bank/UPI/open-banking connections, live security prices or NAV, credit scoring, tax filing, OCR/SMS/email ingestion, household collaboration, and generative financial advice remain intentionally deferred.
