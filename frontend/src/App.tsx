import { useMemo, useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider, useWalletModal } from '@demox-labs/aleo-wallet-adapter-reactui';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import { DecryptPermission, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';
import '@demox-labs/aleo-wallet-adapter-reactui/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MarketList } from './components/MarketList';
import { MarketDetailPage } from './pages/MarketDetailPage';
import { Footer } from './components/Footer';
import { HowItWorksModal } from './components/HowItWorksModal';
import { startIndexerPolling } from './lib/supabase';

const queryClient = new QueryClient();

function AppContent() {
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const { setVisible } = useWalletModal();

  const handleGetStarted = useCallback(() => {
    setShowHowItWorks(false);
    setVisible(true);
  }, [setVisible]);

  return (
    <div className="min-h-screen bg-navy-950 font-body text-white">
      <Header onHowItWorks={() => setShowHowItWorks(true)} />
      <Routes>
        <Route path="/" element={
          <>
            <HeroSection />
            <main className="container mx-auto px-4 py-8">
              <MarketList />
            </main>
          </>
        } />
        <Route path="/market/:marketId" element={<MarketDetailPage />} />
      </Routes>
      <Footer />
      <HowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
        onGetStarted={handleGetStarted}
      />
    </div>
  );
}

function App() {
  // Start background indexer polling on mount
  useEffect(() => { startIndexerPolling(); }, []);

  const wallets = useMemo(
    () => [
      new LeoWalletAdapter({
        appName: 'Lasagna',
      }),
    ],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider
        wallets={wallets}
        decryptPermission={DecryptPermission.UponRequest}
        network={WalletAdapterNetwork.TestnetBeta}
        autoConnect
      >
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
