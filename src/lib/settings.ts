import { storage } from './storage';

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
  
  return {
    enableRegionalSeo: settingsMap.enableRegionalSeo === 'true',
    targetRegion: settingsMap.targetRegion || '',
    includeBrandInH1: settingsMap.includeBrandInH1 === 'true',
    siteName: settingsMap.siteName || 'Supplements Kenya',
    siteDescription: settingsMap.siteDescription || '',
    defaultCurrency: settingsMap.defaultCurrency || 'KES',
    licenseKey: settingsMap.licenseKey || '',
    licenseStatus: settingsMap.licenseStatus || 'inactive',
  };
}
