import type { APIRoute } from "astro";
import OpenAI from "openai";
import { getAdminSessionToken, verifyAdminSession } from "@lib/admin";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface ProductSummary {
  title: string;
  brand?: string;
  price?: number;
  attributes?: Record<string, any>;
}

interface AIFilterResult {
  key: string;
  label: string;
  values: string[];
  priority: number;
}

export const POST: APIRoute = async ({ request }) => {
  try {
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
    const { products, query } = body;
    
    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Products array is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const productSummaries: ProductSummary[] = products.slice(0, 20).map((p: any) => ({
      title: p.title || '',
      brand: p.attributes?.brand || p.brand || '',
      price: p.price || 0,
      attributes: p.attributes || {},
    }));
    
    const prompt = `Analyze these product search results and generate smart filter categories.

Search Query: "${query || 'products'}"

Products:
${productSummaries.map((p, i) => `${i + 1}. ${p.title} (Brand: ${p.brand}, Price: $${p.price})`).join('\n')}

Based on the product types in these results, generate filter categories that would help a user narrow down their search. Consider:
- For electronics/laptops: RAM, Storage, Processor, Screen Size, etc.
- For personal care: Scent, Size, Form (spray, solid, liquid), etc.
- For clothing: Size, Color, Material, etc.
- For general products: Brand, Price Range, Condition, etc.

Only include filter categories that are relevant to these specific products. Extract actual values from the product titles where possible.

Respond in JSON format:
{
  "filters": [
    {
      "key": "ram",
      "label": "RAM",
      "values": ["8GB", "16GB", "32GB"],
      "priority": 1
    }
  ]
}

Rules:
1. Only include filters with 2+ distinct values
2. Skip redundant filters (e.g., don't include "Brand: HP" if all products are HP)
3. Order by relevance to the product type (priority 1 = most important)
4. Maximum 6 filter categories
5. Extract values from product titles using pattern matching`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { 
          role: "system", 
          content: "You are a product filter expert. Analyze product listings and generate relevant filter categories. Always respond with valid JSON only."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000,
      temperature: 0.3,
    });
    
    const content = response.choices[0]?.message?.content || '{}';
    let aiFilters: { filters: AIFilterResult[] };
    
    try {
      aiFilters = JSON.parse(content);
    } catch {
      aiFilters = { filters: [] };
    }
    
    const validFilters = (aiFilters.filters || [])
      .filter((f: AIFilterResult) => f.key && f.label && f.values && f.values.length >= 2)
      .sort((a: AIFilterResult, b: AIFilterResult) => (a.priority || 99) - (b.priority || 99))
      .slice(0, 6);
    
    const facets: Record<string, { name: string; values: string[]; fromAI: boolean }> = {};
    
    for (const filter of validFilters) {
      facets[filter.key] = {
        name: filter.label,
        values: filter.values,
        fromAI: true
      };
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      facets,
      source: 'ai'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('AI filter generation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Failed to generate AI filters',
      facets: {}
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
