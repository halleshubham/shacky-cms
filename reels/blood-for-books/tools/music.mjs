// Generates the instrumental score with ElevenLabs Music -> assets/audio/score.mp3
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { writeFileSync } from "node:fs";
const lengthMs = Number(process.argv[2] ?? 175000);
const client = new ElevenLabsClient();
const audio = await client.music.compose({
  prompt:
    "Somber cinematic instrumental underscore for a documentary-style emotional news story: soft felt piano and slow low strings, a quiet heartbeat-like pulse, restrained and sad, slowly building tension and sorrow, then fading to a lonely single piano note at the end. No vocals, no drums, no beat.",
  musicLengthMs: lengthMs,
  modelId: "music_v2_5",
  forceInstrumental: true,
});
const chunks = [];
for await (const c of audio) chunks.push(Buffer.from(c));
writeFileSync(new URL("../assets/audio/score.mp3", import.meta.url), Buffer.concat(chunks));
console.log("score ok");
