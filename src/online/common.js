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
//   clock,                     // optional: minutes per player, in ms (5, 10 or 15 minutes)
//   time: { w, b },            // with a clock: each player's time left (ms) as of lastMoveAt
//   lastMoveAt,                // with a clock: when the last move was made (server time, ms)
//   friendPair,                // optional: the friend link both players can save (see below)
//   reclaimWith,               // the used-up seat key of the last seat reclaim (see below)
// }
//
// Seat keys: Firebase deletes anonymous player numbers after 30 days, and a player who comes
// back with a new number would no longer own their seat. So each player's device keeps a private
// seat key per game (localStorage "seatKeys"); the server keeps it at seats/{code}/{color}/{key},
// where nobody can read it. To reclaim a seat, the device writes its new number into the game,
// names the old key (reclaimWith) and deletes it, and adds a fresh key, all in one write. The
// rules accept that only if the named key existed and is gone afterwards, so a key works once.
//
// Friend links live at pairs/{id}: { expires, invite: { code, by, at } }. Only the two devices
// that saved the link know its 16-character id; a challenge writes the new game's code there.
// Daily puzzle stats live at stats/daily/{YYYY-MM-DD}: { solved, firstTry }, just two counts.
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
export const PAIR_LENGTH = 16;
export const SEAT_KEY_LENGTH = 24;
export const CLOCK_CHOICES = [0, 5, 10, 15]; // minutes; 0 = no clock
export const PAIR_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000; // friend links unused for 60 days are removed
export const INVITE_FRESH_MS = 30 * 60 * 1000; // a challenge shows on Home for 30 minutes
const TIMEOUT_SLACK_MS = 1500;

export function makeCode(random = Math.random) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  return code;
}

export function makePairId(random = Math.random) {
  let id = "";
  for (let i = 0; i < PAIR_LENGTH; i++) id += CODE_LETTERS[Math.floor(random() * CODE_LETTERS.length)];
  return id;
}

/** A random seat key, from the browser's secure random numbers. */
export function makeSeatKey() {
  const bytes = crypto.getRandomValues(new Uint32Array(SEAT_KEY_LENGTH));
  return Array.from(bytes, (n) => CODE_LETTERS[n % CODE_LETTERS.length]).join("");
}

// This device's seat keys: { code: { w?: key, b?: key } }. Kept until the game is deleted.
const SEAT_STORE = "chessQuest_seatKeys";
const readSeats = () => { try { return JSON.parse(localStorage.getItem(SEAT_STORE)) || {}; } catch { return {}; } };
export const seatKey = (code, color) => readSeats()[code]?.[color] || null;
export function rememberSeatKey(code, color, key) {
  const all = readSeats();
  all[code] = { ...all[code], [color]: key };
  // Games last 7 days; keep the 50 newest codes so this never grows without limit.
  const codes = Object.keys(all);
  for (const old of codes.slice(0, Math.max(0, codes.length - 50))) delete all[old];
  localStorage.setItem(SEAT_STORE, JSON.stringify(all));
}

/** Tidies what someone typed: "k7q f2m" → "K7QF2M". Returns null if it can't be a code. */
export function cleanCode(text) {
  const code = String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0");
  return code.length === CODE_LENGTH && [...code].every((c) => CODE_LETTERS.includes(c)) ? code : null;
}

export function newGameRecord({ uid, color, avatar, now, minutes = 0 }) {
  const game = {
    created: now,
    expires: now + GAME_LIFETIME_MS,
    players: { [color]: uid },
    avatars: { [color]: avatarIndex(avatar) },
    moves: "",
    ply: 0,
    status: "waiting",
  };
  if (CLOCK_CHOICES.includes(minutes) && minutes > 0) game.clock = minutes * 60 * 1000;
  return game;
}

/**
 * Time left (ms) for each player at server time `now`. Only the player to move is losing time.
 * Returns null for a game without a clock.
 */
export function clockAt(game, now) {
  if (!game?.clock) return null;
  const time = { w: game.time?.w ?? game.clock, b: game.time?.b ?? game.clock };
  if (game.status === "playing" && game.lastMoveAt) {
    const turn = turnOf(game);
    time[turn] = Math.max(0, time[turn] - Math.max(0, now - game.lastMoveAt));
  }
  return time;
}

/** True if the player to move has run out of time (with a little slack for the network). */
export const outOfTime = (game, now) => {
  const time = clockAt(game, now);
  return Boolean(time) && game.status === "playing" && time[turnOf(game)] <= 0 && now - game.lastMoveAt >= (game.time?.[turnOf(game)] ?? game.clock) + TIMEOUT_SLACK_MS;
};

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
export function withMove(game, uid, ply, uci, result = null, now = Date.now()) {
  if (!game || game.status !== "playing" || game.ply !== ply) return null;
  const mover = turnOf(game);
  if (game.players?.[mover] !== uid) return null;
  if (result && !((result.reason === "checkmate" && result.winner === mover) || (MOVE_DRAWS.includes(result.reason) && result.winner === "draw"))) return null;
  const next = { ...game, moves: game.moves ? `${game.moves} ${uci}` : uci, ply: ply + 1 };
  if (game.clock) {
    const left = clockAt(game, now)[mover];
    if (left <= 0) return null; // out of time: the game is lost on time instead
    next.time = { ...clockAt(game, now), [mover]: Math.round(left) };
    next.lastMoveAt = now;
  }
  delete next.drawOffer;
  if (result) { next.status = "over"; next.result = result; }
  return next;
}

/** The game after `uid` joins the empty seat. Returns null if they can't. */
export function withJoin(game, uid, avatar, now = Date.now()) {
  if (!game || game.expires < now) return null;
  if (colorOf(game, uid)) return game; // already in this game
  const seat = !game.players.w ? "w" : !game.players.b ? "b" : null;
  if (!seat || game.status !== "waiting") return null;
  const next = { ...game, players: { ...game.players, [seat]: uid }, avatars: { ...game.avatars, [seat]: avatarIndex(avatar) }, status: "playing" };
  // The clock starts when the second player arrives.
  if (game.clock) { next.time = { w: game.clock, b: game.clock }; next.lastMoveAt = now; }
  return next;
}

/**
 * The game after it ends without a move: you resign (the other player wins), or you accept the
 * other player's draw offer. Returns null for anything else, or if it's already over.
 */
export function withResult(game, uid, result, now = Date.now()) {
  const color = colorOf(game, uid);
  if (!game || game.status !== "playing" || !color) return null;
  const resign = result?.reason === "resigned" && result.winner === other(color);
  const acceptDraw = result?.reason === "agreed" && result.winner === "draw" && game.drawOffer === other(color);
  // Either player may record a loss on time once the player to move has run out.
  const timeout = result?.reason === "timeout" && result.winner === other(turnOf(game)) && outOfTime(game, now);
  if (!resign && !acceptDraw && !timeout) return null;
  const next = { ...game, status: "over", result };
  delete next.drawOffer;
  return next;
}
