# Heizkörper-Monitor

Dashboard für die Vorlauftemperatur zur Wohnung (ein Sonoff SNZB-02LD über Home Assistant), gehostet auf Netlify. Ansichten: 24 h, 7 Tage, Monat, Jahr.

- `public/index.html` – Dashboard (mit Demo-Modus: `?demo`)
- `netlify/functions/ingest.mjs` – `POST /api/ingest`, nimmt Werte von Home Assistant an (Header `Authorization: Bearer <INGEST_TOKEN>`)
- `netlify/functions/readings.mjs` – `GET /api/readings`, liefert Werte ans Dashboard (Header `x-view-key: <VIEW_KEY>`)
- `netlify/functions/alerts.mjs` – `/api/alerts`, verwaltet die Empfänger der Warn-Mails (Header `x-view-key: <VIEW_KEY>`)
- `netlify/lib/common.mjs` – gemeinsame Hilfen, u. a. Mailversand über Gmail

Die Schlüssel `INGEST_TOKEN`, `VIEW_KEY`, `GMAIL_USER` und `GMAIL_APP_PASSWORD` (Gmail-App-Passwort) stehen nur als Umgebungsvariablen in Netlify, nie im Repository. Gespeichert werden (Netlify Blobs) die Einzelwerte der letzten 7 Tage sowie Tageswerte (Min/Max/Mittel) für gut 13 Monate.


**Warn-Mails:** Liegen der aktuelle und der vorherige Messwert unter dem Grenzwert, geht eine Mail (BCC) an alle im Dashboard eingetragenen Adressen – höchstens einmal pro Kalendertag. Warnungen lassen sich im Dashboard abschalten (z. B. im Sommer).
