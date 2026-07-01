import { NextRequest, NextResponse } from 'next/server'

const VC_SID = '3774634'
const VC_PID = '892648734'

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')
  if (!q) {
    return NextResponse.redirect('https://shopping.yahoo.co.jp/')
  }

  const yahooSearchUrl = `https://search.shopping.yahoo.co.jp/search?p=${encodeURIComponent(q)}&sort=price`
  const vcUrl = encodeURIComponent(yahooSearchUrl)
  const destination = `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${VC_SID}&pid=${VC_PID}&vc_url=${vcUrl}`

  return NextResponse.redirect(destination)
}
