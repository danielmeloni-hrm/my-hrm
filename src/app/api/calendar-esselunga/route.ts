import { google } from 'googleapis';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Recupero e pulizia della chiave privata
    const privateKey = process.env.GOOGLE_PRIVATE_KEY
      ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, '')
      : undefined;

    if (!privateKey || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
      throw new Error("Credenziali Google mancanti nelle variabili d'ambiente");
    }

    // 2. Autenticazione con Service Account
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
    });

    const calendar = google.calendar({ version: 'v3', auth });
    
    const calendars = {
      COLLAUDO: 'e1b8680caf760dcc73c31959828d8525072c9432f6bc0be0b12f484c1265a2eb@group.calendar.google.com',
      PROD: '732eacb1f9fc6f955a9f912ef7a4c840e72bc1214c4583ff9cee9a3879d4d3d9@group.calendar.google.com'
    };

    // 3. Range temporale per performance (da 1 mese fa)
    const timeMin = new Date();
    timeMin.setMonth(timeMin.getMonth() - 1);

    // 4. Esecuzione parallela delle richieste
    const [resColl, resProd] = await Promise.all([
      calendar.events.list({ 
        calendarId: calendars.COLLAUDO, 
        singleEvents: true, 
        timeMin: timeMin.toISOString() 
      }),
      calendar.events.list({ 
        calendarId: calendars.PROD, 
        singleEvents: true, 
        timeMin: timeMin.toISOString() 
      })
    ]);

    // 5. Funzione di formattazione sicura
    const formatEvents = (items: any[] = [], type: 'COLLAUDO' | 'PROD') => {
      return items.map(item => {
        const dateRaw = item.start?.date || item.start?.dateTime || '';
        const cleanDate = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw;

        return {
          id: item.id,
          titolo: item.summary || 'Senza titolo',
          data: cleanDate,
          type: type,
          isExternal: true,
          clienti: { nome: 'ESSELUNGA' }
        };
      });
    };

    // 6. Unione dei risultati
    const allEvents = [
      ...formatEvents(resColl.data.items || [], 'COLLAUDO'),
      ...formatEvents(resProd.data.items || [], 'PROD')
    ];

    return NextResponse.json(allEvents);

  } catch (error: any) {
    console.error("❌ Errore API Calendar:", error.message);
    
    // Gestione specifica per errori di autenticazione
    if (error.message.includes('invalid_grant') || error.message.includes('PEM')) {
      return NextResponse.json(
        { error: "Errore di autenticazione con Google", details: "Controlla la Private Key e l'email del Service Account" }, 
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Errore durante il recupero dei calendari", details: error.message }, 
      { status: 500 }
    );
  }
}