/**
 * Privacy disclosure section for MarketDetailPage.
 * Clearly explains what data is public vs private in the prediction market,
 * linking to an on-chain transaction as proof of the privacy model.
 */

const EXPLORER_BASE = "https://explorer.provable.com/transaction";
const REFERENCE_TX = "at14wc3a77q7dlpqjcqtxthavqa68a2tmppezv9ee5z4567hcj4ju9sqkerff";

interface PrivacyItem {
  label: string;
  description: string;
}

const PUBLIC_DATA: PrivacyItem[] = [
  { label: "Market ID", description: "Unique identifier for the market" },
  { label: "Bet Amount", description: "The size of each bet (visible in pool updates)" },
  { label: "Pool Totals", description: "Aggregate YES/NO pool sizes" },
  { label: "Outcome", description: "The resolved result of the market" },
  { label: "Bet Direction", description: "Whether a bet was YES or NO (via pool delta)" },
];

const PRIVATE_DATA: PrivacyItem[] = [
  { label: "Bettor Identity", description: "Your wallet address is never linked to a bet on-chain" },
  { label: "Bet Record", description: "Encrypted in your wallet — only you can decrypt and prove ownership" },
  { label: "Position Size per User", description: "No one can see how much a specific address wagered" },
];

/**
 * Renders a detailed privacy disclosure explaining the public/private
 * data model used by the Aleo prediction market contract.
 */
export function PrivacyDisclosure() {
  return (
    <div className="space-y-4">
      {/* Public data */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Public (visible on-chain)
        </h4>
        <ul className="space-y-1.5">
          {PUBLIC_DATA.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              <span className="text-amber-400/60 mt-0.5">●</span>
              <span>
                <span className="text-gray-300 font-medium">{item.label}</span>
                <span className="text-gray-500"> — {item.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Private data */}
      <div>
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Private (zero-knowledge proven)
        </h4>
        <ul className="space-y-1.5">
          {PRIVATE_DATA.map((item) => (
            <li key={item.label} className="flex items-start gap-2 text-sm">
              <span className="text-emerald-400/60 mt-0.5">●</span>
              <span>
                <span className="text-gray-300 font-medium">{item.label}</span>
                <span className="text-gray-500"> — {item.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* How it works */}
      <div className="bg-navy-900/60 rounded-xl p-3 border border-navy-600">
        <p className="text-xs text-gray-400 leading-relaxed">
          <strong className="text-gray-300">How it works:</strong> When you place a bet, Aleo generates a
          zero-knowledge proof that validates your transaction without revealing your identity. Your bet
          receipt is an encrypted <em>record</em> stored in your wallet — only you can decrypt it to
          claim winnings or refunds. Pool totals update publicly, but no observer can link a specific
          bet to your address.
        </p>
      </div>

      {/* Proof link */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500">Verify on explorer:</span>
        <a
          href={`${EXPLORER_BASE}/${REFERENCE_TX}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:text-accent-light transition-colors font-mono truncate"
        >
          {REFERENCE_TX.slice(0, 20)}…{REFERENCE_TX.slice(-8)}
        </a>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </div>
    </div>
  );
}
