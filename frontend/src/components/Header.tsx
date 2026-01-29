import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/aleo-wallet-adapter-reactui";

export function Header() {
  const { connected, publicKey, connecting } = useWallet();

  return (
    <header className="border-b border-navy-600 bg-navy-900/60 backdrop-blur-lg sticky top-0 z-40">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2.5">
          {/* SVG shield-lock logo */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="url(#logo-gradient)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <defs>
              <linearGradient id="logo-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <rect x="9" y="10" width="6" height="5" rx="1" />
            <path d="M10 10V8a2 2 0 1 1 4 0v2" />
          </svg>
          <div>
            <h1 className="font-heading text-lg font-semibold text-white">
              Private Prediction Market
            </h1>
            <p className="text-xs text-privacy font-medium flex items-center gap-1.5">
              Powered by
              <img src="/aleo-wordmark.svg" alt="Aleo" className="h-3 inline-block opacity-80" />
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {connected && publicKey && (
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-gray-400 font-mono text-xs">
                {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
              </span>
            </div>
          )}

          {connecting && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="css-spinner-sm" />
              <span>Connecting...</span>
            </div>
          )}

          <WalletMultiButton />
        </div>
      </div>

      {/* Network badge */}
      <div className="bg-amber-900/20 border-t border-amber-800/30 px-4 py-1 text-center">
        <span className="text-xs text-amber-500/80">
          Testnet Beta — Not real funds
        </span>
      </div>
    </header>
  );
}
