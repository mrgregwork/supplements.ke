import type { APIRoute } from 'astro';
import { storage } from '@lib/storage';
import { getAdminSessionToken, verifyAdminSession } from '@lib/admin';
import { z } from 'zod';
import { sanitizeHTML } from '@lib/sanitize';

const updateHomepageSchema = z.object({
  section: z.string().min(1),
  content: z.record(z.any()),
  isActive: z.boolean().optional().default(true),
});

export const GET: APIRoute = async ({ url }) => {
  try {
    const section = url.searchParams.get('section');
    
    if (section) {
      const content = await storage.getHomepageSection(section);
      if (!content) {
        return new Response(JSON.stringify({ section, content: {}, isActive: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(content), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const allContent = await storage.getHomepageContent();
    return new Response(JSON.stringify(allContent), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching homepage content:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch homepage content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  const isDev = import.meta.env.DEV;
  const sessionToken = getAdminSessionToken(request);
  const sessionData = await verifyAdminSession(sessionToken);
  
  if (!isDev && !sessionData) {
    return new Response(JSON.stringify({ message: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const body = await request.json();
    const parsed = updateHomepageSchema.parse(body);
    
    const contentToSave = { ...parsed.content };
    
    if (contentToSave.title) {
      contentToSave.title = sanitizeHTML(contentToSave.title);
    }
    if (contentToSave.description) {
      contentToSave.description = sanitizeHTML(contentToSave.description);
    }
    if (contentToSave.content) {
      contentToSave.content = sanitizeHTML(contentToSave.content);
    }
    
    const result = await storage.setHomepageSection(parsed.section, contentToSave, parsed.isActive);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error saving homepage content:', error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ message: 'Validation error', errors: error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'Failed to save homepage content' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
