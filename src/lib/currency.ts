const REGION_TO_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  'Kenya': { code: 'KES', symbol: 'KES', name: 'Kenyan Shilling' },
  'Nigeria': { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  'South Africa': { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  'Ghana': { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi' },
  'Tanzania': { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling' },
  'Uganda': { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling' },
  'Ethiopia': { code: 'ETB', symbol: 'Br', name: 'Ethiopian Birr' },
  'Egypt': { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  'Morocco': { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
  'United Kingdom': { code: 'GBP', symbol: '£', name: 'British Pound' },
  'UK': { code: 'GBP', symbol: '£', name: 'British Pound' },
  'United States': { code: 'USD', symbol: '$', name: 'US Dollar' },
  'USA': { code: 'USD', symbol: '$', name: 'US Dollar' },
  'Canada': { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  'Australia': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  'New Zealand': { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  'Germany': { code: 'EUR', symbol: '€', name: 'Euro' },
  'France': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Italy': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Spain': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Netherlands': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Belgium': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Ireland': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Portugal': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Austria': { code: 'EUR', symbol: '€', name: 'Euro' },
  'Japan': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  'China': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  'India': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  'Brazil': { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  'Mexico': { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  'Singapore': { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  'Malaysia': { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  'Thailand': { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  'Indonesia': { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  'Philippines': { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
  'Vietnam': { code: 'VND', symbol: '₫', name: 'Vietnamese Dong' },
  'South Korea': { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  'United Arab Emirates': { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  'UAE': { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  'Saudi Arabia': { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  'Qatar': { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal' },
  'Kuwait': { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar' },
  'Pakistan': { code: 'PKR', symbol: 'Rs', name: 'Pakistani Rupee' },
  'Bangladesh': { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  'Sri Lanka': { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee' },
  'Nepal': { code: 'NPR', symbol: 'Rs', name: 'Nepalese Rupee' },
  'Poland': { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
  'Sweden': { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  'Norway': { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  'Denmark': { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  'Switzerland': { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  'Russia': { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  'Turkey': { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  'Israel': { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
  'Argentina': { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  'Chile': { code: 'CLP', symbol: 'CLP$', name: 'Chilean Peso' },
  'Colombia': { code: 'COP', symbol: 'COL$', name: 'Colombian Peso' },
  'Peru': { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
};

export function getCurrencyForRegion(region: string): { code: string; symbol: string; name: string } | null {
  if (!region) return null;
  const normalized = region.trim();
  return REGION_TO_CURRENCY[normalized] || null;
}

export function getCurrencyCode(region: string): string | null {
  const currency = getCurrencyForRegion(region);
  return currency?.code || null;
}

let cachedRates: { rates: Record<string, number>; timestamp: number } | null = null;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

export async function getExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number> | null> {
  const apiKey = process.env.EXCHANGERATE_API_KEY;
  
  if (!apiKey) {
    console.warn('EXCHANGERATE_API_KEY not set - currency conversion disabled');
    return null;
  }

  if (cachedRates && (Date.now() - cachedRates.timestamp) < CACHE_DURATION) {
    return cachedRates.rates;
  }

  try {
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
    );
    
    if (!response.ok) {
      console.error('Exchange rate API error:', response.status);
      return cachedRates?.rates || null;
    }

    const data = await response.json();
    
    if (data.result === 'success' && data.conversion_rates) {
      cachedRates = {
        rates: data.conversion_rates,
        timestamp: Date.now(),
      };
      return data.conversion_rates;
    }

    return null;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return cachedRates?.rates || null;
  }
}

export async function convertPrice(
  priceUSD: number,
  targetCurrency: string
): Promise<number | null> {
  if (targetCurrency === 'USD') return priceUSD;
  
  const rates = await getExchangeRates('USD');
  if (!rates || !rates[targetCurrency]) return null;
  
  return priceUSD * rates[targetCurrency];
}

export function formatPrice(amount: number, currencyCode: string): string {
  const currency = Object.values(REGION_TO_CURRENCY).find(c => c.code === currencyCode);
  const symbol = currency?.symbol || currencyCode;
  
  const noDecimalCurrencies = ['JPY', 'KRW', 'VND', 'IDR', 'CLP', 'UGX', 'TZS', 'KES'];
  const decimals = noDecimalCurrencies.includes(currencyCode) ? 0 : 2;
  
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return `${symbol} ${formatted}`;
}

export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface DualPrice {
  usd: string;
  local: string | null;
  localCode: string | null;
}

export async function getDualPrice(priceUSD: number, targetRegion: string): Promise<DualPrice> {
  const usdFormatted = formatUSD(priceUSD);
  
  const currency = getCurrencyForRegion(targetRegion);
  if (!currency || currency.code === 'USD') {
    return { usd: usdFormatted, local: null, localCode: null };
  }

  const localAmount = await convertPrice(priceUSD, currency.code);
  if (localAmount === null) {
    return { usd: usdFormatted, local: null, localCode: null };
  }

  return {
    usd: usdFormatted,
    local: formatPrice(localAmount, currency.code),
    localCode: currency.code,
  };
}

export function getAllSupportedRegions(): string[] {
  return Object.keys(REGION_TO_CURRENCY);
}

export function getAllSupportedCurrencies(): { code: string; symbol: string; name: string }[] {
  const seen = new Set<string>();
  const currencies: { code: string; symbol: string; name: string }[] = [];
  
  for (const currency of Object.values(REGION_TO_CURRENCY)) {
    if (!seen.has(currency.code)) {
      seen.add(currency.code);
      currencies.push(currency);
    }
  }
  
  return currencies.sort((a, b) => a.code.localeCompare(b.code));
}
