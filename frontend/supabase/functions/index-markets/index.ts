// Cron: every 60 seconds
// Reads on-chain state from Aleo explorer API, upserts into markets table,
// captures pool snapshots, updates platform stats.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const API_URL = "https://api.explorer.provable.com/v1/testnet";
const PROGRAM_ID = "prediction_market_test005.aleo";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function parseAleoValue(value: string | null): number {
  if (!value || value === "null") return 0;
  const cleaned = value.replace(/u\d+$/, "").replace(/field$/, "").replace(/^"|"$/g, "");
  return Number(cleaned);
}

function parseAleoBool(value: string | null): boolean | null {
  if (!value || value === "null") return null;
  return value.replace(/^"|"$/g, "") === "true";
}

function parseAleoU8(value: string | null): number {
  if (!value || value === "null") return 255;
  return parseInt(value.replace(/^"|"$/g, "").replace(/u\d+$/, ""));
}

function parseAleoAddress(value: string | null): string | null {
  if (!value || value === "null") return null;
  return value.replace(/^"|"$/g, "");
}

async function getMappingValue(mapping: string, key: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/program/${PROGRAM_ID}/mapping/${mapping}/${key}`);
    if (!res.ok) return null;
    const text = await res.text();
    return text.replace(/^"|"$/g, "");
  } catch {
    return null;
  }
}

interface ChainMarket {
  marketId: string;
  status: number;
  yesPool: number;
  noPool: number;
  outcome: number | null;
  endBlock: number | null;
  paused: boolean;
  creator: string | null;
  oracleEnabled: boolean;
}

async function fetchChainMarket(marketId: string): Promise<ChainMarket | null> {
  try {
    const [
      statusRaw, yesPoolRaw, noPoolRaw, outcomeRaw,
      endTimeRaw, pausedRaw, creatorRaw, oracleEnabledRaw,
    ] = await Promise.all([
      getMappingValue("market_status", marketId),
      getMappingValue("yes_pool", marketId),
      getMappingValue("no_pool", marketId),
      getMappingValue("market_outcome", marketId),
      getMappingValue("market_end_time", marketId),
      getMappingValue("market_paused", marketId),
      getMappingValue("market_creator", marketId),
      getMappingValue("oracle_enabled", marketId),
    ]);

    const status = parseAleoU8(statusRaw);
    if (status === 255) return null;

    const outcomeRawBool = parseAleoBool(outcomeRaw);
    let outcome: number | null = null;
    if (outcomeRawBool === true) outcome = 1;
    else if (outcomeRawBool === false) outcome = 2;

    return {
      marketId,
      status,
      yesPool: parseAleoValue(yesPoolRaw),
      noPool: parseAleoValue(noPoolRaw),
      outcome,
      endBlock: endTimeRaw ? parseAleoValue(endTimeRaw) : null,
      paused: parseAleoBool(pausedRaw) ?? false,
      creator: parseAleoAddress(creatorRaw),
      oracleEnabled: parseAleoBool(oracleEnabledRaw) ?? false,
    };
  } catch (e) {
    console.error(`Failed to fetch chain market ${marketId}:`, e);
    return null;
  }
}

async function getAllMarketIds(): Promise<string[]> {
  const countRaw = await getMappingValue("market_count", "true");
  if (!countRaw || countRaw === "null") return [];
  const count = parseAleoValue(countRaw);
  if (count === 0) return [];

  const ids: string[] = [];
  const BATCH = 10;
  for (let start = 0; start < count; start += BATCH) {
    const end = Math.min(start + BATCH, count);
    const batch = [];
    for (let i = start; i < end; i++) {
      batch.push(getMappingValue("market_ids", `${i}u64`));
    }
    const results = await Promise.all(batch);
    for (const raw of results) {
      if (raw && raw !== "null") ids.push(raw);
    }
  }
  return ids;
}

// ── Bet transaction indexing ──────────────────────────────────────────

interface BetEvent {
  walletAddress: string;
  marketId: string;
  outcome: boolean;
  amount: number;
}

/**
 * Scan recent blocks for place_bet transactions and extract bet events.
 * Parses the finalize future output to get (market_id, outcome, amount)
 * and the nested transfer_public_as_signer to get the bettor address.
 */
async function scanBetTransactions(lastHeight: number): Promise<{ events: BetEvent[]; newHeight: number }> {
  const events: BetEvent[] = [];

  // Get current block height
  let currentHeight: number;
  try {
    const res = await fetch(`${API_URL}/latest/height`);
    if (!res.ok) return { events, newHeight: lastHeight };
    currentHeight = parseInt(await res.text());
  } catch {
    return { events, newHeight: lastHeight };
  }

  // Scan at most 30 blocks per run (avoid timeouts)
  const startHeight = Math.max(lastHeight + 1, currentHeight - 30);
  const endHeight = currentHeight;

  for (let h = startHeight; h <= endHeight; h++) {
    try {
      const res = await fetch(`${API_URL}/block/${h}/transactions`);
      if (!res.ok) continue;
      const transactions = await res.json();
      if (!Array.isArray(transactions)) continue;

      for (const tx of transactions) {
        if (tx.type !== "execute") continue;
        const transitions = tx.execution?.transitions ?? [];

        for (const transition of transitions) {
          if (
            transition.program !== PROGRAM_ID ||
            (transition.function !== "place_bet" && transition.function !== "add_to_bet")
          ) continue;

          // Extract data from the future output
          const futureOutput = transition.outputs?.find((o: { type: string }) => o.type === "future");
          if (!futureOutput?.value) continue;

          const futureValue = futureOutput.value as string;

          // Parse finalize arguments from future value
          // Format: { program_id: ..., function_name: place_bet, arguments: [market_id, outcome, amount, {nested_future}] }
          const marketMatch = futureValue.match(/arguments:\s*\[\s*(\d+field)/);
          const outcomeMatch = futureValue.match(/arguments:\s*\[\s*\d+field,\s*(true|false)/);
          const amountMatch = futureValue.match(/arguments:\s*\[\s*\d+field,\s*(?:true|false),\s*(\d+)u64/);

          if (!marketMatch || !outcomeMatch || !amountMatch) continue;

          // Extract bettor address from nested transfer_public_as_signer future
          // The second argument in the nested future is the signer address
          const signerMatch = futureValue.match(
            /transfer_public_as_signer,\s*arguments:\s*\[\s*aleo\w+,\s*(aleo\w+)/
          );
          if (!signerMatch) continue;

          events.push({
            walletAddress: signerMatch[1],
            marketId: marketMatch[1],
            outcome: outcomeMatch[1] === "true",
            amount: parseInt(amountMatch[1]),
          });
        }
      }
    } catch {
      // Skip block on error
      continue;
    }
  }

  return { events, newHeight: endHeight };
}

/**
 * Upsert bet events into the user_positions table.
 * Adds amounts to existing positions rather than overwriting.
 */
async function indexBetEvents(events: BetEvent[]): Promise<number> {
  let indexed = 0;
  for (const event of events) {
    // Get existing position
    const { data: existing } = await supabase
      .from("user_positions")
      .select("yes_amount, no_amount")
      .eq("wallet_address", event.walletAddress)
      .eq("market_id", event.marketId)
      .single();

    const currentYes = Number(existing?.yes_amount ?? 0);
    const currentNo = Number(existing?.no_amount ?? 0);

    const { error } = await supabase.from("user_positions").upsert(
      {
        wallet_address: event.walletAddress,
        market_id: event.marketId,
        yes_amount: event.outcome ? currentYes + event.amount : currentYes,
        no_amount: event.outcome ? currentNo : currentNo + event.amount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "wallet_address,market_id" },
    );

    if (!error) indexed++;
  }
  return indexed;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (_req: Request) => {
  // Handle CORS preflight
  if (_req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get indexer cursor
    const { data: _cursor } = await supabase
      .from("indexer_state")
      .select("*")
      .eq("id", true)
      .single();

    // 2. Discover markets from chain
    const marketIds = await getAllMarketIds();

    // 3. Fetch chain state for each market
    let indexed = 0;
    let snapshotsInserted = 0;

    for (const marketId of marketIds) {
      const chain = await fetchChainMarket(marketId);
      if (!chain) continue;

      // Update chain-only columns (never overwrites metadata like title/description)
      const chainData = {
        status: chain.status,
        yes_pool: chain.yesPool,
        no_pool: chain.noPool,
        outcome: chain.outcome,
        end_block: chain.endBlock,
        paused: chain.paused,
        creator: chain.creator,
        oracle_enabled: chain.oracleEnabled,
        chain_updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateErr } = await supabase
        .from("markets")
        .update(chainData)
        .eq("market_id", chain.marketId)
        .select("market_id");

      if (updateErr) {
        console.error(`Update error for ${marketId}:`, updateErr);
        continue;
      }

      // If row didn't exist, insert with fallback metadata
      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase.from("markets").insert({
          market_id: chain.marketId,
          title: `Market #${chain.marketId}`,
          end_date: "TBD",
          ...chainData,
        });
        if (insertErr) {
          console.error(`Insert error for ${marketId}:`, insertErr);
          continue;
        }
      }
      indexed++;

      // Capture pool snapshot (skip if unchanged from last)
      const { data: lastSnap } = await supabase
        .from("pool_snapshots")
        .select("yes_pool, no_pool")
        .eq("market_id", marketId)
        .order("captured_at", { ascending: false })
        .limit(1)
        .single();

      const poolChanged =
        !lastSnap ||
        lastSnap.yes_pool !== chain.yesPool ||
        lastSnap.no_pool !== chain.noPool;

      if (poolChanged && (chain.yesPool > 0 || chain.noPool > 0)) {
        const totalVol = chain.yesPool + chain.noPool;
        const prob = totalVol > 0 ? (chain.yesPool / totalVol).toFixed(4) : "0.5000";

        await supabase.from("pool_snapshots").insert({
          market_id: marketId,
          yes_pool: chain.yesPool,
          no_pool: chain.noPool,
          total_volume: totalVol,
          yes_probability: prob,
        });
        snapshotsInserted++;
      }
    }

    // 4. Update platform stats
    const { data: allMarkets } = await supabase
      .from("markets")
      .select("status, yes_pool, no_pool");

    const openMarkets = (allMarkets ?? []).filter((m: { status: number }) => m.status === 0).length;
    const totalVol = (allMarkets ?? []).reduce(
      (sum: number, m: { yes_pool: number; no_pool: number }) => sum + (m.yes_pool ?? 0) + (m.no_pool ?? 0),
      0,
    );

    await supabase.from("platform_stats").upsert({
      id: true,
      total_markets: marketIds.length,
      open_markets: openMarkets,
      total_volume: totalVol,
      last_indexed_at: new Date().toISOString(),
    });

    // 5. Scan recent blocks for bet transactions → update user_positions
    const lastBlockHeight = Number(_cursor?.last_block_height ?? 0);
    const { events: betEvents, newHeight } = await scanBetTransactions(lastBlockHeight);
    const positionsIndexed = betEvents.length > 0 ? await indexBetEvents(betEvents) : 0;

    // 6. Update indexer state
    await supabase.from("indexer_state").upsert({
      id: true,
      last_market_count: marketIds.length,
      last_block_height: newHeight,
      last_run_at: new Date().toISOString(),
      last_error: null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        indexed,
        snapshots: snapshotsInserted,
        positions: positionsIndexed,
        markets: marketIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Indexer error:", message);

    // Record error in indexer state
    await supabase.from("indexer_state").upsert({
      id: true,
      last_run_at: new Date().toISOString(),
      last_error: message,
    });

    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
