import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcpedia.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  const { data: articles } = await supabase
    .from('articles')
    .select('slug, verified_at, created_at')
    .order('verified_at', { ascending: false })

  const articleUrls: MetadataRoute.Sitemap = (articles ?? []).map(a => ({
    url: `${SITE_URL}/article/${a.slug}`,
    lastModified: new Date(a.verified_at ?? a.created_at ?? Date.now()),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    ...articleUrls,
  ]
}
