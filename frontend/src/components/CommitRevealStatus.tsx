/**
 * Badge/indicator showing the current commit-reveal phase of a market.
 * Displays on market cards and the detail page when commit-reveal is enabled.
 */

interface CommitRevealStatusProps {
  /** Whether commit-reveal is enabled for this market. */
  commitRevealEnabled: boolean;
  /** Current market status string. */
  marketStatus: "open" | "closed" | "resolved" | "cancelled";
  /** Block height deadline for reveals (undefined if not set). */
  revealDeadline?: number;
  /** Current block height (for determining phase). */
  currentBlock?: number;
  /** Market end time (commit deadline). */
  endBlock?: number;
}

/**
 * Renders a small phase indicator for commit-reveal markets.
 * Shows COMMIT, REVEAL, or ENDED based on current block height.
 */
export function CommitRevealStatus({
  commitRevealEnabled,
  marketStatus,
  revealDeadline,
  currentBlock,
  endBlock,
}: CommitRevealStatusProps) {
  if (!commitRevealEnabled) return null;

  let label: string;
  let colorClass: string;

  if (marketStatus === "open" && endBlock && currentBlock && currentBlock < endBlock) {
    label = "🔒 COMMIT PHASE";
    colorClass = "bg-violet-500/10 text-violet-400 border-violet-500/20";
  } else if (
    marketStatus === "closed" &&
    revealDeadline &&
    currentBlock &&
    currentBlock < revealDeadline
  ) {
    label = "🔓 REVEAL PHASE";
    colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  } else {
    label = "⏱ REVEAL ENDED";
    colorClass = "bg-gray-500/10 text-gray-400 border-gray-500/20";
  }

  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border ${colorClass}`}
    >
      {label}
    </span>
  );
}
