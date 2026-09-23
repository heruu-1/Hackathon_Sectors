export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    {
      status: 'LIVE',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      service: 'rasi',
      version: '0.1.0',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    },
  )
}
