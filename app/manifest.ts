import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'Forcapedia',
    short_name:       'Forcapedia',
    description:      'A living, verified knowledge platform. Historical depth meets live intelligence.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#191919',
    theme_color:      '#C9A96E',
    orientation:      'portrait-primary',
    icons: [
      { src: '/favicon.ico', sizes: '48x48',   type: 'image/x-icon' },
    ],
  }
}
