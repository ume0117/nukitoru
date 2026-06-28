import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const jan = request.nextUrl.searchParams.get('jan')
  if (!jan) {
    return NextResponse.json({ error: 'JAN code required' }, { status: 400 })
  }

  const appId = process.env.RAKUTEN_APP_ID
  const accessKey = process.env.RAKUTEN_ACCESS_KEY
  const affiliateId = process.env.RAKUTEN_AFFILIATE_ID

  if (!appId || !accessKey) {
    return NextResponse.json({ error: 'API not configured' }, { status: 500 })
  }

  try {
    // 新エンドポイント（2026年2月〜）
    const params = new URLSearchParams({
      applicationId: appId,
      keyword: jan,
      hits: '3',
      format: 'json',
      httpReferer: 'https://nukitoru.vercel.app',
    })
    if (affiliateId) params.set('affiliateId', affiliateId)

    const apiUrl = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?${params.toString()}`

    const res = await fetch(apiUrl, {
      next: { revalidate: 300 },
      headers: {
        'accessKey': accessKey,
        'Referer': 'https://nukitoru.vercel.app',
        'Origin': 'https://nukitoru.vercel.app',
      },
    })

    const data = await res.json()
    console.log('Rakuten API status:', res.status)
    console.log('Rakuten API response:', JSON.stringify(data).slice(0, 300))

    if (data.error) {
      console.error('Rakuten API error:', data.error, data.error_description)
      return NextResponse.json({ found: false, error: data.error })
    }

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
