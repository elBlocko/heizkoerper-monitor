// Verwaltung der Warn-E-Mails für das Dashboard.
// GET  /api/alerts                       -> Einstellungen lesen
// PUT  /api/alerts  { enabled, recipients } -> Einstellungen speichern
// POST /api/alerts  { action: "test" }   -> Test-Mail an alle Empfänger
// Alle Aufrufe brauchen den Header "x-view-key: <VIEW_KEY>".
import { testMail } from "../lib/mail-templates.mjs";
import { json, safeEqual, openStore, loadAlerts, loadAlertStatus, updateAlertStatus, cleanRecipients, mailConfigured, sendMail } from "../lib/common.mjs";

const TEST_COOLDOWN_MS = 60 * 1000;

const publicView = (a, s) => ({
  enabled: a.enabled,
  recipients: a.recipients,
  lastAlertTs: s.lastAlertTs,
  lastError: s.lastError,
  mailConfigured: mailConfigured(),
});

export default async (req) => {
  const viewKey = Netlify.env.get("VIEW_KEY");
  if (!viewKey) return json({ error: "not_configured" }, 503);
  if (!safeEqual(req.headers.get("x-view-key") || "", viewKey)) return json({ error: "unauthorized" }, 401);

  const store = openStore();
  const alerts = await loadAlerts(store);

  if (req.method === "GET") return json(publicView(alerts, await loadAlertStatus(store)));

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
    // Alte Fehlermeldung (z. B. "Keine Empfänger") nach einer Änderung zurücksetzen
    const status = await updateAlertStatus(store, { lastError: null });
    return json(publicView(alerts, status));
  }

  if (req.method === "POST" && body.action === "test") {
    if (!alerts.recipients.length) return json({ error: "Keine Empfänger eingetragen" }, 400);
    const status = await loadAlertStatus(store);
    if (status.lastTestTs && Date.now() - status.lastTestTs < TEST_COOLDOWN_MS) {
      return json({ error: "Bitte eine Minute bis zur nächsten Test-Mail warten" }, 429);
    }
    try {
      const latest = await store.get("latest", { type: "json" });
      await sendMail(alerts.recipients, testMail({ ts: Date.now(), threshold: latest?.threshold ?? null }));
      await updateAlertStatus(store, { lastTestTs: Date.now(), lastError: null });
      return json({ ok: true, sent: alerts.recipients.length });
    } catch (e) {
      const msg = String(e.message || e).slice(0, 200);
      await updateAlertStatus(store, { lastTestTs: Date.now(), lastError: msg });
      return json({ error: msg }, 502);
    }
  }

  return json({ error: "Method not allowed" }, 405);
};

export const config = { path: "/api/alerts" };
