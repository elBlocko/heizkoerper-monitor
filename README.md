# Heizkörper-Monitor

Dashboard für die Vorlauftemperatur zur Wohnung (ein Sonoff SNZB-02LD über Home Assistant), gehostet auf Netlify. Ansichten: 24 h, 7 Tage, Monat, Jahr.

- `public/index.html` – Dashboard (mit Demo-Modus: `?demo`)
- `netlify/functions/ingest.mjs` – `POST /api/ingest`, nimmt Werte von Home Assistant an (Header `Authorization: Bearer <INGEST_TOKEN>`)
- `netlify/functions/readings.mjs` – `GET /api/readings`, liefert Werte ans Dashboard (Header `x-view-key: <VIEW_KEY>`)

Die Schlüssel `INGEST_TOKEN` und `VIEW_KEY` stehen nur als Umgebungsvariablen in Netlify, nie im Repository. Gespeichert werden (Netlify Blobs) die Einzelwerte der letzten 7 Tage sowie Tageswerte (Min/Max/Mittel) für gut 13 Monate.
