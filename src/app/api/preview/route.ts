import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'URL required' }, { status: 400 })

  // URLの検証
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Nukitoru/1.0)' },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 3600 },
    })

    const html = await res.text()

    // OGPタグを抽出
    const getTag = (property: string) => {
      const match = html.match(
        new RegExp(`<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')
      ) || html.match(
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${property}["']`, 'i')
      )
      return match?.[1] ?? null
    }

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)

    const title       = getTag('og:title') ?? titleMatch?.[1]?.trim() ?? null
    const description = getTag('og:description') ?? getTag('description') ?? null
    const image       = getTag('og:image') ?? null
    const siteName    = getTag('og:site_name') ?? null

    return NextResponse.json({ title, description, image, siteName })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
