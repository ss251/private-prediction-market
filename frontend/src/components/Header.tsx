import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/aleo-wallet-adapter-reactui";

interface HeaderProps {
  onHowItWorks?: () => void;
}

export function Header({ onHowItWorks }: HeaderProps) {
  const { connected, publicKey, connecting } = useWallet();

  return (
    <header className="border-b-2 border-navy-600 bg-navy-900/80 backdrop-blur-lg sticky top-0 z-40">
      <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex justify-between items-center gap-2">
        <a href="/" className="flex items-center gap-2 sm:gap-3 shrink-0">
          <img
            src="/logo.png"
            alt="Lasagna"
            className="w-8 h-8 sm:w-10 sm:h-10"
          />
          <div>
            <h1 className="font-heading text-lg sm:text-2xl text-accent tracking-wide">
              Lasagna
            </h1>
            <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium tracking-widest uppercase hidden xs:block">
              Move in Silence
            </p>
          </div>
        </a>

        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {connected && publicKey && (
            <div className="hidden md:flex items-center gap-2 text-sm">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-gray-400 font-mono text-xs">
                {publicKey.slice(0, 6)}...{publicKey.slice(-4)}
              </span>
            </div>
          )}

          {connecting && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
              <span className="css-spinner-sm" />
              <span>Connecting...</span>
            </div>
          )}

          {onHowItWorks && (
            <button
              onClick={onHowItWorks}
              className="w-8 h-8 shrink-0 rounded-md border-2 border-navy-600 hover:border-accent/40 bg-navy-800 flex items-center justify-center text-gray-400 hover:text-accent transition-colors"
              title="How it works"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
          )}

          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
