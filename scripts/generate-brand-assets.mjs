import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT = path.resolve("public", "brand");
await mkdir(OUT, { recursive: true });

const COLORS = {
  bg: "#080A0F",
  bgDeep: "#060810",
  surface: "#0F131B",
  card: "#141A24",
  border: "#2A3552",
  fg: "#F8FAFC",
  muted: "#94A3B8",
  violet: "#5865F2",
  violetLight: "#8189F6",
  violetPale: "#C7CCFB",
  violetDeep: "#2B348F",
  cyan: "#38BDF8",
  green: "#22C55E",
  amber: "#F59E0B",
};

const FONT = "'Segoe UI', Arial, sans-serif";
const MONO = "Consolas, 'Cascadia Code', monospace";

function logoDefs(prefix) {
  return `
    <defs>
      <radialGradient id="${prefix}shadow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#000000" stop-opacity=".62"/>
        <stop offset="58%" stop-color="#000000" stop-opacity=".22"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${prefix}front" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8F98FF"/>
        <stop offset="34%" stop-color="#5865F2"/>
        <stop offset="72%" stop-color="#4450E0"/>
        <stop offset="100%" stop-color="#2B348F"/>
      </linearGradient>
      <linearGradient id="${prefix}ring" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity=".15"/>
        <stop offset="38%" stop-color="#A6AEF9" stop-opacity=".82"/>
        <stop offset="72%" stop-color="#5865F2" stop-opacity=".24"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity=".55"/>
      </linearGradient>
      <linearGradient id="${prefix}edge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#29327D"/>
        <stop offset="100%" stop-color="#111638"/>
      </linearGradient>
      <linearGradient id="${prefix}bevel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity=".42"/>
        <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="${prefix}dot" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#86EFAC"/>
        <stop offset="42%" stop-color="#22C55E"/>
        <stop offset="100%" stop-color="#15803D" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${prefix}data" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#182144"/>
        <stop offset="100%" stop-color="#0B1024"/>
      </linearGradient>
    </defs>`;
}

function logoBody(prefix, { simplified = false } = {}) {
  const p = prefix;
  const dataTile = simplified
    ? ""
    : `
      <g transform="translate(710 660) rotate(-10)">
        <rect x="0" y="12" width="188" height="132" rx="34" fill="#11162E" stroke="#33405A" stroke-width="2" opacity=".85"/>
        <rect x="0" y="0" width="188" height="132" rx="34" fill="url(#${p}data)" stroke="#46527A" stroke-width="2"/>
        <path d="M36 38 H152 M36 66 H152 M36 94 H116" stroke="#38BDF8" stroke-opacity=".82" stroke-width="5" stroke-linecap="round"/>
        <circle cx="36" cy="112" r="6" fill="#22C55E"/>
        <circle cx="58" cy="112" r="6" fill="#F59E0B" opacity=".8"/>
      </g>`;

  return `
    <g>
      <ellipse cx="512" cy="842" rx="285" ry="58" fill="url(#${p}shadow)"/>
      <ellipse cx="512" cy="505" rx="352" ry="156" transform="rotate(-18 512 505)" fill="none" stroke="url(#${p}ring)" stroke-width="6" opacity=".65"/>
      <ellipse cx="512" cy="505" rx="294" ry="118" transform="rotate(23 512 505)" fill="none" stroke="#38BDF8" stroke-width="2.5" opacity=".28" stroke-dasharray="3 15"/>
      <g transform="translate(54 62)">
        <rect x="232" y="222" width="520" height="520" rx="132" fill="#111638" opacity=".95"/>
      </g>
      <g transform="translate(28 32)">
        <rect x="232" y="222" width="520" height="520" rx="132" fill="url(#${p}edge)" stroke="#2E397B" stroke-width="2"/>
      </g>
      <rect x="232" y="222" width="520" height="520" rx="132" fill="url(#${p}front)" stroke="#B8BEFF" stroke-opacity=".62" stroke-width="2.5"/>
      <path d="M 310 292 Q 354 252 430 246 L 642 246" fill="none" stroke="url(#${p}bevel)" stroke-width="7" stroke-linecap="round"/>
      <path d="M 704 304 L 704 626" fill="none" stroke="#FFFFFF" stroke-opacity=".13" stroke-width="2"/>
      <rect x="292" y="308" width="400" height="348" rx="76" fill="#0A0F24" opacity=".2"/>
      <path d="M 405 424 L 315 500 L 405 576" fill="none" stroke="#F8FAFC" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 619 424 L 709 500 L 619 576" fill="none" stroke="#F8FAFC" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 552 404 L 466 606" fill="none" stroke="#38BDF8" stroke-width="31" stroke-linecap="round"/>
      <circle cx="692" cy="308" r="44" fill="url(#${p}dot)" opacity=".48"/>
      <circle cx="692" cy="308" r="23" fill="#22C55E" stroke="#07101A" stroke-width="7"/>
      <circle cx="692" cy="308" r="23" fill="none" stroke="#B6F7C9" stroke-opacity=".55" stroke-width="2"/>
      ${dataTile}
    </g>`;
}

function logoMarkSvg(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
    ${logoDefs("logo-")}
    ${logoBody("logo-")}
  </svg>`;
}

function avatarSvg(size = 512) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
    <defs>
      <radialGradient id="av-violet" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity=".72"/>
        <stop offset="48%" stop-color="#3B45B8" stop-opacity=".26"/>
        <stop offset="100%" stop-color="#080A0F" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="av-cyan" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity=".34"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="av-green" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#22C55E" stop-opacity=".2"/>
        <stop offset="100%" stop-color="#22C55E" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="av-border" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#A6AEF9" stop-opacity=".7"/>
        <stop offset="48%" stop-color="#5865F2" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity=".48"/>
      </linearGradient>
      <pattern id="av-grid" width="32" height="32" patternUnits="userSpaceOnUse">
        <path d="M32 0H0V32" fill="none" stroke="#28324D" stroke-opacity=".32" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="512" height="512" rx="0" fill="#070A12"/>
    <rect width="512" height="512" fill="url(#av-grid)" opacity=".48"/>
    <circle cx="242" cy="220" r="270" fill="url(#av-violet)"/>
    <circle cx="410" cy="390" r="210" fill="url(#av-cyan)"/>
    <circle cx="120" cy="430" r="180" fill="url(#av-green)"/>
    <circle cx="256" cy="256" r="238" fill="none" stroke="url(#av-border)" stroke-width="3"/>
    <circle cx="256" cy="256" r="224" fill="none" stroke="#5865F2" stroke-opacity=".13" stroke-width="1"/>
    <g transform="translate(-58 -48) scale(.63)">
      ${logoDefs("av-")}
      ${logoBody("av-", { simplified: true })}
    </g>
    <path d="M 78 158 A 220 220 0 0 1 154 82" fill="none" stroke="#38BDF8" stroke-opacity=".55" stroke-width="2" stroke-linecap="round"/>
    <path d="M 434 358 A 220 220 0 0 1 358 434" fill="none" stroke="#22C55E" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

function faviconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <defs>
      <linearGradient id="fav-front" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#8F98FF"/>
        <stop offset="42%" stop-color="#5865F2"/>
        <stop offset="100%" stop-color="#2B348F"/>
      </linearGradient>
      <linearGradient id="fav-edge" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1B2459"/>
        <stop offset="100%" stop-color="#0B1024"/>
      </linearGradient>
      <radialGradient id="fav-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity=".7"/>
        <stop offset="100%" stop-color="#5865F2" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="256" height="256" rx="56" fill="#080B14"/>
    <circle cx="128" cy="118" r="126" fill="url(#fav-glow)" opacity=".5"/>
    <rect x="60" y="56" width="150" height="150" rx="38" fill="url(#fav-edge)"/>
    <rect x="48" y="44" width="150" height="150" rx="38" fill="url(#fav-front)" stroke="#C7CCFB" stroke-opacity=".55" stroke-width="2"/>
    <path d="M 111 90 L 80 119 L 111 148" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 145 90 L 176 119 L 145 148" fill="none" stroke="#FFFFFF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M 141 84 L 119 153" fill="none" stroke="#38BDF8" stroke-width="12" stroke-linecap="round"/>
    <circle cx="174" cy="76" r="13" fill="#22C55E" stroke="#07101A" stroke-width="5"/>
  </svg>`;
}

function isoCube(x, y, size, opacity = 0.2) {
  const h = size * 0.5;
  return `<g transform="translate(${x} ${y})" opacity="${opacity}">
    <path d="M ${h} 0 L ${size} ${h * 0.55} L ${h} ${h * 1.1} L 0 ${h * 0.55} Z" fill="#5865F2"/>
    <path d="M 0 ${h * 0.55} L ${h} ${h * 1.1} L ${h} ${size * 1.1} L 0 ${size * 0.55} Z" fill="#2B348F"/>
    <path d="M ${size} ${h * 0.55} L ${h} ${h * 1.1} L ${h} ${size * 1.1} L ${size} ${size * 0.55} Z" fill="#1A2150"/>
  </g>`;
}

function bannerSvg(width, height, { discord = false } = {}) {
  const s = width / 1200;
  const baseH = height / s;
  const footerY = baseH - 34;
  const chipY = 486;
  const logoScale = discord ? 0.65 : 0.7;
  const logoX = discord ? 620 : 570;
  const logoY = discord ? 30 : 0;
  const titleY = discord ? 292 : 286;
  const titleOneSize = discord ? 90 : 96;
  const titleTwoSize = discord ? 78 : 84;
  const subY = discord ? 424 : 416;

  const chips = [
    { x: 80, w: 132, label: "DEV STUDIO", dot: COLORS.cyan },
    { x: 224, w: 76, label: "OPS", dot: COLORS.violetLight },
    { x: 312, w: 130, label: "ANTICHEAT", dot: COLORS.green },
    { x: 454, w: 154, label: "LIVE CONSOLE", dot: COLORS.amber },
  ];

  const chipMarkup = chips
    .map(
      (chip) => `
      <rect x="${chip.x}" y="${chipY}" width="${chip.w}" height="36" rx="10" fill="#0E1424" stroke="#2A3552" stroke-opacity=".9"/>
      <circle cx="${chip.x + 17}" cy="${chipY + 18}" r="4" fill="${chip.dot}"/>
      <text x="${chip.x + 29}" y="${chipY + 23}" font-family="${MONO}" font-size="12" font-weight="700" letter-spacing="1.2" fill="#CBD2E5">${chip.label}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1200 ${baseH}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B1020"/>
        <stop offset="46%" stop-color="#080B14"/>
        <stop offset="100%" stop-color="#05070D"/>
      </linearGradient>
      <linearGradient id="bg-glow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity=".22"/>
        <stop offset="45%" stop-color="#5865F2" stop-opacity=".03"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity=".12"/>
      </linearGradient>
      <radialGradient id="violet" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity=".52"/>
        <stop offset="46%" stop-color="#5865F2" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#5865F2" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="cyan" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity=".26"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="green" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#22C55E" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#22C55E" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="platform" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity=".32"/>
        <stop offset="62%" stop-color="#38BDF8" stop-opacity=".09"/>
        <stop offset="100%" stop-color="#5865F2" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="title" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="56%" stop-color="#EEF0FF"/>
        <stop offset="100%" stop-color="#A6AEF9"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#5865F2" stop-opacity="0"/>
        <stop offset="38%" stop-color="#5865F2" stop-opacity=".9"/>
        <stop offset="100%" stop-color="#38BDF8" stop-opacity="0"/>
      </linearGradient>
      <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
        <path d="M42 0H0V42" fill="none" stroke="#2A3552" stroke-opacity=".28" stroke-width="1"/>
      </pattern>
      ${logoDefs("banner-")}
    </defs>

    <rect width="1200" height="${baseH}" fill="url(#bg)"/>
    <rect width="1200" height="${baseH}" fill="url(#grid)" opacity=".42"/>
    <ellipse cx="205" cy="80" rx="560" ry="430" fill="url(#violet)"/>
    <ellipse cx="1070" cy="160" rx="450" ry="390" fill="url(#cyan)"/>
    <ellipse cx="960" cy="660" rx="410" ry="250" fill="url(#green)"/>
    <rect width="1200" height="${baseH}" fill="url(#bg-glow)" opacity=".65"/>
    <path d="M 0 520 C 250 420 340 700 620 560 S 1010 330 1200 430" fill="none" stroke="#5865F2" stroke-opacity=".12" stroke-width="2"/>
    <path d="M 0 565 C 280 465 390 740 680 600 S 1050 370 1200 470" fill="none" stroke="#38BDF8" stroke-opacity=".1" stroke-width="1.5"/>
    ${isoCube(1020, 70, 150, 0.22)}
    ${isoCube(890, 42, 70, 0.16)}
    ${isoCube(124, 470, 46, 0.12)}

    <g transform="translate(80 84)">
      <rect x="0" y="0" width="11" height="11" rx="3" fill="#22C55E"/>
      <text x="24" y="10" font-family="${MONO}" font-size="14" font-weight="700" letter-spacing="3.4" fill="#AEB8D6">BL-HOST · FIVEM TOOLING</text>
    </g>
    <g transform="translate(80 ${titleY - 156})">
      <rect x="0" y="0" width="142" height="26" rx="7" fill="#0D1425" stroke="#2B3A61"/>
      <text x="12" y="17" font-family="${MONO}" font-size="11" font-weight="700" letter-spacing="1.5" fill="#9EB1D8">PRODUCTION READY</text>
    </g>

    <text x="80" y="${titleY - 50}" font-family="${FONT}" font-size="${titleOneSize}" font-weight="800" letter-spacing="5" fill="url(#title)">FIVEM</text>
    <text x="80" y="${titleY + 46}" font-family="${FONT}" font-size="${titleTwoSize}" font-weight="800" letter-spacing="2.4" fill="url(#title)">DEVMANAGER</text>
    <rect x="80" y="${titleY + 68}" width="510" height="3" rx="1.5" fill="url(#accent)"/>

    <text x="82" y="${subY}" font-family="${FONT}" font-size="25" font-weight="500" fill="#D9DFEF">Le cockpit tout-en-un pour</text>
    <text x="82" y="${subY + 34}" font-family="${FONT}" font-size="25" font-weight="500" fill="#D9DFEF">développeurs FiveM.</text>

    ${chipMarkup}

    <line x1="80" y1="${footerY - 28}" x2="690" y2="${footerY - 28}" stroke="#2A3552" stroke-opacity=".7"/>
    <text x="80" y="${footerY}" font-family="${MONO}" font-size="13" letter-spacing="1.2" fill="#7F8BA5">v1.0  ·  SESSIONS  ·  SPRINTS  ·  STUDIO  ·  SUPERVISION</text>
    <circle cx="665" cy="${footerY - 5}" r="4" fill="#22C55E"/>
    <text x="677" y="${footerY}" font-family="${MONO}" font-size="11" letter-spacing="1" fill="#7F8BA5">ONLINE</text>

    <ellipse cx="930" cy="${baseH - 62}" rx="230" ry="38" fill="url(#platform)"/>
    <g transform="translate(${logoX} ${logoY}) scale(${logoScale})">
      ${logoBody("banner-")}
    </g>
    <path d="M 704 136 C 770 84 864 74 946 92" fill="none" stroke="#38BDF8" stroke-opacity=".3" stroke-width="2" stroke-linecap="round"/>
    <path d="M 1032 508 C 1090 486 1148 506 1180 552" fill="none" stroke="#5865F2" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

async function writePng(svg, filename, width, height) {
  await sharp(Buffer.from(svg)).resize(width, height, { fit: "fill" }).png().toFile(path.join(OUT, filename));
}

async function writeIco(svg, filename, sizes) {
  const pngs = await Promise.all(
    sizes.map((size) => sharp(Buffer.from(svg)).resize(size, size, { fit: "fill" }).png().toBuffer()),
  );
  const headerSize = 6 + pngs.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = headerSize;
  pngs.forEach((png, index) => {
    const entry = 6 + index * 16;
    const size = sizes[index];
    header.writeUInt8(size === 256 ? 0 : size, entry);
    header.writeUInt8(size === 256 ? 0 : size, entry + 1);
    header.writeUInt8(0, entry + 2);
    header.writeUInt8(0, entry + 3);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  const ico = Buffer.concat([header, ...pngs]);
  await writeFile(path.join(OUT, filename), ico);
  await writeFile(path.join("public", "favicon.ico"), ico);
}

const logoSvg = logoMarkSvg(1024);
const avatar = avatarSvg(512);
const favicon = faviconSvg();
const ogSvg = bannerSvg(1200, 630);
const discordSvg = bannerSvg(960, 540, { discord: true });

await Promise.all([
  writeFile(path.join(OUT, "fivem-devmgr-logo-3d.svg"), logoSvg),
  writeFile(path.join(OUT, "fivem-devmgr-avatar.svg"), avatar),
  writeFile(path.join(OUT, "fivem-devmgr-favicon.svg"), favicon),
  writeFile(path.join(OUT, "fivem-devmgr-banner-og.svg"), ogSvg),
  writeFile(path.join(OUT, "fivem-devmgr-banner-discord.svg"), discordSvg),
]);

await Promise.all([
  writePng(logoSvg, "fivem-devmgr-logo-3d.png", 1024, 1024),
  writePng(avatar, "fivem-devmgr-avatar-512.png", 512, 512),
  writePng(ogSvg, "fivem-devmgr-banner-og.png", 1200, 630),
  writePng(discordSvg, "fivem-devmgr-banner-discord.png", 960, 540),
]);

await writeIco(favicon, "fivem-devmgr-favicon.ico", [16, 32, 48, 64, 128, 256]);

console.log("Brand kit generated in public/brand");
