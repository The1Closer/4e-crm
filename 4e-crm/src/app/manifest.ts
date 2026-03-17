import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '4 Elements CRM',
    short_name: '4E CRM',
    description: 'Internal roofing CRM',
    start_url: '/',
    display: 'standalone',
    background_color: '#050505',
    theme_color: '#050505',
    icons: [
      {
        src: '/4ELogo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
