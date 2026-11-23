// Penyimpanan data berbasis Upstash Redis (REST) - pengganti Netlify Blobs.
// Dipasang lewat Vercel Marketplace -> Upstash Redis (env: KV_REST_API_URL / KV_REST_API_TOKEN
// atau UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
const CHUNK = 400000;
const MARK = "\u0001CHUNKS:";
const CAS_SCRIPT = "if redis.call('GET',KEYS[1])==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]) return 1 else return 0 end";

function conf() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Database belum terhubung: env UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (atau KV_REST_API_URL / KV_REST_API_TOKEN) belum ada.");
  return { url: url.replace(/\/+$/, ""), token };
}

async function cmd(args) {
  const c = conf();
  const res = await fetch(c.url, {
    method: "POST",
    headers: { authorization: "Bearer " + c.token, "content-type": "application/json" },
    body: JSON.stringify(args)
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j || j.error) throw new Error("Redis: " + ((j && j.error) || "HTTP " + res.status));
  return j.result;
}

const PFX = () => (process.env.SITE_ID ? String(process.env.SITE_ID).replace(/[^A-Za-z0-9_-]/g, "") + ":" : "");
const chunkKey = (key, i) => "~chunk/" + key + "/" + i;

async function rawGet(key) {
  const v = await cmd(["GET", key]);
  if (typeof v === "string" && v.indexOf(MARK) === 0) {
    const n = Number(v.slice(MARK.length));
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => cmd(["GET", chunkKey(key, i)])));
    return parts.map((x) => x || "").join("");
  }
  return v;
}

async function dropChunks(key) {
  const v = await cmd(["GET", key]);
  if (typeof v === "string" && v.indexOf(MARK) === 0) {
    const n = Number(v.slice(MARK.length));
    for (let i = 0; i < n; i++) await cmd(["DEL", chunkKey(key, i)]);
  }
}

async function rawPut(key, str) {
  if (str.length <= CHUNK) {
    await dropChunks(key);
    await cmd(["SET", key, str]);
    return;
  }
  await dropChunks(key);
  const n = Math.ceil(str.length / CHUNK);
  for (let i = 0; i < n; i++) await cmd(["SET", chunkKey(key, i), str.slice(i * CHUNK, (i + 1) * CHUNK)]);
  await cmd(["SET", key, MARK + n]);
}

export function openStore() {
  return {
    async get(key, opts) {
      key = PFX() + key;
      const v = await rawGet(key);
      if (v == null) return null;
      if (opts && opts.type === "json") { try { return JSON.parse(v); } catch (e) { return null; } }
      return v;
    },
    async getWithMetadata(key, opts) {
      key = PFX() + key;
      const v = await cmd(["GET", key]);
      if (v == null) return null;
      let data = v;
      if (opts && opts.type === "json") { try { data = JSON.parse(v); } catch (e) { data = null; } }
      return { data, etag: v };
    },
    async set(key, value) {
      key = PFX() + key;
      await rawPut(key, String(value));
      return { modified: true };
    },
    async setJSON(key, obj, opts) {
      key = PFX() + key;
      const str = JSON.stringify(obj);
      if (opts && opts.onlyIfNew) {
        const r = await cmd(["SET", key, str, "NX"]);
        return { modified: r === "OK" };
      }
      if (opts && opts.onlyIfMatch) {
        const r = await cmd(["EVAL", CAS_SCRIPT, 1, key, opts.onlyIfMatch, str]);
        return { modified: r === 1 };
      }
      await rawPut(key, str);
      return { modified: true };
    },
    async delete(key) {
      key = PFX() + key;
      await dropChunks(key);
      await cmd(["DEL", key]);
    },
    async list(opts) {
      const pf = PFX();
      const prefix = pf + ((opts && opts.prefix) || "");
      const keys = [];
      let cursor = "0";
      do {
        const r = await cmd(["SCAN", cursor, "MATCH", prefix.replace(/[\\*?\[\]]/g, "\\$&") + "*", "COUNT", 500]);
        cursor = String(r[0]);
        for (const k of r[1]) if (k.indexOf("~chunk/") !== 0) keys.push(pf && k.indexOf(pf) === 0 ? k.slice(pf.length) : k);
      } while (cursor !== "0");
      return { blobs: [...new Set(keys)].map((key) => ({ key })) };
    }
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function cas(store, key, init, fn, tries = 14) {
  for (let i = 0; i < tries; i++) {
    const cur = await store.getWithMetadata(key, { type: "json" });
    const doc = cur && cur.data ? cur.data : init();
    const out = await fn(doc);
    if (out && out.abort) return out;
    const w = await store.setJSON(key, doc, cur && cur.etag ? { onlyIfMatch: cur.etag } : { onlyIfNew: true });
    if (w && w.modified) return { ok: true, out, doc };
    await sleep(10 + Math.random() * 40 * (i + 1));
  }
  return { abort: "busy" };
}
export async function listAll(store, prefix) {
  const res = await store.list({ prefix });
  return (res && res.blobs ? res.blobs : []).map((b) => b.key);
}
