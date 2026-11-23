// Shared by both online backends (Firebase and the local test backend).
//
// A game is stored as:
// {
//   created, expires,          // ms since 1970; games are deleted after expires (7 days)
//   players: { w, b },         // anonymous player ids; a seat is empty until someone joins
//   avatars: { w, b },         // index into AVATARS (0–11): no names, so nothing personal is shared,
//                              // and no free text that could carry anything harmful
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

/** The stored number for an avatar (0 if it isn't one of AVATARS). */
export const avatarIndex = (emoji) => Math.max(0, AVATARS.indexOf(emoji));

/**
 * The emoji to show for a player. Only ever returns one of AVATARS (or ❔), whatever is stored,
 * so another player's app can never put anything else on this screen. (Games made before
 * avatars were stored as numbers hold the emoji itself.)
 */
export function avatarOf(game, color) {
  const stored = game?.avatars?.[color];
  if (Number.isInteger(stored) && stored >= 0 && stored < AVATARS.length) return AVATARS[stored];
  if (typeof stored === "string" && AVATARS.includes(stored)) return stored;
  return "❔";
}
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
    avatars: { [color]: avatarIndex(avatar) },
    moves: "",
    ply: 0,
    status: "waiting",
  };
}

export const moveList = (game) => (game?.moves ? game.moves.split(" ") : []);
export const colorOf = (game, uid) => (game?.players?.w === uid ? "w" : game?.players?.b === uid ? "b" : null);
export const turnOf = (game) => ((game?.ply || 0) % 2 === 0 ? "w" : "b");

const MOVE_DRAWS = ["stalemate", "insufficient", "repetition", "fifty"];
const other = (color) => (color === "w" ? "b" : "w");

/**
 * The game after `uid` plays `uci` as move number `ply` (and, if it ends the game, `result`).
 * Returns null if the move isn't allowed: not your turn, the game moved on, or it's over.
 * A move can only end the game as a checkmate won by the player making it, or as a draw.
 * database.rules.json applies the same checks on the server.
 */
export function withMove(game, uid, ply, uci, result = null) {
  if (!game || game.status !== "playing" || game.ply !== ply) return null;
  const mover = turnOf(game);
  if (game.players?.[mover] !== uid) return null;
  if (result && !((result.reason === "checkmate" && result.winner === mover) || (MOVE_DRAWS.includes(result.reason) && result.winner === "draw"))) return null;
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
  return { ...game, players: { ...game.players, [seat]: uid }, avatars: { ...game.avatars, [seat]: avatarIndex(avatar) }, status: "playing" };
}

/**
 * The game after it ends without a move: you resign (the other player wins), or you accept the
 * other player's draw offer. Returns null for anything else, or if it's already over.
 */
export function withResult(game, uid, result) {
  const color = colorOf(game, uid);
  if (!game || game.status !== "playing" || !color) return null;
  const resign = result?.reason === "resigned" && result.winner === other(color);
  const acceptDraw = result?.reason === "agreed" && result.winner === "draw" && game.drawOffer === other(color);
  if (!resign && !acceptDraw) return null;
  const next = { ...game, status: "over", result };
  delete next.drawOffer;
  return next;
}
