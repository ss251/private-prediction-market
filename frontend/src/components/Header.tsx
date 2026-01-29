import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/aleo-wallet-adapter-reactui";

export function Header() {
  const { connected, publicKey, connecting } = useWallet();

  return (
    <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-2xl">&#128302;</span>
          <div>
            <h1 className="text-xl font-bold text-white">
              Private Prediction Market
            </h1>
            <p className="text-xs text-gray-500">Powered by Aleo ZK</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Connection status indicator */}
          {connected && publicKey && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-gray-400 font-mono text-xs">
                {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
              </span>
            </div>
          )}

          {connecting && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="animate-spin">&#8987;</span>
              <span>Connecting...</span>
            </div>
          )}

          <WalletMultiButton />
        </div>
      </div>

      {/* Network badge */}
      <div className="bg-yellow-900/30 border-t border-yellow-800/50 px-4 py-1 text-center">
        <span className="text-xs text-yellow-500">
          &#9888; Testnet Beta - Not real funds
        </span>
      </div>
    </header>
  );
}
