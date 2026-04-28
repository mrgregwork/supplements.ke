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
    const { title, description, price, image, categoryId, subcategoryId, attributes, sourceData } = body;
    
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
