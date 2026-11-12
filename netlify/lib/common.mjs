// Gemeinsame Hilfen für die Netlify Functions (kein eigener Endpunkt).
import nodemailer from "nodemailer";
import { getStore } from "@netlify/blobs";

// Starke Konsistenz: Änderungen sind sofort für alle folgenden Aufrufe sichtbar
// (Standard wäre "eventual" mit bis zu 60 s Verzögerung).
export const openStore = () => getStore({ name: "heizung", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

// Vergleich in konstanter Zeit, damit Schlüssel nicht über Antwortzeiten erraten werden können
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Datum im deutschen Kalender (Europe/Berlin) als YYYY-MM-DD
const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" });
export const dayKey = (ts) => dayFmt.format(new Date(ts));

export const fmtTime = (ts) =>
  new Date(ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ---------- Warnungen (Netlify Blobs) ----------
// "alerts"       = Einstellungen (nur über das Dashboard geändert)
// "alert-status" = Versandstatus (von Ingest und Test-Mail geschrieben)
// Getrennt, damit ein Statuswechsel nie die Empfängerliste überschreiben kann.
export const MAX_RECIPIENTS = 10;
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

export function cleanRecipients(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const raw of list) {
    const e = String(raw ?? "").trim().toLowerCase();
    if (!e) continue;
    if (e.length > 254 || !EMAIL_RE.test(e)) return null;
    if (!out.includes(e)) out.push(e);
  }
  return out.length > MAX_RECIPIENTS ? null : out;
}

export async function loadAlerts(store) {
  const a = (await store.get("alerts", { type: "json" })) || {};
  return {
    enabled: a.enabled !== false,
    recipients: Array.isArray(a.recipients) ? a.recipients : [],
  };
}

export async function loadAlertStatus(store) {
  const s = (await store.get("alert-status", { type: "json" })) || {};
  return {
    lastAlertDay: s.lastAlertDay ?? null,
    lastAlertTs: s.lastAlertTs ?? null,
    lastTestTs: s.lastTestTs ?? null,
    lastError: s.lastError ?? null,
  };
}

export async function updateAlertStatus(store, patch) {
  const s = await loadAlertStatus(store);
  Object.assign(s, patch);
  await store.setJSON("alert-status", s);
  return s;
}

// ---------- E-Mail über Gmail (App-Passwort) ----------
export function mailConfigured() {
  return Boolean(Netlify.env.get("GMAIL_USER") && Netlify.env.get("GMAIL_APP_PASSWORD"));
}

export async function sendMail(recipients, subject, text) {
  const user = Netlify.env.get("GMAIL_USER");
  const pass = Netlify.env.get("GMAIL_APP_PASSWORD");
  if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD fehlen in Netlify");
  if (!recipients.length) throw new Error("Keine Empfänger eingetragen");
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass: pass.replace(/\s+/g, "") }, // Google zeigt App-Passwörter mit Leerzeichen an
    connectionTimeout: 8000,
    socketTimeout: 8000,
  });
  // Empfänger in BCC, damit sie die Adressen der anderen nicht sehen
  try {
    await transporter.sendMail({
      from: `"Heizkörper-Monitor" <${user}>`,
      to: user,
      bcc: recipients,
      subject,
      text,
    });
  } catch (e) {
    // Bei Anmeldefehlern Hinweise zur Diagnose ergänzen (nie das Passwort selbst)
    if (e && e.code === "EAUTH") {
      const clean = pass.replace(/\s+/g, "");
      const hint = /^[a-z]{16}$/.test(clean) ? "Format ok" : "Format ungewöhnlich, erwartet 16 Kleinbuchstaben";
      throw new Error(`Gmail-Anmeldung abgelehnt. Angemeldet als „${user}“, App-Passwort ${clean.length} Zeichen (${hint}).`);
    }
    throw e;
  }
}
