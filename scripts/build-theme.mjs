// Memilih tema berdasarkan env THEME (set per proyek Vercel) dan menulis public/assets/theme.css.
// Pakai:  THEME=deep-navy-cyan node scripts/build-theme.mjs [folder-public]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "public");

// bg: warna dasar | glow: gradasi latar (CSS) | acc: aksen | onacc: teks di atas aksen
const T = {
  "midnight-emerald": { name: "Midnight Emerald Glass", light: true, acc: "#C9F23C", onacc: "#0C2B20", bg: "#F5F3EC", ov: "5,18,12", dk: "#0C2B20", glow: "" },
  "deep-navy-cyan":   { name: "Deep Navy Cyan",         acc: "#35D8F5", onacc: "#04202B", bg: "#050E1C", ov: "5,14,28", glow: "radial-gradient(900px 520px at 85% 8%,rgba(40,140,230,.22),transparent 60%),radial-gradient(700px 480px at 5% 55%,rgba(20,200,240,.10),transparent 60%)" },
  "obsidian-gold":    { name: "Obsidian Gold Luxe",     acc: "#E9B24C", onacc: "#241700", bg: "#0A0907", ov: "10,9,7", glow: "radial-gradient(800px 500px at 88% 10%,rgba(233,178,76,.14),transparent 60%),radial-gradient(700px 500px at 0% 60%,rgba(233,178,76,.07),transparent 60%)" },
  "aurora-sport-glow":{ name: "Aurora Sport Glow",      acc: "#5CF2A8", onacc: "#04231A", bg: "#061318", ov: "6,19,24", glow: "radial-gradient(700px 520px at 18% 12%,rgba(60,240,170,.30),transparent 62%),radial-gradient(760px 560px at 82% 30%,rgba(40,160,255,.24),transparent 62%),radial-gradient(800px 600px at 45% 75%,rgba(150,90,255,.18),transparent 65%)" },
  "royal-violet-night":{name: "Royal Violet Night",     acc: "#C07BFF", onacc: "#1B0A30", bg: "#0C0614", ov: "12,6,20", glow: "radial-gradient(800px 560px at 85% 8%,rgba(150,70,255,.28),transparent 62%),radial-gradient(700px 520px at 0% 60%,rgba(220,90,255,.12),transparent 62%)" },
  "carbon-fiber-frost":{name: "Carbon Fiber Frost",     acc: "#62AEFF", onacc: "#04182E", bg: "#0C0E11", ov: "12,14,17", glow: "radial-gradient(800px 480px at 85% 6%,rgba(110,170,255,.16),transparent 60%),repeating-linear-gradient(45deg,rgba(255,255,255,.018) 0 2px,transparent 2px 6px)" },
  "crimson-arena-glass":{name: "Crimson Arena Glass",   acc: "#FF6262", onacc: "#2B0606", bg: "#10060A", ov: "16,6,10", glow: "radial-gradient(800px 520px at 88% 8%,rgba(255,60,60,.24),transparent 60%),radial-gradient(700px 520px at 0% 62%,rgba(200,30,60,.12),transparent 62%)" },
  "arctic-ice-dark":  { name: "Arctic Ice Dark",        acc: "#7BF3D6", onacc: "#03231F", bg: "#05181B", ov: "5,24,27", glow: "radial-gradient(800px 520px at 85% 8%,rgba(120,240,225,.20),transparent 60%),radial-gradient(700px 500px at 0% 55%,rgba(90,190,255,.10),transparent 60%)" },
  "solar-flare-dark": { name: "Solar Flare Dark",       acc: "#FFA03A", onacc: "#2B1400", bg: "#110A04", ov: "17,10,4", glow: "radial-gradient(800px 520px at 88% 8%,rgba(255,140,40,.24),transparent 60%),radial-gradient(700px 500px at 0% 60%,rgba(255,90,30,.10),transparent 62%)" },
  "minimal-smoked-glass":{name:"Minimal Smoked Glass",  acc: "#F2F2F2", onacc: "#101010", bg: "#09090A", ov: "9,9,10", glow: "radial-gradient(800px 480px at 85% 6%,rgba(255,255,255,.07),transparent 60%)" },
};

const id = (process.env.THEME || "midnight-emerald").trim().toLowerCase();
const t = T[id];
if (!t) { console.error("THEME tidak dikenal: " + id + ". Pilihan: " + Object.keys(T).join(", ")); process.exit(1); }

const light = !!t.light;
const v = light ? {
  bg: t.bg, bg2: "#FFFFFF", ring: t.bg, glass: "#FFFFFF", glass2: t.bg, line: "#E3E0D5", line2: "#8A968D",
  tx: "#10261C", tx2: "#3F5247", tx3: "#6B786F", dk: t.dk, dk2: "#133A2B", dk0: "#06160F",
  dim: "#E4E1D8", btn: "#0C2B20", btnfg: t.acc, btnbd: "#0C2B20", pill: "#0C2B20", pillbd: "#0C2B20",
  errtx: "#8A1F15", errbg: "#FAD4D0", warntx: "#4F3A00", warnbg: "#FFE9A8", oktx: "#0F4A2A", okbg: "#CDEFD9", errsolid: "#8A1F15",
  accent: "#1F6B45", onacc: t.onacc, ov: t.ov, labelAcc: "#1F6B45",
} : {
  bg: t.glow ? "transparent" : t.bg, bg2: "rgba(255,255,255,.025)", ring: t.bg, glass: "rgba(255,255,255,.055)", glass2: "rgba(255,255,255,.09)",
  line: "rgba(255,255,255,.11)", line2: "rgba(255,255,255,.28)", tx: "#EEF4F1", tx2: "rgba(238,244,241,.74)", tx3: "rgba(238,244,241,.46)",
  dk: "rgba(4,8,10,.55)", dk2: "rgba(255,255,255,.06)", dk0: t.bg, dim: "rgba(255,255,255,.045)",
  btn: "color-mix(in srgb," + t.acc + " 16%,transparent)", btnfg: t.acc, btnbd: "color-mix(in srgb," + t.acc + " 50%,transparent)",
  pill: "color-mix(in srgb," + t.acc + " 15%,transparent)", pillbd: "color-mix(in srgb," + t.acc + " 38%,transparent)",
  errtx: "#FF9D92", errbg: "rgba(255,90,70,.16)", warntx: "#FFD983", warnbg: "rgba(255,200,70,.15)", oktx: "#8BE3B0", okbg: "rgba(60,200,120,.16)", errsolid: "#C62E22",
  accent: t.acc, onacc: t.onacc, ov: t.ov, labelAcc: t.acc,
};

const vars = Object.entries({
  accent: v.accent, fill: t.acc, onacc: v.onacc, bg: v.bg, bg2: v.bg2, ring: v.ring, glass: v.glass, glass2: v.glass2, line: v.line, line2: v.line2,
  tx: v.tx, tx2: v.tx2, tx3: v.tx3, dk: v.dk, dk2: v.dk2, dk0: v.dk0, ov: v.ov, dim: v.dim,
  btn: v.btn, btnfg: v.btnfg, btnbd: v.btnbd, pill: v.pill, pillbd: v.pillbd,
  "err-tx": v.errtx, "err-bg": v.errbg, "warn-tx": v.warntx, "warn-bg": v.warnbg, "ok-tx": v.oktx, "ok-bg": v.okbg, "err-solid": v.errsolid,
}).map(([k, val]) => "--" + k + ":" + val + ";").join("");

let css = "/* tema: " + t.name + " (" + id + ") - dibuat oleh scripts/build-theme.mjs */\n:root{" + vars + "color-scheme:" + (light ? "light" : "dark") + "}\n";
if (light) {
  // bagian gelap (header, hero, harga, kontak) tetap memakai teks terang
  css += "header,.hero,#harga,#kontak{--tx:#F3F5EE;--tx2:#C3D2C8;--tx3:#A9BDB1;--accent:" + t.acc + ";--line:#2A5C46;--line2:#5E8C75}\n";
}
if (!light) {
  css += "html,body{background:" + t.bg + "}\n";
  if (t.glow) css += "#top{background:" + t.glow + "," + t.bg + " !important;background-attachment:fixed,fixed,fixed,fixed !important}\n";
  css += "[style*='background:var(--glass)'],[style*='background:var(--glass2)'],[style*='background:var(--dk)'],[style*='background:var(--bg2)']{-webkit-backdrop-filter:blur(18px) saturate(150%);backdrop-filter:blur(18px) saturate(150%)}\n";
  css += "[style*='background:var(--glass)'],[style*='background:var(--glass2)']{box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 10px 30px rgba(0,0,0,.28)}\n";
  css += "@media(min-width:900px){header[style*='background:var(--dk)']{position:sticky;top:0;z-index:50;border-bottom:1px solid var(--line)}}\n";
  css += "input,select,textarea{color-scheme:dark}\ninput::placeholder{color:var(--tx3)}\n";
  css += ".court-card:hover,.step-card:hover{box-shadow:0 18px 40px rgba(0,0,0,.45),0 0 0 1px var(--line2)}\n";
  css += ".btn:hover{filter:brightness(1.12)}\n";
}
css += "a[style*='color:var(--accent)']{text-underline-offset:3px}\n";
css += "[style*='background:var(--fill)']{--accent:var(--onacc);--tx:var(--onacc);--tx2:color-mix(in srgb,var(--onacc) 82%,transparent);--tx3:color-mix(in srgb,var(--onacc) 62%,transparent);--ok-tx:var(--onacc);--err-tx:var(--onacc);--warn-tx:var(--onacc)}\n";
css += "[style*='background:var(--fill)']{--accent:var(--onacc);--tx:var(--onacc);--tx2:color-mix(in srgb,var(--onacc) 82%,transparent);--tx3:color-mix(in srgb,var(--onacc) 62%,transparent);--ok-tx:var(--onacc);--err-tx:var(--onacc);--warn-tx:var(--onacc)}\n";

fs.mkdirSync(path.join(pub, "assets"), { recursive: true });
fs.writeFileSync(path.join(pub, "assets", "theme.css"), css);

// ubah <meta theme-color> di halaman pelanggan
const f = path.join(pub, "index.html");
if (fs.existsSync(f)) {
  let h = fs.readFileSync(f, "utf8");
  h = h.replace(/<meta name="theme-color" content="[^"]*">/, '<meta name="theme-color" content="' + (light ? t.dk : t.bg) + '">');
  fs.writeFileSync(f, h);
}
console.log("Tema aktif: " + t.name + " (" + id + ")");
