import type {
  CalculatedMetricResult,
  CorporateAction,
  EquityDataset,
  EquityMetricsBundle,
  FinancialStatementPeriod,
  MetricCalculationStatus,
  PortfolioAnalyticsSummary,
  PortfolioHoldingAnalytics,
  PortfolioTransactionInput,
  SectorAllocationItem,
} from '../types/financial.ts';

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function buildMetricResult(
  equity: EquityDataset,
  periodLabel: string,
  reportingDate: string,
  metricKey: string,
  metricName: string,
  value: number | null,
  unit: CalculatedMetricResult['unit'],
  formula: string,
  sourceValues: Record<string, number | string | null>,
  methodology: string,
  status: MetricCalculationStatus,
  calculationTimestamp: string
): CalculatedMetricResult {
  let formattedValue = 'N/A';
  if (value !== null && Number.isFinite(value)) {
    const rounded = round2(value);
    if (unit === '%') {
      formattedValue = `${rounded.toFixed(2)}%`;
    } else if (unit === 'x') {
      formattedValue = `${rounded.toFixed(2)}x`;
    } else if (unit === 'INR') {
      formattedValue = `₹${rounded.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      formattedValue = rounded.toFixed(2);
    }
  } else if (status === 'not_applicable_negative_earnings') {
    formattedValue = 'N/A (Loss)';
  } else if (status === 'undefined_zero_denominator') {
    formattedValue = 'N/A (Zero Base)';
  }

  return {
    companyId: equity.companyId,
    stockSymbol: equity.symbol,
    metricKey,
    metricName,
    value: value !== null && Number.isFinite(value) ? round2(value) : null,
    formattedValue,
    unit,
    financialPeriod: periodLabel,
    dataProvider: equity.provenance.dataProvider,
    sourceTimestamp: equity.provenance.sourceTimestamp,
    reportingDate,
    calculationTimestamp,
    formula,
    sourceValues,
    methodology,
    status,
    freshnessStatus: equity.provenance.freshnessStatus,
  };
}

/**
 * Computes cumulative corporate action split/bonus adjustment factor
 * applicable after a reporting date.
 */
export function getCumulativeSplitAdjustment(
  reportingDate: string,
  actions: CorporateAction[]
): number {
  return actions.reduce((acc, action) => {
    if (
      (action.actionType === 'SPLIT' || action.actionType === 'BONUS') &&
      action.exDate > reportingDate &&
      action.adjustmentFactor > 0
    ) {
      return acc * action.adjustmentFactor;
    }
    return acc;
  }, 1);
}

export function calculatePE(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = 'Latest Market Price / Corporate-Action-Adjusted Diluted EPS';
  if (latest.dilutedEps === null || !Number.isFinite(equity.latestPriceInr)) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'pe',
      'Price-to-Earnings (P/E)',
      null,
      'x',
      formula,
      { latestPriceInr: equity.latestPriceInr, dilutedEps: latest.dilutedEps },
      'Requires positive diluted EPS and valid market price.',
      'insufficient_data',
      calcTs
    );
  }
  const adjFactor = getCumulativeSplitAdjustment(latest.reportingDate, equity.corporateActions);
  const adjustedEps = latest.dilutedEps / adjFactor;
  if (adjustedEps < 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'pe',
      'Price-to-Earnings (P/E)',
      null,
      'x',
      formula,
      { latestPriceInr: equity.latestPriceInr, adjustedEps: round2(adjustedEps), adjFactor },
      'P/E is suppressed when diluted EPS is negative to avoid misleading negative multiples.',
      'not_applicable_negative_earnings',
      calcTs
    );
  }
  if (adjustedEps === 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'pe',
      'Price-to-Earnings (P/E)',
      null,
      'x',
      formula,
      { latestPriceInr: equity.latestPriceInr, adjustedEps: 0 },
      'Zero EPS denominator yields undefined P/E.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'pe',
    'Price-to-Earnings (P/E)',
    equity.latestPriceInr / adjustedEps,
    'x',
    formula,
    { latestPriceInr: equity.latestPriceInr, adjustedEps: round2(adjustedEps), adjFactor },
    'Calculated using latest close price divided by split/bonus-adjusted diluted EPS.',
    'valid',
    calcTs
  );
}

export function calculatePB(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = 'Latest Market Price / Adjusted Book Value Per Share';
  if (latest.bookValuePerShare === null || !Number.isFinite(equity.latestPriceInr)) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'pb',
      'Price-to-Book (P/B)',
      null,
      'x',
      formula,
      { latestPriceInr: equity.latestPriceInr, bookValuePerShare: latest.bookValuePerShare },
      'Requires non-zero Book Value Per Share.',
      'insufficient_data',
      calcTs
    );
  }
  const adjFactor = getCumulativeSplitAdjustment(latest.reportingDate, equity.corporateActions);
  const adjustedBvps = latest.bookValuePerShare / adjFactor;
  if (adjustedBvps <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'pb',
      'Price-to-Book (P/B)',
      null,
      'x',
      formula,
      { latestPriceInr: equity.latestPriceInr, adjustedBvps: round2(adjustedBvps) },
      'Non-positive Book Value Per Share cannot form a meaningful P/B multiple.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'pb',
    'Price-to-Book (P/B)',
    equity.latestPriceInr / adjustedBvps,
    'x',
    formula,
    { latestPriceInr: equity.latestPriceInr, adjustedBvps: round2(adjustedBvps) },
    'Calculated using latest close price over split/bonus-adjusted book value per share.',
    'valid',
    calcTs
  );
}

export function calculateROE(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = '(Net Profit / Average Shareholders Equity) × 100';
  if (latest.netProfit === null || latest.shareholdersEquity === null) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'roe',
      'Return on Equity (ROE)',
      null,
      '%',
      formula,
      { netProfitCr: latest.netProfit, shareholdersEquityCr: latest.shareholdersEquity },
      'Requires Net Profit and Shareholders Equity.',
      'insufficient_data',
      calcTs
    );
  }
  const avgEquity =
    latest.priorShareholdersEquity !== null
      ? (latest.shareholdersEquity + latest.priorShareholdersEquity) / 2
      : latest.shareholdersEquity;
  if (avgEquity <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'roe',
      'Return on Equity (ROE)',
      null,
      '%',
      formula,
      { netProfitCr: latest.netProfit, avgShareholdersEquityCr: round2(avgEquity) },
      'Zero or negative equity base makes ROE non-comparable.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'roe',
    'Return on Equity (ROE)',
    (latest.netProfit / avgEquity) * 100,
    '%',
    formula,
    { netProfitCr: latest.netProfit, avgShareholdersEquityCr: round2(avgEquity) },
    'Uses average of opening and closing shareholders equity when prior-period balance sheet is available.',
    'valid',
    calcTs
  );
}

export function calculateROCE(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = '(EBIT / (Total Assets - Current Liabilities)) × 100';
  if (
    latest.operatingProfit === null ||
    latest.totalAssets === null ||
    latest.currentLiabilities === null
  ) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'roce',
      'Return on Capital Employed (ROCE)',
      null,
      '%',
      formula,
      {
        ebitCr: latest.operatingProfit,
        totalAssetsCr: latest.totalAssets,
        currentLiabilitiesCr: latest.currentLiabilities,
      },
      'Requires EBIT, Total Assets, and Current Liabilities.',
      'insufficient_data',
      calcTs
    );
  }
  const capitalEmployed = latest.totalAssets - latest.currentLiabilities;
  if (capitalEmployed <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'roce',
      'Return on Capital Employed (ROCE)',
      null,
      '%',
      formula,
      { ebitCr: latest.operatingProfit, capitalEmployedCr: round2(capitalEmployed) },
      'Non-positive Capital Employed yields undefined ROCE.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'roce',
    'Return on Capital Employed (ROCE)',
    (latest.operatingProfit / capitalEmployed) * 100,
    '%',
    formula,
    { ebitCr: latest.operatingProfit, capitalEmployedCr: round2(capitalEmployed) },
    'Capital Employed computed as Total Assets minus Current Liabilities.',
    'valid',
    calcTs
  );
}

export function calculateDebtToEquity(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = 'Total Debt / Shareholders Equity';
  if (latest.totalDebt === null || latest.shareholdersEquity === null) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'debtToEquity',
      'Debt-to-Equity',
      null,
      'x',
      formula,
      { totalDebtCr: latest.totalDebt, shareholdersEquityCr: latest.shareholdersEquity },
      'Requires Total Debt and Shareholders Equity.',
      'insufficient_data',
      calcTs
    );
  }
  if (latest.shareholdersEquity <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'debtToEquity',
      'Debt-to-Equity',
      null,
      'x',
      formula,
      { totalDebtCr: latest.totalDebt, shareholdersEquityCr: latest.shareholdersEquity },
      'Zero or negative equity denominator prevents meaningful Debt-to-Equity ratio.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'debtToEquity',
    'Debt-to-Equity',
    latest.totalDebt / latest.shareholdersEquity,
    'x',
    formula,
    { totalDebtCr: latest.totalDebt, shareholdersEquityCr: latest.shareholdersEquity },
    'Measures total borrowings relative to shareholders equity.',
    'valid',
    calcTs
  );
}

export function calculateCurrentRatio(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = 'Current Assets / Current Liabilities';
  if (latest.currentAssets === null || latest.currentLiabilities === null) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'currentRatio',
      'Current Ratio',
      null,
      'x',
      formula,
      { currentAssetsCr: latest.currentAssets, currentLiabilitiesCr: latest.currentLiabilities },
      'Requires Current Assets and Current Liabilities (not applicable to banking balance sheets without standard current classification).',
      'insufficient_data',
      calcTs
    );
  }
  if (latest.currentLiabilities <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'currentRatio',
      'Current Ratio',
      null,
      'x',
      formula,
      { currentAssetsCr: latest.currentAssets, currentLiabilitiesCr: latest.currentLiabilities },
      'Zero Current Liabilities denominator.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'currentRatio',
    'Current Ratio',
    latest.currentAssets / latest.currentLiabilities,
    'x',
    formula,
    { currentAssetsCr: latest.currentAssets, currentLiabilitiesCr: latest.currentLiabilities },
    'Short-term liquidity coverage across current obligations.',
    'valid',
    calcTs
  );
}

export function calculateQuickRatio(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  calcTs: string
): CalculatedMetricResult {
  const formula = '(Current Assets - Inventory) / Current Liabilities';
  if (
    latest.currentAssets === null ||
    latest.inventory === null ||
    latest.currentLiabilities === null
  ) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'quickRatio',
      'Quick Ratio',
      null,
      'x',
      formula,
      {
        currentAssetsCr: latest.currentAssets,
        inventoryCr: latest.inventory,
        currentLiabilitiesCr: latest.currentLiabilities,
      },
      'Requires Current Assets, Inventory, and Current Liabilities.',
      'insufficient_data',
      calcTs
    );
  }
  if (latest.currentLiabilities <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      'quickRatio',
      'Quick Ratio',
      null,
      'x',
      formula,
      {
        currentAssetsCr: latest.currentAssets,
        inventoryCr: latest.inventory,
        currentLiabilitiesCr: latest.currentLiabilities,
      },
      'Zero Current Liabilities denominator.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    'quickRatio',
    'Quick Ratio',
    (latest.currentAssets - latest.inventory) / latest.currentLiabilities,
    'x',
    formula,
    {
      currentAssetsCr: latest.currentAssets,
      inventoryCr: latest.inventory,
      currentLiabilitiesCr: latest.currentLiabilities,
    },
    'Acid-test liquidity excluding inventory.',
    'valid',
    calcTs
  );
}

export function calculateMargin(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  metricKey: 'operatingMargin' | 'netProfitMargin' | 'ebitdaMargin',
  metricName: string,
  numerator: number | null,
  numeratorLabel: string,
  formula: string,
  methodology: string,
  calcTs: string
): CalculatedMetricResult {
  if (numerator === null || latest.revenue === null) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { [numeratorLabel]: numerator, revenueCr: latest.revenue },
      methodology,
      'insufficient_data',
      calcTs
    );
  }
  if (latest.revenue <= 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { [numeratorLabel]: numerator, revenueCr: latest.revenue },
      'Zero or negative revenue prevents margin computation.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    latest.periodLabel,
    latest.reportingDate,
    metricKey,
    metricName,
    (numerator / latest.revenue) * 100,
    '%',
    formula,
    { [numeratorLabel]: numerator, revenueCr: latest.revenue },
    methodology,
    'valid',
    calcTs
  );
}

export function calculateYoYGrowth(
  equity: EquityDataset,
  latest: FinancialStatementPeriod,
  prior: FinancialStatementPeriod | undefined,
  metricKey: 'revenueGrowth' | 'earningsGrowth' | 'epsGrowth',
  metricName: string,
  currentVal: number | null,
  priorVal: number | null,
  formula: string,
  methodology: string,
  calcTs: string
): CalculatedMetricResult {
  if (!prior || prior.periodType !== latest.periodType) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { current: currentVal, prior: null },
      'Requires matching prior-year period of identical reporting cadence (annual-to-annual) to prevent period mismatch.',
      'insufficient_data',
      calcTs
    );
  }
  if (currentVal === null || priorVal === null) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { current: currentVal, prior: priorVal },
      methodology,
      'insufficient_data',
      calcTs
    );
  }
  if (priorVal === 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { current: currentVal, prior: priorVal },
      'Prior-period base is zero; percentage growth is undefined.',
      'undefined_zero_denominator',
      calcTs
    );
  }
  if (priorVal < 0) {
    return buildMetricResult(
      equity,
      latest.periodLabel,
      latest.reportingDate,
      metricKey,
      metricName,
      null,
      '%',
      formula,
      { current: currentVal, prior: priorVal },
      'Prior-period base was negative; percentage growth suppressed to prevent sign distortion.',
      'not_applicable_negative_earnings',
      calcTs
    );
  }
  return buildMetricResult(
    equity,
    `${prior.periodLabel} -> ${latest.periodLabel}`,
    latest.reportingDate,
    metricKey,
    metricName,
    ((currentVal - priorVal) / priorVal) * 100,
    '%',
    formula,
    { current: round2(currentVal), prior: round2(priorVal) },
    methodology,
    'valid',
    calcTs
  );
}

export function computeAllEquityMetrics(
  equity: EquityDataset,
  calcTimestamp = new Date().toISOString()
): EquityMetricsBundle {
  const annualPeriods = equity.statements
    .filter((s) => s.periodType === 'annual')
    .sort((a, b) => b.reportingDate.localeCompare(a.reportingDate));

  const latest = annualPeriods[0] ?? equity.statements[0];
  const prior = annualPeriods[1];

  const latestAdjFactor = latest
    ? getCumulativeSplitAdjustment(latest.reportingDate, equity.corporateActions)
    : 1;
  const priorAdjFactor = prior
    ? getCumulativeSplitAdjustment(prior.reportingDate, equity.corporateActions)
    : 1;

  const latestAdjEps =
    latest?.dilutedEps !== null && latest?.dilutedEps !== undefined
      ? latest.dilutedEps / latestAdjFactor
      : null;
  const priorAdjEps =
    prior?.dilutedEps !== null && prior?.dilutedEps !== undefined
      ? prior.dilutedEps / priorAdjFactor
      : null;

  return {
    symbol: equity.symbol,
    companyName: equity.companyName,
    snapshotId: `${equity.symbol}_${latest?.periodLabel ?? 'NA'}_${equity.provenance.reportingDate}`,
    calculatedAt: calcTimestamp,
    metrics: {
      pe: calculatePE(equity, latest, calcTimestamp),
      pb: calculatePB(equity, latest, calcTimestamp),
      roe: calculateROE(equity, latest, calcTimestamp),
      roce: calculateROCE(equity, latest, calcTimestamp),
      debtToEquity: calculateDebtToEquity(equity, latest, calcTimestamp),
      currentRatio: calculateCurrentRatio(equity, latest, calcTimestamp),
      quickRatio: calculateQuickRatio(equity, latest, calcTimestamp),
      operatingMargin: calculateMargin(
        equity,
        latest,
        'operatingMargin',
        'Operating Margin',
        latest.operatingProfit,
        'operatingProfitCr',
        '(Operating Profit (EBIT) / Revenue) × 100',
        'Measures core operating profitability before financing and taxes.',
        calcTimestamp
      ),
      netProfitMargin: calculateMargin(
        equity,
        latest,
        'netProfitMargin',
        'Net Profit Margin',
        latest.netProfit,
        'netProfitCr',
        '(Net Profit / Revenue) × 100',
        'Measures bottom-line net profit retained per rupee of revenue.',
        calcTimestamp
      ),
      ebitdaMargin: calculateMargin(
        equity,
        latest,
        'ebitdaMargin',
        'EBITDA Margin',
        latest.ebitda,
        'ebitdaCr',
        '(EBITDA / Revenue) × 100',
        'Measures cash operating profitability before D&A, interest, and tax.',
        calcTimestamp
      ),
      revenueGrowth: calculateYoYGrowth(
        equity,
        latest,
        prior,
        'revenueGrowth',
        'Revenue Growth (YoY)',
        latest.revenue,
        prior?.revenue ?? null,
        '((Revenue_t - Revenue_{t-1}) / Revenue_{t-1}) × 100',
        'Annual-to-annual top-line revenue growth rate.',
        calcTimestamp
      ),
      earningsGrowth: calculateYoYGrowth(
        equity,
        latest,
        prior,
        'earningsGrowth',
        'Earnings Growth (YoY)',
        latest.netProfit,
        prior?.netProfit ?? null,
        '((NetProfit_t - NetProfit_{t-1}) / NetProfit_{t-1}) × 100',
        'Annual-to-annual Net Profit growth rate.',
        calcTimestamp
      ),
      epsGrowth: calculateYoYGrowth(
        equity,
        latest,
        prior,
        'epsGrowth',
        'EPS Growth (YoY)',
        latestAdjEps,
        priorAdjEps,
        '((AdjEPS_t - AdjEPS_{t-1}) / AdjEPS_{t-1}) × 100',
        'Split/bonus-adjusted Diluted EPS annual growth rate.',
        calcTimestamp
      ),
    },
  };
}

/**
 * Deterministic Weighted-Average Cost Basis Portfolio Engine
 * Computes Weighted Avg Purchase Price, Realized P/L, Unrealized P/L,
 * Portfolio Allocation %, Sector Allocation %, and Concentration Diagnostics.
 */
export function computePortfolioAnalytics(
  transactions: PortfolioTransactionInput[],
  marketBySymbol: Record<string, { priceInr: number; companyName: string; sector: string; provenanceNote: string }>,
  calcTimestamp = new Date().toISOString()
): PortfolioAnalyticsSummary {
  const sorted = [...transactions].sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));

  interface RunningLot {
    symbol: string;
    openQty: number;
    totalCostInr: number;
    realizedPnlInr: number;
  }

  const bySymbol = new Map<string, RunningLot>();

  for (const tx of sorted) {
    const sym = tx.symbol.toUpperCase().trim();
    const state = bySymbol.get(sym) ?? {
      symbol: sym,
      openQty: 0,
      totalCostInr: 0,
      realizedPnlInr: 0,
    };

    const fees = tx.feesInr || 0;
    if (tx.type === 'BUY') {
      state.openQty += tx.quantity;
      state.totalCostInr += tx.quantity * tx.priceInr + fees;
    } else if (tx.type === 'SELL') {
      if (state.openQty > 0) {
        const sellQty = Math.min(tx.quantity, state.openQty);
        const avgCost = state.totalCostInr / state.openQty;
        const costRemoved = avgCost * sellQty;
        const proceeds = sellQty * tx.priceInr - fees;
        state.realizedPnlInr += proceeds - costRemoved;
        state.openQty -= sellQty;
        state.totalCostInr = Math.max(0, state.totalCostInr - costRemoved);
      }
    }
    bySymbol.set(sym, state);
  }

  let totalMarketValueInr = 0;
  let totalInvestedInr = 0;
  let totalRealizedPnlInr = 0;

  const preliminary: Omit<PortfolioHoldingAnalytics, 'allocationPct'>[] = [];

  for (const lot of bySymbol.values()) {
    totalRealizedPnlInr += lot.realizedPnlInr;
    if (lot.openQty <= 0) {
      continue;
    }
    const market = marketBySymbol[lot.symbol];
    const weightedAvg = lot.totalCostInr / lot.openQty;
    const currentPrice = market?.priceInr ?? weightedAvg;
    const marketValue = lot.openQty * currentPrice;
    const unrealized = marketValue - lot.totalCostInr;
    const unrealizedPct = lot.totalCostInr > 0 ? (unrealized / lot.totalCostInr) * 100 : null;

    totalMarketValueInr += marketValue;
    totalInvestedInr += lot.totalCostInr;

    preliminary.push({
      symbol: lot.symbol,
      companyName: market?.companyName ?? `${lot.symbol} (Unmapped)`,
      sector: market?.sector ?? 'Other / Unclassified',
      openQuantity: round2(lot.openQty),
      weightedAvgPurchasePriceInr: round2(weightedAvg),
      totalCostBasisInr: round2(lot.totalCostInr),
      currentPriceInr: round2(currentPrice),
      marketValueInr: round2(marketValue),
      unrealizedPnlInr: round2(unrealized),
      unrealizedPnlPct: unrealizedPct !== null ? round2(unrealizedPct) : null,
      realizedPnlInr: round2(lot.realizedPnlInr),
      provenanceNote: market?.provenanceNote ?? 'Cost-basis fallback (price unavailable)',
    });
  }

  const holdings: PortfolioHoldingAnalytics[] = preliminary
    .map((h) => ({
      ...h,
      allocationPct: totalMarketValueInr > 0 ? round2((h.marketValueInr / totalMarketValueInr) * 100) : 0,
    }))
    .sort((a, b) => b.marketValueInr - a.marketValueInr);

  const sectorMap = new Map<string, number>();
  for (const h of holdings) {
    sectorMap.set(h.sector, (sectorMap.get(h.sector) ?? 0) + h.marketValueInr);
  }

  const sectorAllocation: SectorAllocationItem[] = Array.from(sectorMap.entries())
    .map(([sector, mv]) => ({
      sector,
      marketValueInr: round2(mv),
      allocationPct: totalMarketValueInr > 0 ? round2((mv / totalMarketValueInr) * 100) : 0,
    }))
    .sort((a, b) => b.marketValueInr - a.marketValueInr);

  const top = holdings[0] ?? null;
  const totalUnrealizedPnlInr = round2(totalMarketValueInr - totalInvestedInr);
  const totalUnrealizedPnlPct =
    totalInvestedInr > 0 ? round2((totalUnrealizedPnlInr / totalInvestedInr) * 100) : null;

  return {
    totalInvestedInr: round2(totalInvestedInr),
    totalMarketValueInr: round2(totalMarketValueInr),
    totalUnrealizedPnlInr,
    totalUnrealizedPnlPct,
    totalRealizedPnlInr: round2(totalRealizedPnlInr),
    holdingsCount: holdings.length,
    topConcentrationSymbol: top?.symbol ?? null,
    topConcentrationPct: top?.allocationPct ?? 0,
    concentrationFlag: (top?.allocationPct ?? 0) > 25,
    holdings,
    sectorAllocation,
    calculationTimestamp: calcTimestamp,
  };
}
