import type { APIRoute } from "astro";
import { storage } from "@lib/storage";

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { licenseKey } = body;
    
    if (!licenseKey || typeof licenseKey !== 'string') {
      return new Response(JSON.stringify({ 
        valid: false, 
        message: 'License key is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get the license server URL from environment or use default
    const licenseServerUrl = process.env.LICENSE_SERVER_URL;
    
    if (!licenseServerUrl) {
      // For development/demo: accept any non-empty key as valid
      const isValid = licenseKey.length >= 10;
      
      await storage.setSiteSetting('licenseStatus', isValid ? 'active' : 'inactive');
      
      return new Response(JSON.stringify({ 
        valid: isValid,
        message: isValid ? 'License verified (demo mode)' : 'Invalid license key format'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Production: validate against license server
    try {
      const response = await fetch(`${licenseServerUrl}/api/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey }),
      });
      
      const result = await response.json();
      const isValid = result.valid === true;
      
      await storage.setSiteSetting('licenseStatus', isValid ? 'active' : 'inactive');
      
      return new Response(JSON.stringify({ 
        valid: isValid,
        message: result.message || (isValid ? 'License verified' : 'License verification failed')
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (fetchError) {
      return new Response(JSON.stringify({ 
        valid: false, 
        message: 'Could not connect to license server' 
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('License verification error:', error);
    return new Response(JSON.stringify({ 
      valid: false, 
      message: 'License verification failed' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
