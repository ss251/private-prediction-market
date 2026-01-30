// Cron: daily
// Prunes old granular snapshots, keeping hourly samples for data >7 days old.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// deno-lint-ignore no-unused-vars
Deno.serve(async (_req: Request) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

    // Delete granular snapshots older than 7 days, keeping one per hour per market.
    // Strategy: for each market, find snapshots older than 7d, group by hour,
    // delete all but the first per hour-bucket.
    const { error } = await supabase.rpc("cleanup_old_snapshots", {
      cutoff: sevenDaysAgo,
    });

    // If the RPC doesn't exist yet, fall back to a simpler approach:
    // just delete very old snapshots (>30 days)
    if (error) {
      console.warn("RPC not available, falling back to simple cleanup:", error.message);
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600_000).toISOString();
      const { error: deleteErr, count } = await supabase
        .from("pool_snapshots")
        .delete({ count: "exact" })
        .lt("captured_at", thirtyDaysAgo);

      if (deleteErr) {
        throw deleteErr;
      }

      return new Response(
        JSON.stringify({ ok: true, deleted: count, method: "simple_30d" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, method: "hourly_dedup" }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Cleanup error:", message);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
