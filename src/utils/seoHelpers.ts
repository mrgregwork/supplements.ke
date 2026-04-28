import siteSettings from '@config/siteSettings.json';

/**
 * Generates a natural language URL slug from a value and category.
 * Format: {value}-{category} in lowercase, URL-friendly format.
 * 
 * @example generateSpecSlug('32GB', 'Laptops') -> '32gb-laptops'
 * @example generateSpecSlug('5G', 'Phones') -> '5g-phones'
 */
export function generateSpecSlug(value: string, category: string): string {
  const combined = `${value}-${category}`;
  
  return combined
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Generates anchor text with optional regional suffix based on site settings.
 * If enableRegionalSeo is true, appends ' in {targetRegion}' to the base text.
 * 
 * @example generateAnchorText('Gaming Laptops') -> 'Gaming Laptops in Kenya' (if region enabled)
 * @example generateAnchorText('Gaming Laptops') -> 'Gaming Laptops' (if region disabled)
 */
export function generateAnchorText(baseText: string): string {
  if (siteSettings.enableRegionalSeo && siteSettings.targetRegion) {
    return `${baseText} in ${siteSettings.targetRegion}`;
  }
  return baseText;
}
