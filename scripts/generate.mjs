// Genera las tarjetas holográficas del perfil (sin dependencias, Node 20+):
//   assets/neofetch.svg → neofetch minimalista + mapa de actividad holográfico
//   assets/stack.svg    → stack de IA / backend / devops como hologramas
// Uso: node scripts/generate.mjs   (GITHUB_TOKEN opcional; en Actions se usa el del workflow)
import { writeFileSync, mkdirSync } from "node:fs";

const USER = "HumbleG0d";
const TZ_OFFSET = -5; // Lima (UTC-5) para el horario de actividad
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = new URL("../assets/", import.meta.url);

const C = {
  bg: "#070b14", cyan: "#7dcfff", blue: "#7aa2f7", purple: "#bb9af7", green: "#9ece6a",
  orange: "#ff9e64", text: "#c0caf5", dim: "#565f89",
};
const FONT = "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const HEADERS = { "User-Agent": "profile-card-generator", ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) };

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

function streaks(days) {
  let best = 0, run = 0;
  for (const d of days) { run = d.count > 0 ? run + 1 : 0; best = Math.max(best, run); }
  let cur = 0, i = days.length - 1;
  if (i >= 0 && days[i].count === 0) i--; // hoy aún puede no tener contribuciones
  for (; i >= 0 && days[i].count > 0; i--) cur++;
  return { cur, best };
}

async function habits() {
  try {
    const ev = await gh(`/users/${USER}/events/public?per_page=100`);
    const hours = Array(24).fill(0);
    for (const e of ev) if (e.type === "PushEvent") hours[(new Date(e.created_at).getUTCHours() + 24 + TZ_OFFSET) % 24]++;
    const peak = hours.indexOf(Math.max(...hours));
    if (!hours[peak]) return null;
    const tag = peak >= 21 || peak < 5 ? "night owl" : peak < 12 ? "early bird" : "day coder";
    return `peak ${String(peak).padStart(2, "0")}:00 · ${tag}`;
  } catch { return null; }
}

async function languages(repos) {
  const total = {};
  await Promise.all(repos.map(async (r) => {
    try { for (const [l, b] of Object.entries(await gh(`/repos/${USER}/${r.name}/languages`))) total[l] = (total[l] || 0) + b; } catch {}
  }));
  const sum = Object.values(total).reduce((a, b) => a + b, 0) || 1;
  const top = Object.entries(total).sort((a, b) => b[1] - a[1]);
  const shown = top.slice(0, 5).map(([l, b]) => ({ l, p: b / sum }));
  const rest = 1 - shown.reduce((a, x) => a + x.p, 0);
  if (rest > 0.005) shown.push({ l: "Other", p: rest });
  return shown;
}
const LANG_COLOR = {
  Java: "#e76f00", Python: "#4b8bbe", "Jupyter Notebook": "#f37726", JavaScript: "#f1e05a", TypeScript: "#3178c6",
  CSS: "#a074c4", HTML: "#e34c26", Shell: "#89e051", Dockerfile: "#7aa2f7", Other: C.dim,
};

function uptime(since) {
  const a = new Date(since), b = new Date();
  let y = b.getUTCFullYear() - a.getUTCFullYear(), m = b.getUTCMonth() - a.getUTCMonth();
  if (b.getUTCDate() < a.getUTCDate()) m--;
  if (m < 0) { y--; m += 12; }
  return `${y} years, ${m} months`;
}

// ── Arte ASCII: gato con lentes (mitad izquierda reflejada) ─────────────────
const MIRROR = { "/": "\\", "\\": "/", "(": ")", ")": "(" };
const mirror = (s) => [...s].reverse().map((c) => MIRROR[c] ?? c).join("");
const HALF = [
  "    /\\         ", "   /  \\        ", "  /    \\_______", " /             ",
  "|   ________   ", "|  /        \\__", "| |   (@)    | ", "|  \\________/  ",
  "|             /", "|  ==        (_", " \\ ==         \\", "  \\          \\_", "   \\___________",
];
const CAT = [
  ...HALF.map((h) => h + mirror(h)),
  "   .-------------------------.",
  "   |  > agent.invoke(task)_  |",
  "   '-------------------------'",
  "  /___________________________\\",
];

// ── Piezas comunes de los SVG ───────────────────────────────────────────────
const commonDefs = (W, H, glowCy) => `
  <radialGradient id="bgGlow" cx="50%" cy="${glowCy}" r="90%"><stop offset="0" stop-color="#0f2a44"/><stop offset="1" stop-color="${C.bg}"/></radialGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${C.cyan}" opacity="0.07"/></pattern>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>`;
const commonCss = `
  .scan{animation:scanmove 1.2s linear infinite}
  @keyframes scanmove{to{transform:translateY(4px)}}`;
const frame = (W, H) =>
  `<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="none" stroke="${C.cyan}" stroke-opacity="0.45" stroke-width="1.5" filter="url(#glow)"/>`;

// ── Tarjeta neofetch + actividad ────────────────────────────────────────────
function neofetch(info) {
  const W = 940, LH = 21, FS = 14, PADX = 36, PADY = 40, infoX = 380;
  let i = 0;
  const delay = () => `style="animation-delay:${(0.2 + i++ * 0.07).toFixed(2)}s"`;
  const kv = (k, v, y) => `<text class="l" ${delay()} x="${infoX}" y="${y}"><tspan fill="${C.cyan}" font-weight="700">${esc(k)}</tspan><tspan fill="${C.dim}">: </tspan><tspan fill="${C.text}">${esc(v)}</tspan></text>`;

  const rows = [
    (y) => `<text class="l" ${delay()} x="${infoX}" y="${y}" font-weight="700"><tspan fill="${C.purple}">sergio</tspan><tspan fill="${C.text}">@</tspan><tspan fill="${C.purple}">HumbleG0d</tspan></text>`,
    (y) => `<text class="l" ${delay()} x="${infoX}" y="${y}" fill="${C.dim}">${"─".repeat(46)}</text>`,
    (y) => kv("Role", "AI Engineer · Backend Developer", y),
    (y) => kv("Focus", "Agents · RAG · LLM apps", y),
    (y) => kv("Kernel", "Computer Science Student", y),
    (y) => kv("Host", info.location, y),
    (y) => kv("Uptime", info.uptime, y),
    null,
    (y) => `<text class="l" ${delay()} x="${infoX}" y="${y}" fill="${C.purple}" font-weight="700">— github ${"─".repeat(37)}</text>`,
    (y) => kv("Repos", `${info.repos} · Stars: ${info.stars} · Followers: ${info.followers}`, y),
    (y) => kv("Commits", `${info.total} contributions (last year)`, y),
    (y) => kv("Streak", `${info.streak.cur} days · best ${info.streak.best}`, y),
    info.habits ? (y) => kv("Habits", info.habits, y) : undefined, // se oculta si no hay pushes públicos recientes
    null,
    (y) => {
      // Barra de lenguajes por bytes (estilo lowlighter/metrics)
      const BW = 470; let x = infoX, out = `<g class="l" ${delay()}>`;
      out += `<text x="${infoX}" y="${y}" fill="${C.cyan}" font-weight="700">Languages</text>`;
      const by = y + 8;
      out += `<rect x="${infoX}" y="${by}" width="${BW}" height="8" rx="4" fill="${C.dim}" opacity="0.25"/>`;
      out += `<clipPath id="barclip"><rect x="${infoX}" y="${by}" width="${BW}" height="8" rx="4"/></clipPath><g clip-path="url(#barclip)">`;
      for (const { l, p } of info.langs) { out += `<rect x="${x.toFixed(1)}" y="${by}" width="${(p * BW).toFixed(1)}" height="8" fill="${LANG_COLOR[l] ?? C.blue}"/>`; x += p * BW; }
      out += `</g>`;
      info.langs.forEach(({ l, p }, j) => {
        const lx = infoX + (j % 3) * 160, ly = by + 28 + Math.floor(j / 3) * 20;
        out += `<circle cx="${lx + 5}" cy="${ly - 4}" r="4.5" fill="${LANG_COLOR[l] ?? C.blue}"/><text x="${lx + 15}" y="${ly}" font-size="12.5"><tspan fill="${C.text}">${esc(l)}</tspan><tspan fill="${C.dim}"> ${(p * 100).toFixed(1)}%</tspan></text>`;
      });
      return out + `</g>`;
    },
  ].filter((r) => r !== undefined);
  let y = PADY, body = "";
  for (const r of rows) { y += LH; if (r) body += r(y); }
  y += 8 + 2 * 20; // leyenda de lenguajes

  const topH = Math.max(y, PADY + CAT.length * LH) + 14;
  const catY = PADY + (topH - PADY - CAT.length * LH) / 2 - 10;
  const catLines = CAT.map((l, j) => `<tspan x="${PADX}" y="${(catY + (j + 1) * LH).toFixed(1)}" xml:space="preserve">${esc(l)}</tspan>`).join("");

  // ── Mapa de actividad holográfico (último año) ──
  const CELL = 13, GAP = 3, weeks = [];
  for (const d of info.days) {
    const wd = new Date(d.date + "T00:00:00Z").getUTCDay();
    if (!weeks.length || wd === 0) weeks.push([]);
    weeks.at(-1)[wd] = d;
  }
  const gridW = weeks.length * (CELL + GAP) - GAP, gx = (W - gridW) / 2;
  const hy = topH + 34, gy = hy + 18;
  const LVL_OP = [0.08, 0.32, 0.55, 0.78, 1];
  let cells = "", clip = "";
  weeks.forEach((w, c) => w.forEach((d, r) => {
    if (!d) return;
    const x = gx + c * (CELL + GAP), yy = gy + r * (CELL + GAP);
    cells += `<rect x="${x}" y="${yy}" width="${CELL}" height="${CELL}" rx="3" fill="${C.cyan}" fill-opacity="${LVL_OP[d.level]}"${d.level ? "" : ` stroke="${C.cyan}" stroke-opacity="0.12"`}/>`;
    clip += `<rect x="${x}" y="${yy}" width="${CELL}" height="${CELL}" rx="3"/>`;
  }));
  const gridH = 7 * (CELL + GAP) - GAP;
  const H = gy + gridH + 34;
  const header = `<text x="${gx}" y="${hy}" font-size="13.5"><tspan fill="${C.green}">❯</tspan><tspan fill="${C.text}"> git log --graph</tspan><tspan fill="${C.dim}"> --since="1 year ago"</tspan></text>`
    + `<text x="${gx + gridW}" y="${hy}" font-size="12.5" text-anchor="end" fill="${C.dim}">less <tspan fill="${C.cyan}" fill-opacity="0.15">■</tspan><tspan fill="${C.cyan}" fill-opacity="0.45">■</tspan><tspan fill="${C.cyan}" fill-opacity="0.75">■</tspan><tspan fill="${C.cyan}">■</tspan> more</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="${FS}">
<defs>${commonDefs(W, H, "0%")}
  <linearGradient id="catGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}"/><stop offset="0.6" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cyan}" stop-opacity="0.09"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <linearGradient id="wave" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.85"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
  <clipPath id="cells">${clip}</clipPath>
</defs>
<style>${commonCss}
  .l{animation:in .35s ease-out backwards}
  @keyframes in{from{opacity:0;transform:translateX(-6px)}}
  .holo{animation:flicker 5s infinite}
  @keyframes flicker{0%,47%,49%,82%,84%,100%{opacity:1}48%{opacity:.72}83%{opacity:.88}}
  .cursor{animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  .sweep{animation:sweep 6s linear infinite}
  @keyframes sweep{from{transform:translateY(-160px)}to{transform:translateY(${H + 40}px)}}
  .wave{animation:wave 4.5s ease-in-out infinite}
  @keyframes wave{from{transform:translateX(-160px)}to{transform:translateX(${W + 40}px)}}
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <g class="holo">
    <g filter="url(#glow)">
      <text fill="${C.orange}" opacity="0.35" transform="translate(-1.5,0)">${catLines}</text>
      <text fill="${C.blue}" opacity="0.35" transform="translate(1.5,0)">${catLines}</text>
      <text fill="url(#catGrad)">${catLines}</text>
    </g>
    <line x1="${infoX - 26}" y1="${PADY}" x2="${infoX - 26}" y2="${topH - 10}" stroke="${C.cyan}" stroke-opacity="0.25"/>
    <g filter="url(#glow)">${body}</g>
    <line x1="${PADX}" y1="${topH + 6}" x2="${W - PADX}" y2="${topH + 6}" stroke="${C.cyan}" stroke-opacity="0.18" stroke-dasharray="2 4"/>
    <g filter="url(#glow)">${header}${cells}</g>
    <g clip-path="url(#cells)"><rect class="wave" x="0" y="${gy}" width="140" height="${gridH}" fill="url(#wave)"/></g>
    <rect class="cursor" x="${gx + gridW + 8}" y="${gy + gridH - 13}" width="7" height="13" fill="${C.cyan}"/>
  </g>
  <rect class="scan" y="-4" width="${W}" height="${H + 8}" fill="url(#scan)"/>
  <rect class="sweep" width="${W}" height="140" fill="url(#sweep)"/>
</g>
${frame(W, H)}
</svg>`;
}

// ── Stack holográfico ───────────────────────────────────────────────────────
const SI = "https://cdn.jsdelivr.net/npm/simple-icons@16.37.0/icons";
// Glifos propios (viewBox 24x24) para lo que no tiene logo en simple-icons
const GLYPH = {
  rag: `<g fill="none" stroke="${C.purple}" stroke-width="1.8" stroke-linecap="round"><ellipse cx="10" cy="5" rx="7" ry="2.6"/><path d="M3 5v10c0 1.4 3.1 2.6 7 2.6M3 10c0 1.4 3.1 2.6 7 2.6M17 5v4.5"/><circle cx="17" cy="15.5" r="3.6"/><path d="M19.6 18.1 23 21.5"/></g>`,
  chroma: `<g opacity="0.92"><circle cx="8.5" cy="14.5" r="6" fill="#ffde2d" fill-opacity="0.85"/><circle cx="15.5" cy="14.5" r="6" fill="#ff6446" fill-opacity="0.8"/><circle cx="12" cy="8.5" r="6" fill="#327eff" fill-opacity="0.8"/></g>`,
};
const STACK = [
  [{ title: "ai-engineer", flags: "--agents --rag", items: [
    ["Python", "python", "#4b8bbe"], ["LangChain", "langchain", "#7fc8ff"], ["LangGraph", "langgraph", "#7fc8ff"],
    ["RAG", { glyph: "rag" }], ["ChromaDB", { glyph: "chroma" }], ["MCP", "modelcontextprotocol"],
    ["Ollama", "ollama"], ["Hugging Face", "huggingface", "#ffd21e"],
  ]}],
  [{ title: "backend", flags: "", items: [
    ["Java", "openjdk", "#e76f00"], ["Spring", "spring", "#6db33f"], ["PostgreSQL", "postgresql", "#6c9bd2"],
    ["Docker", "docker", "#2496ed"], ["React", "react", "#61dafb"],
  ]}, { title: "devops", flags: "", items: [
    ["Jenkins", "jenkins", "#e36a5c"], ["Actions", "githubactions", "#2088ff"], ["Postman", "postman", "#ff6c37"],
  ]}],
];

async function iconInner(src, color) {
  if (typeof src === "object") return GLYPH[src.glyph];
  const r = await fetch(`${SI}/${src}.svg`);
  if (!r.ok) throw new Error(`icono ${src}: ${r.status}`);
  const d = (await r.text()).match(/<path d="([^"]+)"/)[1];
  return `<path d="${d}" fill="${color ?? C.cyan}"/>`; // sin color de marca (logos negros) → cian holograma
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
      body += `<text x="${Math.max(PADX, x + 8)}" y="${y + 16}" font-size="14" filter="url(#glow)"><tspan fill="${C.green}">❯</tspan><tspan fill="${C.text}"> ${sec.title}</tspan><tspan fill="${C.dim}"> ${sec.flags}</tspan></text>`;
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
  <text x="${cx}" y="${baseY + 24}" text-anchor="middle" font-size="11.5" fill="${C.cyan}" filter="url(#glow)">${esc(name)}</text>
</g>`;
        x += CELL;
      }
    }
    y += ROWH + 22;
  }
  const H = y - 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs>${commonDefs(W, H, "100%")}
  <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.36"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <radialGradient id="pad"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0.05"/></radialGradient>
  <filter id="holo" x="-50%" y="-50%" width="200%" height="200%">
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.49  0 0 0 0 0.81  0 0 0 0 1  0 0 0 1 0" result="c"/>
    <feGaussianBlur in="c" stdDeviation="3.5" result="cb"/>
    <feComponentTransfer in="SourceGraphic" result="s"><feFuncA type="linear" slope="0.9"/></feComponentTransfer>
    <feMerge><feMergeNode in="cb"/><feMergeNode in="s"/></feMerge>
  </filter>
</defs>
<style>${commonCss}
  .float{animation:float 3s ease-in-out infinite}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  .flick{animation:flick 4s infinite}
  @keyframes flick{0%,60%,62%,64%,100%{opacity:1}61%{opacity:.5}63%{opacity:.8}}
  .beam{animation:beam 2.4s ease-in-out infinite}
  @keyframes beam{0%,100%{opacity:.7}50%{opacity:1}}
  .ring{animation:spin 2.5s linear infinite}
  @keyframes spin{to{stroke-dashoffset:-28}}
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${body}
  <rect class="scan" y="-4" width="${W}" height="${H + 8}" fill="url(#scan)"/>
</g>
${frame(W, H)}
</svg>`;
}

// ── Main ────────────────────────────────────────────────────────────────────
const [user, repos, days, hab] = await Promise.all([
  gh(`/users/${USER}`), gh(`/users/${USER}/repos?per_page=100&type=owner`), calendar(), habits(),
]);
const own = repos.filter((r) => !r.fork);
const info = {
  location: user.location?.replace(/\s+,/g, ",") || "Earth",
  uptime: uptime(user.created_at),
  repos: user.public_repos,
  stars: own.reduce((s, r) => s + r.stargazers_count, 0),
  followers: user.followers,
  days,
  total: days.reduce((s, d) => s + d.count, 0),
  streak: streaks(days),
  habits: hab,
  langs: await languages(own),
};

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("neofetch.svg", OUT), neofetch(info));
writeFileSync(new URL("stack.svg", OUT), await stack());
console.log("OK", { ...info, days: `${days.length} días` });
