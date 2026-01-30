import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(".hero-badge", { opacity: 0, y: 20, duration: 0.5 })
        .from(".hero-title-line", { opacity: 0, y: 40, duration: 0.6, stagger: 0.15 }, "-=0.2")
        .from(".hero-subtitle", { opacity: 0, y: 20, duration: 0.5 }, "-=0.2")
        .from(".hero-pill", { opacity: 0, y: 15, duration: 0.4, stagger: 0.1 }, "-=0.2")
        .from(".hero-card", { opacity: 0, y: 30, duration: 0.7 }, "-=0.6")
        .from(".hero-card-row", { opacity: 0, y: 10, duration: 0.3, stagger: 0.06 }, "-=0.3");
    },
    { scope: containerRef }
  );

  return (
    <section className="hero-gradient border-b-2 border-navy-600" ref={containerRef}>
      <div className="container mx-auto px-4 py-12 sm:py-20 md:py-28">
        <div className="hero-grid grid gap-8 md:gap-12 items-center">
          {/* Left — headline */}
          <div className="min-w-0">
            <span className="hero-badge inline-flex items-center gap-2 text-xs font-mono font-medium text-privacy bg-privacy/10 border-2 border-privacy/20 rounded-md px-3 py-1.5 mb-4 sm:mb-6 privacy-glow">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Built on Aleo
            </span>

            <h1 className="font-heading text-3xl sm:text-5xl lg:text-7xl text-white leading-[1.05] mb-4 sm:mb-6">
              <span className="hero-title-line block">Move in Silence.</span>
              <span className="hero-title-line block text-accent">Predict Privately.</span>
            </h1>

            <p className="hero-subtitle text-gray-400 text-base sm:text-lg leading-relaxed mb-6 sm:mb-10 max-w-md">
              A prediction market on Aleo where zero-knowledge proofs keep your
              positions hidden while pools stay transparent.
            </p>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <span className="hero-pill inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-navy-800 border-2 border-navy-600 rounded-md px-3 sm:px-4 py-2 sm:py-2.5 text-gray-300 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Private Bets
              </span>
              <span className="hero-pill inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-navy-800 border-2 border-navy-600 rounded-md px-3 sm:px-4 py-2 sm:py-2.5 text-gray-300 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                Transparent Pools
              </span>
              <span className="hero-pill inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm bg-navy-800 border-2 border-navy-600 rounded-md px-3 sm:px-4 py-2 sm:py-2.5 text-gray-300 font-medium">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                ZK Proofs
              </span>
            </div>
          </div>

          {/* Right — privacy comparison card */}
          <div className="hero-card glass-card p-4">
            <h3 className="font-heading text-base sm:text-lg text-accent uppercase tracking-wider mb-4 sm:mb-5">
              Why Aleo?
            </h3>

            <div className="space-y-0">
              {/* Table header */}
              <div className="hero-card-row grid grid-cols-3 text-[10px] sm:text-[11px] text-gray-500 font-bold pb-3 border-b-2 border-navy-600 uppercase tracking-widest">
                <span>Data Point</span>
                <span className="text-center">EVM</span>
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
                  className="hero-card-row grid grid-cols-3 items-center text-xs sm:text-sm py-2.5 sm:py-3 border-b border-navy-700/50"
                >
                  <span className="text-gray-300 font-medium">{label}</span>
                  <span className="text-center">
                    {otherVisible ? (
                      <span className="inline-flex items-center justify-center gap-1 text-rose-400 text-[10px] sm:text-xs font-bold">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 sm:w-3 sm:h-3">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="hidden sm:inline">Public</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1 text-emerald-400 text-[10px] sm:text-xs font-bold">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 sm:w-3 sm:h-3">
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                        <span className="hidden sm:inline">Hidden</span>
                      </span>
                    )}
                  </span>
                  <span className="text-center">
                    {thisVisible ? (
                      <span className="inline-flex items-center justify-center gap-1 text-gray-500 text-[10px] sm:text-xs font-medium">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 sm:w-3 sm:h-3">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        <span className="hidden sm:inline">Public</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center justify-center gap-1 text-privacy text-[10px] sm:text-xs font-bold privacy-glow rounded-md px-1 sm:px-1.5 py-0.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 sm:w-3 sm:h-3">
                          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                        </svg>
                        <span className="hidden sm:inline">Private</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t-2 border-navy-600 text-center">
              <p className="text-[11px] sm:text-xs text-gray-500">
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
