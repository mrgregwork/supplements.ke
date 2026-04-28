import { storage } from "@lib/storage";
import { getExchangeRates, getCurrencyCode } from "@lib/currency";

export interface PricingSettings {
  exchangeRate: number | null;
  exchangeRateMarkup: number;
  shippingCostUSD: number;
  commissionPercent: number;
  targetCurrencyCode: string | null;
}

export interface LandedCostResult {
  amazonPriceUSD: number;
  shippingCostUSD: number;
  subtotalUSD: number;
  commissionUSD: number;
  totalUSD: number;
  exchangeRate: number;
  exchangeRateWithMarkup: number;
  landedCostLocal: number;
  currencyCode: string;
  formatted: {
    amazonPriceUSD: string;
    shippingCostUSD: string;
    commissionUSD: string;
    totalUSD: string;
    landedCostLocal: string;
  };
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const allSettings = await storage.getSiteSettings();
  const settingsMap: Record<string, string> = {};
  for (const s of allSettings) {
    settingsMap[s.key] = s.value || '';
  }

  const targetRegion = settingsMap.targetRegion || '';
  const currencyCode = getCurrencyCode(targetRegion);

  return {
    exchangeRate: settingsMap.exchangeRate ? parseFloat(settingsMap.exchangeRate) : null,
    exchangeRateMarkup: parseFloat(settingsMap.exchangeRateMarkup) || 1.05,
    shippingCostUSD: parseFloat(settingsMap.shippingCostUSD) || 25,
    commissionPercent: parseFloat(settingsMap.commissionPercent) || 10,
    targetCurrencyCode: currencyCode,
  };
}

export async function calculateLandedCost(
  amazonPriceUSD: number,
  settings?: PricingSettings
): Promise<LandedCostResult | null> {
  const pricingSettings = settings || await getPricingSettings();
  
  if (!pricingSettings.targetCurrencyCode) {
    return null;
  }

  let exchangeRate = pricingSettings.exchangeRate;
  
  if (!exchangeRate) {
    const rates = await getExchangeRates('USD');
    if (rates && rates[pricingSettings.targetCurrencyCode]) {
      exchangeRate = rates[pricingSettings.targetCurrencyCode];
    } else {
      return null;
    }
  }

  const shippingCostUSD = pricingSettings.shippingCostUSD;
  const subtotalUSD = amazonPriceUSD + shippingCostUSD;
  const commissionUSD = subtotalUSD * (pricingSettings.commissionPercent / 100);
  const totalUSD = subtotalUSD + commissionUSD;
  // exchangeRateMarkup is a multiplier (e.g., 1.05 for 5% markup)
  const exchangeRateWithMarkup = exchangeRate * pricingSettings.exchangeRateMarkup;
  const landedCostLocal = totalUSD * exchangeRateWithMarkup;

  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatLocal = (n: number, code: string) => {
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'UGX', 'TZS', 'KES'];
    const decimals = noDecimalCurrencies.includes(code) ? 0 : 2;
    return `${code} ${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return {
    amazonPriceUSD,
    shippingCostUSD,
    subtotalUSD,
    commissionUSD,
    totalUSD,
    exchangeRate,
    exchangeRateWithMarkup,
    landedCostLocal,
    currencyCode: pricingSettings.targetCurrencyCode,
    formatted: {
      amazonPriceUSD: formatUSD(amazonPriceUSD),
      shippingCostUSD: formatUSD(shippingCostUSD),
      commissionUSD: formatUSD(commissionUSD),
      totalUSD: formatUSD(totalUSD),
      landedCostLocal: formatLocal(landedCostLocal, pricingSettings.targetCurrencyCode),
    },
  };
}

export function calculateLandedCostSync(
  amazonPriceUSD: number,
  exchangeRate: number,
  settings: {
    exchangeRateMarkup: number;
    shippingCostUSD: number;
    commissionPercent: number;
    currencyCode: string;
  }
): LandedCostResult {
  const shippingCostUSD = settings.shippingCostUSD;
  const subtotalUSD = amazonPriceUSD + shippingCostUSD;
  const commissionUSD = subtotalUSD * (settings.commissionPercent / 100);
  const totalUSD = subtotalUSD + commissionUSD;
  // exchangeRateMarkup is a multiplier (e.g., 1.05 for 5% markup)
  const exchangeRateWithMarkup = exchangeRate * settings.exchangeRateMarkup;
  const landedCostLocal = totalUSD * exchangeRateWithMarkup;

  const formatUSD = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatLocal = (n: number, code: string) => {
    const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'UGX', 'TZS', 'KES'];
    const decimals = noDecimalCurrencies.includes(code) ? 0 : 2;
    return `${code} ${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return {
    amazonPriceUSD,
    shippingCostUSD,
    subtotalUSD,
    commissionUSD,
    totalUSD,
    exchangeRate,
    exchangeRateWithMarkup,
    landedCostLocal,
    currencyCode: settings.currencyCode,
    formatted: {
      amazonPriceUSD: formatUSD(amazonPriceUSD),
      shippingCostUSD: formatUSD(shippingCostUSD),
      commissionUSD: formatUSD(commissionUSD),
      totalUSD: formatUSD(totalUSD),
      landedCostLocal: formatLocal(landedCostLocal, settings.currencyCode),
    },
  };
}
