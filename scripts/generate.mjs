// Genera las tarjetas holográficas del perfil (sin dependencias, Node 20+):
//   assets/hero.svg     → avatar en anillos holográficos + nombre + ciclo de agente RAG animado
//   assets/activity.svg → año de contribuciones en radar radial + anillos de lenguajes + rachas
//   assets/stack.svg    → stack de IA / backend / devops como hologramas
// Uso: node scripts/generate.mjs   (GITHUB_TOKEN opcional; en Actions se usa el del workflow)
import { writeFileSync, mkdirSync, rmSync } from "node:fs";

const USER = "HumbleG0d";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = new URL("../assets/", import.meta.url);

const C = {
  bg: "#070b14", cyan: "#7dcfff", blue: "#7aa2f7", purple: "#bb9af7", green: "#9ece6a",
  orange: "#ff9e64", text: "#c0caf5", dim: "#565f89",
};
const SANS = "'Segoe UI','Inter','Helvetica Neue',system-ui,sans-serif";
const MONO = "'JetBrains Mono','Fira Code',Consolas,monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HEADERS = { "User-Agent": "profile-card-generator", ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) };
const f1 = (n) => +n.toFixed(1);

// ── Datos ───────────────────────────────────────────────────────────────────
async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, { headers: HEADERS });
  if (!r.ok) throw new Error(`GitHub API ${path}: ${r.status}`);
  return r.json();
}

// Calendario de contribuciones: GraphQL con token; sin token, la página pública.
async function calendar() {
  if (TOKEN) {
    const query = `query($l:String!){user(login:$l){contributionsCollection{contributionCalendar{
      weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
    const r = await fetch("https://api.github.com/graphql", {
      method: "POST", headers: HEADERS, body: JSON.stringify({ query, variables: { l: USER } }),
    });
    const weeks = (await r.json())?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
    if (weeks) {
      const LV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
      return weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount, level: LV[d.contributionLevel] ?? 0 })));
    }
  }
  const html = await (await fetch(`https://github.com/users/${USER}/contributions`, { headers: { "User-Agent": HEADERS["User-Agent"] } })).text();
  const counts = {};
  for (const m of html.matchAll(/for="(contribution-day-component-\d+-\d+)"[^>]*>([^<]*)/g)) {
    const n = m[2].match(/^(\d+) contribution/);
    counts[m[1]] = n ? +n[1] : 0;
  }
  const days = [];
  for (const m of html.matchAll(/data-date="([\d-]+)" id="(contribution-day-component-\d+-\d+)" data-level="(\d)"/g)) {
    days.push({ date: m[1], level: +m[3], count: counts[m[2]] ?? 0 });
  }
  return days.sort((a, b) => a.date.localeCompare(b.date));
}

function dayStats(days) {
  let best = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; best = Math.max(best, run); }
  let cur = 0, i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--; // hoy aún puede no tener contribuciones
  for (; i >= 0 && days[i].count > 0; i--) cur++;
  const byWd = Array(7).fill(0);
  for (const d of days) byWd[new Date(d.date + "T00:00:00Z").getUTCDay()] += d.count;
  const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const peak = days.reduce((a, d) => (d.count > a.count ? d : a), { count: 0, date: "" });
  const fmt = (s) => new Date(s + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return {
    total: days.reduce((s, d) => s + d.count, 0), cur, best,
    favDay: WD[byWd.indexOf(Math.max(...byWd))],
    peak: peak.count ? `${peak.count} on ${fmt(peak.date)}` : "—",
  };
}

async function languages(repos) {
  const total = {};
  await Promise.all(repos.map(async (r) => {
    try { for (const [l, b] of Object.entries(await gh(`/repos/${USER}/${r.name}/languages`))) total[l] = (total[l] || 0) + b; } catch {}
  }));
  const sum = Object.values(total).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([l, b]) => ({ l, p: b / sum }));
}
const LANG_COLOR = {
  Python: "#7dcfff", HTML: "#ff9e64", C: "#bb9af7", TypeScript: "#7aa2f7", Java: "#e0af68",
  JavaScript: "#e0af68", "Jupyter Notebook": "#ff9e64", CSS: "#bb9af7", Shell: "#9ece6a",
};
const RING_COLORS = [C.cyan, C.purple, C.orange, C.green];

async function avatar() {
  const r = await fetch(`https://avatars.githubusercontent.com/${USER}?size=200`);
  return `data:${r.headers.get("content-type") || "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
}

// ── Piezas comunes ──────────────────────────────────────────────────────────
const commonDefs = (W, H, cx, cy) => `
  <radialGradient id="bgGlow" cx="${cx}" cy="${cy}" r="85%"><stop offset="0" stop-color="#0f2a44"/><stop offset="1" stop-color="${C.bg}"/></radialGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${C.cyan}" opacity="0.06"/></pattern>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="bigglow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath>`;
const commonCss = `
  .scan{animation:scanmove 1.2s linear infinite}
  @keyframes scanmove{to{transform:translateY(4px)}}`;
const shell = (W, H, defs, css, body, glow = ["30%", "50%"]) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${SANS}">
<defs>${commonDefs(W, H, ...glow)}${defs}</defs>
<style>${commonCss}${css}</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${body}
  <rect class="scan" y="-4" width="${W}" height="${H + 8}" fill="url(#scan)"/>
</g>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="18" fill="none" stroke="${C.cyan}" stroke-opacity="0.4" stroke-width="1.5" filter="url(#glow)"/>
</svg>`;
const label = (x, y, t, anchor = "start") =>
  `<text x="${x}" y="${y}" font-size="11" font-weight="700" letter-spacing="3" fill="${C.purple}" text-anchor="${anchor}">${esc(t)}</text>`;

// ── 1. HERO: avatar holográfico + nombre + ciclo de agente ──────────────────
function hero(info) {
  const W = 940, H = 300;
  const ax = 128, ay = 150, ar = 74;

  // Avatar dentro de anillos que giran en sentidos opuestos
  const av = `
  <circle cx="${ax}" cy="${ay}" r="${ar + 6}" fill="${C.cyan}" opacity="0.12" filter="url(#bigglow)"/>
  <g clip-path="url(#avclip)">
    <image href="${info.avatar}" x="${ax - ar}" y="${ay - ar}" width="${ar * 2}" height="${ar * 2}" preserveAspectRatio="xMidYMid slice"/>
    <rect x="${ax - ar}" y="${ay - ar}" width="${ar * 2}" height="${ar * 2}" fill="${C.cyan}" opacity="0.1"/>
    <rect class="scan" x="${ax - ar}" y="${ay - ar - 4}" width="${ar * 2}" height="${ar * 2 + 8}" fill="url(#scan)"/>
  </g>
  <circle cx="${ax}" cy="${ay}" r="${ar}" fill="none" stroke="${C.cyan}" stroke-width="1.5" filter="url(#glow)"/>
  <g class="spin"><circle cx="${ax}" cy="${ay}" r="${ar + 14}" fill="none" stroke="${C.cyan}" stroke-opacity="0.7" stroke-width="1.2" stroke-dasharray="3 9"/></g>
  <g class="spinr"><circle cx="${ax}" cy="${ay}" r="${ar + 26}" fill="none" stroke="${C.purple}" stroke-opacity="0.8" stroke-width="2" stroke-dasharray="70 40 12 40" stroke-linecap="round" filter="url(#glow)"/></g>
  <g class="spin" style="animation-duration:7s"><circle cx="${ax}" cy="${ay - ar - 26}" r="4" fill="${C.cyan}" filter="url(#glow)"/></g>`;

  // Nombre con glitch y datos
  const tx = 262;
  const name = `
  <g font-size="54" font-weight="800" letter-spacing="1">
    <text class="gl1" x="${tx}" y="122" fill="${C.orange}" opacity="0.55">HumbleG0d</text>
    <text class="gl2" x="${tx}" y="122" fill="${C.blue}" opacity="0.55">HumbleG0d</text>
    <text x="${tx}" y="122" fill="url(#nameGrad)" filter="url(#glow)">HumbleG0d</text>
  </g>
  <text x="${tx + 2}" y="154" font-size="13" font-weight="700" letter-spacing="4" fill="${C.cyan}">AI ENGINEER · AGENTS · RAG</text>
  <text x="${tx + 2}" y="178" font-size="13" fill="${C.dim}">Computer Science Student · ${esc(info.location)}</text>`;
  const chips = [[info.repos, "repos"], [info.stars, "stars"], [info.followers, "followers"], [info.total, "contribs"]];
  let cx = tx, chipsSvg = "";
  for (const [v, k] of chips) {
    const w = 22 + String(v).length * 9 + k.length * 7;
    chipsSvg += `<g><rect x="${cx}" y="204" width="${w}" height="30" rx="15" fill="${C.cyan}" fill-opacity="0.07" stroke="${C.cyan}" stroke-opacity="0.35"/>
      <text x="${cx + 12}" y="224" font-size="13"><tspan fill="${C.text}" font-weight="700" font-family="${MONO}">${v}</tspan><tspan fill="${C.dim}"> ${k}</tspan></text></g>`;
    cx += w + 10;
  }

  // Ciclo de agente: 6 nodos sobre una elipse, paquetes de datos circulando
  const ex = 760, ey = 150, rx = 112, ry = 84;
  const steps = ["query", "embed", "retrieve", "reason", "act", "answer"];
  const loop = `M ${ex} ${ey - ry} A ${rx} ${ry} 0 1 1 ${ex} ${ey + ry} A ${rx} ${ry} 0 1 1 ${ex} ${ey - ry}`;
  let graph = `
  <path d="${loop}" fill="none" stroke="${C.cyan}" stroke-opacity="0.22" stroke-width="1.5"/>
  <path d="${loop}" fill="none" stroke="${C.cyan}" stroke-opacity="0.6" stroke-width="1.5" stroke-dasharray="4 10" class="flow"/>
  <circle cx="${ex}" cy="${ey}" r="30" fill="${C.purple}" opacity="0.12" class="core" filter="url(#bigglow)"/>
  <circle cx="${ex}" cy="${ey}" r="22" fill="none" stroke="${C.purple}" stroke-opacity="0.6"/>
  <text x="${ex}" y="${ey + 4}" text-anchor="middle" font-size="10" font-weight="700" letter-spacing="2" fill="${C.purple}">AGENT</text>`;
  steps.forEach((s, k) => {
    const a = (-90 + k * 60) * Math.PI / 180;
    const nx = ex + rx * Math.cos(a), ny = ey + ry * Math.sin(a);
    graph += `<line x1="${ex}" y1="${ey}" x2="${f1(nx)}" y2="${f1(ny)}" stroke="${C.purple}" stroke-opacity="0.12" stroke-dasharray="2 4"/>`;
    const lx = ex + (rx + 26) * Math.cos(a), ly = ey + (ry + 22) * Math.sin(a) + 4;
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    graph += `
    <circle cx="${f1(nx)}" cy="${f1(ny)}" r="13" fill="${C.bg}" stroke="${C.cyan}" stroke-width="1.5" filter="url(#glow)"/>
    <circle cx="${f1(nx)}" cy="${f1(ny)}" r="5" fill="${C.cyan}" class="pulse" style="animation-delay:${(k * 0.6).toFixed(1)}s"/>
    <text x="${f1(lx)}" y="${f1(ly)}" text-anchor="${anchor}" font-size="11.5" font-family="${MONO}" fill="${C.text}">${s}</text>`;
  });
  for (let p = 0; p < 3; p++) {
    graph += `<circle r="4" fill="#ffffff" filter="url(#glow)"><animateMotion dur="7.2s" repeatCount="indefinite" begin="-${(p * 2.4).toFixed(1)}s" path="${loop}"/></circle>`;
  }

  const defs = `
  <linearGradient id="nameGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  <clipPath id="avclip"><circle cx="${ax}" cy="${ay}" r="${ar}"/></clipPath>`;
  const css = `
  .spin{transform-origin:${ax}px ${ay}px;animation:spin 14s linear infinite}
  .spinr{transform-origin:${ax}px ${ay}px;animation:spin 20s linear infinite reverse}
  @keyframes spin{to{transform:rotate(360deg)}}
  .gl1{animation:g1 4s steps(1) infinite}.gl2{animation:g2 4s steps(1) infinite}
  @keyframes g1{0%,100%{transform:translate(-2px,0)}91%{transform:translate(-7px,-2px)}93%{transform:translate(3px,1px)}95%{transform:translate(-2px,0)}}
  @keyframes g2{0%,100%{transform:translate(2px,0)}91%{transform:translate(7px,2px)}93%{transform:translate(-3px,-1px)}95%{transform:translate(2px,0)}}
  .flow{animation:flow 1.5s linear infinite}@keyframes flow{to{stroke-dashoffset:-28}}
  .pulse{animation:pulse 3.6s ease-in-out infinite}@keyframes pulse{0%,100%{opacity:.35}15%{opacity:1}}
  .core{transform-origin:${ex}px ${ey}px;animation:core 3s ease-in-out infinite}@keyframes core{50%{transform:scale(1.25);opacity:.25}}`;
  return shell(W, H, defs, css, av + name + chipsSvg + graph, ["15%", "50%"]);
}

// ── 2. ACTIVIDAD: radar radial + anillos de lenguajes + rachas ──────────────
function activity(info) {
  const W = 940, H = 380, cx = 200, cy = 190, r0 = 62, rMax = 72;
  const days = info.days, N = days.length || 1;
  const max = Math.max(1, ...days.map((d) => d.count));
  const OP = [0.2, 0.45, 0.65, 0.85, 1];
  let rays = "", months = "";
  days.forEach((d, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N, cos = Math.cos(a), sin = Math.sin(a);
    if (d.count) {
      const len = 6 + rMax * Math.sqrt(d.count / max);
      rays += `<line x1="${f1(cx + r0 * cos)}" y1="${f1(cy + r0 * sin)}" x2="${f1(cx + (r0 + len) * cos)}" y2="${f1(cy + (r0 + len) * sin)}" stroke="${C.cyan}" stroke-opacity="${OP[d.level]}"/>`;
    } else {
      rays += `<circle cx="${f1(cx + (r0 + 3) * cos)}" cy="${f1(cy + (r0 + 3) * sin)}" r="0.9" fill="${C.cyan}" opacity="0.3"/>`;
    }
    if (d.date.endsWith("-01")) {
      const m = new Date(d.date + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }).toUpperCase();
      months += `<text x="${f1(cx + (r0 + rMax + 20) * cos)}" y="${f1(cy + (r0 + rMax + 20) * sin + 3.5)}" text-anchor="middle" font-size="9.5" letter-spacing="1" fill="${C.dim}">${m}</text>`;
    }
  });
  const R = r0 + rMax + 10;
  const radial = `
  <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${C.cyan}" stroke-opacity="0.1"/>
  <circle cx="${cx}" cy="${cy}" r="${r0 + rMax / 2}" fill="none" stroke="${C.cyan}" stroke-opacity="0.06" stroke-dasharray="2 5"/>
  <g class="radar"><path d="M ${cx} ${cy} L ${cx} ${cy - R} A ${R} ${R} 0 0 1 ${f1(cx + R * Math.sin(0.55))} ${f1(cy - R * Math.cos(0.55))} Z" fill="url(#radarGrad)"/>
    <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - R}" stroke="${C.cyan}" stroke-opacity="0.7" filter="url(#glow)"/></g>
  <g stroke-width="2.2" stroke-linecap="round" filter="url(#glow)">${rays}</g>
  ${months}
  <circle cx="${cx}" cy="${cy}" r="${r0 - 10}" fill="${C.bg}" fill-opacity="0.7" stroke="${C.cyan}" stroke-opacity="0.3"/>
  <text x="${cx}" y="${cy + 6}" text-anchor="middle" font-size="34" font-weight="800" fill="url(#numGrad)" filter="url(#glow)">${info.total}</text>
  <text x="${cx}" y="${cy + 26}" text-anchor="middle" font-size="9.5" letter-spacing="2" fill="${C.dim}">CONTRIBUTIONS</text>`;

  // Anillos de lenguajes (se dibujan al cargar)
  const lx = 520, ly = 190;
  let rings = "";
  info.langs.forEach(({ p }, k) => {
    const r = 116 - k * 24, circ = 2 * Math.PI * r, len = Math.max(p, 0.02) * circ, col = RING_COLORS[k];
    rings += `<circle cx="${lx}" cy="${ly}" r="${r}" fill="none" stroke="${col}" stroke-opacity="0.1" stroke-width="14"/>
    <circle cx="${lx}" cy="${ly}" r="${r}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${f1(len)} ${f1(circ)}" transform="rotate(-90 ${lx} ${ly})" filter="url(#glow)">
      <animate attributeName="stroke-dashoffset" from="${f1(len)}" to="0" dur="1.6s" begin="${(0.2 + k * 0.2).toFixed(1)}s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.2 1" keyTimes="0;1"/>
    </circle>`;
  });
  const top = info.langs[0];
  rings += top ? `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="22" font-weight="800" fill="${C.text}">${Math.round(top.p * 100)}%</text>
    <text x="${lx}" y="${ly + 20}" text-anchor="middle" font-size="9.5" letter-spacing="1.5" fill="${C.dim}">${esc(top.l.toUpperCase())}</text>` : "";

  // Columna de datos
  const sx = 690;
  let side = label(sx, 62, "LANGUAGES");
  info.langs.forEach(({ l, p }, k) => {
    const y = 90 + k * 24;
    side += `<circle cx="${sx + 5}" cy="${y - 4}" r="5" fill="${RING_COLORS[k]}" filter="url(#glow)"/>
      <text x="${sx + 18}" y="${y}" font-size="13.5" fill="${C.text}">${esc(l)}</text>
      <text x="${W - 40}" y="${y}" font-size="13" text-anchor="end" font-family="${MONO}" fill="${C.dim}">${(p * 100).toFixed(1)}%</text>`;
  });
  side += label(sx, 222, "RHYTHM");
  [["Current streak", `${info.cur} days`], ["Best streak", `${info.best} days`], ["Favorite day", info.favDay], ["Record", info.peak]]
    .forEach(([k, v], j) => {
      const y = 250 + j * 24;
      side += `<text x="${sx}" y="${y}" font-size="13.5" fill="${C.dim}">${k}</text>
        <text x="${W - 40}" y="${y}" font-size="13.5" text-anchor="end" font-weight="700" fill="${C.text}">${esc(v)}</text>`;
    });
  side += `<line x1="${sx - 26}" y1="48" x2="${sx - 26}" y2="${H - 48}" stroke="${C.cyan}" stroke-opacity="0.15"/>`;

  const defs = `
  <radialGradient id="radarGrad" cx="${cx}" cy="${cy}" r="${R}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0.22"/></radialGradient>
  <linearGradient id="numGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.cyan}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>`;
  const css = `
  .radar{transform-origin:${cx}px ${cy}px;animation:spin 6s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}`;
  return shell(W, H, defs, css, radial + rings + side, ["20%", "50%"]);
}

// ── 3. Stack holográfico ────────────────────────────────────────────────────
const SI = "https://cdn.jsdelivr.net/npm/simple-icons@16.37.0/icons";
// Glifos propios (viewBox 24x24) para lo que no tiene logo en simple-icons
const GLYPH = {
  rag: `<g fill="none" stroke="${C.purple}" stroke-width="1.8" stroke-linecap="round"><ellipse cx="10" cy="5" rx="7" ry="2.6"/><path d="M3 5v10c0 1.4 3.1 2.6 7 2.6M3 10c0 1.4 3.1 2.6 7 2.6M17 5v4.5"/><circle cx="17" cy="15.5" r="3.6"/><path d="M19.6 18.1 23 21.5"/></g>`,
  chroma: `<g opacity="0.92"><circle cx="8.5" cy="14.5" r="6" fill="#ffde2d" fill-opacity="0.85"/><circle cx="15.5" cy="14.5" r="6" fill="#ff6446" fill-opacity="0.8"/><circle cx="12" cy="8.5" r="6" fill="#327eff" fill-opacity="0.8"/></g>`,
};
const STACK = [
  [{ title: "AI ENGINEERING", items: [
    ["Python", "python", "#4b8bbe"], ["LangChain", "langchain", "#7fc8ff"], ["LangGraph", "langgraph", "#7fc8ff"],
    ["RAG", { glyph: "rag" }], ["ChromaDB", { glyph: "chroma" }], ["MCP", "modelcontextprotocol"],
    ["Ollama", "ollama"], ["Hugging Face", "huggingface", "#ffd21e"],
  ]}],
  [{ title: "BACKEND", items: [
    ["Java", "openjdk", "#e76f00"], ["Spring", "spring", "#6db33f"], ["PostgreSQL", "postgresql", "#6c9bd2"],
    ["Docker", "docker", "#2496ed"], ["React", "react", "#61dafb"],
  ]}, { title: "DEVOPS", items: [
    ["Jenkins", "jenkins", "#e36a5c"], ["Actions", "githubactions", "#2088ff"], ["Postman", "postman", "#ff6c37"],
  ]}],
];

async function iconInner(src, color) {
  if (typeof src === "object") return GLYPH[src.glyph];
  const r = await fetch(`${SI}/${src}.svg`);
  if (!r.ok) throw new Error(`icono ${src}: ${r.status}`);
  const d = (await r.text()).match(/<path d="([^"]+)"/)[1];
  return `<path d="${d}" fill="${color ?? C.cyan}"/>`; // logos negros → cian holograma
}

async function stack() {
  const W = 940, CELL = 108, ROWH = 168, PADX = 32;
  let y = 26, n = 0, body = "";
  for (const row of STACK) {
    const count = row.reduce((a, s) => a + s.items.length, 0) + (row.length - 1) * 0.6;
    let x = (W - count * CELL) / 2;
    for (const [si, sec] of row.entries()) {
      if (si) {
        body += `<line x1="${x + CELL * 0.3}" y1="${y + 40}" x2="${x + CELL * 0.3}" y2="${y + ROWH - 4}" stroke="${C.cyan}" stroke-opacity="0.2" stroke-dasharray="2 4"/>`;
        x += CELL * 0.6;
      }
      body += label(Math.max(PADX, x + 10), y + 16, sec.title);
      for (const [name, src, color] of sec.items) {
        const cx = x + CELL / 2, baseY = y + 150, d = (n++ * 0.27) % 3;
        const inner = await iconInner(src, color);
        body += `
<g>
  <polygon points="${cx - 20},${baseY} ${cx + 20},${baseY} ${cx + 38},${baseY - 104} ${cx - 38},${baseY - 104}" fill="url(#beam)" class="beam" style="animation-delay:${d}s"/>
  <ellipse cx="${cx}" cy="${baseY}" rx="28" ry="6.5" fill="url(#pad)"/>
  <ellipse cx="${cx}" cy="${baseY}" rx="28" ry="6.5" fill="none" stroke="${C.cyan}" stroke-width="1.2" stroke-dasharray="8 6" class="ring" filter="url(#glow)"/>
  <g class="float" style="animation-delay:-${d}s">
    <g class="flick" style="animation-delay:${(d * 1.7).toFixed(2)}s" filter="url(#holo)">
      <g transform="translate(${cx - 22},${baseY - 86}) scale(1.8333)">${inner}</g>
    </g>
  </g>
  <text x="${cx}" y="${baseY + 24}" text-anchor="middle" font-size="12" fill="${C.cyan}" filter="url(#glow)">${esc(name)}</text>
</g>`;
        x += CELL;
      }
    }
    y += ROWH + 22;
  }
  const H = y - 6;
  const defs = `
  <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.36"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <radialGradient id="pad"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0.05"/></radialGradient>
  <filter id="holo" x="-50%" y="-50%" width="200%" height="200%">
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.49  0 0 0 0 0.81  0 0 0 0 1  0 0 0 1 0" result="c"/>
    <feGaussianBlur in="c" stdDeviation="3.5" result="cb"/>
    <feComponentTransfer in="SourceGraphic" result="s"><feFuncA type="linear" slope="0.9"/></feComponentTransfer>
    <feMerge><feMergeNode in="cb"/><feMergeNode in="s"/></feMerge>
  </filter>`;
  const css = `
  .float{animation:float 3s ease-in-out infinite}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  .flick{animation:flick 4s infinite}
  @keyframes flick{0%,60%,62%,64%,100%{opacity:1}61%{opacity:.5}63%{opacity:.8}}
  .beam{animation:beam 2.4s ease-in-out infinite}
  @keyframes beam{0%,100%{opacity:.7}50%{opacity:1}}
  .ring{animation:spin 2.5s linear infinite}
  @keyframes spin{to{stroke-dashoffset:-28}}`;
  return shell(W, H, defs, css, body, ["50%", "100%"]);
}

// ── Main ────────────────────────────────────────────────────────────────────
const [user, repos, days, av] = await Promise.all([
  gh(`/users/${USER}`), gh(`/users/${USER}/repos?per_page=100&type=owner`), calendar(), avatar(),
]);
const own = repos.filter((r) => !r.fork);
const info = {
  location: user.location?.replace(/\s+,/g, ",") || "Earth",
  repos: user.public_repos,
  stars: own.reduce((s, r) => s + r.stargazers_count, 0),
  followers: user.followers,
  avatar: av,
  days,
  ...dayStats(days),
  langs: await languages(own),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("hero.svg", OUT), hero(info));
writeFileSync(new URL("activity.svg", OUT), activity(info));
writeFileSync(new URL("stack.svg", OUT), await stack());
rmSync(new URL("neofetch.svg", OUT), { force: true }); // diseño anterior
console.log("OK", { ...info, avatar: "(embebido)", days: `${days.length} días` });
