import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { getPricingSettings, calculateLandedCostSync } from "@lib/landedCost";
import { getExchangeRates } from "@lib/currency";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

// Parse Rainforest API refinements into our facets format
function parseRainforestRefinements(refinements: any[]): Record<string, { name: string; values: { name: string; value: string; refineUrl?: string }[] }> {
  const facets: Record<string, { name: string; values: { name: string; value: string; refineUrl?: string }[] }> = {};
  
  if (!Array.isArray(refinements)) return facets;
  
  // Map Rainforest refinement names to our internal keys
  const refinementMapping: Record<string, string> = {
    'brand': 'brand',
    'computer_ram_memory': 'ram',
    'computer_memory_size': 'ram',
    'memory_size': 'ram',
    'hard_disk_size': 'storage',
    'computer_hard_disk_size': 'storage',
    'hard_drive_size': 'storage',
    'screen_size': 'screenSize',
    'display_size': 'screenSize',
    'processor_type': 'processor',
    'computer_cpu_type': 'processor',
    'processor': 'processor',
    'color': 'color',
    'size': 'size',
    'scent': 'scent',
    'item_form': 'form',
    'price': 'price',
  };
  
  for (const refinement of refinements) {
    if (!refinement.name || !refinement.values) continue;
    
    // Normalize the refinement name
    const rawName = refinement.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const internalKey = refinementMapping[rawName] || rawName;
    
    // Skip if already processed or has no useful values
    if (facets[internalKey] || refinement.values.length === 0) continue;
    
    facets[internalKey] = {
      name: refinement.name,
      values: refinement.values.slice(0, 10).map((v: any) => ({
        name: v.name || v.value,
        value: v.value || v.name,
        refineUrl: v.refine_url || null,
      }))
    };
  }
  
  return facets;
}

// Extract product attributes from Rainforest search result item
function extractProductAttributes(item: any): Record<string, any> {
  const attrs: Record<string, any> = {
    brand: item.brand || 'Unknown',
    condition: 'New',
    isPrime: item.is_prime || false,
  };
  
  // Try to extract specs from title using regex patterns
  const title = item.title || '';
  
  // RAM patterns: "16GB RAM", "16 GB RAM", "16GB DDR4"
  const ramMatch = title.match(/(\d+)\s*GB\s*(RAM|DDR\d?|Memory)/i);
  if (ramMatch) {
    attrs.ram = `${ramMatch[1]}GB`;
  }
  
  // Storage patterns: "512GB SSD", "1TB HDD", "256 GB SSD"
  const storageMatch = title.match(/(\d+)\s*(GB|TB)\s*(SSD|HDD|NVMe|Storage|Hard\s*Drive)/i);
  if (storageMatch) {
    attrs.storage = `${storageMatch[1]}${storageMatch[2].toUpperCase()} ${storageMatch[3].toUpperCase()}`;
  }
  
  // Screen size patterns: "15.6 inch", "15.6-inch", "15.6""
  const screenMatch = title.match(/(\d+\.?\d*)\s*[-"]?\s*(?:inch|"|'')/i);
  if (screenMatch) {
    attrs.screenSize = `${screenMatch[1]}"`;
  }
  
  // Processor patterns: "Intel Core i7", "AMD Ryzen 5", "Apple M2"
  const processorMatch = title.match(/(Intel\s+Core\s+i\d|AMD\s+Ryzen\s+\d|Apple\s+M\d|Snapdragon\s+\d+)/i);
  if (processorMatch) {
    attrs.processor = processorMatch[1];
  }
  
  // Color - often at the end of title in parentheses or after comma
  const colorPatterns = ['Black', 'White', 'Silver', 'Gray', 'Grey', 'Gold', 'Blue', 'Red', 'Green', 'Pink', 'Purple', 'Rose Gold', 'Space Gray', 'Midnight', 'Starlight'];
  for (const color of colorPatterns) {
    if (title.toLowerCase().includes(color.toLowerCase())) {
      attrs.color = color;
      break;
    }
  }
  
  // Try to get additional info from item properties if available
  if (item.specifications) {
    for (const spec of item.specifications) {
      const name = (spec.name || '').toLowerCase();
      const value = spec.value;
      
      if (name.includes('ram') || name.includes('memory')) {
        attrs.ram = value;
      } else if (name.includes('storage') || name.includes('hard drive')) {
        attrs.storage = value;
      } else if (name.includes('screen') || name.includes('display')) {
        attrs.screenSize = value;
      } else if (name.includes('processor') || name.includes('cpu')) {
        attrs.processor = value;
      }
    }
  }
  
  return attrs;
}

// Extract filter facets from products (fallback when API doesn't provide refinements)
function extractFilterFacets(products: any[]) {
  const facets: Record<string, Set<string>> = {};
  
  products.forEach(product => {
    const attrs = product.attributes || {};
    
    // Extract common filterable attributes
    for (const [key, value] of Object.entries(attrs)) {
      if (!value || value === 'Unknown' || key === 'condition' || key === 'isPrime') continue;
      
      if (!facets[key]) facets[key] = new Set();
      facets[key].add(String(value));
    }
  });
  
  // Convert Sets to arrays
  const result: Record<string, string[]> = {};
  for (const [key, values] of Object.entries(facets)) {
    if (values.size > 1) { // Only include facets with multiple values
      result[key] = Array.from(values).sort();
    }
  }
  
  return result;
}

// Apply client-side filters to products
function applyFilters(products: any[], filters: Record<string, string[]>) {
  if (!filters || Object.keys(filters).length === 0) return products;
  
  return products.filter(product => {
    const attrs = product.attributes || {};
    
    for (const [key, values] of Object.entries(filters)) {
      if (!values || values.length === 0) continue;
      
      const productValue = attrs[key];
      if (!productValue) return false;
      if (!values.includes(productValue)) return false;
    }
    
    return true;
  });
}

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
    const { query, primeOnly = true, filters = {}, refinementUrl } = body;
    
    if (!query || typeof query !== 'string') {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Search query is required' 
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
    
    // Check for license server first (for distributed templates)
    const licenseServerUrl = process.env.LICENSE_SERVER_URL;
    
    if (licenseServerUrl) {
      // Production mode for clients: proxy through license server
      try {
        const response = await fetch(`${licenseServerUrl}/api/import/search`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-License-Key': licenseKey,
          },
          body: JSON.stringify({ query, primeOnly }),
        });
        
        if (!response.ok) {
          const error = await response.json();
          return new Response(JSON.stringify({ 
            success: false, 
            message: error.message || 'Search failed' 
          }), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        const result = await response.json();
        return new Response(JSON.stringify({ 
          success: true, 
          products: result.products || [],
          source: 'api'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (fetchError) {
        console.error('License server fetch error:', fetchError);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Could not connect to product service' 
        }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Template owner testing mode: use Rainforest API directly
    const rainforestApiKey = process.env.RAINFOREST_API_KEY;
    
    console.log('Search request received, query:', query);
    console.log('RAINFOREST_API_KEY configured:', !!rainforestApiKey);
    
    if (!rainforestApiKey) {
      // Demo mode: return mock product data when no API configured
      console.log('Using demo mode - no API key');
      let mockProducts = await generateMockProductsWithPricing(query, primeOnly);
      
      // Apply client-side filters
      mockProducts = applyFilters(mockProducts, filters);
      
      // Extract filter facets from products
      const facets = extractFilterFacets(mockProducts);
      
      return new Response(JSON.stringify({ 
        success: true, 
        products: mockProducts,
        facets,
        source: 'demo'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Direct API call for template owner testing only
    try {
      console.log('Calling Rainforest API for:', query, 'primeOnly:', primeOnly);
      const searchUrl = new URL('https://api.rainforestapi.com/request');
      searchUrl.searchParams.set('api_key', rainforestApiKey);
      searchUrl.searchParams.set('type', 'search');
      searchUrl.searchParams.set('amazon_domain', 'amazon.com');
      searchUrl.searchParams.set('search_term', query);
      searchUrl.searchParams.set('include_refinements', 'true'); // Request refinements
      
      // Add Prime filter refinement if enabled
      if (primeOnly) {
        searchUrl.searchParams.set('refinements', 'p_85/2470955011'); // Amazon Prime refinement ID
      }
      
      // If a refinement URL was provided, use it for filtered search
      if (refinementUrl) {
        searchUrl.searchParams.set('url', refinementUrl);
      }
      
      const response = await fetch(searchUrl.toString());
      console.log('Rainforest API response status:', response.status);
      
      if (!response.ok) {
        console.error('Rainforest API error:', response.status);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Product search service error. Please try again.'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const data = await response.json();
      
      // Log the refinements for debugging
      console.log('Rainforest refinements available:', data.refinements ? data.refinements.length : 0);
      
      if (!data.search_results || !Array.isArray(data.search_results) || data.search_results.length === 0) {
        // If Prime filter returned no results, try without it
        if (primeOnly) {
          console.log('No Prime results, retrying without Prime filter');
          const retryUrl = new URL('https://api.rainforestapi.com/request');
          retryUrl.searchParams.set('api_key', rainforestApiKey);
          retryUrl.searchParams.set('type', 'search');
          retryUrl.searchParams.set('amazon_domain', 'amazon.com');
          retryUrl.searchParams.set('search_term', query);
          retryUrl.searchParams.set('include_refinements', 'true');
          
          const retryResponse = await fetch(retryUrl.toString());
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.search_results && retryData.search_results.length > 0) {
              // Use the retry data
              Object.assign(data, retryData);
            }
          }
        }
        
        if (!data.search_results || data.search_results.length === 0) {
          return new Response(JSON.stringify({ 
            success: true, 
            products: [],
            facets: {},
            message: 'No products found for this search',
            source: 'rainforest'
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
      
      // Get pricing settings for landed cost calculation
      const pricingSettings = await getPricingSettings();
      let exchangeRate = pricingSettings.exchangeRate;
      
      if (!exchangeRate && pricingSettings.targetCurrencyCode) {
        const rates = await getExchangeRates('USD');
        if (rates && rates[pricingSettings.targetCurrencyCode]) {
          exchangeRate = rates[pricingSettings.targetCurrencyCode];
        }
      }
      
      // Parse Rainforest refinements into our facet format
      const apiRefinements = parseRainforestRefinements(data.refinements || []);
      
      // Map Rainforest API response to our product format
      const products = data.search_results.slice(0, 30).map((item: any) => {
        const amazonPrice = item.price?.value || item.prices?.[0]?.value || 0;
        
        let landedCost = null;
        if (exchangeRate && pricingSettings.targetCurrencyCode) {
          landedCost = calculateLandedCostSync(amazonPrice, exchangeRate, {
            exchangeRateMarkup: pricingSettings.exchangeRateMarkup,
            shippingCostUSD: pricingSettings.shippingCostUSD,
            commissionPercent: pricingSettings.commissionPercent,
            currencyCode: pricingSettings.targetCurrencyCode,
          });
        }
        
        // Extract attributes from search result item
        const attributes = extractProductAttributes(item);
        
        return {
          id: item.asin,
          asin: item.asin,
          title: item.title,
          description: item.description || '',
          price: amazonPrice,
          currency: '$',
          image: item.image || '',
          rating: item.rating || 0,
          reviewCount: item.ratings_total || 0,
          landedCost: landedCost,
          isPrime: item.is_prime || false,
          attributes: attributes
        };
      });
      
      // Apply client-side filters if any
      const filteredProducts = applyFilters(products, filters);
      
      // Extract product-based facets as fallback/supplement to API refinements
      const productFacets = extractFilterFacets(products);
      
      // Merge API refinements with product-extracted facets
      // API refinements take priority as they're more comprehensive
      const mergedFacets: Record<string, any> = {};
      
      // Add API refinements first
      for (const [key, refinement] of Object.entries(apiRefinements)) {
        mergedFacets[key] = {
          name: refinement.name,
          values: refinement.values.map(v => v.name),
          fromApi: true
        };
      }
      
      // Add product-extracted facets if not already covered by API
      for (const [key, values] of Object.entries(productFacets)) {
        if (!mergedFacets[key]) {
          mergedFacets[key] = {
            name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            values: values,
            fromApi: false
          };
        }
      }
      
      return new Response(JSON.stringify({ 
        success: true, 
        products: filteredProducts,
        facets: mergedFacets,
        totalResults: data.search_results.length,
        source: 'rainforest'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (fetchError) {
      console.error('Rainforest API fetch error:', fetchError);
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Product search service error. Please try again.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Import search error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Search failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function generateMockProductsWithPricing(query: string, primeOnly: boolean = true) {
  const pricingSettings = await getPricingSettings();
  let exchangeRate = pricingSettings.exchangeRate;
  
  if (!exchangeRate && pricingSettings.targetCurrencyCode) {
    const rates = await getExchangeRates('USD');
    if (rates && rates[pricingSettings.targetCurrencyCode]) {
      exchangeRate = rates[pricingSettings.targetCurrencyCode];
    }
  }
  
  // Check if query looks like a laptop/computer search
  const isLaptopSearch = /laptop|notebook|computer|macbook|chromebook|hp|dell|lenovo|asus|acer/i.test(query);
  
  // Check for personal care / Old Spice type products
  const isPersonalCareSearch = /old\s*spice|deodorant|body\s*wash|shampoo|cologne|soap|lotion/i.test(query);
  
  const allProducts = isLaptopSearch ? [
    {
      id: 'demo-1',
      asin: 'B0DEMO001',
      title: `HP Envy x360 15.6" Laptop - Intel Core i7, 16GB RAM, 512GB SSD`,
      description: `Premium 2-in-1 convertible laptop with touchscreen display.`,
      price: 999.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=HP+Envy',
      rating: 4.5,
      reviewCount: 1256,
      isPrime: true,
      attributes: {
        brand: 'HP',
        condition: 'New',
        isPrime: true,
        processor: 'Intel Core i7',
        ram: '16GB',
        storage: '512GB SSD',
        screenSize: '15.6"',
        color: 'Silver',
      }
    },
    {
      id: 'demo-2',
      asin: 'B0DEMO002',
      title: `HP Envy 13.3" Laptop - Intel Core i5, 8GB RAM, 256GB SSD`,
      description: `Slim and portable laptop with stunning display.`,
      price: 749.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=HP+Envy+13',
      rating: 4.3,
      reviewCount: 892,
      isPrime: true,
      attributes: {
        brand: 'HP',
        condition: 'New',
        isPrime: true,
        processor: 'Intel Core i5',
        ram: '8GB',
        storage: '256GB SSD',
        screenSize: '13.3"',
        color: 'Silver',
      }
    },
    {
      id: 'demo-3',
      asin: 'B0DEMO003',
      title: `Dell XPS 15 Laptop - Intel Core i9, 32GB RAM, 1TB SSD`,
      description: `Professional powerhouse with stunning 4K display.`,
      price: 1899.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Dell+XPS',
      rating: 4.7,
      reviewCount: 2134,
      isPrime: true,
      attributes: {
        brand: 'Dell',
        condition: 'New',
        isPrime: true,
        processor: 'Intel Core i9',
        ram: '32GB',
        storage: '1TB SSD',
        screenSize: '15.6"',
        color: 'Platinum Silver',
      }
    },
    {
      id: 'demo-4',
      asin: 'B0DEMO004',
      title: `Lenovo ThinkPad X1 Carbon - Intel Core i7, 16GB RAM, 512GB SSD`,
      description: `Business-class ultrabook with legendary ThinkPad reliability.`,
      price: 1449.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=ThinkPad',
      rating: 4.6,
      reviewCount: 1567,
      isPrime: true,
      attributes: {
        brand: 'Lenovo',
        condition: 'New',
        isPrime: true,
        processor: 'Intel Core i7',
        ram: '16GB',
        storage: '512GB SSD',
        screenSize: '14"',
        color: 'Black',
      }
    },
    {
      id: 'demo-5',
      asin: 'B0DEMO005',
      title: `ASUS VivoBook 15 - AMD Ryzen 5, 8GB RAM, 512GB SSD`,
      description: `Affordable everyday laptop with AMD Ryzen power.`,
      price: 549.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=ASUS+VivoBook',
      rating: 4.2,
      reviewCount: 3421,
      isPrime: true,
      attributes: {
        brand: 'ASUS',
        condition: 'New',
        isPrime: true,
        processor: 'AMD Ryzen 5',
        ram: '8GB',
        storage: '512GB SSD',
        screenSize: '15.6"',
        color: 'Slate Gray',
      }
    },
    {
      id: 'demo-6',
      asin: 'B0DEMO006',
      title: `HP Pavilion 17.3" Laptop - Intel Core i5, 8GB RAM, 256GB SSD`,
      description: `Large screen laptop for home and office use.`,
      price: 649.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=HP+Pavilion',
      rating: 4.1,
      reviewCount: 1876,
      isPrime: false,
      attributes: {
        brand: 'HP',
        condition: 'New',
        isPrime: false,
        processor: 'Intel Core i5',
        ram: '8GB',
        storage: '256GB SSD',
        screenSize: '17.3"',
        color: 'Black',
      }
    },
  ] : isPersonalCareSearch ? [
    {
      id: 'demo-os-1',
      asin: 'B0OLDSPICE1',
      title: `Old Spice High Endurance Deodorant - Fresh Scent, 3 oz (Pack of 3)`,
      description: `Long-lasting protection with classic Old Spice fresh scent.`,
      price: 12.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Old+Spice+Deodorant',
      rating: 4.7,
      reviewCount: 8934,
      isPrime: true,
      attributes: {
        brand: 'Old Spice',
        condition: 'New',
        isPrime: true,
        scent: 'Fresh',
        size: '3 oz',
        form: 'Solid',
      }
    },
    {
      id: 'demo-os-2',
      asin: 'B0OLDSPICE2',
      title: `Old Spice Body Wash - Swagger Scent, 16 fl oz (Pack of 2)`,
      description: `Clean and confident with Old Spice Swagger body wash.`,
      price: 14.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Old+Spice+Body+Wash',
      rating: 4.6,
      reviewCount: 5621,
      isPrime: true,
      attributes: {
        brand: 'Old Spice',
        condition: 'New',
        isPrime: true,
        scent: 'Swagger',
        size: '16 fl oz',
        form: 'Liquid',
      }
    },
    {
      id: 'demo-os-3',
      asin: 'B0OLDSPICE3',
      title: `Old Spice Antiperspirant Deodorant - Bearglove, 2.6 oz`,
      description: `48-hour sweat protection with bold Bearglove scent.`,
      price: 7.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Old+Spice+Bearglove',
      rating: 4.5,
      reviewCount: 3245,
      isPrime: true,
      attributes: {
        brand: 'Old Spice',
        condition: 'New',
        isPrime: true,
        scent: 'Bearglove',
        size: '2.6 oz',
        form: 'Solid',
      }
    },
    {
      id: 'demo-os-4',
      asin: 'B0OLDSPICE4',
      title: `Old Spice 2-in-1 Shampoo and Conditioner - Fiji, 12.8 fl oz`,
      description: `Fresh coconut scent for clean, conditioned hair.`,
      price: 8.49,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Old+Spice+Shampoo',
      rating: 4.4,
      reviewCount: 2156,
      isPrime: true,
      attributes: {
        brand: 'Old Spice',
        condition: 'New',
        isPrime: true,
        scent: 'Fiji',
        size: '12.8 fl oz',
        form: 'Liquid',
      }
    },
    {
      id: 'demo-os-5',
      asin: 'B0OLDSPICE5',
      title: `Old Spice Body Spray - Wolfthorn, 3.75 oz`,
      description: `All-day freshness with citrus and orange scent.`,
      price: 6.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Old+Spice+Spray',
      rating: 4.3,
      reviewCount: 1876,
      isPrime: false,
      attributes: {
        brand: 'Old Spice',
        condition: 'New',
        isPrime: false,
        scent: 'Wolfthorn',
        size: '3.75 oz',
        form: 'Spray',
      }
    },
  ] : [
    {
      id: 'demo-1',
      asin: 'B0DEMO001',
      title: `${query} - Premium Edition`,
      description: `High-quality ${query} with advanced features.`,
      price: 199.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Product+1',
      rating: 4.5,
      reviewCount: 156,
      isPrime: true,
      attributes: {
        brand: 'Premium Brand',
        condition: 'New',
        isPrime: true,
      }
    },
    {
      id: 'demo-2',
      asin: 'B0DEMO002',
      title: `${query} - Standard Model`,
      description: `Reliable ${query} for daily use.`,
      price: 149.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Product+2',
      rating: 4.2,
      reviewCount: 89,
      isPrime: true,
      attributes: {
        brand: 'Standard Brand',
        condition: 'New',
        isPrime: true,
      }
    },
    {
      id: 'demo-3',
      asin: 'B0DEMO003',
      title: `${query} - Budget Option`,
      description: `Affordable ${query} without compromising quality.`,
      price: 79.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Product+3',
      rating: 4.0,
      reviewCount: 234,
      isPrime: false,
      attributes: {
        brand: 'Value Brand',
        condition: 'New',
        isPrime: false,
      }
    },
    {
      id: 'demo-4',
      asin: 'B0DEMO004',
      title: `${query} - Pro Series`,
      description: `Professional-grade ${query} with top-tier performance.`,
      price: 349.99,
      currency: '$',
      image: 'https://via.placeholder.com/300x300?text=Product+4',
      rating: 4.8,
      reviewCount: 312,
      isPrime: true,
      attributes: {
        brand: 'Pro Brand',
        condition: 'New',
        isPrime: true,
      }
    },
  ];
  
  // Filter for Prime products if enabled
  const baseProducts = primeOnly 
    ? allProducts.filter(p => p.isPrime) 
    : allProducts;
  
  // Add landed cost to each product
  return baseProducts.map(product => {
    let landedCost = null;
    if (exchangeRate && pricingSettings.targetCurrencyCode) {
      landedCost = calculateLandedCostSync(product.price, exchangeRate, {
        exchangeRateMarkup: pricingSettings.exchangeRateMarkup,
        shippingCostUSD: pricingSettings.shippingCostUSD,
        commissionPercent: pricingSettings.commissionPercent,
        currencyCode: pricingSettings.targetCurrencyCode,
      });
    }
    return { ...product, landedCost };
  });
}
