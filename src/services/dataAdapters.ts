import { NSE_REFERENCE_EQUITIES, PROVIDER_LICENSING_REGISTRY } from '../data/nseReferenceCatalog.ts';
import type {
  EquityDataset,
  OhlcvBar,
  ProviderLicenseCompliance,
} from '../types/financial.ts';

export interface AuthorizedMarketDataAdapter {
  adapterId: string;
  getProviderRegistry(): ProviderLicenseCompliance[];
  listEquities(): EquityDataset[];
  getEquityBySymbol(symbol: string): EquityDataset | null;
  getHistoricalPrices(symbol: string, timeframe: '1M' | '3M' | '6M' | '1Y'): OhlcvBar[];
}

class NseReferenceMarketAdapter implements AuthorizedMarketDataAdapter {
  adapterId = 'nse_reference';

  getProviderRegistry(): ProviderLicenseCompliance[] {
    return PROVIDER_LICENSING_REGISTRY;
  }

  listEquities(): EquityDataset[] {
    return NSE_REFERENCE_EQUITIES;
  }

  getEquityBySymbol(symbol: string): EquityDataset | null {
    const clean = symbol.trim().toUpperCase();
    return NSE_REFERENCE_EQUITIES.find((e) => e.symbol === clean) ?? null;
  }

  getHistoricalPrices(symbol: string, timeframe: '1M' | '3M' | '6M' | '1Y'): OhlcvBar[] {
    const equity = this.getEquityBySymbol(symbol);
    if (!equity) return [];
    const barCounts: Record<'1M' | '3M' | '6M' | '1Y', number> = {
      '1M': 22,
      '3M': 65,
      '6M': 130,
      '1Y': 240,
    };
    const sliceLen = barCounts[timeframe] ?? 130;
    return equity.priceHistory.slice(-sliceLen);
  }
}

export const marketDataAdapter: AuthorizedMarketDataAdapter = new NseReferenceMarketAdapter();
