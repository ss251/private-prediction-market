const waves = [
  {
    title: "Wave 1",
    label: "Now",
    color: "emerald" as const,
    items: ["Binary markets", "ZK private bets", "Manual resolve"],
  },
  {
    title: "Wave 2",
    label: "Next",
    color: "amber" as const,
    items: ["Oracle feeds", "Commit-reveal", "Auto-resolve"],
  },
  {
    title: "Wave 3",
    label: "Future",
    color: "slate" as const,
    items: ["Multi-outcome", "Order book", "Cross-chain"],
  },
] as const;

const dotColor = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  slate: "bg-slate-500",
} as const;

const borderColor = {
  emerald: "border-emerald-500/30",
  amber: "border-amber-500/30",
  slate: "border-slate-500/30",
} as const;

const labelColor = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  slate: "text-slate-400",
} as const;

export function Footer() {
  return (
    <footer className="border-t border-navy-600 mt-16">
      <div className="container mx-auto px-4 py-12">
        {/* Roadmap */}
        <h3 className="font-heading text-sm font-semibold text-gray-400 uppercase tracking-wider text-center mb-8">
          Roadmap
        </h3>

        <div className="grid sm:grid-cols-3 gap-6 mb-10">
          {waves.map((wave) => (
            <div
              key={wave.title}
              className={`glass-card rounded-xl p-5 border ${borderColor[wave.color]}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${dotColor[wave.color]}`} />
                <span className="font-heading font-semibold text-white text-sm">
                  {wave.title}
                </span>
                <span className={`text-xs font-medium ${labelColor[wave.color]} ml-auto`}>
                  {wave.label}
                </span>
              </div>
              <ul className="space-y-1.5">
                {wave.items.map((item) => (
                  <li
                    key={item}
                    className="text-sm text-gray-400 flex items-center gap-2"
                  >
                    <span className="w-1 h-1 rounded-full bg-navy-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="text-center text-xs text-gray-600 pt-4 border-t border-navy-700 space-x-3 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5">Built with <img src="/aleo-wordmark.svg" alt="Aleo" className="h-2.5 inline-block opacity-60" /></span>
          <span className="text-navy-600">|</span>
          <span>WaveHack 2026</span>
          <span className="text-navy-600">|</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
