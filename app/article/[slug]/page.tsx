import { notFound } from 'next/navigation'
import { cache } from 'react'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import ArticleView from '@/components/ArticleView'
import ArticleGenerator from '@/components/ArticleGenerator'
import { createClient } from '@/lib/supabase/server'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://forcapedia.com'

interface Props {
  params: Promise<{ slug: string }>
}

const getArticle = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const article = await getArticle(slug)

  if (!article) {
    // Article is being generated client-side — derive readable title from slug
    const displayTitle = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    return {
      title:  `${displayTitle} — Forcapedia`,
      robots: { index: false, follow: false }, // don't index pending/generating articles
    }
  }

  const url      = `${SITE_URL}/article/${slug}`
  const title    = `${article.title} — Forcapedia`
  const ogImage  = `/article/${slug}/opengraph-image`

  return {
    title,
    description: article.summary,
    alternates:  { canonical: url },
    openGraph: {
      title,
      description:   article.summary,
      url,
      siteName:      'Forcapedia',
      type:          'article',
      publishedTime: article.created_at,
      modifiedTime:  article.verified_at,
      images:        [{ url: ogImage, width: 1200, height: 630, alt: article.title }],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description: article.summary,
      images:      [ogImage],
    },
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug }  = await params
  const article   = await getArticle(slug)

  // Article already in DB — normal SSR render
  if (article) {
    const url = `${SITE_URL}/article/${slug}`
    const jsonLd = {
      '@context':        'https://schema.org',
      '@type':           'Article',
      headline:          article.title,
      description:       article.summary,
      url,
      datePublished:     article.created_at,
      dateModified:      article.verified_at,
      author:            { '@type': 'Organization', name: 'Forcapedia', url: SITE_URL },
      publisher:         { '@type': 'Organization', name: 'Forcapedia', url: SITE_URL },
      keywords:          article.tags?.join(', '),
      articleSection:    article.category,
      inLanguage:        'en-US',
      mainEntityOfPage:  { '@type': 'WebPage', '@id': url },
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Nav />
        <ArticleView article={article} />
      </>
    )
  }

  // Article not in DB — ArticleGenerator reads the pending topic from sessionStorage
  // (stored by the search page before navigating here, keeps URL clean)
  return (
    <>
      <Nav />
      <ArticleGenerator slug={slug} />
    </>
  )
}
