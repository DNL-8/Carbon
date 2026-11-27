'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { SystemHudSkeleton } from '../src/components/SystemHudSkeleton';

const AppEntry = dynamic(() => import('../src/AppEntry'), {
  ssr: false,
  loading: () => <SystemHudSkeleton />,
});

export default function FitnessApp() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const warmCache = () => {
      const assets = performance.getEntriesByType('resource').map((resource) => resource.name);
      navigator.serviceWorker.controller?.postMessage({ assets });
    };
    navigator.serviceWorker.addEventListener('controllerchange', warmCache);
    void navigator.serviceWorker.register('/sw.js').then(warmCache).catch(() => {});
    return () => navigator.serviceWorker.removeEventListener('controllerchange', warmCache);
  }, []);

  return <AppEntry />;
}
