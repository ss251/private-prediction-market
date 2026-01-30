import { useQuery } from "@tanstack/react-query";
import { fetchPlatformStats } from "../lib/supabase";
import type { PlatformStats } from "../db/types";

export function usePlatformStats() {
  return useQuery<PlatformStats | null>({
    queryKey: ["platformStats"],
    queryFn: fetchPlatformStats,
    refetchInterval: 120_000,
  });
}
