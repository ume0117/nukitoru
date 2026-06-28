import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const jan = request.nextUrl.searchParams.get('jan')
  if (!jan) {
    return NextResponse.json({ error: 'JAN code required' }, { status: 400 })
  }

  const appId = process.env.RAKUTEN_APP_ID
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID

  if (!appId) {
    return NextResponse.json({ error: 'API not configured' }, { status: 500 })
  }

  try {
    const url = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601')
    url.searchParams.set('applicationId', appId)
    if (affiliateId) url.searchParams.set('affiliateId', affiliateId)
    url.searchParams.set('keyword', jan)
    url.searchParams.set('hits', '3')
    url.searchParams.set('sort', '+itemPrice')
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), {
      next: { revalidate: 300 },
      headers: {
        'Referer': 'https://nukitoru.vercel.app',
      },
    })
    const data = await res.json()

    if (!data.Items?.length) {
      return NextResponse.json({ found: false })
    }

    const item = data.Items[0].Item
    return NextResponse.json({
      found: true,
      name: item.itemName,
      price: item.itemPrice,
      affiliateUrl: item.affiliateUrl || item.itemUrl,
      imageUrl: item.mediumImageUrls?.[0]?.imageUrl ?? null,
    })
  } catch (e) {
    console.error('Rakuten API error:', e)
    return NextResponse.json({ error: 'API error' }, { status: 500 })
  }
}
