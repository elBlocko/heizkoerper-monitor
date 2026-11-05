# Heizkörper-Monitor

Dashboard für die Heizkörper-Temperaturen (Sonoff SNZB-02LD über Home Assistant), gehostet auf Netlify.

- `public/index.html` – Dashboard (mit Demo-Modus: `?demo`)
- `netlify/functions/ingest.mjs` – `POST /api/ingest`, nimmt Werte von Home Assistant an (Header `Authorization: Bearer <INGEST_TOKEN>`)
- `netlify/functions/readings.mjs` – `GET /api/readings`, liefert Werte ans Dashboard (Header `x-view-key: <VIEW_KEY>`)

Die Schlüssel `INGEST_TOKEN` und `VIEW_KEY` stehen nur als Umgebungsvariablen in Netlify, nie im Repository. Gespeichert wird nur der Verlauf der letzten 7 Tage (Netlify Blobs).
