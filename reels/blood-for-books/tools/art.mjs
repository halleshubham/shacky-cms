// Illustrated scenes for the reel. Each art(p) returns { svg, js }:
//   svg – full-frame (1080x1920) inline SVG markup, ids prefixed with `p`
//   js  – GSAP calls against the scene timeline `tl`; `T` is the beat's local start (s), `D` its duration
// Subject zone is y 230–1000 (above the caption band); below 1330 only texture.

export const C = {
  ink: "#09060a",
  wine: "#2b0b12",
  blood: "#d4121f",
  blood2: "#8d0a14",
  glow: "#ff3b47",
  paper: "#efe3cc",
  gold: "#f0b24b",
  slate: "#1a2030",
  slate2: "#2a3348",
  warm: "#ffb454",
  mute: "#6b6470",
};

const FONT = "'NotoSerifDev','Inter',serif";
const SERIF = "'NotoSerifDev','Inter',serif";

const drop = (cx, cy, s = 1) =>
  `M${cx},${cy - 120 * s} C${cx + 22 * s},${cy - 60 * s} ${cx + 70 * s},${cy - 12 * s} ${cx + 70 * s},${cy + 38 * s} A${70 * s},${70 * s} 0 1 1 ${cx - 70 * s},${cy + 38 * s} C${cx - 70 * s},${cy - 12 * s} ${cx - 22 * s},${cy - 60 * s} ${cx},${cy - 120 * s} Z`;

const bg = (p, top, bottom, gx = 540, gy = 600, gr = 700, gc = C.blood2, ga = 0.55) => `
  <defs>
    <linearGradient id="${p}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
    <radialGradient id="${p}-gl" cx="${gx}" cy="${gy}" r="${gr}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${gc}" stop-opacity="${ga}"/><stop offset="1" stop-color="${gc}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect x="0" y="-400" width="1080" height="2500" fill="url(#${p}-bg)"/>
  <rect id="${p}-glow" x="0" y="-400" width="1080" height="2500" fill="url(#${p}-gl)"/>`;

// GSAP rewrites an SVG element's transform attribute when it tweens x/y, which snaps a
// translate()d group back to the origin. Split `<g id transform>` into a static outer
// group (position) and an inner animated group (same id) so tweens only add offsets.
const splitTransforms = (s) => {
  const re = /<g id="([^"]+)" transform="([^"]+)">/g;
  let pos = 0;
  for (;;) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) break;
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    const tok = /<g[\s>]|<\/g>/g;
    tok.lastIndex = bodyStart;
    let close = -1;
    for (let k; (k = tok.exec(s)); ) {
      depth += k[0] === "</g>" ? -1 : 1;
      if (depth === 0) { close = k.index; break; }
    }
    const open = `<g transform="${m[2]}"><g id="${m[1]}">`;
    s = s.slice(0, m.index) + open + s.slice(bodyStart, close) + "</g></g>" + s.slice(close + 4);
    pos = m.index + open.length;
  }
  return s;
};

const SHIFT = 240; // pushes the whole illustration down so the frame is not top-heavy
const wrap = (inner) => `<svg viewBox="0 0 1080 1920" width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><g transform="translate(0 ${SHIFT})">${splitTransforms(inner)}</g></svg>`;

const txt = (id, x, y, size, str, { fill = C.paper, weight = 800, anchor = "middle", family = FONT, ls = 0, opacity = 1 } = {}) =>
  `<text id="${id}" x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}" opacity="${opacity}">${str}</text>`;

const book = (id, x, y, w, h, color, rot = 0) => `
  <g id="${id}" transform="rotate(${rot} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${color}"/>
    <rect x="${x}" y="${y}" width="${w * 0.08}" height="${h}" fill="#000" opacity=".28"/>
    <rect x="${x + w * 0.15}" y="${y + h * 0.3}" width="${w * 0.6}" height="${h * 0.12}" rx="3" fill="${C.paper}" opacity=".55"/>
    <rect x="${x + 6}" y="${y + h - 14}" width="${w - 12}" height="8" fill="${C.paper}" opacity=".7"/>
  </g>`;

const stars = (p, n, seed = 1) => {
  let s = seed;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += `<circle class="${p}-st" cx="${(r() * 1040 + 20).toFixed(0)}" cy="${(r() * 900 + 60).toFixed(0)}" r="${(r() * 2.6 + 0.8).toFixed(1)}" fill="${C.paper}" opacity="${(r() * 0.6 + 0.2).toFixed(2)}"/>`;
  }
  return out;
};

// Seated student, back to us, lit by a lamp. Origin = desk top centre.
const student = (p, x, y, color = "#0b0b12") => `
  <g id="${p}-stu">
    <circle cx="${x}" cy="${y - 150}" r="46" fill="${color}"/>
    <path d="M${x - 120},${y} C${x - 118},${y - 90} ${x - 70},${y - 110} ${x},${y - 108} C${x + 70},${y - 110} ${x + 118},${y - 90} ${x + 120},${y} Z" fill="${color}"/>
  </g>`;

export const ARTS = {
  // ───────── Hook ─────────
  books(p) {
    return {
      svg: wrap(`${bg(p, "#120a14", C.ink, 540, 640, 620, C.gold, 0.35)}
        ${stars(p, 38, 3)}
        <g id="${p}-pile">
          ${book(`${p}-b1`, 270, 840, 540, 90, "#7a1a22", -1)}
          ${book(`${p}-b2`, 310, 760, 470, 84, "#2d4a7a", 2)}
          ${book(`${p}-b3`, 290, 686, 500, 80, "#c78a2c", -2)}
          ${book(`${p}-b4`, 340, 614, 410, 74, "#2f6b52", 1)}
        </g>
        <g id="${p}-open" transform="translate(540 500)">
          <path d="M-210,40 Q-110,0 0,30 Q110,0 210,40 L210,-130 Q110,-165 0,-135 Q-110,-165 -210,-130 Z" fill="${C.paper}"/>
          <path d="M0,30 L0,-135" stroke="#b9a98a" stroke-width="4"/>
          ${[-100, -70, -40].map((o, i) => `<rect x="-170" y="${o - 60}" width="140" height="8" rx="4" fill="#b9a98a" opacity=".8"/><rect x="30" y="${o - 60}" width="140" height="8" rx="4" fill="#b9a98a" opacity=".8"/>`).join("")}
        </g>
        <path id="${p}-drop" d="${drop(540, 330, 0.8)}" fill="${C.blood}"/>
        ${txt(`${p}-t1`, 540, 280, 96, "शिक्षणासाठी", { fill: C.paper })}
        ${txt(`${p}-t2`, 540, 980, 112, "रक्त?", { fill: C.glow, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-pile > g", { y: -60, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power3.out", stagger: .14 }, ${T + 0.1});
        tl.fromTo("#${p}-open", { scale: .85, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: .8, ease: "power2.out" }, ${T + 0.1});
        tl.fromTo("#${p}-drop", { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: .6, ease: "power2.out" }, ${T + 0.9});
        tl.fromTo("#${p}-drop", { y: 0 }, { y: 560, duration: 1.4, ease: "power2.in", immediateRender: false }, ${T + Math.min(D - 1.6, 7)});
        tl.fromTo("#${p}-t1", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, ${T + 0.05});
        tl.fromTo("#${p}-t2", { opacity: 0, scale: .7, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2)" }, ${T + 1.2});
        tl.to(".${p}-st", { opacity: .15, duration: 1.2, stagger: .03, yoyo: true, repeat: 3, ease: "sine.inOut" }, ${T});`,
    };
  },

  dropripple(p) {
    return {
      svg: wrap(`${bg(p, "#14070b", C.ink, 540, 760, 640, C.blood, 0.5)}
        <rect x="0" y="880" width="1080" height="1040" fill="#0c0508"/>
        ${[0, 1, 2].map((i) => `<ellipse id="${p}-r${i}" cx="540" cy="900" rx="40" ry="12" fill="none" stroke="${C.glow}" stroke-width="5" opacity="0"/>`).join("")}
        <path id="${p}-d" d="${drop(540, 380, 1.5)}" fill="${C.blood}"/>
        <path id="${p}-dh" d="M500,330 Q480,380 495,420" stroke="#ff8a90" stroke-width="12" fill="none" stroke-linecap="round" opacity=".7"/>
        ${txt(`${p}-q`, 540, 960, 66, "हे पैसे कशासाठी?", { fill: C.paper, weight: 800, opacity: 1 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-d, #${p}-dh", { y: -200, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: "power2.out" }, ${T});
        tl.to("#${p}-d, #${p}-dh", { y: 480, duration: 1.3, ease: "power2.in" }, ${T + 1.2});
        tl.set("#${p}-d, #${p}-dh", { opacity: 0 }, ${T + 2.5});
        ${[0, 1, 2].map((i) => `tl.fromTo("#${p}-r${i}", { attr: { rx: 20, ry: 6 }, opacity: .9 }, { attr: { rx: 380, ry: 110 }, opacity: 0, duration: 2, ease: "power2.out" }, ${T + 2.5 + i * 0.35});`).join("\n")}
        tl.fromTo("#${p}-q", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .6 }, ${T + 0.4});`,
    };
  },

  bag(p) {
    return {
      svg: wrap(`${bg(p, "#120709", C.ink, 540, 700, 600, C.blood, 0.4)}
        <rect x="520" y="200" width="40" height="120" fill="#444" />
        <rect x="380" y="300" width="320" height="520" rx="60" fill="#e8dcd0" opacity=".16" stroke="#e8dcd0" stroke-opacity=".5" stroke-width="5"/>
        <clipPath id="${p}-clip"><rect x="384" y="304" width="312" height="512" rx="56"/></clipPath>
        <g clip-path="url(#${p}-clip)"><rect id="${p}-fill" x="384" y="304" width="312" height="512" fill="${C.blood}"/></g>
        <rect x="460" y="360" width="160" height="60" rx="8" fill="#fff" opacity=".85"/>
        ${txt(`${p}-lbl`, 540, 404, 36, "B+  ₹?", { fill: "#222", weight: 900 })}
        <path d="M540,820 L540,930" stroke="#e8dcd0" stroke-opacity=".6" stroke-width="10"/>
        <path id="${p}-dp" d="${drop(540, 1010, .35)}" fill="${C.blood}"/>
        ${txt(`${p}-cap`, 540, 190, 54, "रक्ताची किंमत?", { fill: C.paper, weight: 800, opacity: 0.0 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-fill", { y: 400 }, { y: 0, duration: ${Math.min(D, 6)}, ease: "none" }, ${T});
        tl.fromTo("#${p}-dp", { y: -30, opacity: 0 }, { y: 80, opacity: 1, duration: .9, ease: "power2.in", repeat: ${Math.max(1, Math.floor(D / 1.2) - 1)}, repeatDelay: .3 }, ${T + 0.4});`,
    };
  },

  bookblood(p) {
    return {
      svg: wrap(`${bg(p, "#15090c", C.ink, 540, 760, 640, C.blood2, 0.5)}
        <path d="M120,820 Q330,740 540,800 Q750,740 960,820 L960,420 Q750,350 540,410 Q330,350 120,420 Z" fill="${C.paper}"/>
        <path d="M540,800 L540,410" stroke="#b9a98a" stroke-width="5"/>
        ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="190" y="${470 + i * 52}" width="${300 - (i % 3) * 30}" height="10" rx="5" fill="#b9a98a"/><rect x="590" y="${470 + i * 52}" width="${310 - (i % 2) * 40}" height="10" rx="5" fill="#b9a98a"/>`).join("")}
        <path id="${p}-stain" d="${drop(700, 600, 1.0)}" fill="${C.blood}" opacity="0"/>
        <path id="${p}-pour" d="M700,230 L700,470" stroke="${C.blood}" stroke-width="14" stroke-linecap="round" opacity="0"/>
        ${txt(`${p}-t`, 540, 960, 74, "पैसे शिक्षणासाठी!", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-pour", { opacity: 0, attr: { y2: 230 } }, { opacity: 1, attr: { y2: 500 }, duration: .8, ease: "power2.in" }, ${T + 0.3});
        tl.fromTo("#${p}-stain", { opacity: 0, scale: .1, transformOrigin: "700px 640px" }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, ${T + 1.0});
        tl.to("#${p}-pour", { opacity: 0, duration: .3 }, ${T + 1.5});
        tl.fromTo("#${p}-t", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .6 }, ${T + 0.2});`,
    };
  },

  // ───────── Story ─────────
  city(p) {
    const bld = (x, w, h, c) => `<rect x="${x}" y="${1000 - h}" width="${w}" height="${h}" fill="${c}"/>${Array.from({ length: Math.floor(h / 60) }, (_, i) => Array.from({ length: Math.floor(w / 36) }, (_, j) => `<rect x="${x + 10 + j * 36}" y="${1000 - h + 14 + i * 60}" width="14" height="22" fill="${C.warm}" opacity="${(i * 7 + j * 3 + x) % 5 === 0 ? 0.9 : 0.12}"/>`).join("")).join("")}`;
    return {
      svg: wrap(`${bg(p, "#0f1424", "#1a1018", 540, 880, 700, C.warm, 0.25)}
        ${stars(p, 24, 7)}
        <g id="${p}-sky">
          ${bld(20, 170, 380, "#10131f")}${bld(200, 120, 260, "#161a28")}${bld(330, 190, 460, "#0d1019")}
          ${bld(530, 140, 320, "#151827")}${bld(680, 200, 420, "#0f121d")}${bld(890, 170, 300, "#141726")}
          <path d="M420,540 Q420,470 470,470 Q520,470 520,540 Z" fill="#0d1019"/>
        </g>
        <rect x="0" y="1000" width="1080" height="920" fill="#07080d"/>
        <g id="${p}-pin" transform="translate(540 400)">
          <path d="M0,150 C-70,60 -90,20 -90,-20 A90,90 0 1 1 90,-20 C90,20 70,60 0,150 Z" fill="${C.blood}"/>
          <circle cx="0" cy="-20" r="34" fill="${C.paper}"/>
        </g>
        ${txt(`${p}-nm`, 540, 270, 100, "प्रयागराज", { fill: C.paper, weight: 900 })}
        <g id="${p}-tags">
          <rect x="140" y="860" width="380" height="96" rx="48" fill="${C.paper}"/>
          ${txt(`${p}-tg1`, 330, 924, 52, "NEET", { fill: C.ink, weight: 900, family: "'Inter',sans-serif" })}
          <rect x="560" y="860" width="380" height="96" rx="48" fill="${C.paper}"/>
          ${txt(`${p}-tg2`, 750, 924, 52, "SSC", { fill: C.ink, weight: 900, family: "'Inter',sans-serif" })}
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-sky", { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: "power2.out" }, ${T});
        tl.fromTo("#${p}-nm", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: .6, ease: "power3.out" }, ${T + 0.3});
        tl.fromTo("#${p}-pin", { y: -300, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "bounce.out" }, ${T + 0.6});
        tl.fromTo("#${p}-tags", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .6, ease: "power2.out" }, ${T + 2.2});`,
    };
  },

  news(p) {
    return {
      svg: wrap(`${bg(p, "#16110c", C.ink, 540, 640, 640, C.warm, 0.2)}
        <g id="${p}-paper" transform="rotate(-3 540 600)">
          <rect x="130" y="260" width="820" height="720" fill="${C.paper}"/>
          <rect x="130" y="260" width="820" height="110" fill="#1b1b1b"/>
          ${txt(`${p}-hd`, 540, 342, 70, "दैनिक भास्कर", { fill: C.paper, weight: 900 })}
          <rect x="170" y="410" width="740" height="16" fill="#1b1b1b" opacity=".85"/>
          <rect x="170" y="446" width="520" height="16" fill="#1b1b1b" opacity=".85"/>
          ${txt(`${p}-inv`, 540, 590, 92, "INVESTIGATION", { fill: C.blood, weight: 900, family: "'Inter',sans-serif" })}
          ${[0, 1, 2, 3, 4].map((i) => `<rect x="170" y="${650 + i * 40}" width="${i === 4 ? 360 : 740}" height="10" fill="#7d7468" opacity=".7"/>`).join("")}
        </g>
        <g id="${p}-lens" transform="translate(760 760)">
          <circle r="120" fill="none" stroke="${C.gold}" stroke-width="16"/>
          <path d="M84,84 L190,190" stroke="${C.gold}" stroke-width="24" stroke-linecap="round"/>
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-paper", { y: 400, opacity: 0, rotation: -14, transformOrigin: "50% 50%" }, { y: 0, opacity: 1, rotation: -3, duration: .9, ease: "power3.out" }, ${T});
        tl.fromTo("#${p}-lens", { x: -300, y: -100, opacity: 0 }, { x: 0, y: 0, opacity: 1, duration: 1.2, ease: "power2.out" }, ${T + 1.0});`,
    };
  },

  hostel(p) {
    const wins = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++) {
        const lit = r === 2 && c === 1;
        wins.push(`<rect x="${200 + c * 170}" y="${290 + r * 170}" width="110" height="120" fill="${lit ? C.warm : "#1a2030"}" ${lit ? `id="${p}-lit"` : ""} opacity="${lit ? 1 : 0.6}"/>`);
      }
    return {
      svg: wrap(`${bg(p, "#0d1020", "#0a0a10", 540, 720, 560, C.warm, 0.18)}
        <rect x="150" y="230" width="780" height="770" fill="#131726"/>
        ${wins.join("")}
        <g id="${p}-person" transform="translate(425 790)"><circle cx="0" cy="-36" r="16" fill="#0b0b12"/><path d="M-30,10 C-30,-24 -10,-26 0,-26 C10,-26 30,-24 30,10 Z" fill="#0b0b12"/></g>
        <g id="${p}-cal" transform="translate(540 880)">
          <rect x="-250" y="-110" width="500" height="210" rx="22" fill="${C.paper}"/>
          <rect x="-250" y="-110" width="500" height="64" rx="22" fill="${C.blood}"/>
          ${txt(`${p}-c1`, 0, -62, 40, "हॉस्टेल फी बाकी", { fill: "#fff", weight: 800 })}
          ${txt(`${p}-c2`, 0, 50, 96, "२ महिने", { fill: C.ink, weight: 900 })}
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-lit", { opacity: .15 }, { opacity: 1, duration: 1.0, ease: "power2.out" }, ${T + 0.4});
        tl.fromTo("#${p}-person", { opacity: 0 }, { opacity: 1, duration: .8 }, ${T + 0.9});
        tl.fromTo("#${p}-cal", { y: 100, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: "back.out(1.6)" }, ${T + 2.0});
        tl.to("#${p}-lit", { opacity: .55, duration: .12, yoyo: true, repeat: 5 }, ${T + Math.max(3.5, D - 3)});`,
    };
  },

  homeless(p) {
    return {
      svg: wrap(`${bg(p, "#0b0e1a", "#06070c", 540, 900, 700, C.slate2, 0.4)}
        ${stars(p, 30, 11)}
        <rect x="0" y="1000" width="1080" height="920" fill="#05060a"/>
        <g id="${p}-who" transform="translate(540 1000)">
          <circle cx="0" cy="-210" r="44" fill="#0e0f18"/>
          <path d="M-90,0 C-90,-100 -50,-160 0,-160 C50,-160 90,-100 90,0 Z" fill="#0e0f18"/>
          <path d="M-120,0 L-190,0 L-190,-70 Z" fill="#0e0f18"/>
          <rect x="130" y="-60" width="110" height="60" rx="8" fill="#171925"/>
        </g>
        <g id="${p}-bag"><rect x="148" y="760" width="120" height="240" rx="14" fill="#171925"/></g>
        ${txt(`${p}-q1`, 540, 330, 110, "राहायचं कुठे?", { fill: C.paper, weight: 900 })}
        ${txt(`${p}-q2`, 540, 520, 80, "अभ्यास कसा?", { fill: C.glow, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-who", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, ${T});
        tl.fromTo("#${p}-q1", { opacity: 0, scale: .8, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2)" }, ${T + 0.2});
        tl.fromTo("#${p}-q2", { opacity: 0, scale: .8, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: .5, ease: "back.out(2)" }, ${T + Math.max(1.8, D * 0.45)});`,
    };
  },

  receipt(p) {
    return {
      svg: wrap(`${bg(p, "#101420", C.ink, 540, 640, 640, C.gold, 0.18)}
        <g id="${p}-rc" transform="rotate(4 540 640)">
          <rect x="220" y="260" width="640" height="720" fill="${C.paper}"/>
          ${txt(`${p}-h`, 540, 360, 56, "COACHING FEE", { fill: C.ink, weight: 900, family: "'Inter',sans-serif" })}
          <rect x="270" y="400" width="540" height="6" fill="${C.ink}" opacity=".6"/>
          ${[0, 1, 2, 3].map((i) => `<rect x="270" y="${450 + i * 60}" width="${i % 2 ? 300 : 420}" height="12" fill="#7d7468" opacity=".7"/><rect x="700" y="${450 + i * 60}" width="110" height="12" fill="#7d7468" opacity=".7"/>`).join("")}
          ${txt(`${p}-rs`, 540, 800, 150, "₹ ?", { fill: C.ink, weight: 900 })}
        </g>
        <g id="${p}-st" transform="translate(540 880) rotate(-14)">
          <rect x="-240" y="-70" width="480" height="140" rx="16" fill="none" stroke="${C.blood}" stroke-width="12"/>
          ${txt(`${p}-stt`, 0, 36, 92, "बाकी", { fill: C.blood, weight: 900 })}
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-rc", { y: 500, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: "power3.out" }, ${T});
        tl.fromTo("#${p}-st", { scale: 2.2, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: .35, ease: "power4.in" }, ${T + 1.6});`,
    };
  },

  farm(p) {
    return {
      svg: wrap(`${bg(p, "#2a1218", "#120a0c", 540, 720, 640, C.warm, 0.55)}
        <circle id="${p}-sun" cx="540" cy="700" r="130" fill="${C.warm}" opacity=".9"/>
        <path d="M0,860 Q270,800 540,850 T1080,820 L1080,1920 L0,1920 Z" fill="#0b0a0a"/>
        ${Array.from({ length: 11 }, (_, i) => `<path d="M${-60 + i * 110},1920 L${380 + i * 30},880" stroke="#1d1410" stroke-width="10" opacity=".8"/>`).join("")}
        <g id="${p}-dad" transform="translate(330 880)">
          <circle cx="0" cy="-250" r="34" fill="#050405"/>
          <path d="M-52,0 C-52,-120 -30,-215 0,-215 C30,-215 52,-120 52,0 Z" fill="#050405"/>
          <path d="M60,-210 L150,40" stroke="#050405" stroke-width="12" stroke-linecap="round"/>
          <path d="M120,10 L190,60" stroke="#050405" stroke-width="12" stroke-linecap="round"/>
        </g>
        <g id="${p}-home" transform="translate(800 880)"><path d="M-110,0 L-110,-100 L0,-190 L110,-100 L110,0 Z" fill="#050405"/><rect x="-24" y="-70" width="48" height="70" fill="${C.warm}" opacity=".8"/></g>
        ${txt(`${p}-t`, 540, 300, 96, "शेती आहे, पण…", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-sun", { y: 140 }, { y: 0, duration: ${Math.min(D, 8)}, ease: "none" }, ${T});
        tl.fromTo("#${p}-dad", { x: -120, opacity: 0 }, { x: 0, opacity: 1, duration: 1.4, ease: "power2.out" }, ${T + 0.2});
        tl.fromTo("#${p}-t", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: .6 }, ${T + 0.6});`,
    };
  },

  costs(p) {
    const items = [
      ["Coaching", "कोचिंग", "#8a1b25"],
      ["Hostel", "हॉस्टेल", "#6d2a60"],
      ["Food", "जेवण", "#1f5b6e"],
      ["Books", "पुस्तकं", "#a8741c"],
    ];
    return {
      svg: wrap(`${bg(p, "#120d14", C.ink, 540, 560, 620, C.blood2, 0.35)}
        ${items
          .map(
            (it, i) => `<g id="${p}-c${i}"><rect x="120" y="${230 + i * 190}" width="840" height="156" rx="30" fill="${it[2]}"/>
          ${txt(`${p}-cn${i}`, 190, `${230 + i * 190 + 98}`, 64, it[1], { fill: "#fff", weight: 900, anchor: "start" })}
          ${txt(`${p}-cv${i}`, 900, `${230 + i * 190 + 98}`, 64, "₹ ?", { fill: C.paper, weight: 900, anchor: "end" })}</g>`,
          )
          .join("")}
      `),
      js: (T, D) => `
        ${items.map((_, i) => `tl.fromTo("#${p}-c${i}", { x: 1100, opacity: 0 }, { x: 0, opacity: 1, duration: .5, ease: "power3.out" }, ${(T + 1.4 + i * Math.max(0.9, (D - 3) / 4)).toFixed(2)});`).join("\n")}`,
    };
  },

  question(p) {
    return {
      svg: wrap(`${bg(p, "#0f0b14", C.ink, 540, 640, 620, C.slate2, 0.55)}
        <g id="${p}-wal">
          <path d="M200,700 L880,700 L880,980 Q880,1020 840,1020 L240,1020 Q200,1020 200,980 Z" fill="#2a2018"/>
          <path d="M200,700 L880,700 L880,820 L200,820 Z" fill="#3a2d20"/>
          <circle cx="780" cy="840" r="30" fill="${C.gold}" opacity=".85"/>
        </g>
        ${txt(`${p}-q`, 540, 640, 460, "?", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-q", { opacity: 0, scale: .4, transformOrigin: "50% 60%" }, { opacity: 1, scale: 1, duration: .7, ease: "back.out(2)" }, ${T});
        tl.fromTo("#${p}-wal", { y: 60, opacity: 0 }, { y: 0, opacity: .95, duration: .8 }, ${T + 0.4});
        tl.to("#${p}-q", { rotation: 4, duration: .25, yoyo: true, repeat: 3, transformOrigin: "50% 60%", ease: "sine.inOut" }, ${T + 1.4});`,
    };
  },

  bagfinal(p) {
    return {
      svg: wrap(`${bg(p, "#1b070b", C.ink, 540, 640, 700, C.blood, 0.55)}
        <g id="${p}-hang">
          <rect x="525" y="180" width="30" height="130" fill="#555"/>
          <rect x="380" y="300" width="320" height="500" rx="60" fill="#e8dcd0" opacity=".16" stroke="#e8dcd0" stroke-opacity=".55" stroke-width="5"/>
          <clipPath id="${p}-cl"><rect x="384" y="304" width="312" height="492" rx="56"/></clipPath>
          <g clip-path="url(#${p}-cl)"><rect id="${p}-lvl" x="384" y="304" width="312" height="492" fill="${C.blood}"/></g>
          <path d="M540,800 C540,900 540,980 540,1010" stroke="#e8dcd0" stroke-opacity=".6" stroke-width="10" fill="none"/>
        </g>
        ${txt(`${p}-w`, 540, 960, 76, "धोकादायक पाऊल", { fill: C.glow, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-hang", { y: -80, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: "power2.out" }, ${T});
        tl.fromTo("#${p}-lvl", { y: 0 }, { y: 440, duration: ${Math.max(2, D - 1)}, ease: "none" }, ${T + 0.6});
        tl.fromTo("#${p}-w", { opacity: 0 }, { opacity: 1, duration: .6 }, ${T + 1.4});`,
    };
  },

  // ───────── Emotional peak ─────────
  vichar(p) {
    return {
      svg: wrap(`${bg(p, "#090609", C.ink, 540, 640, 560, C.blood2, 0.3)}
        ${txt(`${p}-v`, 540, 760, 200, "विचार करा…", { fill: C.paper, weight: 900, family: SERIF })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-v", { opacity: 0, scale: 1.18, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 1.4, ease: "power2.out" }, ${T});`,
    };
  },

  parents(p) {
    return {
      svg: wrap(`${bg(p, "#26141a", "#0e080a", 540, 760, 640, C.warm, 0.4)}
        <rect x="0" y="1000" width="1080" height="920" fill="#080506"/>
        <g id="${p}-pr" transform="translate(540 1000)">
          <g transform="translate(-140 0)"><circle cx="0" cy="-330" r="40" fill="#050304"/><path d="M-60,0 C-60,-130 -40,-290 0,-290 C40,-290 60,-130 60,0 Z" fill="#050304"/></g>
          <g transform="translate(140 0)"><circle cx="0" cy="-310" r="38" fill="#050304"/><path d="M-70,0 C-70,-120 -44,-272 0,-272 C44,-272 70,-120 70,0 Z" fill="#050304"/></g>
          <g transform="translate(0 0)"><circle cx="0" cy="-200" r="30" fill="#050304"/><path d="M-40,0 C-40,-80 -26,-166 0,-166 C26,-166 40,-80 40,0 Z" fill="#050304"/></g>
        </g>
        <g id="${p}-dr">
          <g id="${p}-d1" transform="translate(200 360)"><circle r="82" fill="${C.paper}" opacity=".12"/>${txt(`${p}-d1t`, 0, 24, 70, "डॉक्टर", { fill: C.paper, weight: 900 }).replace('font-size="70"', 'font-size="46"')}</g>
          <g id="${p}-d2" transform="translate(540 270)"><circle r="82" fill="${C.paper}" opacity=".12"/>${txt(`${p}-d2t`, 0, 24, 70, "अधिकारी", { fill: C.paper, weight: 900 }).replace('font-size="70"', 'font-size="44"')}</g>
          <g id="${p}-d3" transform="translate(880 360)"><circle r="82" fill="${C.paper}" opacity=".12"/>${txt(`${p}-d3t`, 0, 24, 70, "मोठे", { fill: C.paper, weight: 900 }).replace('font-size="70"', 'font-size="50"')}</g>
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-pr", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: "power2.out" }, ${T});
        ${["d1", "d2", "d3"].map((d, i) => `tl.fromTo("#${p}-${d}", { opacity: 0, scale: .4, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: .6, ease: "back.out(2)" }, ${T + 1.2 + i * 1.3});`).join("\n")}`,
    };
  },

  body(p) {
    return {
      svg: wrap(`${bg(p, "#14080c", C.ink, 540, 640, 560, C.blood, 0.45)}
        <g id="${p}-fig">
          <circle cx="540" cy="360" r="82" fill="#0a0507" stroke="${C.mute}" stroke-opacity=".5" stroke-width="3"/>
          <path d="M360,880 C360,560 440,470 540,470 C640,470 720,560 720,880 Z" fill="#0a0507" stroke="${C.mute}" stroke-opacity=".5" stroke-width="3"/>
          <g id="${p}-ht" transform="translate(540 640)"><path d="M0,60 C-130,-30 -70,-110 0,-50 C70,-110 130,-30 0,60 Z" fill="${C.blood}"/></g>
        </g>
        <g id="${p}-tag" transform="translate(800 520) rotate(12)">
          <rect x="-120" y="-60" width="240" height="120" rx="20" fill="${C.paper}"/>
          <circle cx="-86" cy="-20" r="12" fill="${C.ink}"/>
          ${txt(`${p}-pr`, 20, 28, 76, "₹ ?", { fill: C.ink, weight: 900 })}
        </g>
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-fig", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .9, ease: "power2.out" }, ${T});
        tl.fromTo("#${p}-ht", { scale: 1, transformOrigin: "50% 50%" }, { scale: 1.18, duration: .35, yoyo: true, repeat: ${Math.max(3, Math.floor(D / 0.7))}, ease: "sine.inOut" }, ${T + 0.5});
        tl.fromTo("#${p}-tag", { x: 300, opacity: 0 }, { x: 0, opacity: 1, duration: .6, ease: "back.out(1.6)" }, ${T + 1.8});`,
    };
  },

  dream(p) {
    return {
      svg: wrap(`${bg(p, "#0a1030", "#150b18", 540, 360, 700, "#3a4aa8", 0.5)}
        ${stars(p, 60, 5)}
        <path id="${p}-path" d="M160,960 C260,800 420,820 520,640 S760,420 900,260" stroke="${C.gold}" stroke-width="10" fill="none" stroke-linecap="round" stroke-dasharray="1400" stroke-dashoffset="1400"/>
        <g id="${p}-star" transform="translate(900 260)"><path d="M0,-60 L16,-18 L60,-18 L24,10 L38,54 L0,28 L-38,54 L-24,10 L-60,-18 L-16,-18 Z" fill="${C.gold}"/></g>
        ${txt(`${p}-t`, 540, 990, 72, "स्वप्नांपर्यंतचा प्रवास", { fill: C.paper, weight: 900, opacity: 1 })}
      `),
      js: (T, D) => `
        tl.to("#${p}-path", { strokeDashoffset: 0, duration: ${Math.min(D - 0.5, 5)}, ease: "power1.inOut" }, ${T + 0.2});
        tl.fromTo("#${p}-star", { scale: 0, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: .7, ease: "back.out(2)" }, ${T + Math.min(D - 1.2, 4.6)});
        tl.fromTo("#${p}-t", { opacity: 0 }, { opacity: 1, duration: .6 }, ${T + 0.4});`,
    };
  },

  barrier(p) {
    return {
      svg: wrap(`${bg(p, "#0a1030", "#150b18", 540, 360, 700, "#3a4aa8", 0.3)}
        ${stars(p, 40, 9)}
        ${Array.from({ length: 5 }, (_, i) => `<rect id="${p}-s${i}" x="${150 + i * 150}" y="${900 - i * 120}" width="170" height="${120 + i * 120 + 40}" fill="#1c2340" stroke="#2f3a66" stroke-width="3"/>`).join("")}
        <g id="${p}-stk" transform="translate(790 560)">
          <rect x="-190" y="-70" width="380" height="140" rx="20" fill="${C.blood}"/>
          ${txt(`${p}-stt`, 0, 30, 90, "₹ खर्च", { fill: "#fff", weight: 900 }).replace('font-size="90"', 'font-size="72"')}
        </g>
        <g id="${p}-sm"><circle cx="880" cy="270" r="70" fill="${C.gold}" opacity=".2"/><path d="M880,220 L892,258 L930,258 L900,280 L912,318 L880,296 L848,318 L860,280 L830,258 L868,258 Z" fill="${C.gold}"/></g>
      `),
      js: (T, D) => `
        ${[0, 1, 2, 3, 4].map((i) => `tl.fromTo("#${p}-s${i}", { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: .45, ease: "power2.out" }, ${(T + 0.2 + i * 0.35).toFixed(2)});`).join("\n")}
        tl.fromTo("#${p}-stk", { scale: 2.5, opacity: 0, transformOrigin: "50% 50%" }, { scale: 1, opacity: 1, duration: .4, ease: "power4.in" }, ${T + 2.6});
        tl.to("#${p}-sm", { opacity: .35, duration: .4 }, ${T + 3.0});`,
    };
  },

  ecg(p) {
    return {
      svg: wrap(`${bg(p, "#0c0507", C.ink, 540, 640, 640, C.blood, 0.4)}
        <path id="${p}-ln" d="M0,640 L220,640 L260,640 L300,520 L350,760 L400,640 L520,640 L560,640 L600,470 L650,820 L700,640 L820,640 L1080,640" stroke="${C.glow}" stroke-width="10" fill="none" stroke-linejoin="round" stroke-linecap="round" stroke-dasharray="1500" stroke-dashoffset="1500"/>
        <g id="${p}-wn" transform="translate(540 330)"><path d="M0,-120 L130,100 L-130,100 Z" fill="none" stroke="${C.gold}" stroke-width="14" stroke-linejoin="round"/>${txt(`${p}-ex`, 0, 62, 120, "!", { fill: C.gold, weight: 900 })}</g>
        ${txt(`${p}-t`, 540, 940, 78, "आरोग्याला धोका", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.to("#${p}-ln", { strokeDashoffset: 0, duration: 2.2, ease: "none" }, ${T});
        tl.fromTo("#${p}-wn", { scale: 0, opacity: 0, transformOrigin: "50% 60%" }, { scale: 1, opacity: 1, duration: .5, ease: "back.out(2)" }, ${T + 2.0});
        tl.fromTo("#${p}-wn", { opacity: 1 }, { opacity: .45, immediateRender: false, duration: .35, yoyo: true, repeat: ${Math.max(3, Math.floor((D - 3) / 0.7))}, ease: "sine.inOut" }, ${T + 3.0});
        tl.fromTo("#${p}-t", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .6 }, ${T + 2.4});`,
    };
  },

  // ───────── Ending ─────────
  emptydesk(p) {
    return {
      svg: wrap(`${bg(p, "#0b0d16", C.ink, 540, 760, 520, C.warm, 0.22)}
        <rect x="0" y="1000" width="1080" height="920" fill="#06070b"/>
        <rect x="190" y="800" width="700" height="40" fill="#2a2018"/>
        <rect x="230" y="840" width="26" height="170" fill="#2a2018"/><rect x="824" y="840" width="26" height="170" fill="#2a2018"/>
        <g id="${p}-bk"><path d="M380,800 L380,640 Q470,620 540,650 Q610,620 700,640 L700,800 Z" fill="${C.paper}"/><path d="M540,650 L540,800" stroke="#b9a98a" stroke-width="4"/></g>
        <path id="${p}-dp" d="${drop(540, 600, .5)}" fill="${C.blood}"/>
        ${txt(`${p}-t`, 540, 360, 90, "प्रश्न फक्त त्यांचा नाही", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-bk", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8 }, ${T});
        tl.fromTo("#${p}-t", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: .7, ease: "power2.out" }, ${T + 0.3});
        tl.fromTo("#${p}-dp", { y: -300, opacity: 0 }, { y: 150, opacity: 1, duration: 1.1, ease: "power2.in" }, ${T + 1.0});`,
    };
  },

  system(p) {
    return {
      svg: wrap(`${bg(p, "#0e1018", C.ink, 540, 700, 640, C.slate2, 0.45)}
        <g id="${p}-bd">
          <path d="M140,880 L140,520 L540,340 L940,520 L940,880 Z" fill="#171b2a"/>
          ${Array.from({ length: 5 }, (_, i) => `<rect x="${190 + i * 150}" y="580" width="60" height="300" fill="#0f121d"/>`).join("")}
          <rect x="100" y="880" width="880" height="50" fill="#222840"/>
          <rect x="80" y="930" width="920" height="50" fill="#1b2034"/>
        </g>
        <path id="${p}-cr" d="M540,350 L520,470 L570,540 L510,650 L560,760 L520,880" stroke="${C.glow}" stroke-width="12" fill="none" stroke-linejoin="round" stroke-dasharray="700" stroke-dashoffset="700"/>
        ${txt(`${p}-t`, 540, 1000, 78, "शिक्षणव्यवस्था?", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-bd", { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: "power2.out" }, ${T});
        tl.to("#${p}-cr", { strokeDashoffset: 0, duration: 1.2, ease: "power2.in" }, ${T + 2.0});
        tl.fromTo("#${p}-t", { opacity: 0 }, { opacity: 1, duration: .6 }, ${T + 1.0});`,
    };
  },

  balance(p) {
    return {
      svg: wrap(`${bg(p, "#0a0c14", C.ink, 540, 600, 620, C.gold, 0.2)}
        <rect x="528" y="300" width="24" height="640" fill="#2a2e44"/>
        <rect x="380" y="930" width="320" height="30" rx="8" fill="#2a2e44"/>
        <g id="${p}-beam" transform="translate(540 330)">
          <rect x="-340" y="-10" width="680" height="20" rx="10" fill="${C.gold}"/>
          <g id="${p}-lp"><path d="M-340,10 L-340,230" stroke="${C.mute}" stroke-width="4"/><path d="M-410,230 L-270,230 Q-340,300 -410,230 Z" fill="${C.gold}"/>
            <rect x="-380" y="150" width="80" height="80" fill="#2d4a7a"/>${txt(`${p}-la`, -340, 100, 40, "शिक्षण", { fill: C.paper, weight: 900 })}</g>
          <g id="${p}-rp"><path d="M340,10 L340,230" stroke="${C.mute}" stroke-width="4"/><path d="M270,230 L410,230 Q340,300 270,230 Z" fill="${C.gold}"/>
            <path d="${drop(340, 200, .45)}" fill="${C.blood}"/>${txt(`${p}-ra`, 340, 100, 40, "आयुष्य", { fill: C.glow, weight: 900 })}</g>
        </g>
        ${txt(`${p}-t`, 540, 990, 70, "साधन — धोका नाही", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-beam", { rotation: -14, transformOrigin: "50% 50%" }, { rotation: 0, duration: 1.8, ease: "elastic.out(1,.5)" }, ${T + 0.4});
        tl.fromTo("#${p}-t", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .6 }, ${T + 0.2});`,
    };
  },

  sunrise(p) {
    return {
      svg: wrap(`${bg(p, "#1a0b14", "#0a0608", 540, 840, 760, C.warm, 0.7)}
        <circle id="${p}-sun" cx="540" cy="860" r="170" fill="${C.warm}"/>
        <rect x="0" y="900" width="1080" height="1020" fill="#060406"/>
        <g id="${p}-crowd" transform="translate(0 900)">
          ${Array.from({ length: 11 }, (_, i) => `<g transform="translate(${70 + i * 94} 0)"><circle cx="0" cy="${-120 - (i % 3) * 14}" r="26" fill="#030203"/><path d="M-36,0 C-36,-70 -24,-96 0,-96 C24,-96 36,-70 36,0 Z" transform="translate(0 ${-(i % 3) * 14})" fill="#030203"/></g>`).join("")}
        </g>
        ${[0, 1, 2].map((i) => `<path id="${p}-dp${i}" d="${drop(240 + i * 300, 420, .32)}" fill="${C.blood}" opacity="0"/>`).join("")}
        ${txt(`${p}-t`, 540, 330, 82, "कोणता विकास?", { fill: C.paper, weight: 900 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-sun", { y: 170 }, { y: 0, duration: ${Math.min(D - 1, 9)}, ease: "power1.out" }, ${T});
        tl.fromTo("#${p}-crowd", { opacity: 0 }, { opacity: 1, duration: 1 }, ${T});
        ${[0, 1, 2].map((i) => `tl.fromTo("#${p}-dp${i}", { y: -40, opacity: 0 }, { y: 360, opacity: 1, duration: 1.8, ease: "power2.in" }, ${(T + 2 + i * 1.6).toFixed(2)});
        tl.set("#${p}-dp${i}", { opacity: 0 }, ${(T + 3.8 + i * 1.6).toFixed(2)});`).join("\n")}
        tl.fromTo("#${p}-t", { opacity: 0, y: -20 }, { opacity: 1, y: 0, duration: .7 }, ${T + 0.4});`,
    };
  },

  finale(p) {
    return {
      svg: wrap(`${bg(p, "#0a0507", "#030203", 540, 760, 520, C.blood, 0.55)}
        <path id="${p}-d" d="${drop(540, 640, 1.4)}" fill="${C.blood}"/>
        ${txt(`${p}-t`, 540, 960, 150, "विचार करा!", { fill: C.paper, weight: 900, family: SERIF })}
        ${txt(`${p}-src`, 540, 1090, 40, "स्रोत: दैनिक भास्कर", { fill: C.mute, weight: 700 })}
      `),
      js: (T, D) => `
        tl.fromTo("#${p}-d", { scale: 0.2, opacity: 0, transformOrigin: "50% 60%" }, { scale: 1, opacity: 1, duration: 1.0, ease: "back.out(1.6)" }, ${T});
        tl.fromTo("#${p}-d", { scale: 1 }, { scale: 1.07, immediateRender: false, duration: .55, yoyo: true, repeat: ${Math.max(2, Math.floor((D - 1.2) / 1.1))}, ease: "sine.inOut", transformOrigin: "50% 60%" }, ${T + 1.1});
        tl.fromTo("#${p}-t", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .8, ease: "power3.out" }, ${T + 0.5});
        tl.fromTo("#${p}-src", { opacity: 0 }, { opacity: 1, duration: .8 }, ${T + 1.6});`,
    };
  },
};
