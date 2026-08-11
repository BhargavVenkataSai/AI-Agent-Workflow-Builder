'use client';

import { useMemo } from 'react';
import { NhostProvider } from '@nhost/nextjs';
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '@nhost/apollo';
import { nhost } from '@/lib/nhost';

export default function Providers({ children }: { children: React.ReactNode }) {
  const apolloClient = useMemo(() => {
    return createApolloClient({ nhost });
  }, []);

  return (
    <NhostProvider nhost={nhost}>
      <ApolloProvider client={apolloClient}>
        {children}
      </ApolloProvider>
    </NhostProvider>
  );
}
