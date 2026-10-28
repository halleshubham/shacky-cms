// Builds index.html + compositions/*.html from assets/timeline.json and tools/art.mjs.
// Re-run after changing the script/voiceover:  node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARTS } from "./art.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tlData = JSON.parse(readFileSync(join(root, "assets/timeline.json"), "utf8"));
const lines = tlData.lines;
const TAIL = 3.0;
const TOTAL = +(tlData.total + TAIL).toFixed(2);
const XF = 0.25; // crossfade overlap

// line id -> arts shown (split evenly across the line's time)
const PLAN = {
  h1: ["books", "bag"], h2: ["dropripple"], h3: ["bookblood"],
  m1: ["city", "news"], m2: ["hostel", "homeless"], m3: ["receipt"], m4: ["farm"],
  m5: ["costs"], m6: ["question"], m7: ["bagfinal"],
  e1: ["vichar"], e2: ["parents"], e3: ["body"], e4: ["dream"], e5: ["barrier"], e6: ["ecg"],
  n1: ["emptydesk"], n2: ["system"], n3: ["balance"], n4: ["sunrise"], n5: ["finale"],
};
const SECTIONS = [["hook", "hook"], ["story", "story"], ["peak", "peak"], ["ending", "ending"]];

const FONTS = `
@font-face{font-family:'NotoSansDev';font-weight:700;src:url('assets/fonts/noto-sans-devanagari-devanagari-700-normal.woff2') format('woff2')}
@font-face{font-family:'NotoSansDev';font-weight:800;src:url('assets/fonts/noto-sans-devanagari-devanagari-800-normal.woff2') format('woff2')}
@font-face{font-family:'NotoSansDev';font-weight:900;src:url('assets/fonts/noto-sans-devanagari-devanagari-900-normal.woff2') format('woff2')}
@font-face{font-family:'NotoSerifDev';font-weight:700;src:url('assets/fonts/noto-serif-devanagari-devanagari-700-normal.woff2') format('woff2')}`;

// ── beats ──
const beats = []; // {id, art, start, end, section}
let n = 0;
lines.forEach((l, li) => {
  const arts = PLAN[l.id];
  const next = lines[li + 1];
  const lineEnd = next ? next.start : TOTAL;
  arts.forEach((art, i) => {
    const s = l.start + ((lineEnd - l.start) * i) / arts.length;
    const e = l.start + ((lineEnd - l.start) * (i + 1)) / arts.length;
    beats.push({ id: `b${++n}`, art, start: i === 0 && li === 0 ? 0 : s - XF, end: e, section: l.section });
  });
});
beats[0].start = 0;

const sceneOf = (sec) => beats.filter((b) => b.section === sec);
const sceneFiles = [];
for (const [sec] of SECTIONS) {
  const bs = sceneOf(sec);
  const start = bs[0].start;
  const nextSec = SECTIONS[SECTIONS.findIndex((s) => s[0] === sec) + 1];
  const end = nextSec ? sceneOf(nextSec[0])[0].start : TOTAL;
  const grade = { hook: "none", story: "none", peak: "radial-gradient(ellipse at 50% 40%, transparent 30%, rgba(60,0,8,.45) 100%)", ending: "radial-gradient(ellipse at 50% 40%, transparent 25%, rgba(0,0,0,.55) 100%)" }[sec];
  let html = "", js = "";
  bs.forEach((b) => {
    const p = b.id;
    const a = ARTS[b.art](p);
    const T = +(b.start - start).toFixed(3);
    const D = +(b.end - b.start).toFixed(3);
    html += `\n  <div id="${p}" class="clip beat" data-start="${T}" data-duration="${D}"><div id="${p}-fx" class="fx">${a.svg}</div></div>`;
    js += `\n  // ${b.art}\n  tl.fromTo("#${p}-fx", { opacity: 0 }, { opacity: 1, duration: ${b.start === 0 ? 0.01 : 0.35}, ease: "power1.out" }, ${T});` +
      `\n  tl.fromTo("#${p}-fx", { scale: 1.0 }, { scale: 1.07, duration: ${D}, ease: "none", immediateRender: false }, ${T});` +
      (b.end < end ? `\n  tl.to("#${p}-fx", { opacity: 0, duration: 0.2 }, ${(T + D - 0.2).toFixed(3)});` : "") +
      a.js(T, D);
  });
  writeFileSync(join(root, `compositions/scene-${sec}.html`), `<template>
<style>
${FONTS}
#root { position:absolute; inset:0; overflow:hidden; font-family:'NotoSansDev','Inter',sans-serif; }
.beat { position:absolute; inset:0; }
.fx { position:absolute; inset:0; transform-origin:50% 42%; }
.fx svg { display:block; }
.grade { position:absolute; inset:0; background:${grade}; pointer-events:none; }
</style>
<div id="root" data-composition-id="scene-${sec}" data-width="1080" data-height="1920">${html}
  <div class="grade" data-layout-ignore></div>
</div>
<script>
  const tl = gsap.timeline({ paused: true });${js}
  window.__timelines["scene-${sec}"] = tl;
</script>
</template>
`);
  sceneFiles.push({ sec, start: +start.toFixed(3), dur: +(end - start).toFixed(3) });
}

// ── captions ──
const words = lines.flatMap((l) => l.words.map((w) => ({ ...w, line: l.id })));
const clean = (t) => t.replace(/[“”"*]/g, "");
const ACCENT = /रक्त|शिक्षण|स्वप्न|धोका|धोकादायक|विकासा|आयुष्य/;
const groups = [];
let cur = [];
const flush = () => { if (cur.length) groups.push(cur); cur = []; };
words.forEach((w, i) => {
  const prev = cur[cur.length - 1];
  const chars = cur.reduce((a, x) => a + clean(x.text).length, 0) + clean(w.text).length;
  if (prev && (prev.line !== w.line || chars > 24 || cur.length >= 3 || w.start - prev.end > 0.5)) flush();
  cur.push(w);
  if (/[,?!…।.]$/.test(w.text)) flush();
});
flush();
let chtml = "", cjs = "";
groups.forEach((g, gi) => {
  const s = Math.max(0.1, g[0].start - 0.04);
  const nextS = groups[gi + 1] ? groups[gi + 1][0].start - 0.04 : TOTAL;
  const e = Math.min(g[g.length - 1].end + 0.35, nextS - 0.02);
  const id = `g${gi}`;
  chtml += `\n  <div id="${id}" class="clip cg" data-start="${s.toFixed(3)}" data-duration="${(e - s).toFixed(3)}"><div class="cl">${g.map((w, wi) => `<span id="${id}w${wi}" class="${ACCENT.test(w.text) ? "ac" : ""}">${clean(w.text)}</span>`).join(" ")}</div></div>`;
  g.forEach((w, wi) => {
    const t = +(w.start - s).toFixed(3);
    cjs += `\n  tl.fromTo("#${id}w${wi}", { opacity: 0.35, y: 8 }, { opacity: 1, y: 0, duration: .12, ease: "power2.out" }, ${(s + Math.max(0, t)).toFixed(3)});`;
  });
  cjs += `\n  tl.fromTo("#${id} .cl", { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: .1, ease: "power2.out" }, ${s.toFixed(3)});`;
  cjs += `\n  tl.to("#${id} .cl", { opacity: 0, duration: .08 }, ${(e - 0.09).toFixed(3)});`;
});
writeFileSync(join(root, "compositions/captions.html"), `<template>
<style>
${FONTS}
#root { position:absolute; inset:0; font-family:'NotoSansDev','Inter',sans-serif; }
.cg { position:absolute; left:90px; width:900px; top:1010px; height:260px; display:flex; align-items:flex-end; justify-content:center; }
.cl { width:100%; text-align:center; font-weight:900; font-size:84px; line-height:1.3; color:#fff;
  text-shadow: 0 4px 0 rgba(0,0,0,.65), 0 0 28px rgba(0,0,0,.9); }
.cl .ac { color:#ff4653; }
</style>
<div id="root" data-composition-id="captions" data-width="1080" data-height="1920">${chtml}
</div>
<script>
  const tl = gsap.timeline({ paused: true });${cjs}
  window.__timelines["captions"] = tl;
</script>
</template>
`);

// ── index ──
const hosts = sceneFiles.map((s, i) => `
    <div id="scene-${s.sec}" data-composition-id="scene-${s.sec}" data-composition-src="compositions/scene-${s.sec}.html" data-start="${s.start}" data-duration="${s.dur}" data-track-index="${i + 1}" data-track-kind="graphics" data-width="1080" data-height="1920"></div>`).join("");
writeFileSync(join(root, "index.html"), `<!doctype html>
<html lang="mr" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1080, height=1920" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { margin:0; width:1080px; height:1920px; overflow:hidden; background:#09060a; }
      #root { position:absolute; inset:0; }
      #fx-film { position:absolute; inset:0; z-index:40; pointer-events:none; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${TOTAL}" data-width="1080" data-height="1920">${hosts}
      <svg id="fx-film" class="clip" data-start="0" data-duration="${TOTAL}" data-track-index="8" data-layout-ignore viewBox="0 0 1080 1920" width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="vg" cx="540" cy="880" r="1100" gradientUnits="userSpaceOnUse"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>
            <filter id="gr"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0"/></filter>
          </defs>
          <rect width="1080" height="1920" fill="url(#vg)"/>
          <rect width="1080" height="1920" filter="url(#gr)" opacity=".07"/>
        </svg>
      <div id="captions" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${TOTAL}" data-track-index="9" data-track-kind="captions" data-width="1080" data-height="1920" style="z-index:60"></div>
      <audio id="voice" src="assets/audio/voiceover.mp3" data-start="0" data-duration="${tlData.total.toFixed(2)}" data-track-index="10" data-volume="1"></audio>
      <audio id="score" src="assets/audio/score.mp3" data-start="0" data-duration="${TOTAL}" data-track-index="11" data-volume="0.22" data-fade-in="1.5" data-fade-out="3"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
      tl.seek(0);
    </script>
  </body>
</html>
`);
console.log("built", TOTAL, "s;", beats.length, "beats;", groups.length, "caption groups");
