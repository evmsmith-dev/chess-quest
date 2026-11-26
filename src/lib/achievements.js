// Achievements: badges for real chess skills and milestones, worked out from progress the app
// already saves (plus a few counters in "milestones"). Everything stays on this device. Badges
// reward learning, never time spent, and nothing is ever taken away: once earned, a badge is
// kept, even if a streak later breaks.
import { readJson, writeJson } from "../storage.js";
import { UNITS, ALL_LESSONS } from "../content/lessons.js";
import { BOSSES } from "../content/bosses.js";

/** Small counters for events that aren't otherwise saved: { onlineGames: 2, … }. */
export const milestones = () => readJson("milestones", {});
export function bump(name, by = 1) {
  const all = milestones();
  all[name] = (all[name] || 0) + by;
  writeJson("milestones", all);
}

/** Keeps the best value seen for a counter (e.g. the longest daily streak). */
export function best(name, value) {
  const all = milestones();
  if ((all[name] || 0) >= value) return;
  all[name] = value;
  writeJson("milestones", all);
}

/** Earned badges: { [id]: time earned }. */
export const earnedBadges = () => readJson("achievements", null);

// What a badge check can see: a snapshot of saved progress. Puzzle set sizes come from the
// caller (the puzzle file is loaded separately), as { [setId]: count }.
function snapshot(setSizes) {
  const lessons = readJson("lessons", {});
  const solved = readJson("puzzles", {});
  const clean = readJson("puzzlesClean", null) || solved;
  const games = readJson("games", {});
  return {
    lessons,
    unitDone: (id) => UNITS.find((u) => u.id === id)?.lessons.every((l) => lessons[l.id]),
    unitsDone: UNITS.filter((u) => u.lessons.every((l) => lessons[l.id])).length,
    lessonsDone: ALL_LESSONS.filter((l) => lessons[l.id]).length,
    allThreeStars: ALL_LESSONS.every((l) => lessons[l.id]?.stars === 3),
    solvedCount: Object.values(solved).reduce((n, list) => n + list.length, 0),
    setDone: (id) => setSizes[id] > 0 && (solved[id]?.length || 0) >= setSizes[id],
    setPerfect: (id) => setSizes[id] > 0 && (clean[id]?.length || 0) >= setSizes[id],
    sets: Object.keys(setSizes),
    drillBest: Math.max(0, ...Object.values(readJson("drillBest", {}))),
    bosses: readJson("bosses", {}),
    wins: (level) => games[level]?.w || 0,
    botGames: ["beginner", "intermediate"].reduce((n, l) => n + (games[l] ? games[l].w + games[l].l + games[l].d : 0), 0),
    botWins: ["beginner", "intermediate"].reduce((n, l) => n + (games[l]?.w || 0), 0),
    dailyDays: Object.keys(readJson("daily", {})).length,
    bestStreak: milestones().bestStreak || 0,
    m: milestones(),
    friendGamesOnline: Object.values(readJson("friendRecords", {})).reduce((n, r) => n + r.w + r.l + r.d, 0),
  };
}

// group: where it shows on the badge wall. hint: how to earn it (shown while locked).
export const BADGES = [
  // Learn
  { id: "first-lesson", group: "Learn", emoji: "🎓", title: "First step", hint: "Finish your first lesson.", earned: (s) => s.lessonsDone >= 1 },
  { id: "first-unit", group: "Learn", emoji: "📗", title: "Unit complete", hint: "Finish every lesson in one Learn unit.", earned: (s) => s.unitsDone >= 1 },
  { id: "five-units", group: "Learn", emoji: "📚", title: "Bookworm", hint: "Finish five Learn units.", earned: (s) => s.unitsDone >= 5 },
  { id: "tactician", group: "Learn", emoji: "⚔️", title: "Tactician", hint: "Finish the More tactics unit.", earned: (s) => s.unitDone("tactics") },
  { id: "mate-patterns", group: "Learn", emoji: "🎯", title: "Pattern spotter", hint: "Finish the Checkmate patterns unit.", earned: (s) => s.unitDone("patterns") },
  { id: "endgame-basics", group: "Learn", emoji: "🏁", title: "Endgame explorer", hint: "Finish the Endgame basics unit.", earned: (s) => s.unitDone("endgames") },
  { id: "graduate", group: "Learn", emoji: "🧑‍🎓", title: "Graduate", hint: "Finish every lesson.", earned: (s) => s.lessonsDone >= ALL_LESSONS.length },
  { id: "perfectionist", group: "Learn", emoji: "🌟", title: "Perfectionist", hint: "Earn 3 stars on every lesson.", earned: (s) => s.allThreeStars },
  // Puzzles
  { id: "first-puzzle", group: "Puzzles", emoji: "🧩", title: "Puzzle solver", hint: "Solve your first Challenges puzzle.", earned: (s) => s.solvedCount >= 1 },
  { id: "puzzles-50", group: "Puzzles", emoji: "🔥", title: "Puzzle fan", hint: "Solve 50 puzzles.", earned: (s) => s.solvedCount >= 50 },
  { id: "puzzles-150", group: "Puzzles", emoji: "🏔️", title: "Puzzle master", hint: "Solve 150 puzzles.", earned: (s) => s.solvedCount >= 150 },
  { id: "set-done", group: "Puzzles", emoji: "✅", title: "Set complete", hint: "Solve every puzzle in one Challenges set.", earned: (s) => s.sets.some(s.setDone) },
  { id: "crowned", group: "Puzzles", emoji: "👑", title: "Crowned", hint: "Solve every puzzle in a set on the first try.", earned: (s) => s.sets.some(s.setPerfect) },
  { id: "mate-maestro", group: "Puzzles", emoji: "♛", title: "Mate maestro", hint: "Complete Mate in 1, Mate in 2 and Mate in 3.", earned: (s) => ["mate1", "mate2", "mate3"].every(s.setDone) },
  { id: "tactics-collector", group: "Puzzles", emoji: "🍴", title: "Tactics collector", hint: "Complete Forks, Pins & skewers and Discovered attacks.", earned: (s) => ["fork", "pin", "discovered"].every(s.setDone) },
  { id: "rock-solid", group: "Puzzles", emoji: "🛡️", title: "Rock solid", hint: "Complete the Defend! set.", earned: (s) => s.setDone("defend") },
  { id: "quick-10", group: "Puzzles", emoji: "⚡", title: "Quick thinker", hint: "Solve 10 puzzles in one Speed drill.", earned: (s) => s.drillBest >= 10 },
  { id: "quick-20", group: "Puzzles", emoji: "🌩️", title: "Lightning", hint: "Solve 20 puzzles in one Speed drill.", earned: (s) => s.drillBest >= 20 },
  { id: "daily-first", group: "Puzzles", emoji: "📅", title: "Daily puzzler", hint: "Solve a daily puzzle.", earned: (s) => s.dailyDays >= 1 },
  { id: "streak-7", group: "Puzzles", emoji: "🗓️", title: "Week of chess", hint: "Solve the daily puzzle 7 days in a row. (Once earned, it's yours to keep.)", earned: (s) => s.bestStreak >= 7 },
  // Endgames
  { id: "boss-first", group: "Endgames", emoji: "♚", title: "Boss beater", hint: "Beat any endgame boss.", earned: (s) => Object.keys(s.bosses).length >= 1 },
  { id: "boss-all", group: "Endgames", emoji: "🏆", title: "Endgame champion", hint: "Beat every endgame boss.", earned: (s) => BOSSES.every((b) => s.bosses[b.id]) },
  { id: "boss-flawless", group: "Endgames", emoji: "💎", title: "Flawless", hint: "Earn 3 stars on every endgame boss.", earned: (s) => BOSSES.every((b) => s.bosses[b.id]?.stars === 3) },
  // Play
  { id: "first-game", group: "Play", emoji: "♟️", title: "Game on", hint: "Finish a game against the computer.", earned: (s) => s.botGames >= 1 },
  { id: "win-beginner", group: "Play", emoji: "🐣", title: "First win", hint: "Beat the Beginner bot.", earned: (s) => s.wins("beginner") >= 1 },
  { id: "win-intermediate", group: "Play", emoji: "🦉", title: "Giant slayer", hint: "Beat the Intermediate bot.", earned: (s) => s.wins("intermediate") >= 1 },
  { id: "wins-10", group: "Play", emoji: "🔟", title: "Ten wins", hint: "Win 10 games against the computer.", earned: (s) => s.botWins >= 10 },
  { id: "pass-and-play", group: "Play", emoji: "🤝", title: "Good sport", hint: "Finish a two-player game on one device.", earned: (s) => (s.m.friendGames || 0) >= 1 },
  { id: "online-first", group: "Play", emoji: "🌍", title: "Online debut", hint: "Finish an online game.", earned: (s) => (s.m.onlineGames || 0) >= 1 },
  { id: "online-friend", group: "Play", emoji: "💛", title: "Chess buddies", hint: "Play an online game against a saved friend.", earned: (s) => s.friendGamesOnline >= 1 },
  { id: "reviewer", group: "Play", emoji: "🔍", title: "Learning from games", hint: "Look back at a game with Game review.", earned: (s) => (s.m.reviews || 0) >= 1 },
];
export const BADGE_GROUPS = ["Learn", "Puzzles", "Endgames", "Play"];

/**
 * Works out which badges are now earned and saves them. Returns the newly earned ones, and
 * `first: true` on the very first check (when earlier progress may already have earned several:
 * those are saved quietly and summed up instead of celebrated one by one).
 */
export function checkBadges(setSizes) {
  const before = earnedBadges();
  const first = before === null;
  const earned = { ...(before || {}) };
  const s = snapshot(setSizes);
  const fresh = [];
  for (const badge of BADGES) {
    if (earned[badge.id]) continue;
    let ok = false;
    try {
      ok = badge.earned(s);
    } catch {
      ok = false;
    }
    if (ok) {
      earned[badge.id] = Date.now();
      fresh.push(badge);
    }
  }
  if (fresh.length || first) writeJson("achievements", earned);
  return { fresh, first };
}
