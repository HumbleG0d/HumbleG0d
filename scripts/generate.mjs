// Genera las tarjetas holográficas del perfil:
//   assets/neofetch.svg  → "neofetch" con datos reales de GitHub
//   assets/stack.svg     → tecnologías flotando como hologramas
// Uso: node scripts/generate.mjs   (GITHUB_TOKEN opcional: añade contribuciones)
import { writeFileSync, mkdirSync } from "node:fs";

const USER = "HumbleG0d";
const TOKEN = process.env.GITHUB_TOKEN;
const OUT = new URL("../assets/", import.meta.url);

// ── Paleta holograma (Tokyo Night + cian) ───────────────────────────────────
const C = {
  bg: "#070b14", cyan: "#7dcfff", blue: "#7aa2f7", purple: "#bb9af7",
  green: "#9ece6a", orange: "#ff9e64", text: "#c0caf5", dim: "#565f89",
};
const FONT = "'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Datos de GitHub ─────────────────────────────────────────────────────────
async function gh(path) {
  const r = await fetch(`https://api.github.com${path}`, {
    headers: { "User-Agent": "profile-card-generator", ...(TOKEN && { Authorization: `Bearer ${TOKEN}` }) },
  });
  if (!r.ok) throw new Error(`GitHub API ${path}: ${r.status}`);
  return r.json();
}

async function contributions() {
  if (!TOKEN) return null;
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{totalContributions}}}}`;
  const r = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "profile-card-generator" },
    body: JSON.stringify({ query, variables: { login: USER } }),
  });
  const j = await r.json();
  return j?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions ?? null;
}

function uptime(since) {
  const a = new Date(since), b = new Date();
  let y = b.getUTCFullYear() - a.getUTCFullYear();
  let m = b.getUTCMonth() - a.getUTCMonth();
  let d = b.getUTCDate() - a.getUTCDate();
  if (d < 0) { m--; d += 30; }
  if (m < 0) { y--; m += 12; }
  return `${y} years, ${m} months, ${d} days`;
}

// ── Arte ASCII: gato con lentes (mitad izquierda reflejada) ─────────────────
const MIRROR = { "/": "\\", "\\": "/", "(": ")", ")": "(", "[": "]", "]": "[", "<": ">", ">": "<" };
const mirror = (s) => [...s].reverse().map((c) => MIRROR[c] ?? c).join("");
const HALF = [
  "    /\\         ",
  "   /  \\        ",
  "  /    \\_______",
  " /             ",
  "|   ________   ",
  "|  /        \\__",
  "| |   (@)    | ",
  "|  \\________/  ",
  "|             /",
  "|  ==        (_",
  " \\ ==         \\",
  "  \\          \\_",
  "   \\___________",
];
const CAT = [
  ...HALF.map((h) => h + mirror(h)),
  "   .-------------------------.",
  "   |  > ./hello_world.java_  |",
  "   '-------------------------'",
  "  /___________________________\\",
];

// ── Tarjeta neofetch ────────────────────────────────────────────────────────
function neofetch(info) {
  const W = 940, LH = 21, FS = 14, PADX = 36, PADY = 46;
  const infoX = 380;
  const rows = [
    { t: "title", text: "sergio@HumbleG0d" },
    { t: "sep" },
    ["OS", "Windows 11 · WezTerm · herdr"],
    ["Host", info.location],
    ["Kernel", "Computer Science Student"],
    ["Uptime", info.uptime],
    ["Packages", `${info.repos} repos (github)`],
    ["Shell", "PowerShell"],
    ["Editor", "Neovim · tokyonight"],
    ["Role", "Software Developer"],
    { t: "gap" },
    ["Langs.Code", "Java, JavaScript, SQL"],
    ["Langs.Frameworks", "Spring Boot, React, Tailwind"],
    ["Langs.Data", "MySQL, PostgreSQL"],
    ["Langs.DevOps", "Docker, Git, GitHub Actions"],
    { t: "gap" },
    { t: "head", text: "GitHub Stats" },
    ["Repos", `${info.repos}  |  Stars: ${info.stars}`],
    ["Followers", `${info.followers}  |  Following: ${info.following}`],
    ["Contributions", info.contrib == null ? "—" : `${info.contrib} (last year)`],
    ["Top language", info.topLang],
    { t: "gap" },
    { t: "colors" },
  ];
  const H = Math.max(rows.length, CAT.length) * LH + PADY * 2 + 10;

  let y = PADY, i = 0, body = "";
  const delay = () => `style="animation-delay:${(0.25 + i++ * 0.07).toFixed(2)}s"`;
  for (const r of rows) {
    y += LH;
    if (Array.isArray(r)) {
      const [k, v] = r;
      body += `<text class="l" ${delay()} x="${infoX}" y="${y}"><tspan fill="${C.cyan}" font-weight="700">${esc(k)}</tspan><tspan fill="${C.dim}">: </tspan><tspan fill="${C.text}">${esc(v)}</tspan></text>`;
    } else if (r.t === "title") {
      body += `<text class="l" ${delay()} x="${infoX}" y="${y}" font-weight="700"><tspan fill="${C.purple}">sergio</tspan><tspan fill="${C.text}">@</tspan><tspan fill="${C.purple}">HumbleG0d</tspan></text>`;
    } else if (r.t === "sep") {
      body += `<text class="l" ${delay()} x="${infoX}" y="${y}" fill="${C.dim}">${"─".repeat(46)}</text>`;
    } else if (r.t === "head") {
      body += `<text class="l" ${delay()} x="${infoX}" y="${y}" fill="${C.purple}" font-weight="700">— ${esc(r.text)} ${"─".repeat(30)}</text>`;
    } else if (r.t === "colors") {
      const cols = ["#1a1b26", "#f7768e", "#9ece6a", "#e0af68", "#7aa2f7", "#bb9af7", "#7dcfff", "#c0caf5"];
      body += `<g class="l" ${delay()}>` + cols.map((c, j) => `<rect x="${infoX + j * 30}" y="${y - 14}" width="28" height="18" rx="2" fill="${c}"/>`).join("") + `</g>`;
      body += `<rect class="cursor" x="${infoX + cols.length * 30 + 10}" y="${y - 14}" width="9" height="18" fill="${C.cyan}"/>`;
    }
  }

  const catY = PADY + (H - PADY * 2 - CAT.length * LH) / 2;
  const catLines = CAT.map((l, j) => `<tspan x="${PADX}" y="${(catY + (j + 1) * LH).toFixed(1)}" xml:space="preserve">${esc(l)}</tspan>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}" font-size="${FS}">
<defs>
  <radialGradient id="bgGlow" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#0f2a44"/><stop offset="1" stop-color="${C.bg}"/></radialGradient>
  <linearGradient id="catGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}"/><stop offset="0.6" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.purple}"/></linearGradient>
  <linearGradient id="sweep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0"/><stop offset="0.5" stop-color="${C.cyan}" stop-opacity="0.10"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${C.cyan}" opacity="0.07"/></pattern>
  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<style>
  .l{opacity:0;animation:in .35s ease-out forwards}
  @keyframes in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:none}}
  .holo{animation:flicker 5s infinite}
  @keyframes flicker{0%,100%{opacity:1}47%{opacity:1}48%{opacity:.72}49%{opacity:1}82%{opacity:.9}83%{opacity:1}}
  .cursor{animation:blink 1s steps(1) infinite}
  @keyframes blink{50%{opacity:0}}
  .sweep{animation:sweep 6s linear infinite}
  @keyframes sweep{from{transform:translateY(-160px)}to{transform:translateY(${H + 40}px)}}
  .scan{animation:scanmove 1.2s linear infinite}
  @keyframes scanmove{to{transform:translateY(4px)}}
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <g class="holo">
    <g filter="url(#glow)">
      <text fill="${C.orange}" opacity="0.35" transform="translate(-1.5,0)">${catLines}</text>
      <text fill="${C.blue}" opacity="0.35" transform="translate(1.5,0)">${catLines}</text>
      <text fill="url(#catGrad)">${catLines}</text>
    </g>
    <line x1="${infoX - 26}" y1="${PADY}" x2="${infoX - 26}" y2="${H - PADY}" stroke="${C.cyan}" stroke-opacity="0.25"/>
    <g filter="url(#glow)">${body}</g>
  </g>
  <rect class="scan" y="-4" width="${W}" height="${H + 8}" fill="url(#scan)"/>
  <rect class="sweep" width="${W}" height="140" fill="url(#sweep)"/>
</g>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="none" stroke="${C.cyan}" stroke-opacity="0.45" stroke-width="1.5" filter="url(#glow)"/>
</svg>`;
}

// ── Tarjeta de tecnologías holográficas ─────────────────────────────────────
const DEVICON = "https://cdn.jsdelivr.net/gh/devicons/devicon@v2.16.0/icons";
const STACK = [
  { title: "skills", items: [
    ["Java", "java/java-original"], ["Spring", "spring/spring-original"], ["MySQL", "mysql/mysql-original", "mono"],
    ["PostgreSQL", "postgresql/postgresql-original"], ["Docker", "docker/docker-original"], ["JavaScript", "javascript/javascript-original"],
    ["HTML5", "html5/html5-original"], ["CSS3", "css3/css3-original"], ["React", "react/react-original"],
    ["Tailwind", "tailwindcss/tailwindcss-original"], ["Webpack", "webpack/webpack-original"], ["Git", "git/git-original"],
  ]},
  { title: "tools", items: [
    ["VS Code", "vscode/vscode-original"], ["IntelliJ", "intellij/intellij-original"], ["GitHub", "github/github-original", "inv"],
    ["Maven", "maven/maven-original"], ["Postman", "postman/postman-original"], ["Actions", "githubactions/githubactions-original"],
    ["Neovim", "neovim/neovim-original"],
  ]},
];

async function icon(path) {
  const r = await fetch(`${DEVICON}/${path}.svg`);
  if (!r.ok) throw new Error(`icono ${path}: ${r.status}`);
  return `data:image/svg+xml;base64,${Buffer.from(await r.text()).toString("base64")}`;
}

async function stack() {
  const W = 940, CELL = 134, ROWH = 168, PADX = 32, TITLEH = 44;
  let y = 30, n = 0, body = "";
  for (const sec of STACK) {
    body += `<text x="${PADX}" y="${y + 18}" font-size="15" filter="url(#glow)"><tspan fill="${C.green}">❯</tspan><tspan fill="${C.text}"> ${sec.title}</tspan><tspan fill="${C.dim}"> --list --holo</tspan></text>`;
    y += TITLEH;
    const perRow = sec.items.length > 7 ? 6 : 7;
    for (let k = 0; k < sec.items.length; k += perRow) {
      const row = sec.items.slice(k, k + perRow);
      const x0 = (W - row.length * CELL) / 2;
      for (const [j, [name, path, fx]] of row.entries()) {
        const cx = x0 + j * CELL + CELL / 2, baseY = y + 128, d = (n++ * 0.23) % 3;
        const href = await icon(path);
        body += `
<g>
  <polygon points="${cx - 22},${baseY} ${cx + 22},${baseY} ${cx + 42},${baseY - 112} ${cx - 42},${baseY - 112}" fill="url(#beam)" class="beam" style="animation-delay:${d}s"/>
  <ellipse cx="${cx}" cy="${baseY}" rx="30" ry="7" fill="url(#pad)"/>
  <ellipse cx="${cx}" cy="${baseY}" rx="30" ry="7" fill="none" stroke="${C.cyan}" stroke-width="1.2" stroke-dasharray="8 6" class="ring" filter="url(#glow)"/>
  <g class="float" style="animation-delay:-${d}s">
    <ellipse cx="${cx}" cy="${baseY - 26}" rx="22" ry="4" fill="none" stroke="${C.cyan}" stroke-opacity="0.35"/>
    <g class="flick" style="animation-delay:${(d * 1.7).toFixed(2)}s">
      <image href="${href}" x="${cx - 26}" y="${baseY - 92}" width="52" height="52" filter="url(#${{ inv: "holoInv", mono: "holoMono" }[fx] ?? "holo"})"/>
    </g>
  </g>
  <text x="${cx}" y="${baseY + 26}" text-anchor="middle" font-size="12" fill="${C.cyan}" filter="url(#glow)">${esc(name)}</text>
</g>`;
      }
      y += ROWH;
    }
    y += 6;
  }
  const H = y + 14;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<defs>
  <radialGradient id="bgGlow" cx="50%" cy="100%" r="90%"><stop offset="0" stop-color="#0f2a44"/><stop offset="1" stop-color="${C.bg}"/></radialGradient>
  <linearGradient id="beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.38"/><stop offset="1" stop-color="${C.cyan}" stop-opacity="0"/></linearGradient>
  <radialGradient id="pad"><stop offset="0" stop-color="${C.cyan}" stop-opacity="0.9"/><stop offset="1" stop-color="${C.blue}" stop-opacity="0.05"/></radialGradient>
  <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="${C.cyan}" opacity="0.07"/></pattern>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <filter id="holo" x="-40%" y="-40%" width="180%" height="180%">
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.49  0 0 0 0 0.81  0 0 0 0 1  0 0 0 1 0" result="c"/>
    <feGaussianBlur in="c" stdDeviation="4" result="cb"/>
    <feComponentTransfer in="SourceGraphic" result="s"><feFuncA type="linear" slope="0.88"/></feComponentTransfer>
    <feMerge><feMergeNode in="cb"/><feMergeNode in="s"/></feMerge>
  </filter>
  <filter id="holoInv" x="-40%" y="-40%" width="180%" height="180%">
    <feColorMatrix in="SourceGraphic" type="matrix" values="-1 0 0 0 1  0 -1 0 0 1  0 0 -1 0 1  0 0 0 0.9 0" result="s"/>
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.49  0 0 0 0 0.81  0 0 0 0 1  0 0 0 1 0" result="c"/>
    <feGaussianBlur in="c" stdDeviation="4" result="cb"/>
    <feMerge><feMergeNode in="cb"/><feMergeNode in="s"/></feMerge>
  </filter>
  <filter id="holoMono" x="-40%" y="-40%" width="180%" height="180%">
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0.49  0 0 0 0 0.81  0 0 0 0 1  0 0 0 0.95 0" result="s"/>
    <feGaussianBlur in="s" stdDeviation="4" result="cb"/>
    <feMerge><feMergeNode in="cb"/><feMergeNode in="s"/></feMerge>
  </filter>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="16"/></clipPath>
</defs>
<style>
  .float{animation:float 3s ease-in-out infinite}
  @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
  .flick{animation:flick 4s infinite}
  @keyframes flick{0%,100%{opacity:1}60%{opacity:1}61%{opacity:.55}62%{opacity:1}63%{opacity:.8}64%{opacity:1}}
  .beam{animation:beam 2.4s ease-in-out infinite}
  @keyframes beam{0%,100%{opacity:.75}50%{opacity:1}}
  .ring{animation:spin 2.5s linear infinite}
  @keyframes spin{to{stroke-dashoffset:-28}}
  .scan{animation:scanmove 1.2s linear infinite}
  @keyframes scanmove{to{transform:translateY(4px)}}
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  ${body}
  <rect class="scan" y="-4" width="${W}" height="${H + 8}" fill="url(#scan)"/>
</g>
<rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="16" fill="none" stroke="${C.cyan}" stroke-opacity="0.45" stroke-width="1.5" filter="url(#glow)"/>
</svg>`;
}

// ── Main ────────────────────────────────────────────────────────────────────
const [user, repos, contrib] = await Promise.all([
  gh(`/users/${USER}`),
  gh(`/users/${USER}/repos?per_page=100&type=owner`),
  contributions().catch(() => null),
]);
const own = repos.filter((r) => !r.fork);
const langs = {};
for (const r of own) if (r.language) langs[r.language] = (langs[r.language] || 0) + 1;
const info = {
  location: user.location?.replace(/\s+,/g, ",") || "Earth",
  uptime: uptime(user.created_at),
  repos: user.public_repos,
  stars: own.reduce((s, r) => s + r.stargazers_count, 0),
  followers: user.followers,
  following: user.following,
  contrib,
  topLang: Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l).join(", ") || "—",
};

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL("neofetch.svg", OUT), neofetch(info));
writeFileSync(new URL("stack.svg", OUT), await stack());
console.log("OK", info);
