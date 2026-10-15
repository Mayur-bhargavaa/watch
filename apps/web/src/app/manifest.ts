import type { MetadataRoute } from 'next';

// Lets the site be installed as an app. iPhones only allow Web Push for installed (Home Screen) web apps.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Watch — Watch Together, Play Together',
    short_name: 'Watch',
    description: 'Watch together, play games and video call in one private room.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#111217',
    theme_color: '#ee1d49',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
