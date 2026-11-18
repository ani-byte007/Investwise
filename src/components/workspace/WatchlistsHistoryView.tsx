import React, { useMemo, useState } from 'react';
import { Bell, Bookmark, Download, FileText, Lock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { computeAllEquityMetrics } from '../../engine/financialCalculations.ts';
import { formatInr } from '../../lib/utils.ts';
import { marketDataAdapter } from '../../services/dataAdapters.ts';
import {
  deleteResearchReport,
  deleteWatchlist,
  saveWatchlist,
  type SavedResearchReportRecord,
  type WatchlistRecord,
} from '../../services/firestoreService.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface WatchlistsHistoryViewProps {
  watchlists: WatchlistRecord[];
  reports: SavedResearchReportRecord[];
  onInspectSymbol: (symbol: string) => void;
  onRequireAuth: () => void;
}

export function WatchlistsHistoryView({
  watchlists,
  reports,
  onInspectSymbol,
  onRequireAuth,
}: WatchlistsHistoryViewProps) {
  const { user, account, platformSettings, isEmailVerified } = useAuth();
  const equities = useMemo(() => marketDataAdapter.listEquities(), []);
  const [newWatchlistName, setNewWatchlistName] = useState('');
  const [addSymbolByList, setAddSymbolByList] = useState<Record<string, string>>({});
  const [selectedReport, setSelectedReport] = useState<SavedResearchReportRecord | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const maxWatchlists =
    account?.tier === 'premium'
      ? platformSettings.premiumWatchlistLimit
      : platformSettings.freeWatchlistLimit;

  const trackedAnnouncements = useMemo(() => {
    const trackedSymbols = new Set(watchlists.flatMap((w) => w.symbols));
    return equities
      .filter((e) => trackedSymbols.size === 0 || trackedSymbols.has(e.symbol))
      .flatMap((e) =>
        e.announcements.map((a) => ({
          ...a,
          companyName: e.companyName,
        }))
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [watchlists, equities]);

  if (!user || !isEmailVerified) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <Lock className="h-8 w-8 mx-auto text-slate-400" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold">Watchlists &amp; Saved Research</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in with a verified account to persist custom NSE watchlists, review saved AI
              research snapshots, and track corporate action alerts.
            </p>
          </div>
          <Button onClick={onRequireAuth}>Sign In to Continue</Button>
        </CardContent>
      </Card>
    );
  }

  async function handleCreateWatchlist(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newWatchlistName.trim()) return;
    setNotice(null);
    if (watchlists.length >= maxWatchlists) {
      setNotice(
        `Watchlist limit reached (${watchlists.length}/${maxWatchlists} for ${
          account?.tier === 'premium' ? 'Premium' : 'Free'
        } tier).`
      );
      return;
    }
    await saveWatchlist(user.uid, newWatchlistName, ['RELIANCE', 'TCS']);
    setNewWatchlistName('');
  }

  async function handleAddSymbol(wl: WatchlistRecord) {
    if (!user) return;
    const sym = addSymbolByList[wl.id] || 'INFY';
    if (wl.symbols.includes(sym)) return;
    await saveWatchlist(user.uid, wl.name, [...wl.symbols, sym], wl.id);
  }

  async function handleRemoveSymbol(wl: WatchlistRecord, sym: string) {
    if (!user) return;
    await saveWatchlist(
      user.uid,
      wl.name,
      wl.symbols.filter((s) => s !== sym),
      wl.id
    );
  }

  function handleExportReport(rep: SavedResearchReportRecord) {
    const content = [
      `INVESTWISE AI — GROUNDED RESEARCH REPORT`,
      `Company: ${rep.companyName} (${rep.symbol})`,
      `Snapshot ID: ${rep.snapshotId}`,
      `AI Model: ${rep.aiProvider} · ${rep.modelId} (${rep.promptVersion})`,
      `Generated At: ${rep.generatedAt}`,
      ``,
      `EXECUTIVE SUMMARY`,
      rep.executiveThesis,
      ``,
      `VALUATION ASSESSMENT`,
      rep.valuationAssessment,
      ``,
      `PROFITABILITY & CAPITAL EFFICIENCY`,
      rep.profitabilitySummary,
      ``,
      `BALANCE SHEET & LIQUIDITY`,
      rep.balanceSheetSummary,
      ``,
      `LIMITATIONS & COMPLIANCE`,
      rep.limitations,
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${rep.symbol}_InvestWise_Research_${rep.snapshotId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Watchlists Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Custom NSE Watchlists ({watchlists.length}/{maxWatchlists})
              </CardTitle>
              <CardDescription>
                Track audited prices, P/E, and ROE across focused Indian equity cohorts
              </CardDescription>
            </div>
            <form onSubmit={handleCreateWatchlist} className="flex items-center gap-2">
              <Input
                value={newWatchlistName}
                onChange={(e) => setNewWatchlistName(e.target.value)}
                placeholder="New watchlist name..."
                className="w-48"
              />
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </form>
          </div>
          {notice && <p className="text-xs text-amber-700 dark:text-amber-400 pt-2">{notice}</p>}
        </CardHeader>
        <CardContent className="space-y-6">
          {watchlists.length === 0 ? (
            <p className="text-sm text-slate-500">
              No watchlists saved yet. Create one above or click &quot;Track in Watchlist&quot; on
              any stock page.
            </p>
          ) : (
            watchlists.map((wl) => (
              <div
                key={wl.id}
                className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h4 className="font-semibold text-sm">{wl.name}</h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={addSymbolByList[wl.id] || equities[0].symbol}
                      onChange={(e) =>
                        setAddSymbolByList({ ...addSymbolByList, [wl.id]: e.target.value })
                      }
                      className="h-8 rounded border border-slate-300 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      {equities.map((e) => (
                        <option key={e.symbol} value={e.symbol}>
                          {e.symbol}
                        </option>
                      ))}
                    </select>
                    <Button size="sm" variant="outline" onClick={() => handleAddSymbol(wl)}>
                      Add Symbol
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteWatchlist(user.uid, wl.id)}
                      aria-label="Delete watchlist"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-500 border-b border-slate-100 dark:border-slate-800">
                      <tr>
                        <th className="py-2 font-medium">Symbol</th>
                        <th className="py-2 font-medium">Company</th>
                        <th className="py-2 font-medium text-right">Price</th>
                        <th className="py-2 font-medium text-right">P/E</th>
                        <th className="py-2 font-medium text-right">ROE</th>
                        <th className="py-2 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {wl.symbols.map((sym) => {
                        const eq = marketDataAdapter.getEquityBySymbol(sym);
                        const metrics = eq ? computeAllEquityMetrics(eq).metrics : null;
                        return (
                          <tr key={sym}>
                            <td className="py-2 font-mono font-semibold text-teal-800 dark:text-teal-400">
                              <button
                                type="button"
                                className="hover:underline"
                                onClick={() => onInspectSymbol(sym)}
                              >
                                {sym}
                              </button>
                            </td>
                            <td className="py-2">{eq?.companyName ?? 'Unmapped'}</td>
                            <td className="py-2 text-right font-mono tabular-nums">
                              {eq ? formatInr(eq.latestPriceInr) : 'N/A'}
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums">
                              {metrics?.pe.formattedValue ?? 'N/A'}
                            </td>
                            <td className="py-2 text-right font-mono tabular-nums">
                              {metrics?.roe.formattedValue ?? 'N/A'}
                            </td>
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveSymbol(wl, sym)}
                                className="text-slate-400 hover:text-red-700"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Saved AI Research Reports & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Saved Grounded Research History ({reports.length})
            </CardTitle>
            <CardDescription>
              Retained for{' '}
              {account?.tier === 'premium'
                ? platformSettings.premiumHistoryRetentionDays
                : platformSettings.freeHistoryRetentionDays}{' '}
              days on current tier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-sm text-slate-500">
                No saved reports yet. Generate an analysis in Stock Research and click &quot;Save to
                Research History&quot;.
              </p>
            ) : (
              <div className="space-y-3">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="rounded-md border border-slate-200 dark:border-slate-800 p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-400">
                          {rep.symbol}
                        </span>{' '}
                        <span className="font-semibold text-sm">{rep.companyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setSelectedReport(selectedReport?.id === rep.id ? null : rep)
                          }
                        >
                          {selectedReport?.id === rep.id ? 'Collapse' : 'Read Memo'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExportReport(rep)}
                          aria-label="Download report"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteResearchReport(user.uid, rep.id)}
                          aria-label="Delete report"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
                      Snapshot {rep.snapshotId} · {rep.modelId} · {rep.generatedAt}
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300">
                      {rep.executiveThesis}
                    </p>
                    {selectedReport?.id === rep.id && (
                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        <p>
                          <strong>Valuation:</strong> {rep.valuationAssessment}
                        </p>
                        <p>
                          <strong>Profitability:</strong> {rep.profitabilitySummary}
                        </p>
                        <p>
                          <strong>Balance Sheet:</strong> {rep.balanceSheetSummary}
                        </p>
                        <p className="text-slate-500">
                          <strong>Limitations:</strong> {rep.limitations}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-teal-700 dark:text-teal-400" />
              Corporate Disclosure Notifications
            </CardTitle>
            <CardDescription>Exchange announcements for tracked watchlist equities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {trackedAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className="border-b border-slate-100 dark:border-slate-800 pb-3 last:border-0 last:pb-0 space-y-1"
              >
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-mono font-semibold text-teal-800 dark:text-teal-400">
                    {ann.symbol}
                  </span>
                  <span className="font-mono">{ann.date}</span>
                </div>
                <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                  {ann.headline}
                </p>
                <p className="text-[11px] font-mono text-slate-400">{ann.exchangeRef}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
