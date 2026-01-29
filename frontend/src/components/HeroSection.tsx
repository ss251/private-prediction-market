export function HeroSection() {
  return (
    <section className="hero-gradient border-b border-navy-600">
      <div className="container mx-auto px-4 py-16 md:py-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Left — headline */}
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-mono font-medium text-privacy bg-privacy/10 border border-privacy/20 rounded-full px-3 py-1 mb-5 privacy-glow">
              <svg width="14" height="10" viewBox="0 0 21 12" fill="none">
                <path d="M0.678 0H4.678V4H0.678V0Z" fill="currentColor"/>
                <path d="M4.678 4H8.678V8H4.678V4Z" fill="currentColor"/>
                <path d="M8.678 8H12.678V12H8.678V8Z" fill="currentColor"/>
                <path d="M12.678 4H16.678V8H12.678V4Z" fill="currentColor"/>
                <path d="M16.678 0H20.678V4H16.678V0Z" fill="currentColor"/>
              </svg>
              Built on Aleo
            </span>

            <h1 className="font-heading text-4xl md:text-5xl font-bold text-white leading-tight mb-4">
              Predict Markets.
              <br />
              <span className="text-accent">Protect Positions.</span>
            </h1>

            <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md">
              A prediction market built on Aleo — the first L1 where
              zero-knowledge proofs can make your positions truly private.
            </p>

            <div className="flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-2 text-sm bg-navy-800 border border-navy-600 rounded-xl px-4 py-2 text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Private Bets
              </span>
              <span className="inline-flex items-center gap-2 text-sm bg-navy-800 border border-navy-600 rounded-xl px-4 py-2 text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Transparent Pools
              </span>
              <span className="inline-flex items-center gap-2 text-sm bg-navy-800 border border-navy-600 rounded-xl px-4 py-2 text-gray-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                ZK Proofs
              </span>
            </div>
          </div>

          {/* Right — privacy comparison card */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-heading text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
              Why Aleo?
            </h3>

            <div className="space-y-3">
              {/* Table header */}
              <div className="grid grid-cols-3 text-xs text-gray-500 font-medium pb-2 border-b border-navy-600">
                <span>Data Point</span>
                <span className="text-center">EVM Chains</span>
                <span className="text-center">Aleo</span>
              </div>

              {/* Rows */}
              {([
                ["Bet direction", true, false],
                ["Bet amount", true, false],
                ["Wallet link", true, false],
                ["Pool totals", true, true],
                ["Market outcome", true, true],
              ] as const).map(([label, otherVisible, thisVisible]) => (
                <div
                  key={label}
                  className="grid grid-cols-3 items-center text-sm py-1.5"
                >
                  <span className="text-gray-300">{label}</span>
                  <span className="text-center">
                    {otherVisible ? (
                      <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-medium">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Always Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                        Hidden
                      </span>
                    )}
                  </span>
                  <span className="text-center">
                    {thisVisible ? (
                      <span className="inline-flex items-center gap-1 text-gray-400 text-xs font-medium">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Public
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-privacy text-xs font-medium privacy-glow rounded px-1.5 py-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        Private
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-navy-600 text-center">
              <p className="text-xs text-gray-500">
                Bet positions are encrypted as Aleo records. Only aggregate pool
                totals are public.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
