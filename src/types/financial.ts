export type FreshnessStatus = 'reference_audited' | 'delayed_snapshot' | 'stale' | 'unavailable';

export type ProviderApprovalStatus =
  | 'active_reference'
  | 'pending_commercial_license'
  | 'disabled';

export interface ProviderLicenseCompliance {
  providerId: string;
  providerName: string;
  coverage: string;
  status: ProviderApprovalStatus;
  rightsChecklist: {
    commercialUsage: boolean;
    publicDisplay: boolean;
    perUserLicensing: boolean;
    historicalData: boolean;
    cachingPermitted: boolean;
    derivedDataPermitted: boolean;
    aiProcessingPermitted: boolean;
    redistributionNotes: string;
  };
  pricingTier: string;
  rateLimitNote: string;
  lastAuditedDate: string;
}

export interface DataProvenance {
  companyId: string;
  stockSymbol: string;
  exchange: 'NSE' | 'BSE';
  isin: string;
  dataProvider: string;
  sourceTimestamp: string;
  reportingDate: string;
  financialPeriod: string;
  freshnessStatus: FreshnessStatus;
  licenseNotice: string;
}

export interface OhlcvBar {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface FinancialStatementPeriod {
  periodLabel: string; // e.g. 'FY26', 'FY25', 'Q2 FY27'
  periodType: 'annual' | 'quarterly';
  reportingDate: string;
  currency: 'INR';
  unit: 'INR Crores';
  revenue: number | null;
  ebitda: number | null;
  operatingProfit: number | null; // EBIT
  netProfit: number | null;
  dilutedEps: number | null; // INR per share
  totalDebt: number | null;
  shareholdersEquity: number | null;
  priorShareholdersEquity: number | null;
  totalAssets: number | null;
  currentAssets: number | null;
  inventory: number | null;
  currentLiabilities: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  bookValuePerShare: number | null; // INR per share
  sharesOutstandingCr: number | null;
}

export interface CorporateAction {
  id: string;
  symbol: string;
  actionType: 'DIVIDEND' | 'SPLIT' | 'BONUS';
  exDate: string;
  ratioOrAmount: string;
  adjustmentFactor: number; // e.g., 1 for dividend, 2 for 1:1 bonus or 2-for-1 split
  details: string;
}

export interface CorporateAnnouncement {
  id: string;
  symbol: string;
  date: string;
  category: 'Financial Results' | 'Board Meeting' | 'Regulatory Filing' | 'Expansion';
  headline: string;
  exchangeRef: string;
}

export interface MarketNewsItem {
  id: string;
  symbol: string;
  publishedAt: string;
  source: string;
  headline: string;
  summary: string;
}

export interface EquityDataset {
  companyId: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  isin: string;
  companyName: string;
  sector: string;
  industry: string;
  marketCapCategory: 'Large Cap' | 'Mid Cap' | 'Small Cap';
  latestPriceInr: number;
  previousCloseInr: number;
  dayHighInr: number;
  dayLowInr: number;
  fiftyTwoWeekHighInr: number;
  fiftyTwoWeekLowInr: number;
  marketCapCr: number;
  provenance: DataProvenance;
  statements: FinancialStatementPeriod[];
  priceHistory: OhlcvBar[];
  corporateActions: CorporateAction[];
  announcements: CorporateAnnouncement[];
  news: MarketNewsItem[];
}

export type MetricCalculationStatus =
  | 'valid'
  | 'not_applicable_negative_earnings'
  | 'undefined_zero_denominator'
  | 'insufficient_data';

export interface CalculatedMetricResult {
  companyId: string;
  stockSymbol: string;
  metricKey: string;
  metricName: string;
  value: number | null;
  formattedValue: string;
  unit: 'x' | '%' | 'INR' | 'ratio';
  financialPeriod: string;
  dataProvider: string;
  sourceTimestamp: string;
  reportingDate: string;
  calculationTimestamp: string;
  formula: string;
  sourceValues: Record<string, number | string | null>;
  methodology: string;
  status: MetricCalculationStatus;
  freshnessStatus: FreshnessStatus;
}

export interface EquityMetricsBundle {
  symbol: string;
  companyName: string;
  snapshotId: string;
  calculatedAt: string;
  metrics: {
    pe: CalculatedMetricResult;
    pb: CalculatedMetricResult;
    roe: CalculatedMetricResult;
    roce: CalculatedMetricResult;
    debtToEquity: CalculatedMetricResult;
    currentRatio: CalculatedMetricResult;
    quickRatio: CalculatedMetricResult;
    operatingMargin: CalculatedMetricResult;
    netProfitMargin: CalculatedMetricResult;
    ebitdaMargin: CalculatedMetricResult;
    revenueGrowth: CalculatedMetricResult;
    earningsGrowth: CalculatedMetricResult;
    epsGrowth: CalculatedMetricResult;
  };
}

export interface PortfolioTransactionInput {
  id: string;
  portfolioId: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  type: 'BUY' | 'SELL';
  quantity: number;
  priceInr: number;
  feesInr: number;
  tradeDate: string;
  notes?: string;
}

export interface PortfolioHoldingAnalytics {
  symbol: string;
  companyName: string;
  sector: string;
  openQuantity: number;
  weightedAvgPurchasePriceInr: number;
  totalCostBasisInr: number;
  currentPriceInr: number;
  marketValueInr: number;
  unrealizedPnlInr: number;
  unrealizedPnlPct: number | null;
  realizedPnlInr: number;
  allocationPct: number;
  provenanceNote: string;
}

export interface SectorAllocationItem {
  sector: string;
  marketValueInr: number;
  allocationPct: number;
}

export interface PortfolioAnalyticsSummary {
  totalInvestedInr: number;
  totalMarketValueInr: number;
  totalUnrealizedPnlInr: number;
  totalUnrealizedPnlPct: number | null;
  totalRealizedPnlInr: number;
  holdingsCount: number;
  topConcentrationSymbol: string | null;
  topConcentrationPct: number;
  concentrationFlag: boolean;
  holdings: PortfolioHoldingAnalytics[];
  sectorAllocation: SectorAllocationItem[];
  calculationTimestamp: string;
}

export interface GroundedAiResearchAnalysis {
  snapshotId: string;
  symbol: string;
  companyName: string;
  aiProvider: string;
  modelId: string;
  promptVersion: string;
  generatedAt: string;
  executiveThesis: string;
  valuationAssessment: string;
  profitabilityAndCapitalEfficiency: string;
  balanceSheetAndLiquidity: string;
  keyRisksAndCatalysts: Array<{
    type: 'risk' | 'catalyst';
    title: string;
    detail: string;
    groundingRef: string;
  }>;
  dataGapsAndLimitations: string;
  citedMetrics: Array<{
    metricName: string;
    value: string;
    period: string;
  }>;
  sourceReferences: Array<{
    provider: string;
    period: string;
    reportingDate: string;
    freshnessStatus: FreshnessStatus;
  }>;
  nonAdvisoryDisclaimer: string;
}

export interface PlatformSettings {
  freeAiCreditsPerDay: number;
  premiumAiCreditsPerDay: number;
  freeWatchlistLimit: number;
  premiumWatchlistLimit: number;
  freeComparisonLimit: number;
  premiumComparisonLimit: number;
  freeHistoryRetentionDays: number;
  premiumHistoryRetentionDays: number;
  premiumPriceInr: number;
  subscriptionDurationDays: number;
}

export interface UserAccountDoc {
  uid: string;
  displayName: string;
  photoURL?: string;
  tier: 'free' | 'premium';
  role: 'investor' | 'admin';
  aiCreditsUsedToday?: number;
  aiCreditsDate?: string;
  termsAcceptedAt?: string;
}

export interface UserPrivateProfileDoc {
  uid: string;
  email: string;
  phone?: string;
  preferredCurrency?: 'INR';
  timezone?: string;
  riskDisclosureAccepted: boolean;
  notifyCorporateActions?: boolean;
  notifyResearchDigest?: boolean;
}
