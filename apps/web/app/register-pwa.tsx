/**
 * RegisterPWA — registers the service worker via Serwist.
 *
 * Must be a client component rendered inside the root layout.
 * Uses SerwistProvider from @serwist/next/react for Next.js App Router.
 */

'use client';

import { SerwistProvider } from '@serwist/next/react';

export default function RegisterPWA() {
  return <SerwistProvider swUrl="/sw.js" register={true} reloadOnOnline={true} />;
}
