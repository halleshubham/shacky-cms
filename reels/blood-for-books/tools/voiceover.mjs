// Generates the Marathi voiceover for script.json with ElevenLabs.
// Per line: assets/audio/lines/<id>.mp3 + word timings; then joins them
// (with the scripted pauses) into assets/audio/voiceover.mp3 and writes
// assets/timeline.json used by the composition.
//
// Usage: ELEVENLABS_API_KEY=... node tools/voiceover.mjs [--only id1,id2]
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const script = JSON.parse(readFileSync(join(root, "script.json"), "utf8"));
const linesDir = join(root, "assets/audio/lines");
mkdirSync(linesDir, { recursive: true });

const onlyArg = process.argv.indexOf("--only");
const only = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",")) : null;
const client = new ElevenLabsClient();

const probe = (f) =>
  parseFloat(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString(),
  );

// Group consecutive characters into words using the alignment from the API.
function wordsFromAlignment(a) {
  const words = [];
  let cur = null;
  a.characters.forEach((ch, i) => {
    const isSpace = /\s/.test(ch);
    if (isSpace) {
      if (cur) words.push(cur), (cur = null);
      return;
    }
    if (!cur) cur = { text: "", start: a.characterStartTimesSeconds[i], end: 0 };
    cur.text += ch;
    cur.end = a.characterEndTimesSeconds[i];
  });
  if (cur) words.push(cur);
  return words;
}

const lines = script.lines;
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  const mp3 = join(linesDir, `${l.id}.mp3`);
  const json = join(linesDir, `${l.id}.json`);
  if (existsSync(mp3) && existsSync(json) && !(only && only.has(l.id))) continue;
  console.log("tts", l.id);
  const res = await client.textToSpeech.convertWithTimestamps(script.voiceId, {
    text: l.text,
    modelId: script.modelId,
    languageCode: script.languageCode,
    outputFormat: "mp3_44100_128",
    previousText: lines[i - 1]?.text,
    nextText: lines[i + 1]?.text,
    voiceSettings: { stability: l.section === "peak" || l.section === "ending" ? 0.45 : 0.4, similarityBoost: 0.8 },
  });
  writeFileSync(mp3, Buffer.from(res.audioBase64, "base64"));
  writeFileSync(json, JSON.stringify(wordsFromAlignment(res.alignment ?? res.normalizedAlignment), null, 1));
}

// Concatenate with pauses and build the global timeline.
const listFile = join(linesDir, "concat.txt");
let t = 0;
const timeline = [];
const parts = [];
for (const l of lines) {
  const mp3 = join(linesDir, `${l.id}.mp3`);
  const dur = probe(mp3);
  const words = JSON.parse(readFileSync(join(linesDir, `${l.id}.json`), "utf8")).map((w) => ({
    text: w.text,
    start: +(t + w.start).toFixed(3),
    end: +(t + w.end).toFixed(3),
  }));
  timeline.push({ id: l.id, section: l.section, text: l.text, start: +t.toFixed(3), end: +(t + dur).toFixed(3), words });
  parts.push(`file '${mp3}'`);
  t += dur;
  if (l.pauseAfter > 0) {
    const sil = join(linesDir, `sil_${l.pauseAfter}.mp3`);
    if (!existsSync(sil))
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(l.pauseAfter), "-b:a", "128k", sil]);
    parts.push(`file '${sil}'`);
    t += l.pauseAfter;
  }
}
writeFileSync(listFile, parts.join("\n"));
const out = join(root, "assets/audio/voiceover.mp3");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-ar", "44100", "-ac", "1", "-b:a", "128k", out]);
const total = probe(out);
writeFileSync(join(root, "assets/timeline.json"), JSON.stringify({ total, lines: timeline }, null, 1));
console.log("voiceover", total.toFixed(2), "s");
