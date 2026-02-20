import { useState, useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGetStarted: () => void;
}

const slides = [
  {
    step: "1",
    title: "Pick a Market",
    description:
      "Browse prediction markets and choose Yes or No. Your bet direction is encrypted in a private Bet record — it never appears on-chain.",
    privacy:
      "Your wallet address and bet direction are never linked on-chain. No one can see who bet or which side they chose.",
    icon: (
      <div className="flex gap-3 items-center justify-center">
        <div className="glass-card px-5 py-4 flex flex-col items-center gap-2 w-28">
          <span className="text-2xl font-heading text-white">?</span>
          <span className="text-emerald-400 text-sm font-bold">Yes</span>
        </div>
        <div className="glass-card px-5 py-4 flex flex-col items-center gap-2 w-28">
          <span className="text-2xl font-heading text-white">?</span>
          <span className="text-rose-400 text-sm font-bold">No</span>
        </div>
      </div>
    ),
  },
  {
    step: "2",
    title: "Bet Privately with ZK",
    description:
      "Choose from 5 fixed credit tiers. Your bet generates a ZK proof and a Pedersen commitment. Aggregate commitments update on-chain — no direction revealed. Bet amount is public but indistinguishable within tiers.",
    privacy:
      "Bet direction is encrypted in your Bet record, never passed as a finalize argument. Pedersen commitments aggregate homomorphically so pool totals stay hidden until resolution.",
    icon: (
      <div className="flex flex-col items-center gap-3">
        <div className="glass-card px-6 py-4 flex flex-col items-center gap-1 relative">
          <span className="font-heading text-3xl text-white">Tier 3</span>
          <span className="text-xs text-gray-500">credits</span>
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-privacy/20 border-2 border-privacy/40 rounded-md flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-privacy/70">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Pedersen commitment + ZK proof
        </div>
      </div>
    ),
  },
  {
    step: "3",
    title: "Resolution & Verification",
    description:
      "At resolution, pool totals and blinding sums are published. An on-chain assert verifies they match the committed bets. A 1000-block dispute window follows.",
    privacy:
      "Pool totals are only revealed at resolution (deferred aggregate revelation) — not during betting. Anyone can verify via Pedersen commitments.",
    icon: (
      <div className="flex flex-col items-center gap-3">
        <div className="glass-card px-6 py-4 flex flex-col items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <span className="text-xs text-gray-500">On-chain verification</span>
        </div>
      </div>
    ),
  },
  {
    step: "4",
    title: "Claim in ZK",
    description:
      "Claim your winnings — payout is computed entirely inside a ZK circuit from your private Bet record. No one learns your position.",
    privacy:
      "Your payout amount is computed in ZK. The claim transaction proves eligibility without revealing your bet direction or exact amount.",
    icon: (
      <div className="flex flex-col items-center gap-3">
        <div className="glass-card px-6 py-4 flex flex-col items-center gap-1 border-emerald-500/30">
          <span className="text-xs text-gray-500">You win</span>
          <span className="font-heading text-3xl text-emerald-400">🔒</span>
          <span className="text-xs text-gray-500">computed in ZK</span>
        </div>
      </div>
    ),
  },
];

export function HowItWorksModal({ isOpen, onClose, onGetStarted }: HowItWorksModalProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!isOpen) return;

    gsap.fromTo(
      ".slide-content",
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" }
    );
  }, { scope: contentRef, dependencies: [currentSlide, isOpen] });

  if (!isOpen) return null;

  const slide = slides[currentSlide];
  const isLast = currentSlide === slides.length - 1;

  const handleNext = () => {
    if (isLast) {
      onGetStarted();
    } else {
      setCurrentSlide((s) => s + 1);
    }
  };

  const handleBack = () => {
    setCurrentSlide((s) => Math.max(0, s - 1));
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        ref={contentRef}
        className="bg-navy-800 rounded-lg border-2 border-navy-600 shadow-2xl w-full max-w-md relative"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="p-8">
          {/* Visual area */}
          <div className="slide-content flex flex-col items-center">
            <div className="mb-6 py-6">
              {slide.icon}
            </div>

            {/* Step + Title */}
            <h2 className="font-heading text-2xl text-white text-center mb-3">
              {slide.step}. {slide.title}
            </h2>

            {/* Description */}
            <p className="text-gray-400 text-sm text-center leading-relaxed mb-4">
              {slide.description}
            </p>

            {/* Privacy highlight */}
            <div className="w-full rounded-md bg-privacy/5 border-2 border-privacy/15 px-4 py-3 flex items-start gap-2.5 mb-6">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4A054" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <p className="text-xs text-privacy/80 leading-relaxed">
                {slide.privacy}
              </p>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-2 h-2 rounded-sm transition-all ${
                  i === currentSlide
                    ? "bg-accent w-4"
                    : "bg-navy-500 hover:bg-navy-400"
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {currentSlide > 0 && (
              <button
                onClick={handleBack}
                className="flex-1 py-3 rounded-md bg-navy-700 border-2 border-navy-600 hover:border-navy-500 text-white text-sm font-bold transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="flex-1 btn-primary py-3 rounded-md text-sm"
            >
              {isLast ? "Connect Wallet" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
