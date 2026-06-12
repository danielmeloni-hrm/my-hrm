import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    const calendarId = searchParams.get('calendarId')
    const timeMin = searchParams.get('timeMin')
    const timeMax = searchParams.get('timeMax')

    if (!calendarId) {
      return NextResponse.json(
        { events: [], error: 'calendarId mancante' },
        { status: 400 }
      )
    }

    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      return NextResponse.json(
        { events: [], error: 'Variabili Google mancanti' },
        { status: 500 }
      )
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
      },
      scopes: ['https://www.googleapis.com/auth/calendar.readonly']
    })

    const calendar = google.calendar({
      version: 'v3',
      auth
    })

    const now = new Date()
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin || defaultStart.toISOString(),
      timeMax: timeMax || defaultEnd.toISOString(),
      singleEvents: true,
      orderBy: 'startTime'
    })

    return NextResponse.json({
      events: response.data.items || []
    })
  } catch (error: any) {
    const status = error?.code || error?.response?.status || 500

    return NextResponse.json(
      {
        events: [],
        error: error?.message || 'Errore Google Calendar',
        code: status,
        details: error?.errors || error?.response?.data || null
      },
      { status }
    )
  }
}