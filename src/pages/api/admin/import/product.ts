import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify admin session
    const sessionToken = getAdminSessionToken(request);
    const sessionData = await verifyAdminSession(sessionToken);
    
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev && !sessionData) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Admin authentication required' 
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const body = await request.json();
    const { title, description, price, currency, image, categoryId, subcategoryId, attributes, sourceData } = body;

    // Trust the currency the client actually computed the price in, rather
    // than letting it fall through to the schema default (USD): when a real
    // landed-cost conversion ran, the price here is actually KES (or whatever
    // the target currency is), and defaulting the label to USD would
    // mislabel it just as the opposite hardcoded-KES bug did on other sites.
    const productCurrency = typeof currency === 'string' && currency.trim() ? currency.trim() : 'USD';

    // Amazon's ASIN, carried over from the search result the admin selected.
    // Stored in the otherwise-unused `sku` column so a later search can tell
    // this product has already been imported and leave it out of new results
    // (see import/search.ts's getExistingSkus exclusion).
    const asin = (sourceData && typeof sourceData.asin === 'string') ? sourceData.asin.trim() : '';

    // Validate required fields - subcategory is now optional
    if (!title || !categoryId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Title and category are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check license status
    const allSettings = await storage.getSiteSettings();
    const settingsMap: Record<string, string> = {};
    for (const s of allSettings) {
      settingsMap[s.key] = s.value || '';
    }
    
    const licenseKey = settingsMap.licenseKey || '';
    const licenseStatus = settingsMap.licenseStatus || 'inactive';
    
    if (licenseStatus !== 'active' || !licenseKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Valid license required for product import' 
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get category (required)
    const category = await storage.getCategory(String(categoryId));
    if (!category) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Invalid category' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get subcategory if provided (optional)
    let subcategory = null;
    if (subcategoryId) {
      subcategory = await storage.getSubcategory(String(subcategoryId));
    }
    
    // Generate URL slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 100);
    
    // Create the product with correct fields
    const productData = {
      name: title,
      slug,
      description: description || '',
      price: parseFloat(price) || 0,
      currency: productCurrency,
      // Amazon's ASIN (see `asin` above) so a later search can recognise this
      // product as already imported and skip it (getExistingSkus exclusion
      // in import/search.ts).
      sku: asin || null,
      categoryId: String(categoryId),
      subcategoryId: subcategoryId ? String(subcategoryId) : null,
      categorySlug: category.slug,
      subcategorySlug: subcategory ? subcategory.slug : null,
      images: image ? [image] : [],
      attributes: [],
      inStock: true,
      featured: false,
    };
    
    const newProduct = await storage.createProduct(productData);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Product imported successfully',
      productId: newProduct.id
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Product import error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Failed to import product' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
