import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
// src/domain.mjs
var WIB_OFFSET = 7 * 3600 * 1e3;
var pad = (n) => n < 10 ? "0" + n : "" + n;
function wib(ms) {
  const d = new Date(ms + WIB_OFFSET);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), dow: d.getUTCDay() };
}
function dateKey(ms) {
  const p = wib(ms);
  return p.y + "-" + pad(p.m) + "-" + pad(p.d);
}
function addDays(key, n) {
  const a = key.split("-").map(Number);
  const t = Date.UTC(a[0], a[1] - 1, a[2] + n);
  const d = new Date(t);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
}
var isDateKey = (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k) && !Number.isNaN(Date.parse(k + "T00:00:00Z")) && (/* @__PURE__ */ new Date(k + "T00:00:00Z")).toISOString().slice(0, 10) === k;
var monthOf = (key) => String(key).slice(0, 7);
function isWeekend(key) {
  const a = key.split("-").map(Number);
  const g = new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay();
  return g === 0 || g === 6;
}
var NUM_KEYS = ["priceWeekdayDay", "priceWeekdayNight", "priceWeekendDay", "priceWeekendNight", "dpWeekday", "dpWeekend", "openHour", "closeHour", "nightFrom", "holdMinutes"];
var STR_KEYS = ["name", "heroPhoto", "whatsapp", "instagram", "address", "bankName", "bankNumber", "bankHolder", "facilities", "policy", "telegramToken", "telegramChatId"];
var SECRET_KEYS = ["telegramToken", "telegramChatId"];
function defaultSettings() {
  return {
    name: "Gol Arena Futsal",
    heroPhoto: "",
    courts: [
      { name: "Lapangan 1", type: "", photo: "" },
      { name: "Lapangan 2", type: "", photo: "" },
      { name: "Lapangan 3", type: "", photo: "" }
    ],
    priceWeekdayDay: 1e5,
    priceWeekdayNight: 15e4,
    priceWeekendDay: 13e4,
    priceWeekendNight: 18e4,
    dpWeekday: 2e4,
    dpWeekend: 35e3,
    openHour: 8,
    closeHour: 22,
    nightFrom: 17,
    holdMinutes: 30,
    whatsapp: "088901675385",
    instagram: "",
    address: "4HG6+GR4 Cibabat, Kota Cimahi, Jawa Barat",
    bankName: "",
    bankNumber: "",
    bankHolder: "",
    facilities: "",
    policy: "",
    telegramToken: "",
    telegramChatId: ""
  };
}
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
var cap = (v, n) => String(v == null ? "" : v).slice(0, n);
function mergeSettings(base, patch) {
  const s = Object.assign({}, base);
  const p = patch && typeof patch === "object" ? patch : {};
  NUM_KEYS.forEach((k) => {
    if (p[k] === void 0) return;
    const n = Number(p[k]);
    if (Number.isFinite(n)) s[k] = Math.round(clamp(n, 0, 1e8));
  });
  STR_KEYS.forEach((k) => {
    if (p[k] === void 0) return;
    const big = k === "facilities" || k === "policy" || k === "heroPhoto";
    s[k] = cap(p[k], big ? 6e3 : 300);
  });
  if (Array.isArray(p.courts)) {
    const cur = Array.isArray(base.courts) ? base.courts : [];
    s.courts = p.courts.slice(0, 8).map((c, i) => {
      const o = Object.assign({ name: "Lapangan " + (i + 1), type: "", photo: "" }, cur[i] || {}, c && typeof c === "object" ? c : {});
      return { name: cap(o.name, 60) || "Lapangan " + (i + 1), type: cap(o.type, 60), photo: cap(o.photo, 600) };
    });
    if (!s.courts.length) s.courts = base.courts;
  }
  s.openHour = clamp(Number(s.openHour) || 0, 0, 23);
  s.closeHour = clamp(Number(s.closeHour) || 0, s.openHour + 1, 24);
  s.nightFrom = clamp(Number(s.nightFrom) || 0, s.openHour, s.closeHour);
  s.holdMinutes = clamp(Number(s.holdMinutes) || 30, 1, 1440);
  return s;
}
function publicSettings(s) {
  const o = Object.assign({}, s);
  SECRET_KEYS.forEach((k) => {
    delete o[k];
  });
  return o;
}
function maskSecret(v) {
  const t = String(v || "");
  if (!t) return "";
  return "\u2022\u2022\u2022\u2022" + t.slice(-4);
}
var isMasked = (v) => typeof v === "string" && v.indexOf("\u2022\u2022\u2022\u2022") === 0;
function priceOf(key, h, s) {
  const night = h >= s.nightFrom;
  if (isWeekend(key)) return night ? s.priceWeekendNight : s.priceWeekendDay;
  return night ? s.priceWeekdayNight : s.priceWeekdayDay;
}
var totalOf = (key, hours, s) => hours.reduce((t, h) => t + priceOf(key, h, s), 0);
var dpMinOf = (key, total, s) => Math.min(isWeekend(key) ? s.dpWeekend : s.dpWeekday, total);
function dpAmounts(b) {
  return {
    min: Math.min(b.dpMin, b.total),
    half: Math.min(b.total, Math.max(b.dpMin, Math.round(b.total / 2e3) * 1e3)),
    full: b.total
  };
}
function effStatus(b, nowMs) {
  if (b.status === "wait" && b.holdUntil < nowMs) return "expired";
  return b.status;
}
var isActive = (st) => st === "wait" || st === "verify" || st === "ok";
function normPhone(raw) {
  let p = String(raw || "").replace(/[^0-9]/g, "");
  if (p.indexOf("0") === 0) p = "62" + p.slice(1);
  else if (p.indexOf("8") === 0) p = "62" + p;
  return p;
}
var validPhone = (p) => /^628[0-9]{8,11}$/.test(p);
var CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
var CODE_RE = /^GA-[A-HJ-NP-Z2-9]{5}$/;
var fmtRp = (n) => "Rp " + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
var hh = (h) => pad(h) + ".00";
function rangesText(hours) {
  const sorted = hours.slice().sort((a, b) => a - b);
  const r = [];
  sorted.forEach((h) => {
    const l = r[r.length - 1];
    if (l && l[1] === h) l[1] = h + 1;
    else r.push([h, h + 1]);
  });
  return r.map((x) => hh(x[0]) + "\u2013" + hh(x[1])).join(", ");
}
var DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
function shortDate(key) {
  const a = key.split("-").map(Number);
  const g = new Date(Date.UTC(a[0], a[1] - 1, a[2])).getUTCDay();
  return DAYS[g] + ", " + a[2] + " " + MONTHS[a[1] - 1] + " " + a[0];
}

import { openStore, cas, listAll } from "./_store.mjs";
// src/notify.mjs
async function telegramSend(fetchFn, token, chatId, text) {
  if (!token || !chatId) return { ok: false, reason: "not_configured" };
  try {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 6e3);
    const res = await fetchFn("https://api.telegram.org/bot" + encodeURIComponent(token) + "/sendMessage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: ctl.signal
    });
    clearTimeout(to);
    let j = null;
    try {
      j = await res.json();
    } catch (e) {
      j = null;
    }
    if (res.ok && j && j.ok) return { ok: true };
    return { ok: false, reason: "telegram", detail: j && j.description ? String(j.description) : "HTTP " + res.status };
  } catch (e) {
    return { ok: false, reason: "network", detail: String(e && e.message ? e.message : e) };
  }
}

// src/handlers.mjs
var JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
var fail = (status, message, code) => json({ error: message, code: code || "error" }, status);
var MAX_BODY = 3e6;
var IMG_RE = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;
var hashOf = (s) => createHash("sha256").update(String(s)).digest();
var safeEq = (a, b) => timingSafeEqual(hashOf(a), hashOf(b));
var cap2 = (v, n) => String(v == null ? "" : v).slice(0, n);
var emptyMonth = () => ({ bookings: {}, blocked: {} });
var monthKey = (ym) => "m/" + ym;
async function readBody(req) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return { error: fail(413, "Data terlalu besar.", "too_large") };
  let text = "";
  try {
    text = await req.text();
  } catch (e) {
    return { error: fail(400, "Permintaan tidak terbaca.", "bad_body") };
  }
  if (text.length > MAX_BODY) return { error: fail(413, "Data terlalu besar.", "too_large") };
  try {
    const b = JSON.parse(text || "{}");
    return { body: b && typeof b === "object" ? b : {} };
  } catch (e) {
    return { error: fail(400, "Format data salah.", "bad_json") };
  }
}
async function loadSettings(store) {
  const cur = await store.get("settings", { type: "json", consistency: "strong" });
  return mergeSettings(defaultSettings(), cur || {});
}
async function loadMonth(store, ym) {
  const cur = await store.get(monthKey(ym), { type: "json", consistency: "strong" });
  const doc = cur && typeof cur === "object" ? cur : emptyMonth();
  doc.bookings = doc.bookings || {};
  doc.blocked = doc.blocked || {};
  return doc;
}
async function bump(store, deps) {
  try {
    await store.set("v", deps.now() + "-" + Math.floor(deps.rand() * 1e9));
  } catch (e) {
  }
}
function custView(b) {
  const o = Object.assign({}, b);
  delete o.tok;
  o.proof = "";
  return o;
}
function adminView(b) {
  const o = Object.assign({}, b);
  delete o.tok;
  o.hasProof = !!(b.proofAt && b.proofAt > 0);
  o.proof = "";
  return o;
}
function conflictIn(doc, date, court, hours, nowMs, exceptId) {
  for (const h of hours) if (doc.blocked[date + "|" + court + "|" + h]) return true;
  return Object.values(doc.bookings).some((b) => b.id !== exceptId && b.date === date && b.court === court && isActive(effStatus(b, nowMs)) && b.hours.some((h) => hours.indexOf(h) !== -1));
}
async function refByCode(store, code) {
  const c = String(code || "").trim().toUpperCase();
  if (!CODE_RE.test(c)) return null;
  const ref = await store.get("c/" + c, { type: "json", consistency: "strong" });
  return ref && ref.id && ref.month ? { code: c, id: ref.id, month: ref.month } : null;
}
function adminLink(req, deps) {
  try {
    return new URL(req.url).origin + "/a/" + String(deps.adminKey).toLowerCase() + "/";
  } catch (e) {
    return "";
  }
}
async function notify(req, deps, settings, text) {
  const t = settings.telegramToken, c = settings.telegramChatId;
  if (!t || !c) return;
  const link = adminLink(req, deps);
  const p = telegramSend(deps.fetchFn, t, c, text + (link ? "\n\nBuka dashboard admin:\n" + link : ""));
  if (deps.waitUntil) deps.waitUntil(p);
  else await p;
}
async function health(req, deps) {
  const store = deps.store;
  const stamp = String(deps.now());
  await store.set("health", stamp);
  const back = await store.get("health", { consistency: "strong" });
  return json({ ok: back === stamp, time: new Date(deps.now()).toISOString(), wibDate: dateKey(deps.now()), wibHour: wib(deps.now()).h });
}
async function publicState(req, deps) {
  const store = deps.store;
  const nowMs = deps.now();
  const url = new URL(req.url);
  const today = dateKey(nowMs);
  let from = url.searchParams.get("from") || today;
  if (!isDateKey(from) || from < today) from = today;
  const days = Math.max(1, Math.min(35, Number(url.searchParams.get("days")) || 15));
  const last = addDays(from, days - 1);
  const months = [];
  for (let i = 0; i < days; i++) {
    const m = monthOf(addDays(from, i));
    if (months.indexOf(m) === -1) months.push(m);
  }
  const [settings, docs] = await Promise.all([loadSettings(store), Promise.all(months.map((m) => loadMonth(store, m)))]);
  const taken = [];
  const blocked = {};
  docs.forEach((doc) => {
    Object.values(doc.bookings).forEach((b) => {
      const st = effStatus(b, nowMs);
      if (!isActive(st) || b.date < from || b.date > last) return;
      taken.push({ date: b.date, court: b.court, hours: b.hours, status: st, holdUntil: b.holdUntil });
    });
    Object.keys(doc.blocked).forEach((k) => {
      const d = k.split("|")[0];
      if (doc.blocked[k] && d >= from && d <= last) blocked[k] = true;
    });
  });
  return json({ now: nowMs, today, settings: publicSettings(settings), taken, blocked });
}
async function book(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const b = r.body;
  const store = deps.store;
  const nowMs = deps.now();
  const s = await loadSettings(store);
  const name = cap2(b.name, 60).replace(/\s+/g, " ").trim();
  if (name.length < 2) return fail(400, "Isi nama pemesan (minimal 2 huruf).", "name");
  const phone = normPhone(b.phone);
  if (!validPhone(phone)) return fail(400, "Nomor WhatsApp belum benar. Contoh: 0812 3456 7890.", "phone");
  const court = Number(b.court);
  if (!Number.isInteger(court) || court < 0 || court >= s.courts.length) return fail(400, "Lapangan tidak dikenal.", "court");
  const today = dateKey(nowMs);
  const date = String(b.date || "");
  if (!isDateKey(date) || date < today || date > addDays(today, 60)) return fail(400, "Tanggal tidak valid.", "date");
  let hours = Array.isArray(b.hours) ? b.hours.map(Number) : [];
  hours = hours.filter((h, i) => Number.isInteger(h) && hours.indexOf(h) === i).sort((x, y) => x - y);
  if (!hours.length || hours.length > 12) return fail(400, "Pilih minimal satu jam.", "hours");
  if (hours.some((h) => h < s.openHour || h >= s.closeHour)) return fail(400, "Jam di luar jam buka.", "hours");
  if (date === today && hours.some((h) => h <= wib(nowMs).h)) return fail(409, "Jam yang dipilih sudah lewat. Pilih jam lain.", "past");
  const pend = await loadMonth(store, monthOf(today));
  const pending = Object.values(pend.bookings).filter((x) => x.phone === phone && effStatus(x, nowMs) === "wait").length;
  if (pending >= 3) return fail(429, "Masih ada 3 booking yang belum dibayar untuk nomor ini. Selesaikan atau batalkan dulu.", "limit");
  const id = "b" + nowMs.toString(36) + Math.floor(deps.rand() * 1296).toString(36);
  const month = monthOf(date);
  let code = "";
  for (let t = 0; t < 30 && !code; t++) {
    let c = "GA-";
    for (let i = 0; i < 5; i++) c += CODE_ALPHABET.charAt(Math.floor(deps.rand() * CODE_ALPHABET.length));
    const w = await store.setJSON("c/" + c, { id, month }, { onlyIfNew: true });
    if (w && w.modified) code = c;
  }
  if (!code) return fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  const total = totalOf(date, hours, s);
  const booking = {
    id,
    code,
    name,
    phone,
    court,
    date,
    hours,
    total,
    dpMin: dpMinOf(date, total, s),
    dpPaid: 0,
    status: "wait",
    createdAt: nowMs,
    holdUntil: nowMs + s.holdMinutes * 6e4,
    proof: "",
    proofAt: 0,
    unseen: false,
    tok: randomBytes(18).toString("base64url")
  };
  const res = await cas(store, monthKey(month), emptyMonth, (doc) => {
    doc.bookings = doc.bookings || {};
    doc.blocked = doc.blocked || {};
    if (conflictIn(doc, date, court, hours, nowMs)) return { abort: "conflict" };
    doc.bookings[id] = booking;
    return { ok: true };
  });
  if (!res.ok) {
    await store.delete("c/" + code);
    if (res.abort === "conflict") return fail(409, "Maaf, jam yang kamu pilih baru saja diambil orang lain. Pilih jam lain.", "conflict");
    return fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  }
  await bump(store, deps);
  return json({ booking: custView(booking), token: booking.tok });
}
async function locate(store, code, token) {
  const ref = await refByCode(store, code);
  if (!ref) return { error: fail(404, "Booking tidak ditemukan.", "notfound") };
  const doc = await loadMonth(store, ref.month);
  const b = doc.bookings[ref.id];
  if (!b) return { error: fail(404, "Booking tidak ditemukan.", "notfound") };
  if (!token || !safeEq(token, b.tok)) return { error: fail(403, "Akses ditolak.", "forbidden") };
  return { ref, b };
}
async function ticket(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const l = await locate(deps.store, r.body.code, r.body.token);
  if (l.error) return l.error;
  return json({ booking: custView(l.b), now: deps.now() });
}
async function lookup(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const ref = await refByCode(deps.store, r.body.code);
  const phone = normPhone(r.body.phone);
  const doc = ref ? await loadMonth(deps.store, ref.month) : null;
  const b = doc ? doc.bookings[ref.id] : null;
  if (!b || b.phone !== phone) return fail(404, "Kode booking atau nomor WhatsApp tidak cocok. Periksa lagi, lalu coba cari kembali.", "nomatch");
  return json({ booking: custView(b), token: b.tok, now: deps.now() });
}
async function proof(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const store = deps.store;
  const body = r.body;
  const l = await locate(store, body.code, body.token);
  if (l.error) return l.error;
  const img = String(body.proof || "");
  if (!IMG_RE.test(img) || img.length > 24e5) return fail(400, "Bukti transfer harus berupa foto (JPG atau PNG) yang tidak terlalu besar.", "image");
  const choice = ["min", "half", "full"].indexOf(body.choice) !== -1 ? body.choice : "min";
  const nowMs = deps.now();
  const { ref } = l;
  await store.set("p/" + ref.id, img);
  const res = await cas(store, monthKey(ref.month), emptyMonth, (doc) => {
    const b2 = doc.bookings[ref.id];
    if (!b2) return { abort: "notfound" };
    const st = effStatus(b2, nowMs);
    if (st === "verify" || st === "ok") return { abort: "already" };
    if (st !== "wait") return { abort: "expired" };
    const amt = dpAmounts(b2)[choice];
    b2.status = "verify";
    b2.dpPaid = Math.min(b2.total, Math.max(b2.dpMin, amt));
    b2.proofAt = nowMs;
    b2.unseen = true;
    return { ok: true, snapshot: Object.assign({}, b2) };
  });
  if (!res.ok) {
    if (res.abort === "expired") {
      await store.delete("p/" + ref.id);
      return fail(409, "Waktu pembayaran sudah habis.", "expired");
    }
    if (res.abort === "already") return fail(409, "Bukti transfer sudah dikirim sebelumnya.", "already");
    return fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  }
  await bump(store, deps);
  const b = res.out.snapshot;
  const s = await loadSettings(store);
  await notify(req, deps, s, "\u{1F4B8} Transfer baru masuk\n" + b.code + " \xB7 " + b.name + "\n" + s.courts[b.court].name + " \xB7 " + shortDate(b.date) + " \xB7 " + rangesText(b.hours) + "\nDibayar " + fmtRp(b.dpPaid) + " dari total " + fmtRp(b.total) + " (sisa " + fmtRp(Math.max(0, b.total - b.dpPaid)) + ")\nWA: " + b.phone + "\nMohon cek bukti transfer lalu verifikasi.");
  return json({ booking: custView(b), now: nowMs });
}
async function cancel(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const store = deps.store;
  const l = await locate(store, r.body.code, r.body.token);
  if (l.error) return l.error;
  const nowMs = deps.now();
  const res = await cas(store, monthKey(l.ref.month), emptyMonth, (doc) => {
    const b2 = doc.bookings[l.ref.id];
    if (!b2) return { abort: "notfound" };
    if (!isActive(effStatus(b2, nowMs))) return { abort: "inactive" };
    b2.status = "cancel";
    b2.cancelledBy = "customer";
    b2.cancelledAt = nowMs;
    b2.unseen = true;
    return { ok: true, snapshot: Object.assign({}, b2) };
  });
  if (!res.ok) return res.abort === "inactive" ? fail(409, "Booking ini sudah tidak aktif.", "inactive") : fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  await bump(store, deps);
  const b = res.out.snapshot;
  const s = await loadSettings(store);
  await notify(req, deps, s, "\u26A0\uFE0F Booking dibatalkan pelanggan\n" + b.code + " \xB7 " + b.name + "\n" + s.courts[b.court].name + " \xB7 " + shortDate(b.date) + " \xB7 " + rangesText(b.hours) + "\nJadwal kembali tersedia.");
  return json({ booking: custView(b), now: nowMs });
}
async function image(req, deps, name) {
  if (!/^[a-z0-9-]{3,60}$/.test(name)) return fail(404, "Tidak ditemukan.", "notfound");
  const o = await deps.store.get("img/" + name, { type: "json" });
  if (!o || !o.b64) return fail(404, "Tidak ditemukan.", "notfound");
  return new Response(Buffer.from(o.b64, "base64"), { status: 200, headers: { "content-type": o.type, "cache-control": "public, max-age=31536000, immutable" } });
}
function maskedSettings(s) {
  const o = Object.assign({}, s);
  o.telegramToken = maskSecret(s.telegramToken);
  return o;
}
async function adminState(req, deps) {
  const store = deps.store;
  const url = new URL(req.url);
  const version = await store.get("v", { consistency: "strong" }) || "0";
  if (url.searchParams.get("v") && url.searchParams.get("v") === version) return json({ changed: false, version, now: deps.now() });
  const keys = await listAll(store, "m/");
  const [settings, docs] = await Promise.all([loadSettings(store), Promise.all(keys.map((k) => loadMonth(store, k.slice(2))))]);
  const bookings = [];
  const blocked = {};
  docs.forEach((doc) => {
    Object.values(doc.bookings).forEach((b) => bookings.push(adminView(b)));
    Object.keys(doc.blocked).forEach((k) => {
      if (doc.blocked[k]) blocked[k] = true;
    });
  });
  bookings.sort((a, b) => a.createdAt - b.createdAt);
  return json({ changed: true, version, now: deps.now(), data: { v: 1, settings: maskedSettings(settings), bookings, blocked } });
}
async function adminProof(req, deps) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^b[a-z0-9]{3,40}$/.test(id)) return fail(404, "Tidak ditemukan.", "notfound");
  const p = await deps.store.get("p/" + id, { consistency: "strong" });
  if (!p) return fail(404, "Bukti tidak ada.", "notfound");
  return json({ proof: p });
}
async function storeImages(store, deps, patch) {
  const out = Object.assign({}, patch);
  const put = async (val, tag) => {
    if (typeof val !== "string" || val.indexOf("data:image/") !== 0) return val;
    if (!IMG_RE.test(val) || val.length > 24e5) throw new Error("Foto tidak valid atau terlalu besar.");
    const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(val);
    const name = tag + "-" + deps.now().toString(36) + Math.floor(deps.rand() * 1296).toString(36);
    await store.setJSON("img/" + name, { type: m[1], b64: m[2] });
    return "/api/img/" + name;
  };
  if (out.heroPhoto !== void 0) out.heroPhoto = await put(out.heroPhoto, "hero");
  if (Array.isArray(out.courts)) {
    out.courts = await Promise.all(out.courts.map(async (c, i) => c && typeof c === "object" ? Object.assign({}, c, { photo: await put(c.photo, "court" + i) }) : c));
  }
  return out;
}
var BOOKING_FIELDS = {
  status: (v) => ["wait", "verify", "ok", "rej", "cancel"].indexOf(v) !== -1 ? v : void 0,
  unseen: (v) => !!v,
  verifiedAt: (v) => Math.max(0, Number(v) || 0),
  cancelledBy: (v) => v === "admin" || v === "customer" ? v : void 0,
  cancelledAt: (v) => Math.max(0, Number(v) || 0),
  paidRest: (v) => Math.max(0, Number(v) || 0),
  paidRestAt: (v) => Math.max(0, Number(v) || 0),
  dpForfeit: (v) => v === true || v === false || v === null ? v : void 0,
  dpDecision: (v) => cap2(v, 20),
  dpPaid: (v) => Math.max(0, Number(v) || 0),
  note: (v) => cap2(v, 500),
  rejectedAt: (v) => Math.max(0, Number(v) || 0),
  holdUntil: (v) => Math.max(0, Number(v) || 0)
};
async function adminPatch(req, deps) {
  const r = await readBody(req);
  if (r.error) return r.error;
  const store = deps.store;
  const body = r.body;
  const nowMs = deps.now();
  const skipped = [];
  if (body.resetBookings) {
    for (const p of ["m/", "c/", "p/"]) {
      for (const k of await listAll(store, p)) await store.delete(k);
    }
  }
  if (body.resetSettings) {
    await store.delete("settings");
    for (const k of await listAll(store, "img/")) await store.delete(k);
  }
  if (body.settings && typeof body.settings === "object") {
    let patch;
    try {
      patch = await storeImages(store, deps, body.settings);
    } catch (e) {
      return fail(400, String(e.message || e), "image");
    }
    SECRET_GUARD(patch);
    const res = await cas(store, "settings", () => mergeSettings(defaultSettings(), {}), (cur) => {
      const next = mergeSettings(mergeSettings(defaultSettings(), cur), patch);
      Object.keys(cur).forEach((k) => {
        delete cur[k];
      });
      Object.assign(cur, next);
    });
    if (!res.ok) return fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  }
  const perMonth = {};
  (Array.isArray(body.bookings) ? body.bookings : []).forEach((it) => {
    if (!it || typeof it.id !== "string" || !/^\d{4}-\d{2}$/.test(String(it.month))) return;
    (perMonth[it.month] = perMonth[it.month] || { set: [], blocked: {} }).set.push(it);
  });
  const blockedIn = body.blocked && typeof body.blocked === "object" ? body.blocked : {};
  Object.keys(blockedIn).forEach((k) => {
    const m = /^(\d{4}-\d{2})-\d{2}\|\d+\|\d+$/.exec(k);
    if (m) (perMonth[m[1]] = perMonth[m[1]] || { set: [], blocked: {} }).blocked[k] = !!blockedIn[k];
  });
  for (const ym of Object.keys(perMonth)) {
    const job = perMonth[ym];
    const res = await cas(store, monthKey(ym), emptyMonth, (doc) => {
      doc.bookings = doc.bookings || {};
      doc.blocked = doc.blocked || {};
      job.set.forEach((it) => {
        const b = doc.bookings[it.id];
        if (!b || !it.set || typeof it.set !== "object") return;
        const before = effStatus(b, nowMs);
        const draft = Object.assign({}, b);
        Object.keys(it.set).forEach((f) => {
          if (!BOOKING_FIELDS[f]) return;
          const v = BOOKING_FIELDS[f](it.set[f]);
          if (v !== void 0) draft[f] = v;
        });
        const after = effStatus(draft, nowMs);
        if (!isActive(before) && isActive(after) && conflictIn(doc, b.date, b.court, b.hours, nowMs, b.id)) {
          skipped.push({ id: b.id, reason: "conflict" });
          return;
        }
        doc.bookings[it.id] = draft;
      });
      Object.keys(job.blocked).forEach((k) => {
        if (job.blocked[k]) doc.blocked[k] = true;
        else delete doc.blocked[k];
      });
    });
    if (!res.ok) return fail(503, "Sistem sedang sibuk. Coba lagi sebentar.", "busy");
  }
  await bump(store, deps);
  const version = await store.get("v", { consistency: "strong" }) || "0";
  return json({ ok: true, version, skipped });
}
function SECRET_GUARD(patch) {
  SECRET_KEYS.forEach((k) => {
    if (patch[k] !== void 0 && isMasked(patch[k])) delete patch[k];
  });
}
async function adminNotifyTest(req, deps) {
  const s = await loadSettings(deps.store);
  if (!s.telegramToken || !s.telegramChatId) return fail(400, "Isi Token bot Telegram dan ID chat dulu, lalu simpan.", "not_configured");
  const r = await telegramSend(deps.fetchFn, s.telegramToken, s.telegramChatId, "\u2705 Tes notifikasi " + s.name + ". Jika pesan ini masuk, notifikasi booking akan dikirim ke sini.");
  if (r.ok) return json({ ok: true });
  return fail(502, "Telegram menolak: " + (r.detail || r.reason) + ". Periksa token dan ID chat.", "telegram");
}
async function handle(req, deps) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  const m = req.method.toUpperCase();
  try {
    if (path === "/health" && m === "GET") return await health(req, deps);
    if (path === "/public" && m === "GET") return await publicState(req, deps);
    if (path === "/book" && m === "POST") return await book(req, deps);
    if (path === "/ticket" && m === "POST") return await ticket(req, deps);
    if (path === "/lookup" && m === "POST") return await lookup(req, deps);
    if (path === "/proof" && m === "POST") return await proof(req, deps);
    if (path === "/cancel" && m === "POST") return await cancel(req, deps);
    if (path.indexOf("/img/") === 0 && m === "GET") return await image(req, deps, path.slice(5));
    if (path.indexOf("/admin/") === 0) {
      const key = req.headers.get("x-admin-key") || "";
      if (!deps.adminKey || !key || !safeEq(key.toLowerCase(), String(deps.adminKey).toLowerCase())) return fail(401, "Akses admin ditolak.", "unauthorized");
      if (path === "/admin/ping" && m === "GET") return json({ ok: true });
      if (path === "/admin/state" && m === "GET") return await adminState(req, deps);
      if (path === "/admin/proof" && m === "GET") return await adminProof(req, deps);
      if (path === "/admin/patch" && m === "POST") return await adminPatch(req, deps);
      if (path === "/admin/notify-test" && m === "POST") return await adminNotifyTest(req, deps);
    }
    return fail(404, "Tidak ditemukan.", "notfound");
  } catch (e) {
    console.error("api error", path, e && e.stack ? e.stack : e);
    return fail(500, "Terjadi kesalahan di server. Coba lagi.", "server");
  }
}


export async function handleRequest(req) {
  return handle(req, {
    store: openStore(),
    now: () => Date.now(),
    rand: Math.random,
    adminKey: process.env.ADMIN_KEY || "",
    fetchFn: fetch,
    waitUntil: null
  });
}
