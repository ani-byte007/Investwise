import { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Calculator,
  CheckCircle2,
  Database,
  FileText,
  Info,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { computeAllEquityMetrics } from '../../engine/financialCalculations.ts';
import { formatInr, todayIsoDate } from '../../lib/utils.ts';
import { marketDataAdapter } from '../../services/dataAdapters.ts';
import {
  incrementDailyAiUsage,
  saveResearchReport,
  saveWatchlist,
  type WatchlistRecord,
} from '../../services/firestoreService.ts';
import type { GroundedAiResearchAnalysis } from '../../types/financial.ts';
import { StockPriceChart } from '../charts/StockPriceChart.tsx';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.tsx';

interface StockResearchViewProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  watchlists: WatchlistRecord[];
  isDark: boolean;
  onRequireAuth: () => void;
}

export function StockResearchView({
  selectedSymbol,
  onSelectSymbol,
  watchlists,
  isDark,
  onRequireAuth,
}: StockResearchViewProps) {
  const { user, account, platformSettings, isEmailVerified, getIdToken } = useAuth();
  const equities = useMemo(() => marketDataAdapter.listEquities(), []);
  const equity = useMemo(
    () => marketDataAdapter.getEquityBySymbol(selectedSymbol) ?? equities[0],
    [selectedSymbol, equities]
  );

  const metricsBundle = useMemo(() => computeAllEquityMetrics(equity), [equity]);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusQuestion, setFocusQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<GroundedAiResearchAnalysis | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [watchlistMessage, setWatchlistMessage] = useState<string | null>(null);

  const filteredEquities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return equities;
    return equities.filter(
      (e) =>
        e.symbol.toLowerCase().includes(q) ||
        e.companyName.toLowerCase().includes(q) ||
        e.sector.toLowerCase().includes(q)
    );
  }, [equities, searchQuery]);

  const changeInr = equity.latestPriceInr - equity.previousCloseInr;
  const changePct = (changeInr / equity.previousCloseInr) * 100;
  const isGain = changeInr >= 0;

  const dailyLimit =
    account?.tier === 'premium'
      ? platformSettings.premiumAiCreditsPerDay
      : platformSettings.freeAiCreditsPerDay;
  const usedToday =
    account?.aiCreditsDate === todayIsoDate() ? account?.aiCreditsUsedToday ?? 0 : 0;
  const remainingCredits = Math.max(0, dailyLimit - usedToday);

  async function handleAddToWatchlist() {
    if (!user || !isEmailVerified) {
      onRequireAuth();
      return;
    }
    setWatchlistMessage(null);
    const primary = watchlists[0];
    if (primary) {
      if (primary.symbols.includes(equity.symbol)) {
        setWatchlistMessage(`${equity.symbol} is already tracked in "${primary.name}".`);
        return;
      }
      await saveWatchlist(user.uid, primary.name, [...primary.symbols, equity.symbol], primary.id);
      setWatchlistMessage(`Added ${equity.symbol} to "${primary.name}".`);
    } else {
      await saveWatchlist(user.uid, 'Core NSE Watchlist', [equity.symbol]);
      setWatchlistMessage(`Created "Core NSE Watchlist" with ${equity.symbol}.`);
    }
  }

  async function handleRunAiResearch() {
    if (!user || !isEmailVerified) {
      onRequireAuth();
      return;
    }
    if (remainingCredits <= 0) {
      setAiError(
        `Daily AI research quota reached (${usedToday}/${dailyLimit}). Upgrade tier or wait until tomorrow UTC.`
      );
      return;
    }

    setAiLoading(true);
    setAiError(null);
    setSaveNotice(null);

    try {
      const token = await getIdToken();
      if (!token) {
        onRequireAuth();
        return;
      }
      const res = await fetch('/api/research/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol: equity.symbol,
          focusQuestion: focusQuestion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'AI research analysis failed.');
        return;
      }
      setAiResult(data.analysis as GroundedAiResearchAnalysis);
      await incrementDailyAiUsage(user.uid, usedToday, account?.aiCreditsDate);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Network error calling AI research API.');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSaveReport() {
    if (!user || !isEmailVerified || !aiResult) return;
    await saveResearchReport(user.uid, aiResult);
    setSaveNotice('Saved grounded report to Research History.');
  }

  const metricList = Object.values(metricsBundle.metrics);

  return (
    <div className="space-y-6">
      {/* Symbol Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {filteredEquities.map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => {
                onSelectSymbol(item.symbol);
                setAiResult(null);
                setAiError(null);
                setSaveNotice(null);
                setWatchlistMessage(null);
              }}
              className={`px-3 py-1.5 text-xs font-mono font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
                item.symbol === equity.symbol
                  ? 'border-teal-700 bg-teal-700 text-white dark:border-teal-500 dark:bg-teal-600'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {item.symbol}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter symbol, company, sector..."
            aria-label="Filter equities"
          />
        </div>
      </div>

      {/* Equity Header Summary */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold text-teal-800 dark:text-teal-400">
                  {equity.exchange}: {equity.symbol}
                </span>
                <span aria-hidden="true">·</span>
                <span>ISIN {equity.isin}</span>
                <span aria-hidden="true">·</span>
                <span>{equity.sector}</span>
                <span aria-hidden="true">·</span>
                <span>{equity.marketCapCategory}</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{equity.companyName}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {equity.provenance.dataProvider} · Period {equity.provenance.financialPeriod} ·
                Reported {equity.provenance.reportingDate} · {equity.provenance.freshnessStatus}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="text-left lg:text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400">Reference Close Price</p>
                <p className="text-2xl font-bold font-mono tabular-nums">
                  {formatInr(equity.latestPriceInr)}
                </p>
                <p
                  className={`text-xs font-mono tabular-nums ${
                    isGain
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  {isGain ? 'Gain +' : 'Decline '}
                  {formatInr(changeInr)} ({isGain ? '+' : ''}
                  {changePct.toFixed(2)}%)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-l border-slate-200 dark:border-slate-800 pl-6">
                <span className="text-slate-500 dark:text-slate-400">Market Cap</span>
                <span className="font-mono tabular-nums font-medium text-right">
                  ₹{equity.marketCapCr.toLocaleString('en-IN')} Cr
                </span>
                <span className="text-slate-500 dark:text-slate-400">52W Range</span>
                <span className="font-mono tabular-nums font-medium text-right">
                  {formatInr(equity.fiftyTwoWeekLowInr)} – {formatInr(equity.fiftyTwoWeekHighInr)}
                </span>
                <span className="text-slate-500 dark:text-slate-400">Day Range</span>
                <span className="font-mono tabular-nums font-medium text-right">
                  {formatInr(equity.dayLowInr)} – {formatInr(equity.dayHighInr)}
                </span>
              </div>

              <Button variant="outline" size="sm" onClick={handleAddToWatchlist}>
                <BookmarkPlus className="h-4 w-4" />
                Track in Watchlist
              </Button>
            </div>
          </div>
          {watchlistMessage && (
            <p className="mt-3 text-xs text-teal-800 dark:text-teal-300">{watchlistMessage}</p>
          )}
        </CardContent>
      </Card>

      {/* TradingView Lightweight Chart */}
      <Card>
        <CardContent className="p-5">
          <StockPriceChart symbol={equity.symbol} bars={equity.priceHistory} isDark={isDark} />
        </CardContent>
      </Card>

      {/* Research Workbench Tabs */}
      <Tabs defaultValue="ratios">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="ratios">Deterministic Ratios (13)</TabsTrigger>
          <TabsTrigger value="statements">Financial Statements</TabsTrigger>
          <TabsTrigger value="filings">Corporate Actions &amp; News</TabsTrigger>
          <TabsTrigger value="ai">Grounded AI Research</TabsTrigger>
        </TabsList>

        {/* Tab 1: Deterministic Ratios */}
        <TabsContent value="ratios">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                    Audited Financial Calculation Matrix
                  </CardTitle>
                  <CardDescription>
                    Snapshot {metricsBundle.snapshotId} · Computed deterministically with full
                    formulas and edge-case status
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Metric</th>
                      <th className="px-4 py-3 font-medium text-right">Value</th>
                      <th className="px-4 py-3 font-medium">Period</th>
                      <th className="px-4 py-3 font-medium">Formula &amp; Methodology</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {metricList.map((m) => (
                      <tr key={m.metricKey}>
                        <td className="px-4 py-3 font-medium">{m.metricName}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                          {m.formattedValue}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {m.financialPeriod}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 max-w-md">
                          <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                            {m.formula}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                            {m.methodology}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <span
                            className={
                              m.status === 'valid'
                                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                                : 'text-amber-700 dark:text-amber-400 font-medium'
                            }
                          >
                            {m.status === 'valid' ? 'Verified' : m.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Financial Statements */}
        <TabsContent value="statements">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Reported Financial Statements (INR Crores)
              </CardTitle>
              <CardDescription>
                Provider: {equity.provenance.dataProvider} · All values verbatim from statement
                periods (null indicates field omitted in schedule)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Line Item</th>
                      {equity.statements.map((st) => (
                        <th key={st.periodLabel} className="px-4 py-3 font-medium text-right">
                          {st.periodLabel} ({st.periodType})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs tabular-nums">
                    {(
                      [
                        ['Revenue', 'revenue'],
                        ['EBITDA', 'ebitda'],
                        ['Operating Profit (EBIT)', 'operatingProfit'],
                        ['Net Profit', 'netProfit'],
                        ['Diluted EPS (INR)', 'dilutedEps'],
                        ['Total Debt', 'totalDebt'],
                        ['Shareholders Equity', 'shareholdersEquity'],
                        ['Total Assets', 'totalAssets'],
                        ['Current Assets', 'currentAssets'],
                        ['Inventory', 'inventory'],
                        ['Current Liabilities', 'currentLiabilities'],
                        ['Operating Cash Flow', 'operatingCashFlow'],
                        ['Free Cash Flow', 'freeCashFlow'],
                        ['Book Value / Share (INR)', 'bookValuePerShare'],
                      ] as const
                    ).map(([label, key]) => (
                      <tr key={key}>
                        <td className="px-4 py-2.5 font-sans text-sm font-medium text-slate-800 dark:text-slate-200">
                          {label}
                        </td>
                        {equity.statements.map((st) => {
                          const val = st[key];
                          return (
                            <td key={st.periodLabel} className="px-4 py-2.5 text-right">
                              {val === null ? 'N/A' : val.toLocaleString('en-IN')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Corporate Actions & News */}
        <TabsContent value="filings">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Corporate Actions &amp; Exchange Filings</CardTitle>
                <CardDescription>Dividends, splits/bonuses, and NSE regulatory items</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {equity.corporateActions.map((ca) => (
                  <div
                    key={ca.id}
                    className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-semibold text-teal-800 dark:text-teal-400">
                        {ca.actionType}
                      </span>
                      <span className="font-mono">Ex-Date {ca.exDate}</span>
                    </div>
                    <p className="text-sm font-medium mt-1">{ca.ratioOrAmount}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{ca.details}</p>
                  </div>
                ))}
                {equity.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="border-t border-slate-100 dark:border-slate-800 pt-3"
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>{ann.category}</span>
                      <span className="font-mono">{ann.date} · {ann.exchangeRef}</span>
                    </div>
                    <p className="text-sm mt-1">{ann.headline}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Attributed Financial News</CardTitle>
                <CardDescription>Verified digest summaries linked to exchange disclosures</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {equity.news.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0 space-y-1"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {item.source} · {item.publishedAt}
                    </div>
                    <h4 className="text-sm font-semibold">{item.headline}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {item.summary}
                    </p>
                  </div>
                ))}
                <div className="rounded-md bg-slate-50 dark:bg-slate-950 p-3 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{equity.provenance.licenseNotice}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Grounded AI Research Engine */}
        <TabsContent value="ai">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                      Grounded AI Research Interpretation
                    </CardTitle>
                    <CardDescription>
                      Explains deterministic metrics from snapshot {metricsBundle.snapshotId} using
                      server-side Gemini (Model: gemini-4-hydrogen)
                    </CardDescription>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {user && isEmailVerified
                      ? `Quota: ${remainingCredits}/${dailyLimit} analyses left today`
                      : 'Sign in to run AI research'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={focusQuestion}
                    onChange={(e) => setFocusQuestion(e.target.value)}
                    placeholder="Optional research focus (e.g., Compare ROE trend vs leverage and cash conversion)"
                  />
                  <Button onClick={handleRunAiResearch} disabled={aiLoading}>
                    {aiLoading ? 'Analyzing Snapshot...' : 'Generate Grounded Analysis'}
                  </Button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Guardrail: AI receives pre-computed ratios only and is strictly prohibited from
                  issuing buy/sell recommendations, target prices, or fabricated data.
                </p>

                {aiError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                    {aiError}
                  </div>
                )}
              </CardContent>
            </Card>

            {aiResult && (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <CardTitle>
                        {aiResult.companyName} ({aiResult.symbol}) — Grounded Research Memo
                      </CardTitle>
                      <CardDescription className="font-mono">
                        Snapshot {aiResult.snapshotId} · {aiResult.aiProvider} ({aiResult.modelId}) ·{' '}
                        Prompt {aiResult.promptVersion} · {aiResult.generatedAt}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleSaveReport}>
                      <FileText className="h-4 w-4" />
                      Save to Research History
                    </Button>
                  </div>
                  {saveNotice && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 pt-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {saveNotice}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-6 text-sm leading-relaxed">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                      Executive Factual Summary
                    </h4>
                    <p className="text-slate-700 dark:text-slate-300">{aiResult.executiveThesis}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">Valuation Context</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {aiResult.valuationAssessment}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">Profitability &amp; Capital Efficiency</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {aiResult.profitabilityAndCapitalEfficiency}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <h4 className="font-semibold">Balance Sheet &amp; Liquidity</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {aiResult.balanceSheetAndLiquidity}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                    <h4 className="font-semibold">Grounded Risks &amp; Catalysts</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {aiResult.keyRisksAndCatalysts.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-md border border-slate-200 dark:border-slate-800 p-3.5 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span
                              className={`font-semibold ${
                                item.type === 'risk'
                                  ? 'text-red-700 dark:text-red-400'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {item.type === 'risk' ? 'Risk Factor' : 'Operational Catalyst'}
                            </span>
                            <span className="font-mono text-slate-500 dark:text-slate-400">
                              {item.groundingRef}
                            </span>
                          </div>
                          <p className="font-medium text-slate-900 dark:text-slate-100">
                            {item.title}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300">
                            {item.detail}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-2">
                    <h4 className="font-semibold">Data Gaps, Limitations &amp; Regulatory Scope</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      {aiResult.dataGapsAndLimitations}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {aiResult.nonAdvisoryDisclaimer}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
