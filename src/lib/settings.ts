import { storage } from './storage';
import configDefaults from '@config/siteSettings.json';

export interface SiteSettingsConfig {
  enableRegionalSeo: boolean;
  targetRegion: string;
  includeBrandInH1: boolean;
  siteName: string;
  siteDescription: string;
  defaultCurrency: string;
  licenseKey: string;
  licenseStatus: string;
}

export async function getSiteSettings(): Promise<SiteSettingsConfig> {
  const allSettings = await storage.getSiteSettings();
  
  const settingsMap = allSettings.reduce((acc, s) => {
    acc[s.key] = s.value || '';
    return acc;
  }, {} as Record<string, string>);
  
  // siteSettings.json is the config of record; DB rows override it when present.
  // Falling back to it matters because an unseeded site_settings table would
  // otherwise silently disable regional SEO and blank out targetRegion, which
  // strips "in Kenya" from every collection H1 and internal-link anchor.
  const bool = (dbValue: string | undefined, fallback: boolean) =>
    dbValue === undefined || dbValue === '' ? fallback : dbValue === 'true';

  return {
    enableRegionalSeo: bool(settingsMap.enableRegionalSeo, configDefaults.enableRegionalSeo ?? true),
    targetRegion: settingsMap.targetRegion || configDefaults.targetRegion || 'Kenya',
    includeBrandInH1: bool(settingsMap.includeBrandInH1, configDefaults.includeBrandInH1 ?? false),
    siteName: settingsMap.siteName || configDefaults.siteName || 'Supplements Kenya',
    siteDescription: settingsMap.siteDescription || configDefaults.siteDescription || '',
    defaultCurrency: settingsMap.defaultCurrency || configDefaults.defaultCurrency || 'KES',
    licenseKey: settingsMap.licenseKey || '',
    licenseStatus: settingsMap.licenseStatus || 'inactive',
  };
}
