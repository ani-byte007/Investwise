import assert from 'node:assert/strict';
import { computeAllEquityMetrics, computePortfolioAnalytics } from './financialCalculations.ts';
import type { EquityDataset, PortfolioTransactionInput } from '../types/financial.ts';

function createMockEquity(overrides: Partial<EquityDataset> = {}): EquityDataset {
  return {
    companyId: 'INE001A01036',
    symbol: 'TESTCO',
    exchange: 'NSE',
    isin: 'INE001A01036',
    companyName: 'TestCo India Ltd',
    sector: 'Information Technology',
    industry: 'IT Services',
    marketCapCategory: 'Large Cap',
    latestPriceInr: 1000,
    previousCloseInr: 990,
    dayHighInr: 1010,
    dayLowInr: 985,
    fiftyTwoWeekHighInr: 1120,
    fiftyTwoWeekLowInr: 840,
    marketCapCr: 100000,
    provenance: {
      companyId: 'INE001A01036',
      stockSymbol: 'TESTCO',
      exchange: 'NSE',
      isin: 'INE001A01036',
      dataProvider: 'NSE Reference Dataset',
      sourceTimestamp: '2026-11-18T00:00:00Z',
      reportingDate: '2026-03-31',
      financialPeriod: 'FY26',
      freshnessStatus: 'reference_audited',
      licenseNotice: 'Reference evaluation dataset',
    },
    statements: [
      {
        periodLabel: 'FY26',
        periodType: 'annual',
        reportingDate: '2026-03-31',
        currency: 'INR',
        unit: 'INR Crores',
        revenue: 10000,
        ebitda: 2500,
        operatingProfit: 2000,
        netProfit: 1500,
        dilutedEps: 50,
        totalDebt: 1000,
        shareholdersEquity: 5000,
        priorShareholdersEquity: 4000,
        totalAssets: 12000,
        currentAssets: 6000,
        inventory: 1000,
        currentLiabilities: 2000,
        operatingCashFlow: 1800,
        freeCashFlow: 1400,
        bookValuePerShare: 200,
        sharesOutstandingCr: 30,
      },
      {
        periodLabel: 'FY25',
        periodType: 'annual',
        reportingDate: '2025-03-31',
        currency: 'INR',
        unit: 'INR Crores',
        revenue: 8000,
        ebitda: 2000,
        operatingProfit: 1600,
        netProfit: 1200,
        dilutedEps: 40,
        totalDebt: 1100,
        shareholdersEquity: 4000,
        priorShareholdersEquity: 3500,
        totalAssets: 10000,
        currentAssets: 5000,
        inventory: 900,
        currentLiabilities: 2000,
        operatingCashFlow: 1500,
        freeCashFlow: 1100,
        bookValuePerShare: 160,
        sharesOutstandingCr: 30,
      },
    ],
    priceHistory: [],
    corporateActions: [],
    announcements: [],
    news: [],
    ...overrides,
  };
}

// Test 1: Standard 13 fundamental metrics
const standard = computeAllEquityMetrics(createMockEquity(), '2026-11-18T10:00:00Z');
assert.equal(standard.metrics.pe.value, 20); // 1000 / 50
assert.equal(standard.metrics.pb.value, 5); // 1000 / 200
assert.equal(standard.metrics.roe.value, 33.33); // 1500 / 4500 * 100
assert.equal(standard.metrics.roce.value, 20); // 2000 / (12000 - 2000) * 100
assert.equal(standard.metrics.debtToEquity.value, 0.2); // 1000 / 5000
assert.equal(standard.metrics.currentRatio.value, 3); // 6000 / 2000
assert.equal(standard.metrics.quickRatio.value, 2.5); // (6000 - 1000) / 2000
assert.equal(standard.metrics.operatingMargin.value, 20); // 2000 / 10000 * 100
assert.equal(standard.metrics.netProfitMargin.value, 15); // 1500 / 10000 * 100
assert.equal(standard.metrics.ebitdaMargin.value, 25); // 2500 / 10000 * 100
assert.equal(standard.metrics.revenueGrowth.value, 25); // (10000 - 8000) / 8000 * 100
assert.equal(standard.metrics.earningsGrowth.value, 25); // (1500 - 1200) / 1200 * 100
assert.equal(standard.metrics.epsGrowth.value, 25); // (50 - 40) / 40 * 100

// Test 2: Negative Earnings P/E suppression
const lossEquity = createMockEquity();
lossEquity.statements[0].netProfit = -400;
lossEquity.statements[0].dilutedEps = -12;
const lossResult = computeAllEquityMetrics(lossEquity);
assert.equal(lossResult.metrics.pe.value, null);
assert.equal(lossResult.metrics.pe.status, 'not_applicable_negative_earnings');

// Test 3: Zero Denominator Protection
const zeroEquity = createMockEquity();
zeroEquity.statements[0].currentLiabilities = 0;
zeroEquity.statements[0].shareholdersEquity = 0;
zeroEquity.statements[0].priorShareholdersEquity = 0;
const zeroResult = computeAllEquityMetrics(zeroEquity);
assert.equal(zeroResult.metrics.currentRatio.status, 'undefined_zero_denominator');
assert.equal(zeroResult.metrics.debtToEquity.status, 'undefined_zero_denominator');
assert.equal(zeroResult.metrics.roe.status, 'undefined_zero_denominator');

// Test 4: Corporate Action 1:1 Bonus adjustment after FY26 reporting date
const splitEquity = createMockEquity({
  corporateActions: [
    {
      id: 'ca1',
      symbol: 'TESTCO',
      actionType: 'BONUS',
      exDate: '2026-06-15',
      ratioOrAmount: '1:1',
      adjustmentFactor: 2,
      details: '1:1 Bonus Issue',
    },
  ],
});
const splitResult = computeAllEquityMetrics(splitEquity);
assert.equal(splitResult.metrics.pe.value, 40); // 1000 / (50 / 2)

// Test 5: Portfolio Weighted Avg Cost, Realized P/L, Unrealized P/L, Allocation %
const txs: PortfolioTransactionInput[] = [
  { id: '1', portfolioId: 'pf1', symbol: 'TCS', exchange: 'NSE', type: 'BUY', quantity: 10, priceInr: 3500, feesInr: 0, tradeDate: '2026-01-10' },
  { id: '2', portfolioId: 'pf1', symbol: 'TCS', exchange: 'NSE', type: 'BUY', quantity: 10, priceInr: 4100, feesInr: 0, tradeDate: '2026-02-10' },
  { id: '3', portfolioId: 'pf1', symbol: 'TCS', exchange: 'NSE', type: 'SELL', quantity: 5, priceInr: 4200, feesInr: 100, tradeDate: '2026-03-10' },
  { id: '4', portfolioId: 'pf1', symbol: 'HDFCBANK', exchange: 'NSE', type: 'BUY', quantity: 20, priceInr: 1500, feesInr: 0, tradeDate: '2026-03-15' },
];
const portfolio = computePortfolioAnalytics(txs, {
  TCS: { priceInr: 4000, companyName: 'Tata Consultancy Services', sector: 'Information Technology', provenanceNote: 'NSE Reference' },
  HDFCBANK: { priceInr: 1650, companyName: 'HDFC Bank Ltd', sector: 'Financial Services', provenanceNote: 'NSE Reference' },
});

const tcsHolding = portfolio.holdings.find((h) => h.symbol === 'TCS')!;
assert.equal(tcsHolding.openQuantity, 15);
assert.equal(tcsHolding.weightedAvgPurchasePriceInr, 3800);
assert.equal(tcsHolding.realizedPnlInr, 1900); // 5*(4200-3800) - 100
assert.equal(tcsHolding.unrealizedPnlInr, 3000); // 15*(4000-3800)
assert.equal(portfolio.totalMarketValueInr, 93000); // 60000 + 33000
assert.equal(portfolio.concentrationFlag, true); // TCS is 64.52% > 25%

console.log('ALL 17 FINANCIAL CALCULATION & PORTFOLIO TESTS PASSED');
