// Coach Knightly: Chess Quest's own coach, a friendly pony on a chess-piece base (a knight; an
// original drawing, front-facing so he reads clearly even at 48 px). He introduces tips and
// celebrates badges with short, kind lines: never sarcastic, never guilt.
export const COACH_NAME = "Coach Knightly";

/** The coach as an inline SVG, `size` pixels square. "cheer" opens his smile. */
export function coachSvg(size = 56, mood = "happy") {
  const mouth = mood === "cheer"
    ? '<path d="M88 122 Q100 138 112 122 Z" fill="#7a2e2e" stroke="#2b2420" stroke-width="4" stroke-linejoin="round"/>'
    : '<path d="M90 124 Q100 132 110 124" fill="none" stroke="#2b2420" stroke-width="4" stroke-linecap="round"/>';
  return `<svg class="coach-svg" width="${size}" height="${size}" viewBox="0 0 200 200" role="img" aria-label="${COACH_NAME}">
  <g stroke="#2b2420" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">
    <rect x="38" y="172" width="124" height="20" rx="8" fill="#3d332c"/>
    <rect x="50" y="158" width="100" height="16" rx="6" fill="#efe1c6"/>
    <path d="M70 160 C68 146 72 136 80 130 L120 130 C128 136 132 146 130 160 Z" fill="#e9c99b"/>
    <path d="M58 42 L66 12 L84 34 Z" fill="#e9c99b"/>
    <path d="M142 42 L134 12 L116 34 Z" fill="#e9c99b"/>
    <path d="M64 36 L67 22 L76 32 Z" fill="#f2a29a" stroke="none"/>
    <path d="M136 36 L133 22 L124 32 Z" fill="#f2a29a" stroke="none"/>
    <path d="M60 70 C56 44 76 28 100 28 C124 28 144 44 140 70 C138 92 132 104 132 116 C132 132 118 142 100 142 C82 142 68 132 68 116 C68 104 62 92 60 70 Z" fill="#e9c99b"/>
    <path d="M84 26 C88 14 100 10 112 16 C104 18 120 24 116 34 C110 28 100 30 92 36 C92 30 88 28 84 26 Z" fill="#6b4a33"/>
    <ellipse cx="100" cy="116" rx="26" ry="20" fill="#f6ead3"/>
    <circle cx="90" cy="112" r="3" fill="#2b2420" stroke="none"/>
    <circle cx="110" cy="112" r="3" fill="#2b2420" stroke="none"/>
    ${mouth}
    <circle cx="82" cy="74" r="11" fill="#fff"/>
    <circle cx="118" cy="74" r="11" fill="#fff"/>
    <circle cx="83" cy="76" r="5.5" fill="#2b2420" stroke="none"/>
    <circle cx="117" cy="76" r="5.5" fill="#2b2420" stroke="none"/>
    <circle cx="81" cy="73.5" r="2" fill="#fff" stroke="none"/>
    <circle cx="115" cy="73.5" r="2" fill="#fff" stroke="none"/>
    <circle cx="70" cy="96" r="6" fill="#f2a29a" stroke="none" opacity="0.7"/>
    <circle cx="130" cy="96" r="6" fill="#f2a29a" stroke="none" opacity="0.7"/>
    <path d="M70 140 C88 148 112 148 130 140 L130 152 C112 160 88 160 70 152 Z" fill="#2e8b62"/>
  </g>
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
