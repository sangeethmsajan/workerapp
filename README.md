# WorkTrack

A field & project management web app for contractors, site managers, and solo operators.

Built with React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Express, SQLite (Drizzle ORM), TanStack Query, and Recharts.

## Run locally

Prerequisites: **Node.js 20+** and **npm**.

```bash
npm install
npm run dev
```

Open http://localhost:5000

Works on **Windows, macOS, and Linux** — the scripts use `cross-env` so you can run them in PowerShell, CMD, or any Unix shell.

The app uses SQLite for persistence (file `data.db` is created automatically on first run and seeded with demo data — 4 projects, 21 workers, today's tasks, attendance for the last 14 days, expenses, and invoices).

> **Upgrading from an earlier version?** This release adds authentication and per-user data isolation. The DB schema changed (every table now has a `userId` column, plus a new `users` table). Delete the old `data.db` (and `data.db-shm` / `data.db-wal`) before running `npm run dev` so the seed runs cleanly.

## Authentication

The app requires login. On first run, a super admin account is auto-created:

- Email: `admin@worktrack.local`
- Password: `admin123`

**Change this password immediately in Settings → Account.**

You can also register new user accounts at `/#/signup`. Each user has fully isolated data — they only see their own projects, workers, tasks, etc. The super admin sees and manages everything via the **Users** page, and can "View as" any user to inspect their workspace.

### Google Sign-In (optional)

The "Continue with Google" button only appears if you've configured Google OAuth. To set it up:

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID, type "Web application"
3. Authorized JavaScript origins: `http://localhost:5000`
4. Copy the Client ID and Client Secret
5. Copy `.env.example` to `.env` and fill in:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   VITE_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>
   SESSION_SECRET=<any random string>
   ```
   Note: `VITE_GOOGLE_CLIENT_ID` is the same value as `GOOGLE_CLIENT_ID` — Vite needs the `VITE_` prefix to expose it to the frontend, while the server reads `GOOGLE_CLIENT_ID`.
6. Restart `npm run dev`.

## Features

- **Dashboard** — stat cards, today's tasks (filter by site), team workload, recent expenses
- **Projects** — create, edit, delete, track progress against budget and timeline
- **Daily tasks** — assign to workers, cycle status (pending → in progress → done → delayed), notes
- **Team & workers** — manage workers, roles, daily wages, site assignments
- **Attendance** — one-tap mark present / absent / leave per day
- **Payroll** — auto-calculated from attendance × daily wage, monthly view, mark paid
- **Expenses** — log against project, approval workflow (pending → approved → paid)
- **Invoices** — dynamic line items, auto-totaled, printable view
- **Analytics** — tasks completed, expense trends, category breakdown, attendance rate
- **Settings** — user name, company name, currency

## Production build

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Tech notes

- Backend routes are under `/api/*` — see `server/routes.ts`
- Schema in `shared/schema.ts`
- Frontend pages in `client/src/pages/`
- Reusable components in `client/src/components/`
- Dark theme by default
- Currency: ₹ (INR) — easy to change in Settings
