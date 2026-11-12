// HTML- und Text-Vorlagen für die Mails des Heizkörper-Monitors.
// Nur Inline-Styles und Tabellen, damit es in Gmail, Outlook & Co. gleich aussieht.

const FALLBACK_URL = "https://heizkoerper-monitor-mb.netlify.app";
export const dashboardUrl = () => {
  try { return Netlify.env.get("URL") || FALLBACK_URL; } catch { return FALLBACK_URL; }
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtNum = (v) => v.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtTime = (ts) =>
  new Date(ts).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr";

const C = { bg: "#f4f2ee", card: "#ffffff", ink: "#1d1c1a", muted: "#6b6760", line: "#e3dfd8", cold: "#2f6fb0", coldSoft: "#dde9f6", warm: "#d9541e", warmSoft: "#fbe6dc" };
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function layout({ preheader, accent, accentSoft, icon, title, body, url }) {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
<tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${C.card};border:1px solid ${C.line};border-radius:14px;overflow:hidden;">
    <tr><td style="height:6px;background:${accent};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:28px 28px 8px;font-family:${FONT};">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:44px;height:44px;border-radius:22px;background:${accentSoft};text-align:center;font-size:22px;line-height:44px;">${icon}</td>
        <td style="padding-left:12px;font-family:${FONT};font-size:13px;color:${C.muted};">Heizkörper-Monitor</td>
      </tr></table>
      <h1 style="margin:18px 0 0;font-family:${FONT};font-size:22px;line-height:1.3;color:${C.ink};font-weight:600;">${esc(title)}</h1>
    </td></tr>
    ${body}
    <tr><td align="center" style="padding:8px 28px 28px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="border-radius:10px;background:${C.ink};">
          <a href="${esc(url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">Zum Dashboard &rarr;</a>
        </td>
      </tr></table>
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td style="padding:16px 12px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};text-align:center;">
      Du bekommst diese Nachricht, weil deine Adresse im Heizkörper-Monitor eingetragen ist.<br>
      Warnungen kommen höchstens einmal pro Tag und lassen sich im Dashboard abschalten.
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const p = (html) => `<tr><td style="padding:10px 28px 0;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.ink};">${html}</td></tr>`;

// ---------- Warnung: Vorlauf unter Grenzwert ----------
export function alertMail({ sensors, threshold, ts }) {
  const url = dashboardUrl();
  const main = sensors[0];
  const rows = sensors.map((s) => `
      <tr>
        <td style="padding:14px 18px;font-family:${FONT};font-size:14px;color:${C.muted};">${esc(s.name)}</td>
        <td align="right" style="padding:14px 18px;font-family:${FONT};font-size:30px;font-weight:600;color:${C.cold};white-space:nowrap;">${fmtNum(s.temperature)}&nbsp;<span style="font-size:16px;color:${C.muted};font-weight:400;">°C</span></td>
      </tr>`).join("");

  const body =
    p(`Hallo,<br><br>gerade ist der Vorlauf deiner Heizung unter <strong>${fmtNum(threshold)} °C</strong> gefallen – die Heizkörper kühlen aus. Vielleicht lohnt sich ein kurzer Blick auf die Heizung.`) +
    `<tr><td style="padding:18px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.coldSoft};border-radius:12px;">${rows}
        <tr><td colspan="2" style="padding:0 18px 14px;font-family:${FONT};font-size:12px;color:${C.muted};">Grenzwert ${fmtNum(threshold)} °C &middot; gemessen ${esc(fmtTime(ts))}</td></tr>
      </table>
    </td></tr>` +
    p(`<span style="color:${C.muted};font-size:14px;">Im Dashboard siehst du den Verlauf der letzten Stunden und kannst prüfen, seit wann es kälter wird.</span>`) +
    `<tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

  const html = layout({
    preheader: `${main.name}: ${fmtNum(main.temperature)} °C – unter ${fmtNum(threshold)} °C`,
    accent: C.cold, accentSoft: C.coldSoft, icon: "&#10052;&#65039;",
    title: "Die Heizung kühlt aus", body, url,
  });

  const text =
    `Hallo,\n\ngerade ist der Vorlauf deiner Heizung unter ${fmtNum(threshold)} °C gefallen – die Heizkörper kühlen aus.\n\n` +
    sensors.map((s) => `  ${s.name}: ${fmtNum(s.temperature)} °C`).join("\n") +
    `\n\nGemessen: ${fmtTime(ts)}\n\nZum Dashboard: ${url}\n\n` +
    `Diese Warnung kommt höchstens einmal pro Tag und lässt sich im Dashboard abschalten.`;

  return { subject: `❄️ Heizung kühlt aus: ${fmtNum(main.temperature)} °C`, html, text };
}

// ---------- Test-Mail ----------
export function testMail({ ts, threshold }) {
  const url = dashboardUrl();
  const thr = threshold != null ? `${fmtNum(threshold)} °C` : "den Grenzwert";
  const body =
    p(`Hallo,<br><br>schön, dass du dabei bist! Diese Test-Mail zeigt: Der Versand klappt und deine Adresse ist richtig eingetragen.`) +
    `<tr><td style="padding:18px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.warmSoft};border-radius:12px;">
        <tr><td style="padding:16px 18px;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ink};">
          <strong>So funktioniert's</strong><br>
          Fällt der Vorlauf unter <strong>${thr}</strong>, bekommst du eine Warnung &ndash; höchstens einmal pro Tag, damit dein Postfach nicht vollläuft.
        </td></tr>
      </table>
    </td></tr>` +
    p(`<span style="color:${C.muted};font-size:13px;">Gesendet ${esc(fmtTime(ts))}</span>`) +
    `<tr><td style="height:14px;font-size:0;line-height:0;">&nbsp;</td></tr>`;

  const html = layout({
    preheader: "Der Versand klappt – deine Adresse ist richtig eingetragen.",
    accent: C.warm, accentSoft: C.warmSoft, icon: "&#9989;",
    title: "Alles bereit!", body, url,
  });

  const text =
    `Hallo,\n\nschön, dass du dabei bist! Diese Test-Mail zeigt: Der Versand klappt und deine Adresse ist richtig eingetragen.\n\n` +
    `Fällt der Vorlauf unter ${thr}, bekommst du eine Warnung – höchstens einmal pro Tag.\n\n` +
    `Zum Dashboard: ${url}\n\nGesendet: ${fmtTime(ts)}`;

  return { subject: "✅ Test: Heizkörper-Monitor ist bereit", html, text };
}
