// Liefert aktuelle Werte und Verlauf ans Dashboard.
// Erwartet: GET /api/readings, Header "x-view-key: <VIEW_KEY>"
import { getStore } from "@netlify/blobs";
import { json, safeEqual } from "../lib/common.mjs";

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

  const dailyRaw = (await store.get("daily", { type: "json" })) || {};
  const daily = Object.keys(dailyRaw).sort().map((date) => {
    const values = {};
    for (const [id, e] of Object.entries(dailyRaw[date])) {
      values[id] = { min: e.min, max: e.max, avg: Math.round((e.sum / e.n) * 10) / 10 };
    }
    return { date, values };
  });

  return json({ latest, history, daily });
};

export const config = { path: "/api/readings" };
