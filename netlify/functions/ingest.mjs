// Nimmt Messwerte von Home Assistant entgegen, speichert sie in Netlify Blobs
// und verschickt bei Auskühlung höchstens eine Warn-Mail pro Tag.
// Erwartet: POST /api/ingest, Header "Authorization: Bearer <INGEST_TOKEN>"
// Body: { "threshold": 30, "sensors": [ { "id": "vorlauf", "name": "Vorlauf Wohnung", "temperature": 52.3, "battery": 95 } ] }
import { getStore } from "@netlify/blobs";
import { json, safeEqual, dayKey, fmtTime, loadAlerts, sendMail, mailConfigured } from "../lib/common.mjs";

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage Verlauf
const MAX_SENSORS = 20;
const MAX_DAYS = 400; // Tageswerte für gut 13 Monate
const CONFIRM_WINDOW_MS = 30 * 60 * 1000; // vorheriger Wert muss jünger als 30 Min. sein

const fmtT = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " °C";

// Warnung, wenn der aktuelle UND der vorherige Messwert unter dem Grenzwert liegen
// (also seit mindestens einem Sendeintervall) – höchstens einmal pro Kalendertag.
async function checkAlert(store, sensors, threshold, history, ts) {
  if (threshold == null || !mailConfigured()) return;
  const alerts = await loadAlerts(store);
  if (!alerts.enabled || !alerts.recipients.length) return;
  const today = dayKey(ts);
  if (alerts.lastAlertDay === today) return;

  const prev = history.length >= 2 ? history[history.length - 2] : null;
  const cold = sensors.filter((s) => {
    if (s.temperature >= threshold) return false;
    const p = prev && ts - prev.ts <= CONFIRM_WINDOW_MS ? prev.values[s.id] : undefined;
    return p != null && p < threshold;
  });
  if (!cold.length) return;

  const lines = cold.map((s) => `• ${s.name}: ${fmtT(s.temperature)}`).join("\n");
  try {
    await sendMail(alerts.recipients, `Heizung: Vorlauf unter ${threshold} °C`,
      `Der Vorlauf ist unter den Grenzwert von ${threshold} °C gefallen.\n\n${lines}\n\n` +
      `Stand: ${fmtTime(ts)}\n\n` +
      `Diese Warnung kommt höchstens einmal pro Tag. Verlauf und Einstellungen findest du im Dashboard.`);
    alerts.lastAlertDay = today;
    alerts.lastAlertTs = ts;
    alerts.lastError = null;
  } catch (e) {
    alerts.lastError = String(e.message || e).slice(0, 200);
  }
  await store.setJSON("alerts", alerts);
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

  // Tageswerte (Min/Max/Mittel) für Monats- und Jahresansicht, ca. 13 Monate
  const daily = (await store.get("daily", { type: "json" })) || {};
  const day = dayKey(ts);
  const entry = daily[day] || (daily[day] = {});
  for (const s of sensors) {
    const t = s.temperature;
    const e = entry[s.id] || { min: t, max: t, sum: 0, n: 0 };
    e.min = Math.min(e.min, t);
    e.max = Math.max(e.max, t);
    e.sum = Math.round((e.sum + t) * 10) / 10;
    e.n += 1;
    entry[s.id] = e;
  }
  for (const k of Object.keys(daily).sort().slice(0, -MAX_DAYS)) delete daily[k];

  await store.setJSON("history", pruned);
  await store.setJSON("daily", daily);
  await store.setJSON("latest", { ts, threshold, sensors });

  // Ein Fehler beim Mailversand darf das Speichern der Messwerte nicht verhindern
  try { await checkAlert(store, sensors, threshold, pruned, ts); } catch {}

  return json({ ok: true, stored: sensors.length });
};

export const config = { path: "/api/ingest" };
