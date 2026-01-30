// HTTP POST endpoint: upserts market metadata after on-chain creation.
// Called by the frontend after a successful create_market transaction.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface MetadataBody {
  market_id: string;
  title: string;
  description?: string;
  category_id?: string;
  end_date: string;
  resolution_source?: string;
  tags?: string[];
  image_url?: string;
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const body = (await req.json()) as MetadataBody;

    if (!body.market_id || !body.title || !body.end_date) {
      return new Response(
        JSON.stringify({ error: "market_id, title, and end_date are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { error } = await supabase.from("markets").upsert(
      {
        market_id: body.market_id,
        title: body.title,
        description: body.description ?? "",
        category_id: body.category_id ?? "other",
        end_date: body.end_date,
        resolution_source: body.resolution_source ?? "",
        tags: body.tags ?? [],
        image_url: body.image_url ?? null,
        metadata_updated_at: new Date().toISOString(),
      },
      { onConflict: "market_id" },
    );

    if (error) {
      console.error("Upsert error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, market_id: body.market_id }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
