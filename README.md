# Chess Quest

Learn chess, solve puzzles and play the computer, in an app you install on a phone, tablet or computer (PWA). It works offline. For all ages, from first moves to intermediate.

- **🎓 Learn:** 38 short lessons in 10 units: *Meet the pieces*, *Winning pieces*, *Check and checkmate*, *Special moves*, *How games end*, *Winning plans*, *Opening basics* (center, development, castling, beginner traps), *Checkmate patterns* (back-rank, smothered, queen kiss and ladder mates), *More tactics* (pins, skewers, discovered attacks, removing the defender) and *Endgame basics* (the square rule, the opposition, king in front of the pawn, pawn breakthrough). Each lesson starts with a Tip Card, followed by a few tasks:
  - **Stars:** move one kind of piece to collect every ⭐, with the fewest moves possible shown.
  - **Find the move:** for example a mate in one, getting out of check three ways, castling or en passant.
  - **Quizzes:** short questions about the rules.
  - **Play-outs:** checkmate a lone king with a queen or a rook against the bot, within a set number of moves.

  Wrong moves get an explanation ("The pawn on d5 is protected by the pawn on e6…"). Lessons earn up to 3 stars, and every lesson is open, so experienced players can skip ahead.
- **🏅 Achievements:** 31 badges for real skills and milestones (finishing units, crowns, Speed drill scores, beating endgame bosses, first wins against each bot, online and pass-and-play games, game review, a 7-day daily streak). Worked out from saved progress and kept on the device; once earned, a badge is never taken away. A banner celebrates each new one; progress from before badges existed gets a single summary. **Coach Knightly**, an original cartoon pony on a chess-piece base (a knight), introduces Tip Cards and celebrates badges with short, kind lines. Settings has switches for the coach (off: plain tips, same badges) and for badge pop-ups (off: badges still appear in Achievements).
- **🎯 Challenges:** puzzles with one best answer, in nine sets. Beginner sets are *Mate in 1* and *Free pieces*. Intermediate sets are *Mate in 2*, *Forks*, *Win material*, *Pins & skewers*, *Discovered attacks*, *Mate in 3* and *Defend!* (find the only move that stops the opponent's threat). **Endgame bosses** are positions to win against the bot (queen, two rooks, rook, pawn race, breakthrough, king and pawn), with ⭐⭐⭐ for winning in few moves. A hint first shows which piece to move, then where to move it.
  - **Finishing a set** celebrates, shows how many were solved on the first try, and suggests the next set (Mate in 1 → Free pieces → Mate in 2 → Forks → Win material). A finished set's card shows ✓, or 👑 when every puzzle was solved on the first try, and opens **Retry missed**, **Practice** (shuffled) and **Speed drill**.
  - **⚡ Speed drill:** as many puzzles from one set as you can in 3 minutes, with 3 lives. A miss shows the answer. The best score per set is kept.
- **🔥 Daily puzzle:** the same puzzle for everyone each day, with a streak. Every 7 days in a row earns a 🧊 freeze (up to 2), and a freeze saves the streak on a missed day. After solving, you see how many players solved it on the first try that day (two anonymous counts per day, when online play is set up).
- **🤖 Play the computer:** full games against a **Beginner** or **Intermediate** bot, as White, Black or a random color.
  - All the rules apply: castling, en passant, promotion, and draws by stalemate, threefold repetition, the 50-move rule and insufficient material.
  - Optional help: a **coach** that warns before you leave a piece unprotected, **take-backs**, and **hints**. All are on by default for Beginner and off for Intermediate.
  - You can resign, offer a draw, flip the board and see the move list. An unfinished game is saved and can be continued from Home.
- **🔍 Game review:** after a game against the bot or a two-player game, the engine checks every move and picks out up to three key moments: a missed checkmate, an allowed checkmate, a piece left where it could be taken, a free piece that was missed, or a move that gave away value. Each comes with a plain-words explanation. **Try it** lets you look for a better move yourself and tells you at once how it compares. **Show** plays the better move. Back returns to the finished game.
- **👥 Play a friend:** two players take turns on one phone or tablet (pass and play), with optional names.
  - The board can turn to face whoever's turn it is.
  - Take-backs undo the last move. Either player can resign, and a draw offer is answered by the other player on the same device.
  - A rematch swaps sides. An unfinished two-player game is saved separately from a game against the bot.
- **🌐 Play online:** play someone on another phone or tablet. One player creates a game and shares a 6-character code or a link, and the other joins with it.
  - Moves, resign, draw offers and rematches (which swap sides) work across both devices. If the other player goes offline, you see it, and the game waits for them.
  - **Offline:** the online pop-up says "You're offline" and waits to enable its buttons until the connection is back, and a banner during a game says moves will send on reconnecting. It watches both the phone's network status and Firebase's live connection. Creating, joining and challenging give up after 10 seconds with a clear message instead of waiting forever.
  - Leaving and coming back continues the game. If Firebase replaces a player's anonymous number (it deletes them after 30 days), a private **seat key** saved on the device quietly reclaims their seat. A game nobody has joined yet can be cancelled: it's deleted at once, and any friend challenge is withdrawn.
  - **Clocks:** choose No clock, 5, 10 or 15 minutes per player. Only the player to move loses time, clocks use the server's time (so a phone's wrong clock doesn't matter), and running out loses the game.
  - **Friends:** after a game, **Add friend** saves a private link that only your two devices know, under a nickname that stays on your device. Saved friends appear in Play online with **Challenge**. The friend sees "Sam challenged you!" on Home the next time they open the app (challenges last 30 minutes). Friend links unused for 60 days are removed.
  - **No names and no chat:** players pick an emoji avatar. Only the moves, the avatars and a random player number are stored, and games are deleted after 7 days.
  - Runs on Firebase's free plan, which needs a one-time setup: see [docs/firebase-setup.md](docs/firebase-setup.md). Until then the card says online play isn't set up.
- **⚙️ Settings** also has **📤 Share Chess Quest**, which opens the phone's share sheet with a link to the website (people install the app from there), and a plain-words **🔒 Privacy** page.
- **📖 Rulebook:** every rule with an example board, searchable.

**Moving pieces:** tap a piece and then a square, or drag it (dragging can be turned off in Settings, for players who find it causes slips). Dots show where the piece can go. When you drag on a touch screen, the piece rides above your finger so you can see it. Illegal moves are explained ("That bishop is pinned: moving it would put your own king in check"). The board also works with a keyboard and a screen reader.

**Any screen, any orientation:** in portrait the board sits above the controls. In landscape (a phone on its side, an iPad, a computer) the board takes the full height with the controls beside it. Tests run at Galaxy S26 size in portrait and landscape, at iPad landscape size and on desktop.

**Every pop-up can be dismissed** with its ✕, a tap outside it, Escape, or the phone's Back gesture. This includes the promotion picker: dismissing it puts the pawn back. `tests/e2e/overlays.spec.js` checks all four ways for every pop-up.

## How it's built

- Plain HTML, CSS and JavaScript (ES modules), with no framework, set up the same way as Logic Puzzles and Sentence Builders.
- **Rules:** [chess.js](https://github.com/jhlywa/chess.js) (BSD-2) is the referee: legal moves, move names (SAN), check, mate and draws.
- **The bot** (`src/chess/engine.js`) has its own fast move generator, because chess.js is far too slow to search with. It uses a 10×12 mailbox board, alpha-beta search with quiescence, a transposition table, null-move pruning and piece-square tables, and checks about 350,000 positions a second. It runs in a Web Worker (`src/chess/worker.js`) so the board never freezes. A unit test checks the move generator against standard perft counts and against chess.js in random games.
  - **Beginner** looks two moves ahead with a lot of randomness. It plays sensible moves but misses tactics and sometimes leaves pieces hanging.
  - **Intermediate** looks four to five moves ahead, follows captures to the end, and adds only a little randomness. It beats Beginner almost every time, which a unit test also checks.
  - Harder levels can come later by raising the depth and lowering the randomness, or by adding Stockfish. Note that Stockfish's GPL license would then cover the whole app.
- **The board** (`src/ui/board.js`) is 64 buttons with a layer of pieces that slide between squares. It only knows about taps and drags. Each screen decides which moves are allowed.
- **Lessons** live in `src/content/lessons.js` and **rules** in `src/content/rules.js`. `src/lib/tasks.js` judges the tasks. `npm run validate` checks every lesson position, answer and star route, and replays every puzzle.
- **Puzzles** (`data/puzzles.json`) are generated by `npm run puzzles` from games the bots play against each other. See `data/README.md`.
- **Game review** (`src/lib/review.js`, `src/screens/review.js`): the worker scores every legal move in each position where the player moved (three moves deep). The review compares the move played with the best one, then sorts out the kind of mistake and words the explanation. Moves within 0.6 points of the best count as finding it in **Try it**.
- **Online play** (`src/screens/online.js`) talks to a small backend interface. `src/online/firebase-backend.js` uses Firebase anonymous sign-in and the Realtime Database, and is loaded only when online play is opened. `database.rules.json` holds the server's security rules: only the two players can change a game, only on their turn, with a fixed shape and no free text. `src/online/local-backend.js` stands in for Firebase in the browser tests, where two tabs play each other. Both phones replay every move through chess.js, and a game stops if an illegal move ever arrives.
- **Security:**
  - The rules accept only a fixed game shape. Avatars are a number from 0 to 11, so there's no free text at all.
  - A resignation always makes the other player the winner, and a draw by agreement needs an open offer from the opponent. Checkmate or a draw can only be claimed together with the move that caused it, by the player who made it.
  - App Check (reCAPTCHA Enterprise) shuts out scripts that copied the public config.
  - The built page carries a Content Security Policy: only this site's code runs, and it talks only to Firebase and reCAPTCHA. A browser test fails if any screen breaks the policy.
  - Dependabot opens pull requests for dependency updates.
  - **The database rules are tested** against Firebase's own rules engine (the emulator) on every push, in the `rules` job of the GitHub workflow (`tests/rules/`). The tests cover strangers moving, out-of-turn moves, rewriting history, resigning and winning, early time claims, reusing a seat key, reading seat keys, fake challenges and inflating stats.
- **Sound** is made in code with Web Audio, so there are no audio files. It respects the iPhone silent switch. **Vibration** works on Android, with a light tick on iPhone (iOS 18+).
- ****Emoji reactions:** in online games, 😊 sends one of six fixed reactions (👍 Nice move!, 😮 Wow!, 😄 Ha ha!, 🤔 Hmm…, 👏 Well played!, 🤝 Good game!), which pops up by the sender's name on both screens. No typing or chat; at most one every 2 seconds (enforced by the database rules); can be turned off in Settings.
- **“Your move” alerts:**** in an online game, when the app is in the background, a chime, a vibration, a ♟ in the tab title and a badge on the app icon say it's your turn (also for a game ending, an opponent joining, a rematch or a friend's challenge). If the player allows notifications (from a button in the online game or in Settings), a phone notification is shown too, made by the device itself while the app is still running in the background: phones block vibration and badges for background apps, so this is the alert that gets noticed. It all happens on the device: no server or push tokens. Browsers pause background pages after a while, iPhones and iPads almost at once, so it helps most on computers and Android.
- **Settings:** theme (auto, light or dark), board colors (green, blue or wood), sound, vibration, “Your move” alerts, legal-move dots, coordinates, always promote to a queen, and larger text.
- **`npm run build`** bundles everything into `dist/` with esbuild and writes a service worker that caches every file for offline play. New versions install in the background and are offered with an Update button, the same as in the other apps.

## Development

```sh
npm install
npm start          # play the source at http://localhost:8080
npm test           # content check, unit tests, then build and run the browser tests
npm run preview    # build and serve dist/ at http://localhost:8080
npm run puzzles    # regenerate data/puzzles.json (takes a while)
npm run test:rules # test database.rules.json in the Firebase emulator (needs Java)
```

Pushes to `main` are tested and deployed to GitHub Pages by `.github/workflows/deploy.yml`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Credits

- Chess pieces by Colin M.L. Burnett and Rfc1394, from Wikimedia Commons (CC BY-SA 3.0), in the sprite from cm-chessboard. See `vendor/pieces/LICENSE.txt`.
- The Fredoka font (SIL Open Font License) and canvas-confetti (ISC license) are bundled in `vendor/`.
- chess.js is under the BSD 2-Clause license.
