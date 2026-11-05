// Liefert aktuelle Werte und Verlauf ans Dashboard.
// Erwartet: GET /api/readings, Header "x-view-key: <VIEW_KEY>"
import { getStore } from "@netlify/blobs";

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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const viewKey = Netlify.env.get("VIEW_KEY");
  if (!viewKey) return json({ error: "not_configured" }, 503);

  const given = req.headers.get("x-view-key") || "";
  if (!safeEqual(given, viewKey)) return json({ error: "unauthorized" }, 401);

  const store = getStore("heizung");
  const latest = await store.get("latest", { type: "json" });
  const history = (await store.get("history", { type: "json" })) || [];

  if (!latest) return json({ error: "no_data" }, 404);
  return json({ latest, history });
};

export const config = { path: "/api/readings" };
