import { useMemo, useState } from 'react';
import { ArrowUpRight, Filter, Scale } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { computeAllEquityMetrics } from '../../engine/financialCalculations.ts';
import { formatInr } from '../../lib/utils.ts';
import { marketDataAdapter } from '../../services/dataAdapters.ts';
import { Button } from '../ui/button.tsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card.tsx';
import { Input } from '../ui/input.tsx';

interface ScreenerComparisonViewProps {
  onInspectSymbol: (symbol: string) => void;
}

export function ScreenerComparisonView({ onInspectSymbol }: ScreenerComparisonViewProps) {
  const { account, platformSettings } = useAuth();
  const maxCompare =
    account?.tier === 'premium'
      ? platformSettings.premiumComparisonLimit
      : platformSettings.freeComparisonLimit;

  const enriched = useMemo(() => {
    return marketDataAdapter.listEquities().map((eq) => ({
      equity: eq,
      bundle: computeAllEquityMetrics(eq),
    }));
  }, []);

  const sectors = useMemo(
    () => ['ALL', ...Array.from(new Set(enriched.map((e) => e.equity.sector)))],
    [enriched]
  );

  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [maxPe, setMaxPe] = useState('');
  const [minRoe, setMinRoe] = useState('');
  const [maxDe, setMaxDe] = useState('');
  const [compareSymbols, setCompareSymbols] = useState<string[]>(['RELIANCE', 'TCS']);
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const peCap = maxPe ? Number(maxPe) : null;
    const roeFloor = minRoe ? Number(minRoe) : null;
    const deCap = maxDe ? Number(maxDe) : null;

    return enriched.filter(({ equity, bundle }) => {
      if (sectorFilter !== 'ALL' && equity.sector !== sectorFilter) return false;
      const pe = bundle.metrics.pe.value;
      const roe = bundle.metrics.roe.value;
      const de = bundle.metrics.debtToEquity.value;

      if (peCap !== null && Number.isFinite(peCap) && (pe === null || pe > peCap)) return false;
      if (roeFloor !== null && Number.isFinite(roeFloor) && (roe === null || roe < roeFloor))
        return false;
      if (deCap !== null && Number.isFinite(deCap) && (de === null || de > deCap)) return false;
      return true;
    });
  }, [enriched, sectorFilter, maxPe, minRoe, maxDe]);

  function toggleCompare(symbol: string) {
    setLimitWarning(null);
    if (compareSymbols.includes(symbol)) {
      setCompareSymbols(compareSymbols.filter((s) => s !== symbol));
      return;
    }
    if (compareSymbols.length >= maxCompare) {
      setLimitWarning(
        `Current plan allows comparing up to ${maxCompare} companies simultaneously (${
          account?.tier === 'premium' ? 'Premium' : 'Free'
        } tier limit).`
      );
      return;
    }
    setCompareSymbols([...compareSymbols, symbol]);
  }

  const comparedItems = enriched.filter((e) => compareSymbols.includes(e.equity.symbol));

  return (
    <div className="space-y-6">
      {/* Screener Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-teal-700 dark:text-teal-400" />
            NSE Equity Screener
          </CardTitle>
          <CardDescription>
            Filter audited reference equities by deterministic valuation, capital efficiency, and
            leverage criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Sector
              </label>
              <select
                value={sectorFilter}
                onChange={(e) => setSectorFilter(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              >
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Max P/E (x)
              </label>
              <Input
                type="number"
                value={maxPe}
                onChange={(e) => setMaxPe(e.target.value)}
                placeholder="e.g. 35"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Min ROE (%)
              </label>
              <Input
                type="number"
                value={minRoe}
                onChange={(e) => setMinRoe(e.target.value)}
                placeholder="e.g. 15"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Max Debt / Equity
              </label>
              <Input
                type="number"
                step="0.1"
                value={maxDe}
                onChange={(e) => setMaxDe(e.target.value)}
                placeholder="e.g. 1.0"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSectorFilter('ALL');
                  setMaxPe('');
                  setMinRoe('');
                  setMaxDe('');
                }}
              >
                Reset Filters
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-medium">Compare</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium text-right">Price</th>
                  <th className="px-4 py-3 font-medium text-right">P/E</th>
                  <th className="px-4 py-3 font-medium text-right">P/B</th>
                  <th className="px-4 py-3 font-medium text-right">ROE</th>
                  <th className="px-4 py-3 font-medium text-right">ROCE</th>
                  <th className="px-4 py-3 font-medium text-right">D/E</th>
                  <th className="px-4 py-3 font-medium text-right">Op Margin</th>
                  <th className="px-4 py-3 font-medium text-right">Research</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-sm text-slate-500">
                      No equities match the active numeric criteria. Adjust filter bounds above.
                    </td>
                  </tr>
                ) : (
                  filtered.map(({ equity, bundle }) => {
                    const selected = compareSymbols.includes(equity.symbol);
                    return (
                      <tr
                        key={equity.symbol}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleCompare(equity.symbol)}
                            className={`px-2.5 py-1 text-xs rounded border whitespace-nowrap ${
                              selected
                                ? 'border-teal-700 bg-teal-700 text-white'
                                : 'border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {selected ? 'Selected' : 'Add'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-mono font-semibold text-xs text-teal-800 dark:text-teal-400">
                            {equity.symbol}
                          </div>
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {equity.companyName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {equity.sector}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {formatInr(equity.latestPriceInr)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.pe.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.pb.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.roe.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.roce.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.debtToEquity.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums">
                          {bundle.metrics.operatingMargin.formattedValue}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onInspectSymbol(equity.symbol)}
                          >
                            Open
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Side-by-Side Comparison Matrix */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                Side-by-Side Peer Comparison Matrix
              </CardTitle>
              <CardDescription>
                Comparing {comparedItems.length} of {maxCompare} permitted companies for your tier
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {limitWarning && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {limitWarning}
            </div>
          )}

          {comparedItems.length === 0 ? (
            <p className="text-sm text-slate-500">
              Select at least one company above to compare fundamental metrics side-by-side.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-medium">Metric</th>
                    {comparedItems.map(({ equity }) => (
                      <th key={equity.symbol} className="px-4 py-3 font-medium text-right">
                        <span className="font-mono text-slate-900 dark:text-slate-100">
                          {equity.symbol}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-xs tabular-nums">
                  <tr>
                    <td className="px-4 py-2.5 font-sans text-sm font-medium">Reference Price</td>
                    {comparedItems.map(({ equity }) => (
                      <td key={equity.symbol} className="px-4 py-2.5 text-right">
                        {formatInr(equity.latestPriceInr)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-sans text-sm font-medium">Market Cap (Cr)</td>
                    {comparedItems.map(({ equity }) => (
                      <td key={equity.symbol} className="px-4 py-2.5 text-right">
                        ₹{equity.marketCapCr.toLocaleString('en-IN')}
                      </td>
                    ))}
                  </tr>
                  {(
                    [
                      'pe',
                      'pb',
                      'roe',
                      'roce',
                      'debtToEquity',
                      'currentRatio',
                      'quickRatio',
                      'operatingMargin',
                      'netProfitMargin',
                      'ebitdaMargin',
                      'revenueGrowth',
                      'earningsGrowth',
                      'epsGrowth',
                    ] as const
                  ).map((key) => (
                    <tr key={key}>
                      <td className="px-4 py-2.5 font-sans text-sm font-medium">
                        {comparedItems[0].bundle.metrics[key].metricName}
                      </td>
                      {comparedItems.map(({ equity, bundle }) => (
                        <td key={equity.symbol} className="px-4 py-2.5 text-right">
                          {bundle.metrics[key].formattedValue}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
