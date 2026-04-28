import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertAttributeDefinitionSchema } from "@shared/schema";

export const GET: APIRoute = async ({ params }) => {
  try {
    const attribute = await storage.getAttributeDefinition(params.id!);
    if (!attribute) {
      return new Response(JSON.stringify({ error: "Attribute not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify(attribute), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get attribute error:", error);
    return new Response(JSON.stringify({ error: "Failed to get attribute" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const PUT: APIRoute = async ({ request, params }) => {
  try {
    const body = await request.json();
    const data = insertAttributeDefinitionSchema.partial().parse(body);
    const attribute = await storage.updateAttributeDefinition(params.id!, data);
    if (!attribute) {
      return new Response(JSON.stringify({ error: "Attribute not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify(attribute), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Update attribute error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Failed to update attribute" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    await storage.deleteAttributeDefinition(params.id!);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Delete attribute error:", error);
    return new Response(JSON.stringify({ error: "Failed to delete attribute" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
