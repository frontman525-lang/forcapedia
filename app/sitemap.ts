import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

const STATIC_PAGES: MetadataRoute.Sitemap = [
  { url: SITE_URL,                  lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
  { url: `${SITE_URL}/search`,      lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
  { url: `${SITE_URL}/pricing`,     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  { url: `${SITE_URL}/contact`,     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  { url: `${SITE_URL}/terms`,       lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${SITE_URL}/privacy`,     lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  { url: `${SITE_URL}/refund`,      lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select('slug, verified_at, created_at')
    .order('verified_at', { ascending: false })

  const articleUrls: MetadataRoute.Sitemap = (articles ?? []).map(a => ({
    url:             `${SITE_URL}/article/${a.slug}`,
    lastModified:    new Date(a.verified_at ?? a.created_at ?? Date.now()),
    changeFrequency: 'weekly',
    priority:        0.8,
  }))

  return [...STATIC_PAGES, ...articleUrls]
}
