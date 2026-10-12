import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ReportAndFix — Issue Tracker',
    short_name: 'ReportAndFix',
    description: 'Scan. Report. Fix. Next-generation campus & workplace issue tracking platform.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b',
    theme_color: '#2563eb',
    categories: ['productivity', 'utilities', 'business'],
    icons: [
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
    shortcuts: [
      {
        name: 'Report Issue',
        short_name: 'Report',
        description: 'Quickly report a new issue',
        url: '/report',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'My Dashboard',
        short_name: 'Dashboard',
        description: 'Go to your dashboard',
        url: '/',
        icons: [{ src: '/icons/icon-192x192.png', sizes: '192x192' }],
      },
    ],
    prefer_related_applications: false,
  };
}
