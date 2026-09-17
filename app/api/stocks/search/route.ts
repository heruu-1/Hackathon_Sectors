import { NextResponse } from 'next/server'

function escapeLike(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "''")
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ results: [] })
  const key = process.env.SECTORS_API_KEY?.trim()
  if (!key || key === 'your_sectors_api_key_here')
    return NextResponse.json(
      { error: 'SECTORS_API_KEY belum diisi pada konfigurasi server.' },
      { status: 503 },
    )
  const safe = escapeLike(query.slice(0, 80))
  const params = new URLSearchParams({
    where: `symbol like '%${safe}%' or company_name like '%${safe}%'`,
    order_by: 'symbol',
    limit: '8',
    offset: '0',
  })
  try {
    const response = await fetch('https://api.sectors.app/v2/companies/?' + params.toString(), {
      headers: { Authorization: key },
      signal: AbortSignal.timeout(8_000),
      cache: 'no-store',
    })
    if (!response.ok)
      return NextResponse.json({ error: 'Pencarian saham belum tersedia.' }, { status: 502 })
    const payload = (await response.json()) as {
      results?: Array<{
        symbol?: string
        company_name?: string
        sector?: string
        sub_sector?: string
      }>
    }
    return NextResponse.json({
      results: (payload.results ?? []).map((item) => ({
        symbol: item.symbol?.replace(/\.JK$/i, '') ?? '',
        name: item.company_name ?? 'Nama belum tersedia',
        sector: item.sector ?? item.sub_sector ?? 'Sektor belum tersedia',
      })),
    })
  } catch {
    return NextResponse.json(
      { error: 'Pencarian saham gagal terhubung. Coba lagi.' },
      { status: 502 },
    )
  }
}
