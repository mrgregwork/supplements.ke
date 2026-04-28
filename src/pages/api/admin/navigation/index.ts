import type { APIRoute } from 'astro';
import { storage } from '@lib/storage';
import { getAdminSessionToken, verifyAdminSession } from '@lib/admin';
import { z } from 'zod';

const createNavItemSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional().default(0),
  isActive: z.boolean().optional().default(true),
  openInNewTab: z.boolean().optional().default(false),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const GET: APIRoute = async () => {
  try {
    const items = await storage.getNavigationItems();
    return new Response(JSON.stringify(items), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching navigation items:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch navigation items' }), {
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
    const parsed = createNavItemSchema.parse(body);
    
    const item = await storage.createNavigationItem({
      label: parsed.label,
      href: parsed.href,
      parentId: parsed.parentId || null,
      sortOrder: parsed.sortOrder,
      isActive: parsed.isActive,
      openInNewTab: parsed.openInNewTab,
      icon: parsed.icon || null,
      description: parsed.description || null,
    });
    
    return new Response(JSON.stringify(item), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating navigation item:', error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ message: 'Validation error', errors: error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'Failed to create navigation item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
