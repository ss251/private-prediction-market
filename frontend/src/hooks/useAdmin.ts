import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { getAdminAddress } from "../lib/aleo";

/**
 * Hook that checks whether the currently connected wallet is the
 * on-chain contract admin. Returns `{ isAdmin, isLoading }`.
 *
 * The admin address is fetched once from the chain mapping and cached
 * for the session (staleTime: Infinity).
 */
export function useAdmin() {
  const { address, connected } = useWallet();

  const { data: adminAddress, isLoading } = useQuery({
    queryKey: ["adminAddress"],
    queryFn: getAdminAddress,
    staleTime: Infinity,
    retry: 1,
  });

  const isAdmin =
    connected &&
    !!address &&
    !!adminAddress &&
    address.toLowerCase() === adminAddress.toLowerCase();

  return { isAdmin, isLoading };
}
