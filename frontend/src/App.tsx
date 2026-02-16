import { useMemo, useState, useCallback, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AleoWalletProvider } from '@provablehq/aleo-wallet-adaptor-react';
import { WalletModalProvider, useWalletModal } from '@provablehq/aleo-wallet-adaptor-react-ui';
import { ShieldWalletAdapter } from '@provablehq/aleo-wallet-adaptor-shield';
import { DecryptPermission } from '@provablehq/aleo-wallet-adaptor-core';
import { Network } from '@provablehq/aleo-types';
import '@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css';
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
    () => [new ShieldWalletAdapter()],
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AleoWalletProvider
        wallets={wallets}
        decryptPermission={DecryptPermission.UponRequest}
        network={Network.TESTNET}
        autoConnect
      >
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </AleoWalletProvider>
    </QueryClientProvider>
  );
}

export default App;
