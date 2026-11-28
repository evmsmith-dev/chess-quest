// The bot ladder: friendly characters, easiest first. Every bot is open; the ladder is a suggested
// path ("Next up" is the bot after the highest one you've won against). To add a bot, add an
// entry here; the picker, its tier groups, records and "first win" badges all come from this list.
//
// Fields:
//   id        saved with games and records: never change it once shipped ("beginner" and
//             "intermediate" are the two bots from before the ladder)
//   name, kind, emoji
//   group     the difficulty tier shown in the picker ("Beginner", "Intermediate"; a later
//             "Advanced" group just goes after them)
//   about     one short line about its personality
//   plays     its strength in plain words (no ratings: they'd only be guesses)
//   hello     what the bot says when a game starts (friendly, never mocking)
//   engine    { level, ...overrides } for chooseMove in src/chess/engine.js
//   helpers   whether Coach, Take-backs and Hints start switched on
//   tier      "core" bots make up the Ladder climber badge; bots added later in another tier
//             (say "advanced") don't change what it asks for
//   badge     { id, title }: the "first win" badge (ids of earlier badges are kept)
export const BOTS = [
  {
    id: "pip",
    name: "Pip",
    kind: "chick",
    emoji: "🐣",
    group: "Beginner",
    about: "Just hatched! Makes lots of random moves.",
    plays: "Like someone playing their very first games.",
    hello: "Peep! I'm still learning too. Let's play!",
    engine: { level: "beginner", depth: 1, noise: 600, blunder: 0.7, mateChance: 0.3 },
    helpers: true,
    tier: "core",
    badge: { id: "win-pip", title: "Hatched a win" },
  },
  {
    id: "bramble",
    name: "Bramble",
    kind: "hedgehog",
    emoji: "🦔",
    group: "Beginner",
    about: "Loves grabbing pieces. Watch out, and set traps!",
    plays: "Like a new player who has learned how the pieces move.",
    hello: "Ooh, shiny pieces! Can I take one?",
    engine: { level: "beginner", depth: 1, noise: 240, blunder: 0.3, mateChance: 0.6 },
    helpers: true,
    tier: "core",
    badge: { id: "win-bramble", title: "Prickly win" },
  },
  {
    id: "beginner",
    name: "Sunny",
    kind: "otter",
    emoji: "🦦",
    group: "Beginner",
    about: "Plays for fun and slips up now and then.",
    plays: "Like someone who knows the rules but misses tricks.",
    hello: "Hi! Ready for a fun game?",
    engine: { level: "beginner" },
    helpers: true,
    tier: "core",
    badge: { id: "win-beginner", title: "First win" },
  },
  {
    id: "shelly",
    name: "Shelly",
    kind: "tortoise",
    emoji: "🐢",
    group: "Intermediate",
    about: "Slow and steady. Guards its pieces.",
    plays: "Like a player who protects pieces but misses some tactics.",
    hello: "Let's take our time and play carefully.",
    engine: { level: "beginner", depth: 2, noise: 90, blunder: 0.08, mateChance: 0.9 },
    helpers: true,
    tier: "core",
    badge: { id: "win-shelly", title: "Slow and steady" },
  },
  {
    id: "hoot",
    name: "Hoot",
    kind: "owl",
    emoji: "🦉",
    group: "Intermediate",
    about: "Thinks further ahead. Rarely leaves a piece hanging.",
    plays: "Like a careful player who spots simple tricks.",
    hello: "Hoo! Think before you move. I will too.",
    engine: { level: "beginner", depth: 4, noise: 70, blunder: 0.05, mateChance: 1 },
    helpers: false,
    tier: "core",
    badge: { id: "win-hoot", title: "Wise move" },
  },
  {
    id: "intermediate",
    name: "Ember",
    kind: "dragon",
    emoji: "🐉",
    group: "Intermediate",
    about: "A friendly dragon at the top of the ladder.",
    plays: "Like a solid club beginner: you'll need a plan.",
    hello: "Welcome to the top! Show me what you've learned.",
    engine: { level: "intermediate" },
    helpers: false,
    tier: "core",
    badge: { id: "win-intermediate", title: "Dragon's match" },
  },
];

export const botById = (id) => BOTS.find((b) => b.id === id) || null;

/** The `games` record ({ [botId]: { w, l, d } }) → a bot's wins. */
export const botWins = (games, id) => games[id]?.w || 0;

/** "Next up" on the ladder: the bot after the highest one won against (null at the top). */
export function nextUpBot(games) {
  const highest = BOTS.reduce((top, b, i) => (botWins(games, b.id) ? i : top), -1);
  return BOTS[highest + 1] || null;
}

/** The bot after `id` on the ladder (null at the top). */
export const botAfter = (id) => BOTS[BOTS.findIndex((b) => b.id === id) + 1] || null;

/** Where the one-time "How much chess have you played?" question starts each answer. */
export const BOT_START = [
  { id: "new", label: "I'm new to chess", bot: "pip" },
  { id: "rules", label: "I know the rules", bot: "beginner" },
  { id: "often", label: "I play often", bot: "hoot" },
];
