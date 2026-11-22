// Shared by both online backends (Firebase and the local test backend).
//
// A game is stored as:
// {
//   created, expires,          // ms since 1970; games are deleted after expires (7 days)
//   players: { w, b },         // anonymous player ids; a seat is empty until someone joins
//   avatars: { w, b },         // one of AVATARS: there are no names, so nothing personal is shared
//   moves: "e2e4 e7e5 …",      // every move so far, as one string
//   ply,                       // number of moves so far
//   status,                    // "waiting" (for the second player), "playing" or "over"
//   result: { winner, reason } // winner "w" | "b" | "draw"
//   drawOffer,                 // "w" or "b" while a draw offer is open
//   rematch,                   // code of the rematch game, once someone starts one
//   presence: { w, b },        // true while that player has the game open
// }
// database.rules.json enforces the same shape on the Firebase server.

export const AVATARS = ["🦊", "🐼", "🦉", "🐸", "🐯", "🐙", "🦄", "🐢", "🦁", "🐧", "🐨", "🐲"];
export const GAME_DAYS = 7;
export const GAME_LIFETIME_MS = GAME_DAYS * 24 * 60 * 60 * 1000;

// No 0/O, 1/I/L: codes are read aloud and typed on phones.
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function makeCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  return code;
}

/** Tidies what someone typed: "k7q f2m" → "K7QF2M". Returns null if it can't be a code. */
export function cleanCode(text) {
  const code = String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

export function newGameRecord({ uid, color, avatar, now }) {
  return {
    created: now,
    expires: now + GAME_LIFETIME_MS,
    players: { [color]: uid },
    avatars: { [color]: avatar },
    moves: "",
    ply: 0,
    status: "waiting",
  };
}

export const moveList = (game) => (game?.moves ? game.moves.split(" ") : []);
export const colorOf = (game, uid) => (game?.players?.w === uid ? "w" : game?.players?.b === uid ? "b" : null);
export const turnOf = (game) => ((game?.ply || 0) % 2 === 0 ? "w" : "b");

/**
 * The game after `uid` plays `uci` as move number `ply` (and, if it ends the game, `result`).
 * Returns null if the move isn't allowed: not your turn, the game moved on, or it's over.
 */
export function withMove(game, uid, ply, uci, result = null) {
  if (!game || game.status !== "playing" || game.ply !== ply) return null;
  if (game.players?.[turnOf(game)] !== uid) return null;
  const next = { ...game, moves: game.moves ? `${game.moves} ${uci}` : uci, ply: ply + 1 };
  delete next.drawOffer;
  if (result) { next.status = "over"; next.result = result; }
  return next;
}

/** The game after `uid` joins the empty seat. Returns null if they can't. */
export function withJoin(game, uid, avatar) {
  if (!game || game.expires < Date.now()) return null;
  if (colorOf(game, uid)) return game; // already in this game
  const seat = !game.players.w ? "w" : !game.players.b ? "b" : null;
  if (!seat || game.status !== "waiting") return null;
  return { ...game, players: { ...game.players, [seat]: uid }, avatars: { ...game.avatars, [seat]: avatar }, status: "playing" };
}

/** The game after it ends (resign, agreed draw). Returns null if it's already over. */
export function withResult(game, uid, result) {
  if (!game || game.status !== "playing" || !colorOf(game, uid)) return null;
  const next = { ...game, status: "over", result };
  delete next.drawOffer;
  return next;
}
