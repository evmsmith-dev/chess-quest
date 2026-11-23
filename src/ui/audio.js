// Sound effects, all made in code with Web Audio, so there are no audio files to download and
// the app works offline. Browsers only allow sound after a tap, so nothing is set up until then.
// On iPhone the "ambient" audio session respects the silent switch and mixes with other audio.
import { setting } from "../lib/settings.js";

let ctx = null;
let bus = null;
let noiseBuffer = null;
let unavailable = false;

function setUp() {
  if (ctx) return true;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context || unavailable) return false;
  try {
    if (navigator.audioSession) navigator.audioSession.type = "ambient";
  } catch {
    // Older Safari.
  }
  try {
    ctx = new Context();
  } catch {
    unavailable = true;
    return false;
  }
  bus = ctx.createGain();
  bus.gain.value = 0.6;
  bus.connect(ctx.destination);
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return true;
}

/** Call from a tap: browsers need one before sound can play. */
export function unlockAudio() {
  if (!setting("sound") || !setUp()) return;
  if (ctx.state === "suspended" && document.visibilityState === "visible") ctx.resume().catch(() => {});
}

function tone({ freq, type = "sine", start = 0, attack = 0.005, decay = 0.3, gain = 0.3, to = null }) {
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + decay);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  osc.connect(amp).connect(bus);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

function knock({ start = 0, decay = 0.05, gain = 0.35, freq = 1500, q = 2.5 }) {
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(gain, t);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(filter).connect(amp).connect(bus);
  src.start(t);
  src.stop(t + decay + 0.05);
}

const SOUNDS = {
  // A wooden piece set down.
  move: () => { knock({ freq: 1300, decay: 0.05 }); tone({ freq: 220, decay: 0.06, gain: 0.1 }); },
  // A capture: two knocks, a little heavier.
  capture: () => { knock({ freq: 900, decay: 0.07, gain: 0.45 }); knock({ start: 0.05, freq: 1500, decay: 0.05, gain: 0.3 }); },
  castle: () => { knock({ freq: 1300, decay: 0.05 }); knock({ start: 0.09, freq: 1200, decay: 0.05 }); },
  check: () => { knock({ freq: 1200, decay: 0.05 }); tone({ freq: 880, decay: 0.25, gain: 0.12, type: "triangle" }); },
  promote: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, start: i * 0.07, decay: 0.25, gain: 0.12, type: "triangle" })),
  illegal: () => tone({ freq: 180, decay: 0.12, gain: 0.12, type: "square", to: 140 }),
  star: () => tone({ freq: 1318, decay: 0.3, gain: 0.12, type: "triangle", to: 1760 }),
  correct: () => { tone({ freq: 784, decay: 0.18, gain: 0.14, type: "triangle" }); tone({ freq: 1175, start: 0.1, decay: 0.35, gain: 0.14, type: "triangle" }); },
  wrong: () => { tone({ freq: 330, decay: 0.15, gain: 0.12, type: "triangle" }); tone({ freq: 262, start: 0.12, decay: 0.25, gain: 0.12, type: "triangle" }); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, start: i * 0.1, decay: 0.4, gain: 0.13, type: "triangle" })),
  lose: () => [392, 330, 262].forEach((f, i) => tone({ freq: f, start: i * 0.14, decay: 0.4, gain: 0.11, type: "triangle" })),
  // "Your move!": a friendly two-note doorbell, loud enough to notice from another tab.
  turn: () => { tone({ freq: 988, decay: 0.3, gain: 0.18, type: "triangle" }); tone({ freq: 784, start: 0.18, decay: 0.45, gain: 0.18, type: "triangle" }); },
  draw: () => [440, 440].forEach((f, i) => tone({ freq: f, start: i * 0.15, decay: 0.3, gain: 0.1, type: "triangle" })),
};

export function play(name) {
  if (!setting("sound") || !SOUNDS[name] || !setUp()) return;
  if (ctx.state !== "running") ctx.resume().catch(() => {});
  try {
    SOUNDS[name]();
  } catch {
    // Audio hiccup: ignore.
  }
}
