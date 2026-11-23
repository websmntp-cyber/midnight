import { handleRequest } from "./_core.mjs";

// vercel.json mengarahkan semua /api/* ke fungsi ini dengan jalur asli di ?__p=
export default {
  async fetch(req) {
    const u = new URL(req.url);
    const p = u.searchParams.get("__p");
    if (p !== null) {
      u.searchParams.delete("__p");
      u.pathname = "/api/" + p.replace(/^\/+/, "");
      req = new Request(u.toString(), req);
    }
    return handleRequest(req);
  }
};
