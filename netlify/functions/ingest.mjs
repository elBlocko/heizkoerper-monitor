// Nimmt Messwerte von Home Assistant entgegen und speichert sie in Netlify Blobs.
// Erwartet: POST /api/ingest, Header "Authorization: Bearer <INGEST_TOKEN>"
// Body: { "threshold": 30, "sensors": [ { "id": "wohnzimmer", "name": "Wohnzimmer", "temperature": 52.3, "battery": 95 } ] }
import { getStore } from "@netlify/blobs";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage Verlauf
const MAX_SENSORS = 20;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = Netlify.env.get("INGEST_TOKEN");
  if (!token) return json({ error: "INGEST_TOKEN nicht konfiguriert" }, 503);

  const auth = req.headers.get("authorization") || "";
  if (!safeEqual(auth, `Bearer ${token}`)) return json({ error: "Unauthorized" }, 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Ungültiges JSON" }, 400);
  }

  if (!Array.isArray(body?.sensors) || body.sensors.length === 0 || body.sensors.length > MAX_SENSORS) {
    return json({ error: "sensors fehlt oder ungültig" }, 400);
  }

  const sensors = [];
  for (const s of body.sensors) {
    const id = String(s?.id ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    const name = String(s?.name ?? id).slice(0, 40);
    const temperature = Number(s?.temperature);
    if (!id || !Number.isFinite(temperature) || temperature < -40 || temperature > 130) continue;
    const battery = Number.isFinite(Number(s?.battery)) ? Math.max(0, Math.min(100, Number(s.battery))) : null;
    sensors.push({ id, name, temperature: Math.round(temperature * 10) / 10, battery });
  }
  if (sensors.length === 0) return json({ error: "Keine gültigen Messwerte" }, 400);

  const threshold = Number.isFinite(Number(body.threshold)) ? Number(body.threshold) : null;
  const ts = Date.now();

  const store = getStore("heizung");
  const history = (await store.get("history", { type: "json" })) || [];
  const values = {};
  for (const s of sensors) values[s.id] = s.temperature;
  history.push({ ts, values });
  const pruned = history.filter((h) => ts - h.ts <= MAX_AGE_MS);

  await store.setJSON("history", pruned);
  await store.setJSON("latest", { ts, threshold, sensors });

  return json({ ok: true, stored: sensors.length });
};

export const config = { path: "/api/ingest" };
