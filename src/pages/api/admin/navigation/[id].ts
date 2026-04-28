import type { APIRoute } from 'astro';
import { storage } from '@lib/storage';
import { getAdminSessionToken, verifyAdminSession } from '@lib/admin';
import { z } from 'zod';

const updateNavItemSchema = z.object({
  label: z.string().min(1).optional(),
  href: z.string().min(1).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  isActive: z.boolean().optional(),
  openInNewTab: z.boolean().optional(),
  icon: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ message: 'ID required' }), { status: 400 });
    }
    
    const item = await storage.getNavigationItem(id);
    
    if (!item) {
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    }
    
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching navigation item:', error);
    return new Response(JSON.stringify({ message: 'Failed to fetch navigation item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
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
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ message: 'ID required' }), { status: 400 });
    }
    
    const body = await request.json();
    const parsed = updateNavItemSchema.parse(body);
    
    const item = await storage.updateNavigationItem(id, parsed);
    
    if (!item) {
      return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
    }
    
    return new Response(JSON.stringify(item), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating navigation item:', error);
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ message: 'Validation error', errors: error.errors }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ message: 'Failed to update navigation item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
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
    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ message: 'ID required' }), { status: 400 });
    }
    
    await storage.deleteNavigationItem(id);
    
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting navigation item:', error);
    return new Response(JSON.stringify({ message: 'Failed to delete navigation item' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
