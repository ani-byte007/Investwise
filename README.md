# InvestWise AI — Indian Equity Research & Portfolio Intelligence Platform

InvestWise AI is a full-stack public-facing FinTech investment research and portfolio intelligence platform tailored for self-directed Indian retail investors.

## Architecture

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (`@radix-ui/*`), TradingView Lightweight Charts (`lightweight-charts` v5)
- **Authentication & Database**: Firebase Authentication (Google Sign-In + Email/Password with Email Verification & Password Reset) and Cloud Firestore (`firebase-blueprint.json`, `firestore.rules`, `firestore.indexes.json`)
- **Backend Server (`server.ts`)**: Express server with Vite middleware in development, sliding-window API rate limiting, Firebase Admin ID token verification (`verifyIdToken`), deterministic calculation verification endpoint, grounded Gemini AI endpoint (`@google/genai`), and HMAC payment webhook verification stub
- **Financial Calculation Engine (`src/engine/financialCalculations.ts`)**: Deterministic, independently testable calculations for 17 equity and portfolio metrics with formula attribution and edge-case handling
- **Data Adapter Layer (`src/services/dataAdapters.ts`)**: Provider-independent adapter isolating financial datasets (`nse_reference` evaluation snapshot) from UI and AI components

## Local Development & Verification

```bash
npm install
npm run dev          # Starts full-stack Express + Vite server on http://localhost:3000
npm run lint         # TypeScript type-checking (tsc --noEmit)
npm run test:calc    # Runs deterministic 17-metric calculation & portfolio test suite
npx eslint firestore.rules  # Audits Firestore security rules with @firebase/eslint-plugin-security-rules
npm run build        # Production Vite bundle
```

## Compliance & Licensing Posture

- **Not SEBI-Registered**: InvestWise AI is an analytical calculation and research software platform. It is not registered with SEBI as an Investment Adviser or Research Analyst.
- **No Fabricated Live Data**: Market displays rely strictly on audited historical reference data (`nse_reference`) until commercial exchange redistribution licenses (NSE/BSE/Morningstar) are approved.
- **No Live Payments**: Subscription tiers (Free ₹0/mo, Proposed Premium ₹299/mo) are configurable; live payment collection remains gated behind `PAYMENT_WEBHOOK_SECRET` verification.
