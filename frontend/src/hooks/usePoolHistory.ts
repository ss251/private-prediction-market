import { useQuery } from "@tanstack/react-query";
import { fetchPoolHistory } from "../lib/supabase";
import type { PoolSnapshot } from "../db/types";

export function usePoolHistory(marketId: string, hours = 168) {
  return useQuery<PoolSnapshot[]>({
    queryKey: ["poolHistory", marketId, hours],
    queryFn: () => fetchPoolHistory(marketId, hours),
    enabled: !!marketId,
    refetchInterval: 300_000, // 5 minutes
  });
}
