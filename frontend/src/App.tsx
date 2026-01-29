import { useMemo } from 'react';
import { WalletProvider } from '@demox-labs/aleo-wallet-adapter-react';
import { WalletModalProvider } from '@demox-labs/aleo-wallet-adapter-reactui';
import { LeoWalletAdapter } from '@demox-labs/aleo-wallet-adapter-leo';
import { DecryptPermission, WalletAdapterNetwork } from '@demox-labs/aleo-wallet-adapter-base';
import '@demox-labs/aleo-wallet-adapter-reactui/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from './components/Header';
import { MarketList } from './components/MarketList';

const queryClient = new QueryClient();

function App() {
  const wallets = useMemo(
    () => [
      new LeoWalletAdapter({
        appName: 'Private Prediction Market',
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
          <div className="min-h-screen bg-gray-900">
            <Header />
            <main className="container mx-auto px-4 py-8">
              <MarketList />
            </main>
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}

export default App;
