import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Lock,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { computePortfolioAnalytics } from '../../engine/financialCalculations.ts';
import { formatInr, todayIsoDate } from '../../lib/utils.ts';
import { marketDataAdapter } from '../../services/dataAdapters.ts';
import {
  addPortfolioTransaction,
  createPortfolio,
  removePortfolioTransaction,
  type PortfolioRecord,
} from '../../services/firestoreService.ts';
import type { PortfolioTransactionInput } from '../../types/financial.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface PortfolioAnalyticsViewProps {
  portfolios: PortfolioRecord[];
  transactions: PortfolioTransactionInput[];
  onRequireAuth: () => void;
}

export function PortfolioAnalyticsView({
  portfolios,
  transactions,
  onRequireAuth,
}: PortfolioAnalyticsViewProps) {
  const { user, isEmailVerified } = useAuth();
  const equities = useMemo(() => marketDataAdapter.listEquities(), []);

  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [symbol, setSymbol] = useState('RELIANCE');
  const [txType, setTxType] = useState<'BUY' | 'SELL'>('BUY');
  const [quantity, setQuantity] = useState('10');
  const [priceInr, setPriceInr] = useState('1300');
  const [feesInr, setFeesInr] = useState('25');
  const [tradeDate, setTradeDate] = useState(todayIsoDate());
  const [csvText, setCsvText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activePortfolio = useMemo(() => {
    if (portfolios.length === 0) return null;
    return portfolios.find((p) => p.id === selectedPortfolioId) ?? portfolios[0];
  }, [portfolios, selectedPortfolioId]);

  const activeTransactions = useMemo(() => {
    if (!activePortfolio) return [];
    return transactions
      .filter((t) => t.portfolioId === activePortfolio.id)
      .sort((a, b) => b.tradeDate.localeCompare(a.tradeDate));
  }, [transactions, activePortfolio]);

  const marketLookup = useMemo(() => {
    const map: Record<
      string,
      { priceInr: number; companyName: string; sector: string; provenanceNote: string }
    > = {};
    for (const eq of equities) {
      map[eq.symbol] = {
        priceInr: eq.latestPriceInr,
        companyName: eq.companyName,
        sector: eq.sector,
        provenanceNote: `${eq.provenance.dataProvider} (${eq.provenance.reportingDate})`,
      };
    }
    return map;
  }, [equities]);

  const analytics = useMemo(
    () => computePortfolioAnalytics(activeTransactions, marketLookup),
    [activeTransactions, marketLookup]
  );

  if (!user || !isEmailVerified) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <Lock className="h-8 w-8 mx-auto text-slate-400" />
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold">Private Portfolio Workspace</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sign in with a verified account to manage manual trades, import CSV trade ledgers,
              and calculate weighted-average P/L in INR. Visitors cannot access private portfolio
              records.
            </p>
          </div>
          <Button onClick={onRequireAuth}>Sign In to Access Portfolios</Button>
        </CardContent>
      </Card>
    );
  }

  async function handleCreatePortfolio(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newPortfolioName.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      const id = await createPortfolio(user.uid, newPortfolioName);
      setSelectedPortfolioId(id);
      setNewPortfolioName('');
      setStatusMessage('Created new INR equity portfolio.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTrade(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      let targetPortfolioId = activePortfolio?.id;
      if (!targetPortfolioId) {
        targetPortfolioId = await createPortfolio(user.uid, 'Core India Equity');
        setSelectedPortfolioId(targetPortfolioId);
      }
      await addPortfolioTransaction(user.uid, {
        portfolioId: targetPortfolioId,
        symbol,
        exchange: 'NSE',
        type: txType,
        quantity: Number(quantity),
        priceInr: Number(priceInr),
        feesInr: Number(feesInr || 0),
        tradeDate,
      });
      setStatusMessage(`Recorded ${txType} ${quantity} ${symbol} @ ${formatInr(Number(priceInr))}.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleImportCsv() {
    if (!user || !csvText.trim()) return;
    setBusy(true);
    setStatusMessage(null);
    try {
      let targetPortfolioId = activePortfolio?.id;
      if (!targetPortfolioId) {
        targetPortfolioId = await createPortfolio(user.uid, 'Core India Equity');
        setSelectedPortfolioId(targetPortfolioId);
      }
      const lines = csvText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let importedCount = 0;
      for (const line of lines) {
        if (line.toLowerCase().startsWith('symbol,')) continue;
        const [sym, typeStr, qtyStr, priceStr, feesStr, dateStr] = line
          .split(',')
          .map((c) => c.trim());
        const qtyNum = Number(qtyStr);
        const priceNum = Number(priceStr);
        if (!sym || !Number.isFinite(qtyNum) || qtyNum <= 0 || !Number.isFinite(priceNum) || priceNum <= 0) {
          continue;
        }
        await addPortfolioTransaction(user.uid, {
          portfolioId: targetPortfolioId,
          symbol: sym.toUpperCase(),
          exchange: 'NSE',
          type: typeStr?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
          quantity: qtyNum,
          priceInr: priceNum,
          feesInr: Number(feesStr) || 0,
          tradeDate: dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayIsoDate(),
        });
        importedCount += 1;
      }
      setCsvText('');
      setStatusMessage(`Imported ${importedCount} trade row(s) into portfolio ledger.`);
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadCsvTemplate() {
    const sample = [
      'symbol,type,quantity,priceInr,feesInr,tradeDate',
      'RELIANCE,BUY,15,1260.00,35.00,2026-04-12',
      'TCS,BUY,8,3920.00,40.00,2026-05-18',
      'HDFCBANK,BUY,20,1610.00,30.00,2026-07-09',
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'investwise_portfolio_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Selector & Create */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {portfolios.map((pf) => (
            <button
              key={pf.id}
              type="button"
              onClick={() => setSelectedPortfolioId(pf.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border whitespace-nowrap ${
                activePortfolio?.id === pf.id
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {pf.name}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreatePortfolio} className="flex items-center gap-2">
          <Input
            value={newPortfolioName}
            onChange={(e) => setNewPortfolioName(e.target.value)}
            placeholder="New portfolio name..."
            className="w-48"
          />
          <Button type="submit" variant="outline" size="sm" disabled={busy}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </form>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Invested Cost Basis</p>
            <p className="text-xl font-bold font-mono tabular-nums">
              {formatInr(analytics.totalInvestedInr)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Reference Market Value</p>
            <p className="text-xl font-bold font-mono tabular-nums">
              {formatInr(analytics.totalMarketValueInr)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Unrealized P/L</p>
            <p
              className={`text-xl font-bold font-mono tabular-nums ${
                analytics.totalUnrealizedPnlInr >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {analytics.totalUnrealizedPnlInr >= 0 ? '+' : ''}
              {formatInr(analytics.totalUnrealizedPnlInr)}
              {analytics.totalUnrealizedPnlPct !== null &&
                ` (${analytics.totalUnrealizedPnlPct >= 0 ? '+' : ''}${analytics.totalUnrealizedPnlPct.toFixed(2)}%)`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-1">
            <p className="text-xs text-slate-500 dark:text-slate-400">Realized P/L (Closed Lots)</p>
            <p
              className={`text-xl font-bold font-mono tabular-nums ${
                analytics.totalRealizedPnlInr >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }`}
            >
              {analytics.totalRealizedPnlInr >= 0 ? '+' : ''}
              {formatInr(analytics.totalRealizedPnlInr)}
            </p>
          </CardContent>
        </Card>
      </div>

      {analytics.concentrationFlag && analytics.topConcentrationSymbol && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-center gap-2.5 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Portfolio Concentration Notice: <strong>{analytics.topConcentrationSymbol}</strong>{' '}
            represents {analytics.topConcentrationPct.toFixed(2)}% of total portfolio value (above
            the 25% single-stock threshold).
          </span>
        </div>
      )}

      {/* Holdings & Sector Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle>Holdings &amp; Weighted-Average Cost Basis</CardTitle>
            <CardDescription>
              Calculated deterministically from recorded BUY/SELL transactions (no brokerage execution)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {analytics.holdings.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No open holdings yet. Record a manual trade or import a CSV ledger below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-medium">Symbol</th>
                      <th className="px-4 py-3 font-medium text-right">Qty</th>
                      <th className="px-4 py-3 font-medium text-right">Avg Cost</th>
                      <th className="px-4 py-3 font-medium text-right">Ref Price</th>
                      <th className="px-4 py-3 font-medium text-right">Market Value</th>
                      <th className="px-4 py-3 font-medium text-right">Unrealized P/L</th>
                      <th className="px-4 py-3 font-medium text-right">Weight</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs tabular-nums">
                    {analytics.holdings.map((h) => (
                      <tr key={h.symbol}>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {h.symbol}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{h.sector}</div>
                        </td>
                        <td className="px-4 py-3 text-right">{h.openQuantity}</td>
                        <td className="px-4 py-3 text-right">
                          {formatInr(h.weightedAvgPurchasePriceInr)}
                        </td>
                        <td className="px-4 py-3 text-right">{formatInr(h.currentPriceInr)}</td>
                        <td className="px-4 py-3 text-right">{formatInr(h.marketValueInr)}</td>
                        <td
                          className={`px-4 py-3 text-right ${
                            h.unrealizedPnlInr >= 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-red-700 dark:text-red-400'
                          }`}
                        >
                          {h.unrealizedPnlInr >= 0 ? '+' : ''}
                          {formatInr(h.unrealizedPnlInr)}
                        </td>
                        <td className="px-4 py-3 text-right">{h.allocationPct.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Sector Allocation</CardTitle>
            <CardDescription>Market value weight by NSE sector</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.sectorAllocation.length === 0 ? (
              <p className="text-xs text-slate-500">Add holdings to compute sector weights.</p>
            ) : (
              analytics.sectorAllocation.map((sec) => (
                <div key={sec.sector} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {sec.sector}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {sec.allocationPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-teal-700 dark:bg-teal-500"
                      style={{ width: `${Math.min(100, sec.allocationPct)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual Trade Entry & CSV Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Manual Trade Entry</CardTitle>
            <CardDescription>Log BUY or SELL lots in INR (updates weighted average cost)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTrade} className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">NSE Symbol</label>
                <select
                  value={symbol}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSymbol(next);
                    const match = marketLookup[next];
                    if (match) setPriceInr(String(match.priceInr));
                  }}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  {equities.map((e) => (
                    <option key={e.symbol} value={e.symbol}>
                      {e.symbol} — {e.companyName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Side</label>
                <select
                  value={txType}
                  onChange={(e) => setTxType(e.target.value as 'BUY' | 'SELL')}
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Quantity</label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Execution Price (INR)</label>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={priceInr}
                  onChange={(e) => setPriceInr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Brokerage &amp; STT (INR)</label>
                <Input
                  type="number"
                  min="0"
                  step="any"
                  value={feesInr}
                  onChange={(e) => setFeesInr(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Trade Date</label>
                <Input
                  type="date"
                  required
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                />
              </div>
              <div className="col-span-2 pt-2">
                <Button type="submit" disabled={busy} className="w-full">
                  Record Transaction
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle>CSV Trade Ledger Import</CardTitle>
                <CardDescription>
                  Columns: symbol,type,quantity,priceInr,feesInr,tradeDate
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadCsvTemplate}>
                <Download className="h-3.5 w-3.5" />
                Template
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'symbol,type,quantity,priceInr,feesInr,tradeDate\nRELIANCE,BUY,10,1280,25,2026-06-15'}
              className="w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs dark:border-slate-700 dark:bg-slate-950"
            />
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={handleImportCsv}
              disabled={busy || !csvText.trim()}
            >
              <Upload className="h-4 w-4" />
              Validate &amp; Import CSV Trades
            </Button>
            {statusMessage && (
              <p className="text-xs text-teal-800 dark:text-teal-300">{statusMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction Ledger */}
      {activeTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recorded Transaction Ledger</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono tabular-nums">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Symbol</th>
                    <th className="px-4 py-3 font-medium">Side</th>
                    <th className="px-4 py-3 font-medium text-right">Qty</th>
                    <th className="px-4 py-3 font-medium text-right">Price</th>
                    <th className="px-4 py-3 font-medium text-right">Fees</th>
                    <th className="px-4 py-3 font-medium text-right">Remove</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeTransactions.map((tx) => (
                    <tr key={tx.id}>
                      <td className="px-4 py-2.5">{tx.tradeDate}</td>
                      <td className="px-4 py-2.5 font-semibold">{tx.symbol}</td>
                      <td
                        className={`px-4 py-2.5 font-semibold ${
                          tx.type === 'BUY'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {tx.type}
                      </td>
                      <td className="px-4 py-2.5 text-right">{tx.quantity}</td>
                      <td className="px-4 py-2.5 text-right">{formatInr(tx.priceInr)}</td>
                      <td className="px-4 py-2.5 text-right">{formatInr(tx.feesInr)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => removePortfolioTransaction(user.uid, tx.id)}
                          className="text-slate-400 hover:text-red-700 dark:hover:text-red-400"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
