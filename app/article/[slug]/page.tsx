import { notFound } from 'next/navigation'
import Nav from '@/components/Nav'
import ArticleView from '@/components/ArticleView'
import { createClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return {
    title: `${title} — Forcapedia`,
    description: `Verified knowledge article about ${title}. Sourced, dated, and AI-verified.`,
  }
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch from cache
  const { data: article } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .single()

  if (!article) notFound()

  return (
    <>
      <Nav />
      <ArticleView article={article} />
    </>
  )
}
