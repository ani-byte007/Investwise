import { useMemo } from 'react';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  Briefcase,
  FileText,
  Info,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { computePortfolioAnalytics } from '../../engine/financialCalculations.ts';
import { formatInr, todayIsoDate } from '../../lib/utils.ts';
import { marketDataAdapter } from '../../services/dataAdapters.ts';
import type {
  PortfolioRecord,
  SavedResearchReportRecord,
  WatchlistRecord,
} from '../../services/firestoreService.ts';
import type { PortfolioTransactionInput } from '../../types/financial.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';

interface DashboardOverviewViewProps {
  portfolios: PortfolioRecord[];
  transactions: PortfolioTransactionInput[];
  watchlists: WatchlistRecord[];
  reports: SavedResearchReportRecord[];
  onNavigateTab: (tab: 'research' | 'screener' | 'portfolio' | 'watchlists' | 'account') => void;
  onInspectSymbol: (symbol: string) => void;
  onRequireAuth: () => void;
}

export function DashboardOverviewView({
  portfolios,
  transactions,
  watchlists,
  reports,
  onNavigateTab,
  onInspectSymbol,
  onRequireAuth,
}: DashboardOverviewViewProps) {
  const {
    user,
    account,
    privateProfile,
    platformSettings,
    isEmailVerified,
    resendVerificationEmail,
    refreshAuthUser,
  } = useAuth();

  const equities = useMemo(() => marketDataAdapter.listEquities().slice(0, 4), []);

  const portfolioSummary = useMemo(() => {
    if (transactions.length === 0) return null;
    const priceMap: Record<
      string,
      { priceInr: number; companyName: string; sector: string; provenanceNote: string }
    > = {};
    for (const eq of marketDataAdapter.listEquities()) {
      priceMap[eq.symbol] = {
        priceInr: eq.latestPriceInr,
        companyName: eq.companyName,
        sector: eq.sector,
        provenanceNote: `${eq.provenance.dataProvider} (${eq.provenance.reportingDate})`,
      };
    }
    return computePortfolioAnalytics(transactions, priceMap);
  }, [transactions]);

  if (!user) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <UserCheck className="h-9 w-9 mx-auto text-teal-700 dark:text-teal-400" />
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-xl font-bold tracking-tight">Protected Investor Dashboard</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Sign in or create an account to access your private portfolio ledger, saved
              watchlists, daily AI research credits, and immutable audit history. You can still
              preview Stock Research and Screener tools directly from the sidebar.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <Button onClick={onRequireAuth}>Sign In / Create Free Account</Button>
            <Button variant="outline" onClick={() => onNavigateTab('research')}>
              Preview Stock Research
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isEmailVerified) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verify Your Email to Unlock Your Dashboard</CardTitle>
          <CardDescription>
            Signed in as {user.email}. Firestore private collections require verified email
            ownership.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={resendVerificationEmail}>
            Resend Verification Email
          </Button>
          <Button onClick={refreshAuthUser}>I Have Verified — Refresh Session</Button>
        </CardContent>
      </Card>
    );
  }

  const dailyLimit =
    account?.tier === 'premium'
      ? platformSettings.premiumAiCreditsPerDay
      : platformSettings.freeAiCreditsPerDay;
  const usedToday =
    account?.aiCreditsDate === todayIsoDate() ? account?.aiCreditsUsedToday || 0 : 0;
  const remainingCredits = Math.max(0, dailyLimit - usedToday);
  const allWatchlistSymbols = Array.from(new Set(watchlists.flatMap((w) => w.symbols)));

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card>
        <CardContent className="p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-800 dark:text-teal-400">
              Investor Workspace · {privateProfile?.preferredCurrency || 'INR'} ·{' '}
              {privateProfile?.timezone || 'Asia/Kolkata'}
            </p>
            <h1 className="text-2xl font-bold tracking-tight">
              Welcome back, {account?.displayName || user.displayName || 'Investor'}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
              Plan: {account?.tier === 'premium' ? 'Premium Investor' : 'Free Investor'} · AI
              Research Quota Remaining Today: {remainingCredits}/{dailyLimit} · Saved Portfolios:{' '}
              {portfolios.length}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Button size="sm" onClick={() => onNavigateTab('research')}>
              Open Stock Research
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigateTab('portfolio')}>
              Manage Portfolio
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Market Overview Reference Notice */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Reference Equity Coverage (Evaluation Snapshot)
              </CardTitle>
              <CardDescription>
                Live NSE/BSE streaming feeds remain disabled pending commercial exchange licensing.
                Values below reflect the audited FY25–FY26 reference dataset.
              </CardDescription>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onNavigateTab('screener')}>
              View All Covered Equities
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {equities.map((eq) => {
              const changePct =
                ((eq.latestPriceInr - eq.previousCloseInr) / eq.previousCloseInr) * 100;
              const isPos = changePct >= 0;
              return (
                <button
                  key={eq.symbol}
                  type="button"
                  onClick={() => onInspectSymbol(eq.symbol)}
                  className="text-left rounded-md border border-slate-200 dark:border-slate-800 p-3.5 hover:border-teal-600/60 dark:hover:border-teal-500/60 transition-colors space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {eq.symbol}
                    </span>
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        isPos
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {isPos ? '+' : ''}
                      {changePct.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {eq.companyName}
                  </p>
                  <p className="font-mono text-sm font-semibold tabular-nums">
                    {formatInr(eq.latestPriceInr)}
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Core Overview Cards: Portfolio, Watchlists, Recent AI Research */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Portfolio Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Portfolio Overview
            </CardTitle>
            <CardDescription>Weighted average cost basis &amp; INR P/L</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {portfolioSummary && portfolioSummary.holdingsCount > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 font-mono tabular-nums text-xs">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Market Value</p>
                    <p className="text-base font-bold">
                      {formatInr(portfolioSummary.totalMarketValueInr)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Unrealized P/L</p>
                    <p
                      className={`text-base font-bold ${
                        portfolioSummary.totalUnrealizedPnlInr >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-red-700 dark:text-red-400'
                      }`}
                    >
                      {formatInr(portfolioSummary.totalUnrealizedPnlInr)}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {portfolioSummary.holdingsCount} active position(s) across {portfolios.length}{' '}
                  portfolio(s).
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                No equity transactions recorded yet. Log trades manually or import a broker CSV
                to compute portfolio allocation and P/L.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onNavigateTab('portfolio')}
            >
              Open Portfolio Analytics
            </Button>
          </CardContent>
        </Card>

        {/* Watchlist Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bookmark className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Watchlists ({watchlists.length})
            </CardTitle>
            <CardDescription>Tracked NSE symbols synced to Firestore</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {allWatchlistSymbols.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {allWatchlistSymbols.slice(0, 8).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => onInspectSymbol(sym)}
                      className="rounded border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-mono font-medium hover:border-teal-600 dark:hover:border-teal-400"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select a symbol to inspect ratios, statements, and AI notes.
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                No watchlists created yet. Group companies you follow to monitor fundamentals and
                corporate announcements.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onNavigateTab('watchlists')}
            >
              Manage Watchlists
            </Button>
          </CardContent>
        </Card>

        {/* Recent Research Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Recent AI Research ({reports.length})
            </CardTitle>
            <CardDescription>Saved grounded financial memos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reports.length > 0 ? (
              <div className="space-y-2">
                {reports.slice(0, 3).map((rep) => (
                  <button
                    key={rep.id}
                    type="button"
                    onClick={() => onInspectSymbol(rep.symbol)}
                    className="w-full text-left rounded border border-slate-200 dark:border-slate-800 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between font-mono font-semibold">
                      <span>{rep.symbol}</span>
                      <span className="text-[11px] text-slate-500">
                        {rep.generatedAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 truncate">
                      {rep.executiveThesis}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                No saved research reports yet. Run a grounded Gemini research analysis from any
                equity terminal and save it to your workspace.
              </p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onNavigateTab('watchlists')}
            >
              View Research History
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Access</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => onNavigateTab('research')}
            className="flex items-center gap-3 rounded-md border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <BarChart3 className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Equity Research</p>
              <p className="text-[11px] text-slate-500">17 ratios &amp; Gemini notes</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('screener')}
            className="flex items-center gap-3 rounded-md border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <SlidersHorizontal className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Company Comparison</p>
              <p className="text-[11px] text-slate-500">Filter &amp; compare peers</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('portfolio')}
            className="flex items-center gap-3 rounded-md border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <Briefcase className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Portfolio Ledger</p>
              <p className="text-[11px] text-slate-500">CSV import &amp; P/L</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('account')}
            className="flex items-center gap-3 rounded-md border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
          >
            <ShieldCheck className="h-4 w-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Account &amp; Disclosures</p>
              <p className="text-[11px] text-slate-500">
                {privateProfile?.riskDisclosureAccepted
                  ? 'Terms acknowledged'
                  : 'Review terms & plan'}
              </p>
            </div>
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
