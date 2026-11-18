import { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  Briefcase,
  Building2,
  Check,
  FileSpreadsheet,
  FileText,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { computeAllEquityMetrics } from '../engine/financialCalculations.ts';
import { formatInr } from '../lib/utils.ts';
import { marketDataAdapter } from '../services/dataAdapters.ts';
import type { PlatformSettings } from '../types/financial.ts';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';

interface PublicLandingPageProps {
  platformSettings: PlatformSettings;
  isSignedIn: boolean;
  onEnterWorkspace: (initialTab?: string, symbol?: string) => void;
  onOpenAuth: () => void;
}

type LegalModalTopic =
  | 'about'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'risk'
  | 'sources';

const LEGAL_MODAL_COPY: Record<
  LegalModalTopic,
  { title: string; subtitle: string; paragraphs: string[] }
> = {
  about: {
    title: 'About InvestWise AI',
    subtitle: 'Public Indian Equity Research & Portfolio Intelligence Platform',
    paragraphs: [
      'InvestWise AI is engineered for self-directed Indian retail equity investors who require verifiable fundamental ratios, clean statement breakdowns, and transparent portfolio accounting in INR.',
      'Unlike opaque black-box stock tips, every ratio displayed by InvestWise AI originates from a deterministic TypeScript calculation engine with attached formulas, source period timestamps, and zero-denominator protection.',
      'Generative AI explanations (powered via server-side Gemini integration) strictly interpret pre-computed financial snapshots and never invent stock prices or financial metrics.',
    ],
  },
  contact: {
    title: 'Contact & Support Desk',
    subtitle: 'Indian Retail Investor Assistance & Data Verification',
    paragraphs: [
      'Registered product investors can submit data accuracy checks, corporate-action questions, and account requests directly through the signed-in Support Desk inside Account & Billing.',
      'General inquiries and institutional licensing correspondence: support@investwise-ai.in (Phase 1 evaluation channel; operational SLA schedules will publish at commercial launch).',
      'Platform timezone default: Asia/Kolkata (IST) · Currency: Indian Rupee (INR).',
    ],
  },
  privacy: {
    title: 'Privacy Policy (Phase 1 Summary)',
    subtitle: 'Strict PII Isolation & Zero-Sale Guarantee',
    paragraphs: [
      'Personal account details (email address, timezone preference, notification settings, and disclosure acknowledgments) are isolated inside a private user-scoped Firestore subcollection protected by Firebase Authentication and email verification.',
      'Your portfolio holdings, trade ledgers, watchlists, and saved AI memos are private to your verified Firebase UID and are never published publicly or shared with third-party marketers.',
      'Audit logs record critical security and consent actions without storing plain-text passwords or private financial credentials.',
    ],
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Analytical Software License & Acceptable Use',
    paragraphs: [
      'InvestWise AI provides analytical software, deterministic financial calculation tooling, and AI-assisted document summaries for personal informational and educational evaluation.',
      'Subscription billing gateways remain inactive during Phase 1. Proposed Premium pricing is configurable via platform governance settings (currently proposed at ₹299/month) and will only activate upon explicit commercial launch and webhook verification.',
      'Automated scraping, unauthorized redistribution of underlying reference financials, or attempting to bypass per-user AI quotas is prohibited.',
    ],
  },
  risk: {
    title: 'Investment Risk & SEBI Non-Advisory Disclosure',
    subtitle: 'Important Regulatory Notice for Indian Retail Investors',
    paragraphs: [
      'InvestWise AI is NOT registered with the Securities and Exchange Board of India (SEBI) as an Investment Adviser (IA) or Research Analyst (RA), and does not offer brokerage execution.',
      'Nothing presented on this platform—including deterministic ratios, financial statement summaries, portfolio concentration alerts, or AI-generated explanations—constitutes a recommendation to buy, sell, or hold any security.',
      'Investments in Indian securities markets are subject to market risks. Past financial performance is not indicative of future returns. Read all official exchange filings and consult a SEBI-registered adviser before making investment decisions.',
    ],
  },
  sources: {
    title: 'Financial Data Sources & Freshness',
    subtitle: 'Adapter-Isolated Data Governance',
    paragraphs: [
      'All public previews in Phase 1 operate on an audited NSE/company reference snapshot (FY25–FY26 consolidated filings) strictly flagged as reference evaluation data.',
      'InvestWise AI isolates external market feeds behind a provider-independent adapter layer. Commercial NSE/BSE exchange streams, paid fundamental APIs, and news feeds remain disabled until explicit commercial usage, redistribution, and AI-processing licenses are verified.',
      'Every displayed equity metric shows its source dataset, reporting period, reporting date, and freshness classification so users always know the exact origin of every figure.',
    ],
  },
};

export function PublicLandingPage({
  platformSettings,
  isSignedIn,
  onEnterWorkspace,
  onOpenAuth,
}: PublicLandingPageProps) {
  const featuredEquities = marketDataAdapter.listEquities().slice(0, 5);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalTopic | null>(null);

  const featuresList = [
    {
      title: 'AI-Assisted Stock Research',
      description:
        'Structured fundamental memos generated server-side strictly from verified financial snapshots—explaining thesis, valuation, and risks without synthetic figures.',
      icon: Sparkles,
    },
    {
      title: 'Financial Statement Analysis',
      description:
        'Inspect multi-period Income Statements, Balance Sheets, Cash Flows, and corporate actions alongside deterministic 17-metric ratios and source formulas.',
      icon: FileSpreadsheet,
    },
    {
      title: 'Company Comparison',
      description:
        'Evaluate peer NSE companies side-by-side across P/E, P/B, ROE, ROCE, margins, leverage, and revenue/earnings growth using consistent period alignment.',
      icon: BarChart3,
    },
    {
      title: 'Portfolio Intelligence',
      description:
        'Log equity trades manually or via CSV import to track weighted average purchase price, realized and unrealized INR P/L, sector weights, and concentration.',
      icon: Briefcase,
    },
    {
      title: 'Stock Screening',
      description:
        'Filter covered Indian equities by sector, valuation multiples, capital efficiency (ROCE/ROE), debt discipline, and profit margins.',
      icon: SlidersHorizontal,
    },
    {
      title: 'Investment Research Reports',
      description:
        'Save timestamped, snapshot-linked AI research memos to your private workspace history for ongoing thesis review and auditability.',
      icon: FileText,
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Discover',
      detail:
        'Screen Indian listed companies by sector, market-cap tier, valuation multiples, and return on capital.',
    },
    {
      step: '02',
      title: 'Analyse',
      detail:
        'Examine audited statement trends, 17 deterministic formulas, corporate announcements, and grounded AI interpretations.',
    },
    {
      step: '03',
      title: 'Compare',
      detail:
        'Line up competitors side-by-side to evaluate margin durability, leverage ratios, and earnings growth.',
    },
    {
      step: '04',
      title: 'Monitor',
      detail:
        'Maintain private watchlists, track INR portfolio cost basis and sector allocation, and revisit saved research notes.',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Top Bar Contract: 3 clean zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            InvestWise AI
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#top"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Home
            </a>
            <a
              href="#features"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <button
              type="button"
              onClick={() => onEnterWorkspace('research')}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Stock Research
            </button>
            <button
              type="button"
              onClick={() => onEnterWorkspace('portfolio')}
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Portfolio Intelligence
            </button>
            <a
              href="#pricing"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              Pricing
            </a>
            <a
              href="#trust"
              className="hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-4 whitespace-nowrap shrink-0"
            >
              About
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            {isSignedIn ? (
              <Button onClick={() => onEnterWorkspace('overview')} size="sm">
                Open Dashboard
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={onOpenAuth}>
                  Login
                </Button>
                <Button size="sm" onClick={onOpenAuth}>
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main id="top">
        <section className="mx-auto max-w-[1280px] px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-8 py-2">
              <div className="space-y-5">
                <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
                  India Equity Intelligence · NSE Reference Coverage · Audited FY25–FY26
                </p>
                <h1
                  className="font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-[1.1]"
                  style={{ fontSize: 'clamp(2.2rem, 3.8vw, 3.35rem)', textWrap: 'balance' }}
                >
                  Make Smarter Investment Decisions with AI-Powered Research.
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  Research Indian equities, understand financial fundamentals and evaluate your
                  portfolio with transparent calculations and explainable AI.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Button
                  onClick={() =>
                    isSignedIn ? onEnterWorkspace('overview') : onOpenAuth()
                  }
                  size="lg"
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="lg" asChild>
                  <a href="#features">Explore Features</a>
                </Button>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="relative h-full min-h-[300px] lg:min-h-[420px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-slate-400">
                  <Building2 className="h-10 w-10 mb-2 opacity-60" />
                  <span className="text-sm font-medium">Mumbai Bandra-Kurla Financial District</span>
                </div>
                <img
                  src="/src/assets/images/hero_mumbai_financial_1795014031946.jpg"
                  alt="Mumbai Bandra-Kurla Complex financial towers"
                  referrerPolicy="no-referrer"
                  className="relative z-10 h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent p-5 text-white space-y-1">
                  <p className="text-xs font-semibold text-teal-300">
                    Dashboard Preview · Grounded Research Terminal
                  </p>
                  <p className="text-xs font-mono tabular-nums text-slate-200">
                    17 Deterministic Ratios · INR Portfolio Accounting · Licensed Adapter Registry
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4-column verifiable capability strip below hero */}
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-slate-200 dark:border-slate-800 pt-8">
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Calculation Engine</p>
              <p className="text-lg font-semibold font-mono tabular-nums">17 Verified Metrics</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Formula, denominator guards, and reporting dates attached to every ratio.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">AI Grounding</p>
              <p className="text-lg font-semibold font-mono tabular-nums">Snapshot-Linked</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Gemini explains pre-calculated numbers instead of inventing figures.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Portfolio Accounting</p>
              <p className="text-lg font-semibold font-mono tabular-nums">Weighted Avg Cost</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Manual trades &amp; CSV imports with Realized &amp; Unrealized P/L in INR.
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Data Governance</p>
              <p className="text-lg font-semibold font-mono tabular-nums">Adapter Isolated</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Explicit licensing registry; zero fabricated prices when feeds are unconfigured.
              </p>
            </div>
          </div>
        </section>

        {/* Live Reference Snapshot / Dashboard Preview */}
        <section
          id="research"
          className="border-t border-slate-200 bg-white py-14 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto max-w-[1280px] px-6 space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
                  Interactive Dashboard Preview
                </p>
                <h2 className="text-2xl font-bold tracking-tight">
                  Audited Reference Equities &amp; Deterministic Ratios
                </h2>
              </div>
              <Button variant="outline" onClick={() => onEnterWorkspace('screener')}>
                Open Stock Screener &amp; Comparison
              </Button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Company &amp; Sector</th>
                    <th className="px-4 py-3 font-medium text-right">Reference Price</th>
                    <th className="px-4 py-3 font-medium text-right">P/E</th>
                    <th className="px-4 py-3 font-medium text-right">ROE</th>
                    <th className="px-4 py-3 font-medium text-right">ROCE</th>
                    <th className="px-4 py-3 font-medium text-right">Debt / Equity</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {featuredEquities.map((eq) => {
                    const m = computeAllEquityMetrics(eq).metrics;
                    const changePct =
                      ((eq.latestPriceInr - eq.previousCloseInr) / eq.previousCloseInr) * 100;
                    const isPositive = changePct >= 0;
                    return (
                      <tr
                        key={eq.symbol}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {eq.symbol}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {eq.companyName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {eq.sector} · {eq.provenance.financialPeriod}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          <div>{formatInr(eq.latestPriceInr)}</div>
                          <div
                            className={`text-xs ${
                              isPositive
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-red-700 dark:text-red-400'
                            }`}
                          >
                            {isPositive ? '+' : ''}
                            {changePct.toFixed(2)}%
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {m.pe.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {m.roe.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {m.roce.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {m.debtToEquity.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEnterWorkspace('research', eq.symbol)}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Source: InvestWise Audited Reference Snapshot (FY25–FY26) · Evaluation data only, not a
              live commercial exchange feed.
            </p>
          </div>
        </section>

        {/* Core Platform Features (6 Pillars) */}
        <section id="features" className="mx-auto max-w-[1280px] px-6 py-16 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-2">
              <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
                Core Platform Capabilities
              </p>
              <h2 className="text-2xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>
                Everything self-directed Indian equity investors need for disciplined fundamental
                research.
              </h2>
            </div>
            <div className="lg:col-span-5">
              <div className="relative h-44 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800">
                <img
                  src="/src/assets/images/editorial_research_desk_1795014030923.jpg"
                  alt="Equity research workstation reviewing quarterly financial statements"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuresList.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-lg border border-slate-200 bg-white p-6 space-y-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-teal-700 dark:border-slate-700 dark:bg-slate-950 dark:text-teal-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">{feat.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* How It Works: Discover -> Analyse -> Compare -> Monitor */}
        <section
          id="workflow"
          className="border-t border-slate-200 bg-slate-900 text-slate-100 py-16 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto max-w-[1280px] px-6 space-y-8">
            <div className="max-w-xl space-y-2">
              <p className="text-xs font-medium text-teal-400">How It Works</p>
              <h2 className="text-2xl font-bold tracking-tight">
                A structured four-step research workflow
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {workflowSteps.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-6 space-y-3"
                >
                  <span className="font-mono text-xs font-semibold text-teal-400">
                    STEP {item.step}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing & Configurable Quotas */}
        <section
          id="pricing"
          className="border-t border-slate-200 bg-white py-16 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="mx-auto max-w-[1280px] px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
                Configurable Subscription Plans · Phase 1 Payments Inactive
              </p>
              <h2 className="text-2xl font-bold tracking-tight">
                Transparent limits for self-directed Indian retail investors
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Proposed Premium pricing is configurable via governance settings and currently set to
                ₹{platformSettings.premiumPriceInr}/month. Live checkout gateways remain inactive during
                Phase 1.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              <div className="rounded-lg border border-slate-200 p-6 space-y-6 dark:border-slate-800">
                <div className="space-y-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    For individual investors getting started
                  </p>
                  <h3 className="text-xl font-bold">Free Investor</h3>
                  <p className="text-3xl font-bold font-mono tabular-nums pt-2">
                    ₹0 <span className="text-sm font-normal text-slate-500">/ month</span>
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      {platformSettings.freeAiCreditsPerDay} AI research analyses / day
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      Up to {platformSettings.freeWatchlistLimit} custom watchlists
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      Compare up to {platformSettings.freeComparisonLimit} companies side-by-side
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span>
                      Manual &amp; CSV portfolio tracking ({platformSettings.freeHistoryRetentionDays}
                      -day report retention)
                    </span>
                  </li>
                </ul>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => (isSignedIn ? onEnterWorkspace('account') : onOpenAuth())}
                >
                  {isSignedIn ? 'Manage Current Plan' : 'Start with Free Account'}
                </Button>
              </div>

              <div className="rounded-lg border border-teal-700/40 bg-slate-50/70 p-6 space-y-6 dark:border-teal-500/40 dark:bg-slate-950/60">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
                    Proposed Paid Tier · Payments Disabled in Phase 1
                  </p>
                  <h3 className="text-xl font-bold">Premium Investor</h3>
                  <p className="text-3xl font-bold font-mono tabular-nums pt-2">
                    ₹{platformSettings.premiumPriceInr}{' '}
                    <span className="text-sm font-normal text-slate-500">
                      / {platformSettings.subscriptionDurationDays} days (proposed)
                    </span>
                  </p>
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      {platformSettings.premiumAiCreditsPerDay} AI research analyses / day
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      Up to {platformSettings.premiumWatchlistLimit} custom watchlists
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span className="font-mono tabular-nums">
                      Compare up to {platformSettings.premiumComparisonLimit} companies side-by-side
                    </span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
                    <span>
                      Extended {platformSettings.premiumHistoryRetentionDays}-day research report
                      retention &amp; audit exports
                    </span>
                  </li>
                </ul>
                <Button
                  className="w-full"
                  onClick={() => (isSignedIn ? onEnterWorkspace('account') : onOpenAuth())}
                >
                  {isSignedIn ? 'View Subscription Settings' : 'Create Free Account First'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Trust, Transparency & Regulatory Disclosure */}
        <section id="trust" className="mx-auto max-w-[1280px] px-6 py-16 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
              Trust &amp; Transparency
            </p>
            <h2 className="text-2xl font-bold tracking-tight">
              Clear disclosures on data provenance, AI limits, and regulatory posture
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Financial Data Sources &amp; Freshness
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Phase 1 previews use an audited FY25–FY26 NSE reference dataset with explicit
                reporting dates. Paid commercial exchange feeds remain inactive pending formal API
                redistribution licensing.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                AI Interpretation &amp; Limitations
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                AI research outputs summarize deterministic ratios and statement data from the cited
                snapshot only. Models can miss off-balance-sheet nuances and are never a substitute
                for reading official annual reports.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Scale className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Investment Risk &amp; Non-SEBI Posture
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                InvestWise AI is <strong>not</strong> SEBI-registered as an Investment Adviser or
                Research Analyst and provides no buy/sell calls, price targets, or return
                guarantees. Equity investing carries capital risk.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Required Links */}
      <footer className="border-t border-slate-200 bg-white py-10 dark:border-slate-800 dark:bg-slate-950">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs text-slate-500 dark:text-slate-400">
          <div className="space-y-1.5 max-w-md">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              InvestWise AI
            </p>
            <p>
              Indian equity research and portfolio intelligence software · Not SEBI-registered
              investment advice. Evaluation reference data only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-medium">
            {(
              [
                ['about', 'About'],
                ['contact', 'Contact'],
                ['privacy', 'Privacy Policy'],
                ['terms', 'Terms of Service'],
                ['risk', 'Risk Disclosure'],
                ['sources', 'Data Sources'],
              ] as const
            ).map(([topic, label]) => (
              <button
                key={topic}
                type="button"
                onClick={() => setActiveLegalModal(topic)}
                className="hover:text-slate-900 dark:hover:text-slate-100 hover:underline underline-offset-4"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </footer>

      {/* Legal & Transparency Modal */}
      <Dialog
        open={activeLegalModal !== null}
        onOpenChange={(open) => {
          if (!open) setActiveLegalModal(null);
        }}
      >
        <DialogContent>
          {activeLegalModal && (
            <>
              <DialogHeader>
                <DialogTitle>{LEGAL_MODAL_COPY[activeLegalModal].title}</DialogTitle>
                <DialogDescription>
                  {LEGAL_MODAL_COPY[activeLegalModal].subtitle}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {LEGAL_MODAL_COPY[activeLegalModal].paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>
              <div className="pt-2 flex justify-end">
                <Button size="sm" onClick={() => setActiveLegalModal(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
