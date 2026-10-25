// Vercel serverless function: /api/site  ->  your bot panel (plugins/website.js)
// If your panel address changes, edit PANEL_URL (or set BACKEND_URL in Vercel > Environment Variables).
const PANEL_URL = "http://kod.publicvm.com:2888";
const ROUTE = "/api/site";

function baseUrl() {
  const raw = process.env.BACKEND_URL || (process.env.BACKEND_PAIR_URL || "").replace(/\/api\/pair\/?$|\/pair\/?$/, "") || PANEL_URL;
  return raw.replace(/\/+$/, "");
}

export default async function handler(req, res) {
  if (!["GET", "POST", "DELETE"].includes(req.method)) return res.status(405).json({ error: "Method not allowed" });

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query || {})) qs.append(k, Array.isArray(v) ? String(v[0]) : String(v));

  if (ROUTE === "/api/pair") {
    const number = String(qs.get("number") || "").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(number)) {
      return res.status(400).json({ error: "Invalid WhatsApp number. Use country code without + (e.g. 947XXXXXXXX)." });
    }
    qs.set("number", number);
  }

  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const headers = {};
  if (ip) headers["x-forwarded-for"] = ip;
  if (req.headers.authorization) headers.authorization = req.headers.authorization;

  let body;
  if (req.method === "POST") {
    headers["content-type"] = "application/json";
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 50000);
  try {
    const q = qs.toString();
    const upstream = await fetch(baseUrl() + ROUTE + (q ? "?" + q : ""), { method: req.method, headers, body, signal: ctrl.signal });
    const text = await upstream.text();
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "application/json");
    try { JSON.parse(text); return res.status(upstream.status).send(text); }
    catch (_) {
      const hint = upstream.status === 404
        ? "Bot panel has no " + ROUTE + " route (404). Check that plugins/website.js is loaded and the panel port is correct."
        : "Bot panel returned an invalid reply (HTTP " + upstream.status + ").";
      return res.status(502).json({ error: hint });
    }
  } catch (err) {
    return res.status(502).json({ error: "Bot server is offline right now. Try again later." });
  } finally {
    clearTimeout(timer);
  }
}
