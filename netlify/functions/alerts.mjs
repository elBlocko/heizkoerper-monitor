// Verwaltung der Warn-E-Mails für das Dashboard.
// GET  /api/alerts                       -> Einstellungen lesen
// PUT  /api/alerts  { enabled, recipients } -> Einstellungen speichern
// POST /api/alerts  { action: "test" }   -> Test-Mail an alle Empfänger
// Alle Aufrufe brauchen den Header "x-view-key: <VIEW_KEY>".
import { getStore } from "@netlify/blobs";
import { json, safeEqual, loadAlerts, cleanRecipients, mailConfigured, sendMail, fmtTime } from "../lib/common.mjs";

const TEST_COOLDOWN_MS = 60 * 1000;

const publicView = (a) => ({
  enabled: a.enabled,
  recipients: a.recipients,
  lastAlertTs: a.lastAlertTs,
  lastError: a.lastError,
  mailConfigured: mailConfigured(),
});

export default async (req) => {
  const viewKey = Netlify.env.get("VIEW_KEY");
  if (!viewKey) return json({ error: "not_configured" }, 503);
  if (!safeEqual(req.headers.get("x-view-key") || "", viewKey)) return json({ error: "unauthorized" }, 401);

  const store = getStore("heizung");
  const alerts = await loadAlerts(store);

  if (req.method === "GET") return json(publicView(alerts));

  let body;
  try { body = await req.json(); } catch { return json({ error: "Ungültiges JSON" }, 400); }

  if (req.method === "PUT") {
    if (body.recipients !== undefined) {
      const r = cleanRecipients(body.recipients);
      if (!r) return json({ error: "Ungültige E-Mail-Adresse oder mehr als 10 Empfänger" }, 400);
      alerts.recipients = r;
    }
    if (typeof body.enabled === "boolean") alerts.enabled = body.enabled;
    await store.setJSON("alerts", alerts);
    return json(publicView(alerts));
  }

  if (req.method === "POST" && body.action === "test") {
    if (alerts.lastTestTs && Date.now() - alerts.lastTestTs < TEST_COOLDOWN_MS) {
      return json({ error: "Bitte eine Minute bis zur nächsten Test-Mail warten" }, 429);
    }
    alerts.lastTestTs = Date.now();
    try {
      await sendMail(alerts.recipients, "Test: Heizkörper-Monitor",
        `Dies ist eine Test-Mail vom Heizkörper-Monitor (${fmtTime(Date.now())}).\n\n` +
        `Wenn der Vorlauf unter den Grenzwert fällt, kommt höchstens eine Warnung pro Tag an diese Adresse.`);
      alerts.lastError = null;
      await store.setJSON("alerts", alerts);
      return json({ ok: true, sent: alerts.recipients.length });
    } catch (e) {
      alerts.lastError = String(e.message || e).slice(0, 200);
      await store.setJSON("alerts", alerts);
      return json({ error: alerts.lastError }, 502);
    }
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/alerts" };
