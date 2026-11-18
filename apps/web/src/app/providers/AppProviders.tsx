import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  useEffect(() => {
    const expired = () => {
      void queryClient.cancelQueries();
      queryClient.removeQueries({ predicate: q => q.queryKey[0] !== 'auth' });
      queryClient.setQueryData(['auth', 'session'], null);
    };
    window.addEventListener('dexatrack:unauthorized', expired);
    return () => window.removeEventListener('dexatrack:unauthorized', expired);
  }, [queryClient]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
