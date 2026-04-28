import type { APIRoute } from "astro";
import { storage } from "@lib/storage";
import { insertAttributeDefinitionSchema } from "@shared/schema";

export const GET: APIRoute = async () => {
  try {
    const attributes = await storage.getAttributeDefinitions();
    return new Response(JSON.stringify(attributes), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("Get attributes error:", error);
    return new Response(JSON.stringify({ error: "Failed to get attributes" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const data = insertAttributeDefinitionSchema.parse(body);
    const attribute = await storage.createAttributeDefinition(data);
    return new Response(JSON.stringify(attribute), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Create attribute error:", error);
    if (error.name === "ZodError") {
      return new Response(JSON.stringify({ error: "Invalid data", details: error.errors }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    return new Response(JSON.stringify({ error: "Failed to create attribute" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
