# Puzzles

`puzzles.json` holds the Challenges puzzles. It's made by `npm run puzzles`
(`scripts/make-puzzles.mjs`), which lets the bots play each other and keeps every position with
exactly one clearly best answer:

| Set | Kind | Rule |
| --- | --- | --- |
| `mate1` | Mate in 1 | Exactly one mating move. |
| `hanging` | Free pieces | One capture wins at least a minor piece; every other move is clearly worse. |
| `mate2` | Mate in 2 | No mate in one, and exactly one first move forces mate. |
| `fork` | Forks | One move attacks two valuable pieces (or king and piece) and wins one. |
| `material` | Win material | Any other two-move combination that wins at least a minor piece. |

Each puzzle is `{ fen, line, accept? }`. The player plays the even steps of `line` (0, 2, …);
the odd steps are the other side's replies. `accept[i]` lists other moves just as good at step
`i`. In mate puzzles any mating move finishes the puzzle. The generator is seeded, so it makes the
same file every time. `npm run validate` replays and re-checks every puzzle.
