import type { APIRoute } from "astro";
import { storage } from "@lib/storage";

export const GET: APIRoute = async ({ request }) => {
  try {
    const settings = await storage.getSiteSettings();
    
    const settingsMap: Record<string, string> = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value || '';
    }
    
    return new Response(JSON.stringify(settingsMap), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    
    const targetRegion = (body.targetRegion || '').trim();
    const enableRegionalSeo = targetRegion.length > 0;
    
    const settingsToUpdate: { key: string; value: string; description?: string }[] = [
      { key: 'enableRegionalSeo', value: String(enableRegionalSeo), description: 'Enable regional SEO targeting' },
      { key: 'targetRegion', value: targetRegion, description: 'Target region/location for SEO' },
      { key: 'siteName', value: body.siteName || '', description: 'Site name' },
      { key: 'siteDescription', value: body.siteDescription || '', description: 'Site description' },
      { key: 'defaultCurrency', value: body.defaultCurrency || 'KES', description: 'Default currency' },
      { key: 'exchangeRate', value: body.exchangeRate || '', description: 'Manual exchange rate override' },
      { key: 'exchangeRateMarkup', value: body.exchangeRateMarkup || '1.05', description: 'Exchange rate markup multiplier' },
      { key: 'shippingCostUSD', value: body.shippingCostUSD || '25', description: 'Shipping cost in USD' },
      { key: 'commissionPercent', value: body.commissionPercent || '10', description: 'Commission/profit margin percentage' },
    ];
    
    // Only update license key if a new one is provided (not empty)
    const newLicenseKey = (body.licenseKey || '').trim();
    if (newLicenseKey.length > 0) {
      settingsToUpdate.push({ key: 'licenseKey', value: newLicenseKey, description: 'Product import license key' });
      // Reset license status when key changes - user needs to verify again
      settingsToUpdate.push({ key: 'licenseStatus', value: 'inactive', description: 'License validation status' });
    }
    
    for (const setting of settingsToUpdate) {
      await storage.setSiteSetting(setting.key, setting.value, setting.description);
    }
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error saving settings:", error);
    return new Response(JSON.stringify({ error: "Failed to save settings" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
