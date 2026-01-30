export function Footer() {
  return (
    <footer className="border-t-2 border-navy-600 mt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Lasagna" className="h-6 opacity-70" />
            <span className="text-sm text-gray-500 font-medium">Lasagna</span>
            <span className="text-navy-600">·</span>
            <span className="text-xs text-gray-600">Predict Privately</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4 text-xs">
            <a
              href="https://aleo.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-gray-500 hover:text-accent transition-colors"
            >
              Built on
              <img src="/aleo-wordmark.svg" alt="Aleo" className="h-2.5 opacity-60" />
            </a>
            <span className="text-navy-600">·</span>
            <a
              href="https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-accent transition-colors"
            >
              Aleo Buildathon
            </a>
            <span className="text-navy-600">·</span>
            <a
              href="https://github.com/ss251/private-prediction-market"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-accent transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>

      </div>
    </footer>
  );
}
