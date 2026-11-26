// Coach Knightly: Chess Quest's own coach, a friendly chess knight (an original drawing). He
// introduces tips and celebrates badges with short, kind lines: never sarcastic, never guilt.
export const COACH_NAME = "Coach Knightly";

/** The coach as an inline SVG, `size` pixels square. */
export function coachSvg(size = 56, mood = "happy") {
  const mouth = mood === "cheer" ? '<path d="M27 45 Q35 55 43 45 Z" fill="#7a2e2e" stroke="#3a2e24" stroke-width="2.5" stroke-linejoin="round"/>' : '<path d="M27 46 Q35 52 42 45" fill="none" stroke="#3a2e24" stroke-width="3" stroke-linecap="round"/>';
  return `<svg class="coach-svg" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="${COACH_NAME}">
  <rect x="18" y="84" width="64" height="12" rx="5" fill="#3a2e24"/>
  <path d="M30 85 L31 64 C31 54 26 49 21 44 C14 37 16 26 25 19 C33 13 45 10 55 13 L61 5 L67 17 C78 25 83 41 78 58 L73 85 Z" fill="#f6e9d2" stroke="#3a2e24" stroke-width="3.5" stroke-linejoin="round"/>
  <path d="M67 17 L74 21 L70 25 L78 30 L73 34 L81 40 L75 43 L81 50 L76 52" fill="none" stroke="#3a2e24" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="44" cy="29" r="7.5" fill="#fff" stroke="#3a2e24" stroke-width="2.5"/>
  <circle cx="42.5" cy="29.5" r="3.6" fill="#3a2e24"/>
  <circle cx="41.2" cy="28" r="1.3" fill="#fff"/>
  <path d="M37 19 Q43 15 50 19" fill="none" stroke="#3a2e24" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="24" cy="33" r="2.2" fill="#3a2e24"/>
  ${mouth}
  <circle cx="53" cy="41" r="4" fill="#f2a7a0" opacity="0.7"/>
  <path d="M29 63 C42 69 62 69 76 61 L76 71 C62 78 42 78 29 72 Z" fill="#2e8b62" stroke="#3a2e24" stroke-width="3" stroke-linejoin="round"/>
  <path d="M60 72 L66 86 L72 84 L68 70" fill="#2e8b62" stroke="#3a2e24" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
}

const LINES = {
  tip: ["Here's my tip:", "Let me show you a trick:", "Try this idea:", "Here's what to look for:"],
  badge: ["Wonderful work!", "You earned it!", "Brilliant!", "Look at you go!", "That's a new badge!", "I'm proud of you!"],
};
/** A short line for `context` ("tip" or "badge"). */
export const coachLine = (context) => {
  const list = LINES[context] || [""];
  return list[Math.floor(Math.random() * list.length)];
};
