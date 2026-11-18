import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  type IChartApi,
} from 'lightweight-charts';
import type { OhlcvBar } from '../../types/financial.ts';
import { formatInr } from '../../lib/utils.ts';

interface StockPriceChartProps {
  symbol: string;
  bars: OhlcvBar[];
  isDark?: boolean;
}

export function StockPriceChart({ symbol, bars, isDark = false }: StockPriceChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [timeframe, setTimeframe] = useState<'1M' | '3M' | '6M' | '1Y'>('6M');
  const [chartMode, setChartMode] = useState<'candlestick' | 'area'>('candlestick');
  const [hoveredBar, setHoveredBar] = useState<OhlcvBar | null>(null);

  const visibleBars = useMemo(() => {
    const counts: Record<'1M' | '3M' | '6M' | '1Y', number> = {
      '1M': 22,
      '3M': 65,
      '6M': 130,
      '1Y': 240,
    };
    return bars.slice(-counts[timeframe]);
  }, [bars, timeframe]);

  const latestBar = hoveredBar ?? visibleBars[visibleBars.length - 1] ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || visibleBars.length === 0) return;

    const chart: IChartApi = createChart(el, {
      width: el.clientWidth,
      height: 340,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? '#0f172a' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
        horzLines: { color: isDark ? '#1e293b' : '#f1f5f9' },
      },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#e2e8f0',
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
      },
    });

    if (chartMode === 'candlestick') {
      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#15803d',
        downColor: '#b91c1c',
        borderVisible: false,
        wickUpColor: '#15803d',
        wickDownColor: '#b91c1c',
      });
      candleSeries.setData(
        visibleBars.map((b) => ({
          time: b.time,
          open: b.open,
          high: b.high,
          low: b.low,
          close: b.close,
        }))
      );
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#0f766e',
        topColor: 'rgba(15, 118, 110, 0.22)',
        bottomColor: 'rgba(15, 118, 110, 0.01)',
        lineWidth: 2,
      });
      areaSeries.setData(
        visibleBars.map((b) => ({
          time: b.time,
          value: b.close,
        }))
      );
    }

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    volumeSeries.setData(
      visibleBars.map((b) => ({
        time: b.time,
        value: b.volume,
        color:
          b.close >= b.open
            ? isDark
              ? 'rgba(21, 128, 61, 0.35)'
              : 'rgba(21, 128, 61, 0.22)'
            : isDark
              ? 'rgba(185, 28, 28, 0.35)'
              : 'rgba(185, 28, 28, 0.22)',
      }))
    );

    chart.timeScale().fitContent();

    const barLookup = new Map(visibleBars.map((b) => [b.time, b]));
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoveredBar(null);
        return;
      }
      const match = barLookup.get(String(param.time));
      setHoveredBar(match ?? null);
    });

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [visibleBars, chartMode, isDark]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{symbol} OHLCV</span>
          {latestBar && (
            <>
              <span aria-hidden="true">·</span>
              <span>{latestBar.time}</span>
              <span aria-hidden="true">·</span>
              <span>O {formatInr(latestBar.open)}</span>
              <span>H {formatInr(latestBar.high)}</span>
              <span>L {formatInr(latestBar.low)}</span>
              <span>C {formatInr(latestBar.close)}</span>
              <span aria-hidden="true">·</span>
              <span>Vol {(latestBar.volume / 100000).toFixed(2)}L</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['candlestick', 'area'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChartMode(mode)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  chartMode === mode
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                {mode === 'candlestick' ? 'Candles' : 'Area'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            {(['1M', '3M', '6M', '1Y'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
                  timeframe === tf
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-slate-100'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full h-[340px] rounded-md border border-slate-200 dark:border-slate-800 overflow-hidden"
      />
    </div>
  );
}
