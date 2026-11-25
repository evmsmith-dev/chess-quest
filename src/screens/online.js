// Online play against someone on another device. One player creates a game and shares its code
// (or a link); the other joins with it. Moves go through the backend (Firebase, or the local
// test backend), and both phones check every move with the same rules, so a tampered app can't
// sneak in an illegal one. There are no names and no chat: players pick an emoji avatar.
import { Chess, targetsFor, animationFor, checkSquare, explainIllegal, capturedPieces, materialBalance, gameOutcome, OUTCOME_TEXT, piecesFromFen, PIECE_WORD } from "../chess/rules.js";
import { board, useMode, setTitle, setMessage, setControls, setBars, setMoveList, feelMove, choosePromotion, isPromotionMove, showResult } from "./boardscreen.js";
import { openScreen, currentScreen, backToHome } from "../ui/overlays.js";
import { readJson, writeJson } from "../storage.js";
import { play } from "../ui/audio.js";
import { buzz } from "../ui/haptics.js";
import { alertPlayer, clearAlert, notificationPermission, enableNotifications } from "../ui/turnalert.js";
import { startReview } from "./review.js";
import { setting } from "../lib/settings.js";
import { getBackend } from "../online/backend.js";
import { isOffline, onConnectionChange } from "../online/connection.js";
import { moveList, GAME_DAYS, avatarOf, clockAt, outOfTime, turnOf, AVATARS, REACTIONS, REACTION_GAP_MS } from "../online/common.js";
import { openOverlay, closeTopThen } from "../ui/overlays.js";
import { confirm } from "./game.js";

const byId = (id) => document.getElementById(id);
let O = null; // the online game on screen
let hooks = { onChange: () => {} };
export function setOnlineHooks(h) { hooks = { ...hooks, ...h }; }

/** The online game this device is in, if any: { code, color }. */
export const savedOnlineGame = () => readJson("onlineGame", null);
const forget = (code) => { if (savedOnlineGame()?.code === code) writeJson("onlineGame", null); hooks.onChange(); };

export const joinLink = (code) => `${location.origin}${location.pathname}?join=${code}`;

/** Shows a short message at the bottom of the screen. */
export function toast(text) {
  const el = byId("toast");
  el.textContent = text;
  el.classList.add("is-visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("is-visible"), 2200);
}

// ---------- Friends (saved on this device only) ----------
// [{ id, name, avatar, added }]: id is the private friend link, name is the nickname this
// player chose (never sent anywhere), avatar is the friend's avatar number.
export const friends = () => readJson("friends", []);
export const saveFriends = (list) => { writeJson("friends", list); hooks.onChange(); };
const friendByPair = (id) => friends().find((f) => f.id === id);

// Results against each friend, on this device only: { [friend link]: { w, l, d, codes } }, where
// w counts this player's wins and codes are the last games counted (so none is counted twice).
export const friendRecords = () => readJson("friendRecords", {});
export function forgetFriendRecord(id) {
  const all = friendRecords();
  delete all[id];
  writeJson("friendRecords", all);
}
/** "3–2" or "3–2–1" (wins–losses–draws), or "" before the first game. */
export function recordText(record) {
  if (!record || !(record.w + record.l + record.d)) return "";
  return `${record.w}–${record.l}${record.d ? `–${record.d}` : ""}`;
}
const friendIdOf = () => O?.friendId || O?.rec?.friendPair || null;

/** Counts the finished game toward the record with this friend (once), if they're saved. */
function countForFriend() {
  const id = friendIdOf();
  const rec = O?.rec;
  if (!id || !friendByPair(id) || rec?.status !== "over" || !rec.result) return;
  const all = friendRecords();
  const record = all[id] || { w: 0, l: 0, d: 0, codes: [] };
  if (record.codes.includes(O.code)) return;
  const { winner } = rec.result;
  if (winner === "draw") record.d++;
  else if (winner === O.color) record.w++;
  else record.l++;
  record.codes = [...record.codes, O.code].slice(-30);
  all[id] = record;
  writeJson("friendRecords", all);
  hooks.onChange();
}

const formatClock = (ms) => {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

/** Opens the game `code`, where this device plays `color`. `friendName` when it's a challenge. */
export async function openOnlineGame(code, color, { friendName = null, inviteId = null, friendId = null } = {}) {
  if (isOffline()) throw new Error("offline");
  const backend = await getBackend();
  if (!backend) return;
  friendId = friendId || inviteId || null;
  writeJson("onlineGame", { code, color, friendId });
  hooks.onChange();
  if (O) leave();
  O = { code, color, backend, game: new Chess(), rec: null, token: 0, sending: false, shownResult: false, broken: false, friendName, inviteId, friendId };
  if (currentScreen() !== "play") openScreen("play", { onLeave: leave });
  useMode(mode);
  setTitle("Online game", `Game code ${code}`);
  board.setOrientation(color);
  board.setPieces(piecesFromFen(O.game.fen()), { animate: false });
  board.setMovable(null);
  setMessage("Connecting…");
  const mine = O;
  mine.unwatch = backend.watch(code, (rec) => { if (O === mine) update(rec); });
  mine.stopPresence = backend.setPresence(code, color);
  mine.ticker = setInterval(() => { if (O === mine) tick(); }, 250);
  byId("conn-banner").hidden = !isOffline();
}

/** Updates the clocks every quarter second, and records a loss on time when a clock runs out. */
function tick() {
  const rec = O.rec;
  if (!rec?.clock || rec.status !== "playing") return;
  const now = O.backend.serverNow();
  const time = clockAt(rec, now);
  for (const el of document.querySelectorAll("[data-clock]")) {
    const ms = time[el.dataset.clock];
    el.textContent = formatClock(ms);
    el.classList.toggle("is-low", ms < 30000);
    el.classList.toggle("is-running", turnOf(rec) === el.dataset.clock);
  }
  if (outOfTime(rec, now) && !O.claimedTimeout) {
    O.claimedTimeout = true;
    board.setMovable(null);
    O.backend.finish(O.code, { winner: turnOf(rec) === "w" ? "b" : "w", reason: "timeout" }).then((ok) => { if (!ok && O) O.claimedTimeout = false; });
  }
}

// During an online game, a banner says when this device is offline (moves wait and send later).
onConnectionChange((offline) => { byId("conn-banner").hidden = !(offline && O); });

function leave() {
  if (!O) return;
  byId("conn-banner").hidden = true;
  clearInterval(O.ticker);
  O.unwatch?.();
  O.stopPresence?.();
  byId("offer").hidden = true;
  clearAlert();
  O = null;
  hooks.onChange();
}

const opponent = () => (O.color === "w" ? "b" : "w");
const myTurn = () => O.rec?.status === "playing" && O.game.turn() === O.color && !O.game.isGameOver()
  && !(O.rec.clock && clockAt(O.rec, O.backend.serverNow())[O.color] <= 0); // not after your flag falls

const mode = {
  getTargets(from) {
    if (!O || O.broken || O.sending || !myTurn()) return [];
    return targetsFor(O.game, from);
  },
  async onMove(from, to) {
    if (!O || !myTurn()) return;
    if (O.rec?.clock && clockAt(O.rec, O.backend.serverNow())[O.color] <= 0) return; // flag has fallen
    let promotion;
    if (isPromotionMove(board.pieces, from, to)) {
      promotion = await choosePromotion(O.color);
      if (!promotion) { render(); return; }
    }
    sendMove({ from, to, promotion });
  },
  onIllegal(from, to) {
    if (!O) return;
    const reason = explainIllegal(O.game.fen(), from, to);
    if (reason) { setMessage(reason, "info"); play("illegal"); buzz("wrong"); }
  },
  onTap(square) {
    if (!O || O.rec?.status !== "playing") return;
    const piece = O.game.get(square);
    if (O.game.turn() !== O.color) setMessage("Waiting for your opponent's move…", "info");
    else if (piece && piece.color !== O.color) setMessage(`You play ${O.color === "w" ? "White" : "Black"}.`, "info");
  },
  leave() {},
};

// ---------- Keeping in step with the server ----------

function update(rec) {
  if (O.cancelled) return;
  if (!rec) {
    O.rec = null;
    board.setMovable(null);
    setMessage(`This game no longer exists. Online games are deleted after ${GAME_DAYS} days.`, "info");
    setControls([{ label: "🏠 Home", onClick: () => backToHome() }]);
    forget(O.code);
    return;
  }
  const previous = O.rec;
  O.rec = rec;
  showNewReaction(rec);
  // The other player just saved this one as a friend: say so, even over the result pop-up.
  if (previous && !previous.friendPair && theyAddedMe()) toast("Your opponent saved you as a friend. Add them too!");
  // This device's seat now shows a different player number: Firebase replaced ours (after 30
  // days). Take the seat back with the seat key, once; the next update shows the result.
  if (rec.players?.[O.color] && rec.players[O.color] !== O.backend.uid && rec.status !== "over") {
    if (!O.reclaiming) {
      O.reclaiming = "trying";
      const mine = O;
      O.backend.reclaim(O.code, O.color).then((ok) => { if (O === mine) { mine.reclaiming = ok ? null : "failed"; render(); } });
    }
  }
  const before = O.seen;
  syncMoves(moveList(rec));
  render();
  O.seen = { myTurn: myTurn(), status: rec.status, rematch: rec.rematch || null };
  if (before) alertIfNeeded(before, O.seen);
  if (rec.status === "over" && !O.shownResult) finished();
}

/** "Your move!" (and friends) when something changed for this player while they looked away. */
function alertIfNeeded(before, now) {
  const who = O.friendName || friendByPair(friendIdOf())?.name || "Your opponent";
  const last = O.game.history().at(-1);
  if (now.status === "over" && before.status !== "over") alertPlayer("Game over", "Tap to see how it ended.");
  else if (now.myTurn && !before.myTurn) alertPlayer(before.status === "waiting" ? "Your opponent joined" : "Your move", before.status === "waiting" ? `${who} joined. You play White: make the first move.` : last ? `${who} played ${last}.` : undefined);
  else if (now.rematch && now.rematch !== before.rematch && now.rematch !== O.startedRematch) alertPlayer("Rematch?");
}

/** Brings the local game in line with the server's move list. */
function syncMoves(serverMoves) {
  const local = O.game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || ""));
  const isPrefix = (a, b) => a.length <= b.length && a.every((m, i) => m === b[i]);
  if (isPrefix(serverMoves, local) && local.length > serverMoves.length) return; // our move is on its way
  let base = local;
  if (!isPrefix(local, serverMoves)) {
    O.game = new Chess(); // out of step: rebuild from the server
    base = [];
  }
  const fresh = serverMoves.slice(base.length);
  let last = null;
  for (const uci of fresh) {
    try {
      last = O.game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    } catch {
      O.broken = true;
      break;
    }
  }
  if (O.broken) return;
  if (last && fresh.length === 1) {
    board.setPieces(piecesFromFen(O.game.fen()), { moves: animationFor(last) });
    if (last.color !== O.color) feelMove(last, O.game.inCheck());
  } else if (fresh.length) {
    board.setPieces(piecesFromFen(O.game.fen()), { animate: false });
  }
}

async function sendMove(spec) {
  const ply = O.game.history().length;
  const move = O.game.move(spec);
  const uci = move.from + move.to + (move.promotion || "");
  feelMove(move, O.game.inCheck());
  board.setPieces(piecesFromFen(O.game.fen()), { moves: animationFor(move) });
  const outcome = gameOutcome(O.game);
  O.sending = true;
  render();
  const mine = O;
  const ok = await O.backend.move(O.code, ply, uci, outcome ? { winner: outcome.result, reason: outcome.reason } : null);
  if (O !== mine) return;
  O.sending = false;
  if (!ok) {
    // Refused (the game moved on, or the connection failed): go back to the server's version.
    O.game = new Chess();
    syncMoves(moveList(O.rec));
    board.setPieces(piecesFromFen(O.game.fen()), { animate: false });
    setMessage("That move couldn't be sent. Check your internet connection and try again.", "bad");
  }
  render();
}

// ---------- Drawing the screen ----------

function render() {
  if (!O || !O.rec || O.reviewing) return;
  const rec = O.rec;
  const game = O.game;
  const opp = opponent();
  const caps = capturedPieces(game);
  const balance = materialBalance(game);
  const plus = (color) => { const v = color === "w" ? balance : -balance; return v > 0 ? v : 0; };
  const away = rec.status === "playing" && rec.presence?.[opp] === false;
  const time = clockAt(rec, O.backend.serverNow());
  const clock = (color) => (time ? `<span class="bar-clock${time[color] < 30000 ? " is-low" : ""}${rec.status === "playing" && turnOf(rec) === color ? " is-running" : ""}" data-clock="${color}" aria-label="Time left">${formatClock(time[color])}</span>` : "");
  const oppStatus = rec.status === "waiting" ? "not joined yet" : away ? "offline" : !time && rec.status === "playing" && game.turn() === opp ? '<span class="thinking">thinking</span>' : "";
  const oppName = opponentName();
  setBars(
    { name: rec.players?.[opp] ? escapeHtml(oppName) : "Waiting…", emoji: rec.players?.[opp] ? avatarOf(rec, opp) : "❔", captured: caps[opp], color: opp, plus: plus(opp), status: oppStatus + clock(opp) },
    { name: "You", emoji: avatarOf(rec, O.color), captured: caps[O.color], color: O.color, plus: plus(O.color), status: (O.sending ? "sending… " : "") + clock(O.color) },
  );
  const history = game.history({ verbose: true });
  const last = history[history.length - 1];
  board.setHighlights({ lastMove: last ? [last.from, last.to] : [], check: checkSquare(game) });
  setMoveList(game.history());
  board.setMovable(!O.broken && !O.sending && myTurn() ? O.color : null);
  byId("offer").hidden = !(rec.status === "playing" && rec.drawOffer === opp);

  if (O.reclaiming) {
    board.setMovable(null);
    setMessage(O.reclaiming === "failed"
      ? "This device can't take part in this game any more (its player number changed and the seat couldn't be reclaimed). Start a new game from Home."
      : "Reconnecting you to your seat…", O.reclaiming === "failed" ? "bad" : "info");
    setControls([{ label: "🏠 Home", onClick: () => backToHome() }]);
    return;
  }
  if (O.broken) {
    setMessage("Your opponent's app sent a move that isn't legal, so this game can't continue.", "bad");
    setControls([{ label: "🏠 Home", onClick: () => backToHome() }]);
    return;
  }
  if (rec.status === "waiting") {
    const lead = O.friendName
      ? `<strong>Waiting for ${escapeHtml(O.friendName)}.</strong> They'll see your challenge when they open Chess Quest. You can also send the code:`
      : "<strong>Waiting for your opponent.</strong> Send them this code, or share a link:";
    setMessage(`${lead}<span class="game-code" aria-label="Game code ${O.code.split("").join(" ")}">${O.code}</span>${rec.clock ? `<span class="task-meta">⏱ ${rec.clock / 60000} minutes each</span>` : ""}${notifyOffer()}`);
    setControls([
      { label: "✕ Cancel", id: "ctl-cancel", ariaLabel: "Cancel game", onClick: cancelGame },
      { label: "📋 Copy", ariaLabel: "Copy code", onClick: copyCode },
      { label: "📤 Share link", kind: "primary", onClick: shareLink },
    ]);
    return;
  }
  if (rec.status === "over") {
    resultControls();
    return;
  }
  const you = O.color === "w" ? "White" : "Black";
  if (!O.sending) {
    if (rec.drawOffer === O.color) setMessage("You offered a draw. Waiting for an answer…", "info");
    else if (game.turn() === O.color) setMessage(game.inCheck() ? "You're in check! Protect your king." : `${last ? `${last.san}. ` : ""}Your move. You play ${you}.`);
    else setMessage(away ? "Your opponent is offline. The game waits until they're back." : "Waiting for your opponent's move…");
  }
  setControls([
    { label: "⇅ Flip", ariaLabel: "Flip the board", onClick: () => board.setOrientation(board.orientation === "w" ? "b" : "w") },
    { label: "🤝 Draw", id: "ctl-draw", onClick: offerDraw, disabled: rec.drawOffer === O.color },
    { label: "🏳️ Resign", onClick: resign },
    ...reactButton(),
  ]);
}

/**
 * True when the other player saved this one as a friend but this device hasn't saved them back.
 * Challenges only reach a friend whose device has saved the friend link too.
 */
const theyAddedMe = () => Boolean(O?.rec?.friendPair && !friendByPair(O.rec.friendPair) && O.rec.friendPair !== O.myPair);

function resultControls() {
  const rec = O.rec;
  const addBack = theyAddedMe();
  const buttons = [{ label: "🔍 Review", id: "ctl-review", onClick: reviewGame }];
  if (!friendByPair(friendIdOf())) buttons.push({ label: "🤝 Add friend", id: "ctl-friend", kind: addBack ? "primary" : undefined, onClick: addFriend });
  else buttons.unshift({ label: "🏠 Home", onClick: () => backToHome() });
  const rematchKind = addBack ? undefined : "primary";
  if (rec.rematch && rec.rematch !== O.startedRematch) buttons.push({ label: "🔁 Join rematch", kind: "primary", onClick: () => joinRematch(rec.rematch) });
  else if (!rec.rematch) buttons.push({ label: "🔁 Rematch", kind: rematchKind, onClick: startRematch });
  setControls([...buttons, ...reactButton()]);
  if (rec.rematch && rec.rematch !== O.startedRematch) setMessage("Your opponent wants a rematch!", "info");
  else if (addBack) setMessage(`<strong>${escapeHtml(opponentName() === "Opponent" ? "Your opponent" : opponentName())} saved you as a friend.</strong> Tap 🤝 Add friend to save them too, so you can challenge each other from Play online.`, "info");
  else {
    const winner = rec.result?.winner;
    setMessage(winner === "draw" ? "Game over: it's a draw." : winner === O.color ? "Game over: you won! 🎉" : winner ? "Game over: your opponent won. Good game!" : "Game over.", "info");
  }
}

function finished() {
  O.shownResult = true;
  forget(O.code);
  countForFriend();
  const { winner, reason } = O.rec.result || {};
  const draw = winner === "draw";
  const won = winner === O.color;
  setTimeout(() => {
    if (!O || !O.shownResult) return;
    play(won ? "win" : draw ? "draw" : "lose");
    buzz(won ? "win" : "lose");
    if (won) window.confetti?.({ particleCount: 120, spread: 75, origin: { y: 0.6 }, disableForReducedMotion: true });
    const text = reason === "resigned" ? (won ? "Your opponent resigned." : "You resigned.")
      : reason === "timeout" ? (won ? "Your opponent ran out of time." : "You ran out of time.")
      : reason === "checkmate" ? (won ? "You won by checkmate!" : "Your opponent won by checkmate. Good game!")
      : reason === "agreed" ? "You agreed to a draw." : OUTCOME_TEXT[reason] || "";
    showResult({
      emoji: won ? "🏆" : draw ? "🤝" : "🙂",
      title: won ? "You win!" : draw ? "Draw" : "Your opponent wins",
      text,
      stats: [["Moves", Math.ceil(O.game.history().length / 2)], ...friendStat()],
      secondary: ["🔍 Review game", reviewGame],
      primary: ["Rematch", () => (O?.rec?.rematch ? joinRematch(O.rec.rematch) : startRematch())],
    });
  }, 600);
}

function opponentName() {
  return O.friendName || friendByPair(friendIdOf())?.name || "Opponent";
}

/** ["vs Micah", "3–2"] for the result pop-up, when the opponent is a saved friend. */
function friendStat() {
  const id = friendIdOf();
  const friend = friendByPair(id);
  const text = friend && recordText(friendRecords()[id]);
  return text ? [[`You vs ${friend.name}`, text]] : [];
}

/** The game review for a finished online game; Back returns to the game. */
function reviewGame() {
  if (!O?.rec || O.rec.status !== "over") return;
  const mine = O;
  const name = opponentName();
  mine.reviewing = true;
  startReview({
    moves: mine.game.history({ verbose: true }).map((m) => m.from + m.to + (m.promotion || "")),
    colors: [mine.color],
    nameOf: () => "You",
    opponentOf: () => (name === "Opponent" ? "your opponent" : name),
    sub: `Online · vs ${name}`,
    orientation: board.orientation,
    onExit: () => {
      if (O !== mine) return;
      mine.reviewing = false;
      useMode(mode);
      setTitle("Online game", `Game code ${mine.code}`);
      board.setPieces(piecesFromFen(mine.game.fen()), { animate: false });
      render();
    },
  });
}

/** A button offering "Your move" notifications, while they haven't been allowed or refused. */
function notifyOffer() {
  if (!setting("turnAlerts") || notificationPermission() !== "default") return "";
  return '<button type="button" class="inline-btn" id="notify-offer">🔔 Notify me when it\'s my turn</button>';
}
byId("message").addEventListener("click", async (e) => {
  if (!e.target.closest("#notify-offer")) return;
  const state = await enableNotifications();
  toast(state === "granted" ? "You'll get a notification when it's your turn." : "No notifications. You can change this in Settings.");
  render();
});

// ---------- Reactions (a fixed set of emoji: no typing, no chat) ----------

const reactButton = () => (setting("reactions") ? [{ label: "😊", id: "ctl-react", ariaLabel: "Send a reaction", onClick: openReactions }] : []);

function openReactions() {
  if (!O?.rec) return;
  byId("react-options").innerHTML = REACTIONS.map((r, i) => `<button type="button" class="react-btn" data-react="${i}"><span class="react-emoji" aria-hidden="true">${r.emoji}</span><span>${r.label}</span></button>`).join("");
  openOverlay("react-overlay", { focus: "[data-react]" });
}
byId("react-options").addEventListener("click", (e) => {
  const i = Number(e.target.closest("[data-react]")?.dataset.react);
  if (!Number.isInteger(i)) return;
  closeTopThen(() => sendReaction(i));
});

async function sendReaction(i) {
  if (!O?.rec) return;
  const now = Date.now();
  if (O.lastReactionSent && now - O.lastReactionSent < REACTION_GAP_MS) { toast("One moment…"); return; }
  O.lastReactionSent = now;
  popReaction("bar-bottom", i, "You");
  if (!(await O.backend.react(O.code, O.color, i))) toast("Couldn't send that. Check your internet connection.");
}

/** Shows the opponent's newest reaction once (not old ones from before this device opened the game). */
function showNewReaction(rec) {
  const latest = rec.reactions?.[opponent()];
  const t = latest?.t || 0;
  if (O.seenReaction === undefined) { O.seenReaction = t; return; }
  if (t <= O.seenReaction) return;
  O.seenReaction = t;
  if (!setting("reactions") || O.reviewing || !REACTIONS[latest.i]) return;
  if (O.backend.serverNow() - t > 30000) return; // arrived late (after being offline): skip it
  popReaction("bar-top", latest.i, opponentName() === "Opponent" ? "Your opponent" : opponentName());
}

/** A reaction bubble that pops up by a player's bar and floats away. */
function popReaction(barId, i, who) {
  const bar = byId(barId);
  const r = REACTIONS[i];
  if (!bar || bar.hidden || !r) return;
  const box = bar.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "reaction-pop";
  pop.setAttribute("role", "status");
  pop.innerHTML = `<span class="react-emoji" aria-hidden="true">${r.emoji}</span><span>${r.label}</span><span class="visually-hidden">${escapeHtml(who)}: ${r.label}</span>`;
  pop.style.left = `${Math.max(8, box.left + 48)}px`;
  pop.style.top = `${box.top + box.height / 2}px`;
  document.body.append(pop);
  setTimeout(() => pop.remove(), 2800);
}

// ---------- Actions ----------

async function copyCode() {
  try {
    await navigator.clipboard.writeText(O.code);
    toast("Code copied");
  } catch {
    toast(`The code is ${O.code}`);
  }
}

async function shareLink() {
  const url = joinLink(O.code);
  const text = `Play chess with me in Chess Quest! Game code: ${O.code}`;
  if (navigator.share) {
    try { await navigator.share({ title: "Chess Quest", text, url }); return; } catch (error) { if (error?.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast("Link copied");
  } catch {
    toast(url);
  }
}

/** Cancels a game nobody has joined: it's deleted, and any friend challenge is withdrawn. */
function cancelGame() {
  confirm("Cancel this game?", "It will be deleted, and nobody will be able to join it with this code.", "Cancel game", async () => {
    if (!O || O.rec?.status !== "waiting") return;
    const mine = O;
    mine.cancelled = true;
    if (await mine.backend.cancel(mine.code)) {
      if (mine.inviteId) mine.backend.clearInvite(mine.inviteId);
      forget(mine.code);
      backToHome(() => toast("Game cancelled"));
      return;
    }
    mine.cancelled = false;
    if (O === mine) {
      update(mine.rec);
      setMessage(mine.rec?.status === "playing" ? "Your opponent just joined, so the game is on!" : "Couldn't cancel the game. Check your internet connection.", "info");
    }
  }, "Keep it");
}

async function offerDraw() {
  if (!O || O.rec?.status !== "playing") return;
  if (await O.backend.offerDraw(O.code, O.color)) setMessage("You offered a draw. Waiting for an answer…", "info");
  else setMessage("Couldn't send the offer. Check your internet connection.", "bad");
}

byId("offer-accept").addEventListener("click", async () => {
  if (!O) return;
  byId("offer").hidden = true;
  await O.backend.finish(O.code, { winner: "draw", reason: "agreed" });
});
byId("offer-decline").addEventListener("click", async () => {
  if (!O) return;
  byId("offer").hidden = true;
  await O.backend.offerDraw(O.code, null);
});

function resign() {
  confirm("Resign this game?", "Your opponent wins this game.", "Resign", async () => {
    if (!O) return;
    if (!(await O.backend.finish(O.code, { winner: opponent(), reason: "resigned" }))) setMessage("Couldn't resign: check your internet connection.", "bad");
  });
}

async function startRematch() {
  if (!O) return;
  const avatar = avatarOf(O.rec, O.color);
  const color = opponent(); // swap sides
  const old = O.code;
  try {
    const code = await O.backend.create({ color, avatar, minutes: (O.rec.clock || 0) / 60000 });
    O.startedRematch = code;
    if (!(await O.backend.setRematch(old, code))) {
      // The other player started one first: join theirs instead.
      const latest = O.rec?.rematch;
      if (latest) { joinRematch(latest); return; }
    }
    openOnlineGame(code, color, { friendName: O.friendName, friendId: friendIdOf() });
  } catch {
    setMessage("Couldn't start a rematch. Check your internet connection.", "bad");
  }
}

// ---------- Adding a friend ----------

let pendingFriend = null;

/** Saves this opponent as a friend: both devices end up with the same private friend link. */
async function addFriend() {
  if (!O?.rec) return;
  const mine = O;
  let id = mine.rec.friendPair;
  try {
    if (!id) {
      const fresh = await mine.backend.createPair();
      // If the other player added first, use their link instead.
      mine.myPair = fresh; // this device started the link: no "they saved you" prompt for it
      id = (await mine.backend.setFriendPair(mine.code, fresh)) ? fresh : mine.rec?.friendPair || fresh;
    }
    mine.myPair = id;
  } catch {
    setMessage("Couldn't add the friend. Check your internet connection.", "bad");
    return;
  }
  const avatar = Math.max(0, AVATARS.indexOf(avatarOf(mine.rec, opponent())));
  pendingFriend = { id, avatar };
  byId("friend-name").value = "";
  byId("friend-name").placeholder = `Friend ${AVATARS[avatar]}`;
  byId("addfriend-avatar").textContent = AVATARS[avatar];
  openOverlay("addfriend-overlay", { focus: "#friend-name" });
}

byId("save-friend").addEventListener("click", () => {
  if (!pendingFriend) return;
  const typed = byId("friend-name").value.replace(/[<>&"'`]/g, "").trim().slice(0, 16);
  const friend = { ...pendingFriend, name: typed || `Friend ${AVATARS[pendingFriend.avatar]}`, added: Date.now() };
  saveFriends([...friends().filter((f) => f.id !== friend.id), friend]);
  pendingFriend = null;
  if (O?.rec?.friendPair === friend.id || !O?.friendId) { if (O) O.friendId = friend.id; countForFriend(); }
  closeTopThen(() => {
    toast(`${friend.name} saved. Challenge them from Play online.`);
    if (O) render();
  });
});
byId("friend-name").addEventListener("keydown", (e) => { if (e.key === "Enter") byId("save-friend").click(); });

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function joinRematch(code) {
  if (!O) return;
  try {
    const { color } = await O.backend.join(code, avatarOf(O.rec, O.color));
    openOnlineGame(code, color, { friendName: O.friendName || friendByPair(friendIdOf())?.name || null, friendId: friendIdOf() });
  } catch {
    setMessage("Couldn't join the rematch.", "bad");
  }
}
