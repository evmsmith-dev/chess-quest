// The Learn path. Each lesson opens with a Tip Card and then a few short tasks:
//   stars  Move one kind of piece to collect every ⭐ (a ⭐ on an enemy piece means capture it).
//          Only pieces of type `piece` move; the other side never moves.
//   move   Find one move. `goal`: mate (any checkmate), check (any check), exact (one of `accept`),
//          escape (get out of check by `way`: king, block or capture), safe (afterwards none of
//          your pieces can be won), promote. `pre` is a move the other side makes first.
//          `wrong` gives a reason for particular wrong moves.
//   quiz   A question, with an optional board (`fen`, `highlight`).
//   play   Play on from a position against the bot until `goal` (mate) within `moves` moves.
//          `success` is shown for a solution; `successFor` can give particular solutions their own.
// The player always plays the side to move in `fen`. scripts/validate-content.mjs checks every
// position, answer and star.
export const UNITS = [
  {
    id: "pieces",
    title: "Meet the pieces",
    emoji: "♟️",
    lessons: [
      {
        id: "board",
        title: "The board",
        tip: [
          "Chess is played on a board of 64 squares, 8 by 8, between White and Black. White moves first, then you take turns.",
          "Each square has a name: a letter for its column (a to h) and a number for its row (1 to 8). The square in the middle here is e4.",
          "Set the board up with a light square in each player's bottom-right corner: \"light on the right\".",
        ],
        tipFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        tipHighlight: ["e4"],
        tasks: [
          { type: "quiz", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", highlight: ["d5"], text: "Which square is glowing?", options: ["d5", "e4", "5d", "d4"], answer: 0, explain: "Letter first (the column d), then the number (row 5): d5." },
          { type: "quiz", text: "When you set up a board, which corner square goes on your right?", options: ["A light square", "A dark square"], answer: 0, explain: "\"Light on the right\": the bottom-right square (h1 for White) is always light." },
          { type: "quiz", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", highlight: ["d1", "e1"], text: "The queen starts on a square of her own color. Which square is the white queen on?", options: ["d1", "e1"], answer: 0, explain: "The white queen starts on d1, a light square; the black queen on d8, a dark square. The kings stand beside them." },
        ],
      },
      {
        id: "rook",
        title: "The rook",
        tip: [
          "The rook moves in a straight line: up, down, left or right, as far as it likes.",
          "It can't jump over pieces. It captures an enemy piece by landing on its square.",
        ],
        tipFen: "8/8/8/8/3R4/8/8/8 w - - 0 1",
        tipHighlight: ["d1", "d2", "d3", "d5", "d6", "d7", "d8", "a4", "b4", "c4", "e4", "f4", "g4", "h4"],
        tasks: [
          { type: "stars", piece: "r", fen: "8/8/8/8/8/8/8/R7 w - - 0 1", stars: ["a8", "h8", "h1"], text: "Collect all the stars with your rook." },
          { type: "stars", piece: "r", fen: "8/8/3P4/8/1P1R2P1/8/8/8 w - - 0 1", stars: ["d8", "a4"], text: "Rooks can't jump. Find a way around your own pawns." },
          { type: "stars", piece: "r", fen: "8/8/p4p2/8/8/8/8/R7 w - - 0 1", stars: ["a6", "f6"], text: "Capture both black pawns by landing on them." },
        ],
      },
      {
        id: "bishop",
        title: "The bishop",
        tip: [
          "The bishop moves diagonally, as far as it likes, and can't jump over pieces.",
          "A bishop always stays on squares of one color. Each side has one bishop for the light squares and one for the dark squares.",
        ],
        tipFen: "8/8/8/8/3B4/8/8/8 w - - 0 1",
        tipHighlight: ["a1", "b2", "c3", "e5", "f6", "g7", "h8", "a7", "b6", "c5", "e3", "f2", "g1"],
        tasks: [
          { type: "stars", piece: "b", fen: "8/8/8/8/8/8/8/2B5 w - - 0 1", stars: ["h6", "f8", "a3"], text: "Collect all the stars with your bishop." },
          { type: "quiz", fen: "8/8/8/8/8/8/8/2B5 w - - 0 1", highlight: ["h1"], text: "This bishop is on a dark square. Can it ever reach the glowing square, h1?", options: ["No, h1 is a light square", "Yes, in two moves"], answer: 0, explain: "A bishop never changes color. This one will only ever stand on dark squares." },
          { type: "stars", piece: "b", fen: "4p3/8/8/1p6/8/8/8/5B2 w - - 0 1", stars: ["b5", "e8"], text: "Capture both black pawns." },
        ],
      },
      {
        id: "queen",
        title: "The queen",
        tip: [
          "The queen is the most powerful piece. She moves like a rook and a bishop together: any distance in a straight line or diagonally.",
          "Like them, she can't jump over pieces.",
        ],
        tipFen: "8/8/8/8/3Q4/8/8/8 w - - 0 1",
        tipHighlight: ["d1", "d2", "d3", "d5", "d6", "d7", "d8", "a4", "b4", "c4", "e4", "f4", "g4", "h4", "a1", "b2", "c3", "e5", "f6", "g7", "h8", "a7", "b6", "c5", "e3", "f2", "g1"],
        tasks: [
          { type: "stars", piece: "q", fen: "8/8/8/8/8/8/8/3Q4 w - - 0 1", stars: ["d8", "h4", "a4"], text: "Collect all the stars with your queen." },
          { type: "stars", piece: "q", fen: "8/p5p1/8/8/3Q4/8/8/p5p1 w - - 0 1", stars: ["a7", "g7", "g1", "a1"], text: "Capture all four pawns. Use straight lines and diagonals." },
        ],
      },
      {
        id: "king",
        title: "The king",
        tip: [
          "The king moves one square in any direction.",
          "The king is never captured. Instead, it may never move to a square where it could be captured. Protecting your king is the whole game!",
        ],
        tipFen: "8/8/8/8/3K4/8/8/8 w - - 0 1",
        tipHighlight: ["c3", "c4", "c5", "d3", "d5", "e3", "e4", "e5"],
        tasks: [
          { type: "stars", piece: "k", fen: "8/8/8/8/8/8/8/4K3 w - - 0 1", stars: ["e3", "g3"], text: "Collect the stars, one step at a time." },
          { type: "stars", piece: "k", fen: "8/8/3b4/8/8/4K3/8/8 w - - 0 1", stars: ["e6"], text: "Your king can't step onto a square the black bishop attacks. Find a safe path to the star." },
        ],
      },
      {
        id: "knight",
        title: "The knight",
        tip: [
          "The knight moves in an L shape: two squares in a straight line, then one square to the side.",
          "It's the only piece that can jump over other pieces. A knight always lands on a square of the other color.",
        ],
        tipFen: "8/8/8/8/3N4/8/8/8 w - - 0 1",
        tipHighlight: ["b3", "b5", "c2", "c6", "e2", "e6", "f3", "f5"],
        tasks: [
          { type: "stars", piece: "n", fen: "8/8/8/8/8/8/8/6N1 w - - 0 1", stars: ["f3", "e5", "f7"], text: "Hop to every star." },
          { type: "stars", piece: "n", fen: "8/8/8/8/8/8/PPPP4/1N6 w - - 0 1", stars: ["c3", "d5", "b6"], text: "Knights jump over pieces. Leap out from behind your pawns." },
          { type: "stars", piece: "n", fen: "8/8/2p1p3/8/3N4/8/8/8 w - - 0 1", stars: ["c6", "e6"], text: "Capture both pawns. Tricky: you may need to hop back." },
        ],
      },
      {
        id: "pawn",
        title: "The pawn",
        tip: [
          "Pawns move straight ahead one square, never backward. On its very first move a pawn may move two squares.",
          "Pawns capture differently: one square diagonally forward. A pawn can't capture straight ahead, so a piece in front of it blocks it.",
        ],
        tipFen: "8/8/8/3p1p2/4P3/8/8/8 w - - 0 1",
        tipHighlight: ["e5", "d5", "f5"],
        tasks: [
          { type: "stars", piece: "p", fen: "8/8/8/8/8/8/4P3/8 w - - 0 1", stars: ["e4", "e6"], text: "Collect the stars. Your pawn hasn't moved yet, so it may jump two squares." },
          { type: "stars", piece: "p", fen: "8/8/8/5p2/4p3/3P4/8/8 w - - 0 1", stars: ["e4", "f5"], text: "Pawns capture diagonally. Capture both black pawns." },
          { type: "stars", piece: "p", fen: "8/8/8/2pp4/2P5/8/8/8 w - - 0 1", stars: ["d5", "d7"], text: "Your pawn is blocked. Capture to get around, then reach the last star." },
        ],
      },
    ],
  },
  {
    id: "capturing",
    title: "Winning pieces",
    emoji: "⚖️",
    lessons: [
      {
        id: "values",
        title: "What pieces are worth",
        tip: [
          "Pieces are worth points: pawn 1, knight 3, bishop 3, rook 5, queen 9. The king is priceless.",
          "Trade a piece only for one worth as much or more. Losing a rook for a knight is a bad deal.",
        ],
        tasks: [
          { type: "quiz", text: "Which is worth more: one rook, or a knight and a pawn?", options: ["The rook (5)", "The knight and pawn (4)", "They're equal"], answer: 0, explain: "A rook is 5, a knight and a pawn together are 3 + 1 = 4." },
          { type: "quiz", text: "You can take your opponent's knight, but then they'll take your queen. Good deal?", options: ["No: you'd give a queen (9) for a knight (3)", "Yes: a capture is always good"], answer: 0, explain: "Count before you capture: you'd win 3 and lose 9." },
          { type: "move", goal: "exact", fen: "6k1/3r4/8/8/p7/8/8/3Q2K1 w - - 0 1", accept: ["d1d7"], text: "Your queen can capture a pawn or a rook. Take the more valuable piece.", success: "Right: a rook is worth 5, a pawn only 1.", wrong: { d1a4: "A pawn is worth 1. The rook on d7 is worth 5, and nothing protects it." } },
        ],
      },
      {
        id: "free-pieces",
        title: "Free pieces",
        tip: [
          "A piece is hanging when it's attacked and nothing protects it. Capture hanging pieces: they're free!",
          "Before you capture, check whether the piece is protected. If it is, you may lose your own piece right back.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "6k1/8/4p3/3p4/b7/2N5/8/6K1 w - - 0 1", accept: ["c3a4"], text: "Your knight can capture two things. Which one is free?", success: "Nothing protected the bishop: a free 3 points.", wrong: { c3d5: "The pawn on d5 is protected by the pawn on e6. After you take it, Black takes your knight: 3 points lost for 1." } },
          { type: "move", goal: "exact", fen: "6k1/8/1p3r2/2n5/8/8/1B6/2R3K1 w - - 0 1", accept: ["b2f6"], text: "One black piece is hanging. Find it and capture it.", success: "The rook on f6 was unprotected. Free rook!", wrong: { c1c5: "The knight is protected by the pawn on b6. You'd trade your rook (5) for a knight (3)." } },
        ],
      },
      {
        id: "protect",
        title: "Keep your pieces safe",
        tip: [
          "When one of your pieces is attacked, you can move it away, protect it with another piece, or block the attack.",
          "Protecting doesn't help if the attacker is worth less: a rook protected from a pawn still loses 5 for 1. Then move it!",
        ],
        tasks: [
          { type: "move", goal: "safe", fen: "6k1/8/8/3p4/4N3/8/5PPP/6K1 w - - 0 1", text: "A pawn attacks your knight. Move the knight to a safe square.", success: "Safe! Your knight can't be captured there." },
          { type: "move", goal: "safe", fen: "6k1/8/5b2/8/3R4/8/5PPP/6K1 w - - 0 1", text: "The bishop attacks your rook. Move the rook to a square the bishop doesn't attack.", success: "Well done. Watch out for squares on the bishop's diagonals!" },
        ],
      },
    ],
  },
  {
    id: "checkmate",
    title: "Check and checkmate",
    emoji: "👑",
    lessons: [
      {
        id: "check",
        title: "Check",
        tip: [
          "When a piece attacks the king, the king is in check.",
          "A player in check must get out of it right away. You may never make a move that leaves your own king in check.",
        ],
        tipFen: "4k3/8/8/1B6/8/8/8/6K1 b - - 0 1",
        tipHighlight: ["b5", "e8"],
        tasks: [
          { type: "move", goal: "check", fen: "4k3/8/8/8/8/8/8/R5K1 w - - 0 1", text: "Give check with your rook.", success: "Check! The rook attacks the black king." },
          { type: "move", goal: "check", fen: "4k3/8/8/8/4N3/8/8/6K1 w - - 0 1", text: "Give check with your knight.", success: "Check! Knight checks can't be blocked." },
          { type: "quiz", fen: "4k3/8/8/1B6/8/8/8/6K1 b - - 0 1", text: "Is the black king in check?", options: ["Yes, the bishop attacks it", "No"], answer: 0, explain: "The bishop on b5 attacks along the diagonal to e8." },
        ],
      },
      {
        id: "escape",
        title: "Getting out of check",
        tip: [
          "There are three ways out of check: move the king to a safe square, block the attack by putting a piece in the way, or capture the attacking piece.",
          "A knight's check can't be blocked, because knights jump.",
        ],
        tasks: [
          { type: "move", goal: "escape", way: "king", fen: "4k3/8/8/4r3/8/8/8/4K3 w - - 0 1", text: "The rook checks your king. Move the king out of check.", success: "Safe! The king stepped off the rook's line." },
          { type: "move", goal: "escape", way: "block", fen: "4k3/8/8/4r3/8/8/8/2B1K3 w - - 0 1", text: "Block the check: put your bishop between the rook and your king.", success: "Blocked! The bishop shields your king." },
          { type: "move", goal: "escape", way: "capture", fen: "4k3/8/8/4r3/8/3N4/8/4K3 w - - 0 1", text: "Get out of check by capturing the attacker.", success: "Captured! No attacker, no check." },
        ],
      },
      {
        id: "checkmate",
        title: "Checkmate",
        tip: [
          "Checkmate is a check with no way out: the king can't move to safety, the check can't be blocked, and the attacker can't be captured.",
          "Checkmate wins the game.",
        ],
        tipFen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1",
        tipHighlight: ["a8", "g8"],
        tasks: [
          { type: "quiz", fen: "R5k1/5ppp/8/8/8/8/8/6K1 b - - 0 1", text: "Black to move. Is this checkmate?", options: ["Checkmate", "Just check", "Neither"], answer: 0, explain: "The rook checks the king, and the king's own pawns block every escape square. Nothing can block or capture the rook." },
          { type: "quiz", fen: "R5k1/5pp1/8/8/8/8/8/6K1 b - - 0 1", text: "Black to move. Is this checkmate?", options: ["Checkmate", "Just check", "Neither"], answer: 1, explain: "The king can escape to h7, so it's only check." },
          { type: "move", goal: "mate", fen: "7k/8/6K1/8/8/8/8/Q7 w - - 0 1", text: "Checkmate in one move with your queen. Your king guards the squares next to it.", success: "Checkmate! The king has nowhere to go." },
        ],
      },
      {
        id: "mate-in-one",
        title: "Mate in one",
        tip: [
          "Look at the squares around the enemy king. Which ones are covered, which are free?",
          "Checks first: try every check you have, and see if the king can escape.",
        ],
        tasks: [
          { type: "move", goal: "mate", fen: "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", text: "Checkmate in one.", success: "The back-row mate: the pawns trap their own king." },
          { type: "move", goal: "mate", fen: "5k2/8/5K2/8/8/8/8/7Q w - - 0 1", text: "Checkmate in one.", success: "Checkmate! Your king and queen work together." },
          { type: "move", goal: "mate", fen: "6rk/6pp/7N/8/8/8/8/6K1 w - - 0 1", text: "Checkmate in one. The black king is boxed in by its own pieces.", success: "A smothered mate: the knight jumps in and nothing can stop it." },
        ],
      },
    ],
  },
  {
    id: "special",
    title: "Special moves",
    emoji: "✨",
    lessons: [
      {
        id: "castling",
        title: "Castling",
        tip: [
          "Castling moves the king two squares toward a rook, and the rook jumps over to the king's other side. It tucks the king away and brings the rook into play.",
          "You may castle only if neither piece has moved, the squares between them are empty, and the king isn't in check, doesn't pass through check, and doesn't land in check.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "r3k2r/pppq1ppp/2n2n2/4p3/4P3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1", accept: ["e1g1"], text: "Castle kingside: move your king two squares toward the rook on h1.", success: "Castled! The king is safe in the corner and the rook is active.", wrong: { e1c1: "That's castling on the queen's side. Go the other way, toward the h1 rook." } },
          { type: "move", goal: "exact", fen: "r3k2r/pppq1ppp/2n2n2/4p3/4P3/2N2N2/PPPQ1PPP/R3K2R w KQkq - 0 1", accept: ["e1c1"], text: "Now castle queenside: move your king two squares toward the rook on a1.", success: "Queenside castling: the king goes to c1, the rook to d1.", wrong: { e1g1: "That's kingside castling. Go toward the a1 rook this time." } },
          { type: "quiz", fen: "4k3/8/8/8/2b5/8/8/4K2R w K - 0 1", highlight: ["f1"], text: "White wants to castle kingside. Is it allowed?", options: ["No: the king would pass through f1, which the bishop attacks", "Yes"], answer: 0, explain: "The king may not pass through an attacked square while castling." },
        ],
      },
      {
        id: "promotion",
        title: "Promotion",
        tip: [
          "When a pawn reaches the far side of the board, it is promoted: it becomes a queen, rook, bishop or knight of your choice.",
          "Almost always choose a queen, the strongest piece.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "8/4P3/8/8/8/2k5/8/6K1 w - - 0 1", accept: ["e7e8q"], text: "Push your pawn to the last row and make it a queen.", success: "A new queen!", wrong: { e7e8r: "A rook is good, but a queen is stronger. Choose the queen.", e7e8b: "Choose the queen, the strongest piece.", e7e8n: "Choose the queen, the strongest piece." } },
          { type: "move", goal: "mate", fen: "k7/2P5/1K6/8/8/8/8/8 w - - 0 1", text: "Promote your pawn with checkmate!", success: "Promotion and checkmate in one move!" },
        ],
      },
      {
        id: "en-passant",
        title: "En passant",
        tip: [
          "En passant (French for \"in passing\") is a special pawn capture.",
          "When an enemy pawn moves two squares and lands right beside your pawn, you may capture it as if it had moved only one square. You must do it on the very next move, or the chance is gone.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "4k3/3p4/8/4P3/8/8/8/4K3 b - - 0 1", pre: "d7d5", accept: ["e5d6"], text: "Black's pawn just moved two squares and landed beside yours. Capture it en passant!", success: "En passant! Your pawn captured diagonally onto d6, and the black pawn left the board." },
          { type: "quiz", text: "When can you capture en passant?", options: ["Only on the move right after the enemy pawn moves two squares", "Any time the pawns are side by side"], answer: 0, explain: "If you make any other move first, the chance is gone." },
        ],
      },
    ],
  },
  {
    id: "endings",
    title: "How games end",
    emoji: "🏁",
    lessons: [
      {
        id: "stalemate",
        title: "Stalemate",
        tip: [
          "If the player to move has no legal move but is not in check, it's stalemate, and the game is a draw.",
          "When you're winning, be careful not to take away every square from the enemy king without giving check.",
        ],
        tasks: [
          { type: "quiz", fen: "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", text: "Black to move. What is this?", options: ["Checkmate", "Stalemate: a draw", "Neither"], answer: 1, explain: "The black king isn't in check, but every square it could go to is attacked, and Black has no other pieces." },
          { type: "move", goal: "mate", fen: "7k/8/6K1/8/8/8/8/3Q4 w - - 0 1", text: "Checkmate in one. Careful: some queen moves leave Black no legal move without check. That's only a draw!", success: "Checkmate, not stalemate. Well done!" },
          { type: "quiz", text: "Who wins after a stalemate?", options: ["Nobody: it's a draw", "The player who trapped the king"], answer: 0, explain: "Stalemate is a draw, even if one side has many more pieces." },
        ],
      },
      {
        id: "draws",
        title: "Draws",
        tip: [
          "Besides stalemate, a game is a draw when: the same position happens three times; 50 moves each go by with no capture and no pawn move; neither side has enough pieces left to checkmate; or both players agree.",
          "King and bishop, or king and knight, can't checkmate a lone king.",
        ],
        tasks: [
          { type: "quiz", fen: "8/8/3k4/8/8/2B5/8/4K3 w - - 0 1", text: "White has a king and a bishop, Black just a king. Can White win?", options: ["No: it's a draw, a bishop can't checkmate", "Yes, with careful play"], answer: 0, explain: "A king and one bishop (or one knight) can never force checkmate, so the game is drawn right away." },
          { type: "quiz", text: "The same position appears for the third time. What happens?", options: ["The game is a draw", "The player to move loses", "Nothing"], answer: 0, explain: "Threefold repetition is a draw." },
          { type: "quiz", text: "Which of these is NOT a draw?", options: ["The king is in check and can't escape", "Stalemate", "Both players agree"], answer: 0, explain: "That's checkmate: a win." },
        ],
      },
    ],
  },
  {
    id: "plans",
    title: "Winning plans",
    emoji: "🧭",
    lessons: [
      {
        id: "opening",
        title: "A good start",
        tip: [
          "Start by putting pawns in the center (e4 or d4) and bringing out your knights and bishops.",
          "Castle early to keep your king safe. Don't bring your queen out too soon: it can be chased around.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", accept: ["e2e4", "d2d4", "c2c4", "g1f3", "b1c3"], text: "Make a strong first move that controls the center.", success: "A great start: you claim the center and free your pieces.", successFor: { b1c3: "Good! The knight controls e4 and d5, two center squares. e4 or d4 grabs the center even more directly." }, wrong: { f2f4: "That does aim at the center (e5), but it also opens up your king. e4 or d4 is safer.", e2e3: "That's safe, but timid: e4 takes twice as much space in one move.", d2d3: "That's safe, but timid: d4 takes twice as much space in one move.", g2g3: "That gets the bishop ready to aim at the center, but e4 or d4 grabs the center right away.", b2b3: "That gets the bishop ready to aim at the center, but e4 or d4 grabs the center right away.", g1h3: "A knight on the rim is dim. From f3 it would control the center.", b1a3: "A knight on the rim is dim. From c3 it would control the center." }, wrongDefault: "That's legal, but it doesn't do much for the center. Try a pawn to e4 or d4." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", accept: ["g1f3", "b1c3", "f1c4", "f1b5", "f1e2"], text: "Bring out a knight or a bishop.", success: "Developed! Your pieces are heading into the game.", successFor: { f1e2: "Developed! Be2 is solid. Bc4 or Bb5 would put the bishop to work a little more." }, wrong: { f1d3: "That does develop the bishop, but on d3 it blocks your d-pawn, and then your other bishop gets stuck behind it. Try c4, b5 or e2.", f1a6: "The b7 pawn would just take your bishop. Try c4 or b5.", g1e2: "That develops the knight, but on e2 it blocks your bishop. f3 is its best square.", g1h3: "A knight on the rim is dim. Bring it to f3 instead.", b1a3: "A knight on the rim is dim. Bring it to c3 instead.", e1e2: "The king should stay home and castle soon. Bring out a knight or a bishop.", d2d4: "d4 is a good move too! But this task is about pieces: bring out a knight or a bishop.", d1h5: "Bringing the queen out early lets Black chase her with tempo. Develop a knight or bishop first.", d1f3: "The queen came out too early, and she took the knight's best square. Develop a knight or bishop first.", d1g4: "Bringing the queen out early lets Black chase her. Develop a knight or bishop first.", d1e2: "The queen can wait, and on e2 she blocks your bishop. Develop a knight or bishop first." }, wrongDefault: "That's a pawn move. Bring out a knight or a bishop: they're the pieces to bring out first." },
          { type: "quiz", text: "Why is it good to castle early?", options: ["It keeps your king safe and brings a rook into play", "It wins a pawn", "It's required by the rules"], answer: 0, explain: "A king left in the center is easy to attack." },
        ],
      },
      {
        id: "forks",
        title: "Forks",
        tip: [
          "A fork is one piece attacking two enemy pieces at once. Your opponent can only save one!",
          "Knights are great at forks, but any piece can fork, even a pawn.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "6k1/3q1p1p/8/8/4N3/8/5PPP/6K1 w - - 0 1", accept: ["e4f6"], text: "Find a knight move that attacks the king and the queen at once.", success: "A royal fork! The king must move, and then you take the queen." },
          { type: "move", goal: "exact", fen: "6k1/5ppp/2n1b3/8/3PP3/8/5PPP/6K1 w - - 0 1", accept: ["d4d5"], text: "Fork two black pieces with a pawn.", success: "A pawn fork: you'll win a knight or a bishop." },
        ],
      },
      {
        id: "queen-mate",
        title: "Checkmate with a queen",
        tip: [
          "A king and queen can always checkmate a lone king.",
          "Use the queen to push the king to the edge, a knight's move away from it. Then bring your own king close, and deliver mate. Always check that the enemy king still has a move, so it isn't stalemate!",
        ],
        tasks: [
          { type: "play", goal: "mate", moves: 20, fen: "8/8/8/4k3/8/8/8/Q3K3 w - - 0 1", text: "Checkmate the lone king within 20 moves." },
        ],
      },
      {
        id: "rook-mate",
        title: "Checkmate with a rook",
        tip: [
          "A king and rook can checkmate a lone king, but it takes teamwork.",
          "Use the rook to cut the king off along a row or column, and walk your king toward it. When the kings face each other with one square between them, check with the rook along the edge.",
        ],
        tasks: [
          { type: "play", goal: "mate", moves: 30, fen: "8/8/8/8/3k4/8/8/R3K3 w - - 0 1", text: "Checkmate the lone king within 30 moves." },
        ],
      },
    ],
  },
  {
    id: "openings",
    title: "Opening basics",
    emoji: "🚀",
    lessons: [
      {
        id: "center",
        title: "Control the center",
        tip: [
          "The four squares in the middle (d4, e4, d5 and e5) are the center. Pieces in or near the center reach the most squares.",
          "Start with a center pawn, then bring your knights toward the middle. A knight on the edge reaches only a few squares: \"a knight on the rim is dim\".",
        ],
        tipFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        tipHighlight: ["d4", "e4", "d5", "e5"],
        tasks: [
          { type: "quiz", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", highlight: ["d4", "e4", "d5", "e5"], text: "What are the four glowing squares called?", options: ["The center", "The kingside", "The back row"], answer: 0, explain: "d4, e4, d5 and e5 are the center: the most important squares at the start." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", accept: ["e7e5", "d7d5", "c7c5", "e7e6", "c7c6", "d7d6", "g8f6", "b8c6"], text: "White took the center with e4. Answer by fighting for the center too.", success: "Good! You're not letting White have the center for free.", wrong: { a7a5: "Edge pawns don't help in the center. Try e5, d5 or c5.", h7h5: "Edge pawns don't help in the center. Try e5, d5 or c5.", g8h6: "A knight on the rim is dim. Bring it toward the middle instead (f6)." }, wrongDefault: "Fight for the center: a pawn to e5, d5 or c5, or the knight to f6." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", accept: ["g1f3", "b1c3"], text: "Bring out a knight toward the center.", success: "From there the knight reaches the center squares.", wrong: { g1h3: "A knight on the rim is dim: on h3 it reaches only a few squares. Try f3.", b1a3: "A knight on the rim is dim: on a3 it reaches only a few squares. Try c3.", g1e2: "That's a knight move, but on e2 it blocks your bishop. f3 or c3 is better." }, wrongDefault: "This task is about knights: move one toward the middle, to f3 or c3." },
        ],
      },
      {
        id: "develop",
        title: "Develop your pieces",
        tip: [
          "Developing means bringing your knights and bishops off the back row so they can join the game.",
          "Move each piece once before moving any piece twice, and bring the queen out later: she gets chased around if she comes out too soon.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", accept: ["f1c4", "f1b5", "b1c3", "f1e2"], text: "Bring a new piece into the game.", success: "Developed! Another piece is ready to play.", successFor: { f1e2: "Developed! Be2 is solid. Bc4 or Bb5 would put the bishop to work a little more." }, wrong: { f1d3: "That does develop the bishop, but on d3 it blocks your d-pawn, and then your other bishop gets stuck behind it. Try c4, b5 or e2.", f1a6: "The b7 pawn would just take your bishop. Try c4 or b5.", b1a3: "A knight on the rim is dim. Bring it to c3 instead.", f3g5: "That moves the same knight twice. Bring out a new piece instead.", f3d4: "That moves the same knight twice. Bring out a new piece instead.", f3h4: "That moves the same knight twice. Bring out a new piece instead.", f3g1: "That moves the same knight twice, right back home! Bring out a new piece instead.", f3e5: "The pawn is protected by the knight on c6: you'd lose your knight for a pawn.", d2d4: "d4 is a good move too! But this task is about pieces: bring out a knight or a bishop.", d1e2: "The queen can wait. Develop a knight or a bishop first." }, wrongDefault: "That's a pawn or a piece that's already out. Bring out one that hasn't moved yet: the f1 bishop or the b1 knight." },
          { type: "quiz", text: "White has moved four different pieces. Black has moved the same knight four times. Who is ahead?", options: ["White: more pieces are ready to play", "Black: the knight has gone further", "It's equal"], answer: 0, explain: "Each move should bring something new into the game. Moving one piece over and over leaves the rest asleep." },
          { type: "move", goal: "exact", fen: "rnb1kbnr/pppp1ppp/8/4p3/4P2q/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", accept: ["g1f3"], text: "Black brought the queen out early. Develop a piece that attacks her!", success: "The knight comes out and attacks the queen, so she has to run again. Black wastes another move.", wrong: { g2g3: "That attacks the queen, but it's a pawn move that weakens your king. Develop a piece that attacks her.", g1h3: "A knight on the rim is dim, and on h3 it doesn't attack her. Try another square for that knight." }, wrongDefault: "Which piece can come out and attack the queen at the same time? Look at the g1 knight." },
        ],
      },
      {
        id: "castle-early",
        title: "Castle early",
        tip: [
          "Castling tucks your king into a corner behind its pawns and brings a rook toward the middle, all in one move.",
          "Try to castle in the first ten moves or so. A king left in the center is easy to attack once the game opens up.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", accept: ["e1g1"], text: "Castle on the kingside: tap your king, then g1.", success: "Castled! The king is safe and the rook is coming into the game.", wrong: { e1f1: "Moving the king by hand gives up castling for good. Castle instead: the king goes to g1.", e1e2: "Moving the king by hand gives up castling for good, and the king is still in the middle." }, wrongDefault: "Castle: tap your king, then g1." },
          { type: "move", goal: "exact", fen: "r3kbnr/pppqpppp/2n5/3p1b2/3P1B2/2N5/PPPQPPPP/R3KBNR b KQkq - 6 5", accept: ["e8c8"], text: "Castle on the queenside (the long way): tap your king, then c8.", success: "Castled long! The rook lands on d8, right on the center column.", wrongDefault: "Castle long: tap your king, then c8." },
          { type: "quiz", text: "Your king is still on e1 and the middle of the board is opening up. What should you do?", options: ["Castle soon, while you still can", "Walk the king forward to help attack", "Nothing: kings are safe in the middle"], answer: 0, explain: "Open lines in the middle let rooks and queens reach your king. Castling moves it out of the way." },
        ],
      },
      {
        id: "traps",
        title: "Beginner traps",
        tip: [
          "The f7 pawn (f2 for White) is only protected by the king, so attackers aim at it. The famous four-move checkmate, Scholar's mate, hits f7 with a queen and a bishop.",
          "Moving the f and g pawns early opens the way to your king. Don't do it!",
        ],
        tipFen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4",
        tipHighlight: ["f7", "c4"],
        tasks: [
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", accept: ["g7g6", "d8e7", "d8f6", "g8h6"], text: "White is aiming at f7 with the queen and bishop. Stop Scholar's mate!", success: "Defended! f7 is safe, and White's queen came out too early.", successFor: { g8h6: "That works: the knight guards f7. But a knight on the rim is dim, so Qe7 or g6 keeps your pieces better placed.", g7g6: "Defended! g6 blocks the queen and attacks her. Watch out though: White may try again with Qf3." }, wrong: { g8f6: "The knight attacks the queen, but Qxf7 is checkmate! Defend f7 first.", d7d5: "That blocks the bishop for one move, but after Bxd5 Qxf7 is checkmate again. Block the queen or guard f7.", e8e7: "Walking the king out isn't safe. Block the queen (g6) or guard f7 with your queen." }, wrongDefault: "Qxf7 would be checkmate. Block the queen (g6) or protect f7 with your queen." },
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4", accept: ["g8f6", "d8e7", "d8f6", "g8h6"], text: "You played g6, so White's queen went to f3, aiming at f7 again. Stop it for good!", success: "Nf6 blocks the queen and develops a piece. Scholar's mate is stopped for good.", successFor: { d8e7: "Defended! Nf6 was even better: it blocks the queen and develops a piece at the same time.", d8f6: "Defended! Nf6 was even better: it blocks the queen and develops a piece instead of the queen.", g8h6: "That guards f7, but a knight on the rim is dim. Nf6 blocks the queen from a better square." }, wrong: { d7d5: "That blocks the bishop for one move, but after Bxd5 f7 is under attack again. Nf6 blocks the queen for good.", f7f6: "That stops the mate, but it weakens your king and takes the knight's best square. Try Nf6.", f7f5: "That opens lines toward your own king. Nf6 is safer." }, wrongDefault: "Qxf7 would be checkmate. Block the queen's path to f7, best with the knight." },
          { type: "move", goal: "mate", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", text: "White moved the f and g pawns. Punish it: checkmate in one!", success: "Fool's mate, the fastest checkmate there is." },
          { type: "quiz", text: "Why did White lose so quickly in Fool's mate?", options: ["Moving the f and g pawns opened a path to the king", "White moved too fast", "The queen was captured"], answer: 0, explain: "With the f and g pawns gone, the queen could reach the king along the h4–e1 diagonal." },
        ],
      },
    ],
  },
  {
    id: "opening-plans",
    title: "Opening plans",
    emoji: "🗺️",
    lessons: [
      {
        id: "italian",
        title: "The Italian Game",
        tip: [
          "1.e4 e5 2.Nf3 Nc6 3.Bc4 is the Italian Game, one of the oldest openings. Each move follows a rule: take the center, bring out a knight that attacks e5, and aim the bishop at f7.",
          "f7 is the weak spot near Black's king: only the king protects it. After Bc4, White castles and gets ready to push c3 and d4 to take the whole center.",
        ],
        tipFen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
        tipHighlight: ["c4", "f7"],
        tasks: [
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", accept: ["g1f3"], text: "Start the Italian: bring out the knight that attacks Black's e5 pawn.", success: "Nf3 develops a piece and attacks e5 at the same time. Black has to defend it.", wrong: { b1c3: "That develops a knight, but it doesn't attack anything. Nf3 develops and attacks e5.", f1c4: "The bishop comes next! First the knight: it develops and attacks e5.", d1h5: "Bringing the queen out early lets Black chase her. Develop a knight first.", d1f3: "The queen came out too early, and she took the knight's best square. Develop a knight first.", g1e2: "On e2 the knight blocks your bishop and doesn't attack e5. Try f3." }, wrongDefault: "Bring out the g1 knight to the square where it attacks e5." },
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", accept: ["f1c4"], text: "Black defended with Nc6. Now the bishop: put it where it aims at f7.", success: "Bc4: that's the Italian Game! The bishop aims at f7, the square only Black's king protects.", wrong: { f1b5: "Bb5 is a great move too (that's the Ruy Lopez), but this lesson is the Italian: aim the bishop at f7.", f1e2: "Solid, but from e2 the bishop doesn't aim at f7. Find a better square.", f1d3: "On d3 the bishop blocks your d-pawn, and it doesn't aim at f7.", b1c3: "A good developing move, but this task is about the bishop: aim it at f7." }, wrongDefault: "Move the f1 bishop to the square where it aims at f7." },
          { type: "quiz", fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4", highlight: ["c4", "f7"], text: "Why does White's bishop aim at f7?", options: ["Only the king protects f7, so it's a weak spot", "The bishop wants to reach the rook on h8", "Bishops have to stay near the enemy king"], answer: 0, explain: "With only the king guarding it, f7 is the easiest place to attack early in the game." },
          { type: "move", goal: "exact", fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5", accept: ["d2d4"], text: "You played c3 to get ready. Now take the whole center with one pawn move.", success: "d4! With pawns on e4 and d4 (and c3 behind them), White owns the center.", wrong: { d2d3: "Safe, but d4 grabs twice as much space. That's why you played c3.", e1g1: "Castling is a good move too, but now is the moment for the plan: c3 was played to support d4.", b2b4: "That's a pawn on the edge of the action. The plan with c3 is d4." }, wrongDefault: "c3 was played to support a pawn move to the center. Which pawn goes there?" },
          { type: "quiz", text: "In the Italian Game, what's White's plan after Bc4?", options: ["Castle, then push c3 and d4 to take the center", "Bring the queen out to attack f7 right away", "Push the h-pawn to attack"], answer: 0, explain: "Develop, castle, then grab the center with c3 and d4. A quick queen attack is easy for Black to stop." },
        ],
      },
      {
        id: "black-e4",
        title: "Playing Black against e4",
        tip: [
          "When White opens 1.e4, a good answer is 1...e5. Then develop: the knight to c6 defends e5, the other knight to f6 attacks e4, the bishop goes to c5 or e7, and you castle.",
          "Watch f7! If White's knight jumps to g5 so that knight and bishop both attack f7, block the bishop's line with ...d5.",
        ],
        tipFen: "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4",
        tipHighlight: ["g5", "c4", "f7"],
        tasks: [
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2", accept: ["b8c6"], text: "White's knight attacks your e5 pawn. Defend it by developing a piece.", success: "Nc6 defends e5 and brings a piece out. Two jobs in one move.", wrong: { d7d6: "d6 defends too, but it's a pawn move that shuts in your f8 bishop. Defend with a piece: Nc6.", f7f6: "That defends e5, but it weakens your king and takes the knight's best square. Try Nc6.", d8f6: "The queen defends, but she came out early and took the knight's square. Use a knight.", d8e7: "The queen defends, but she blocks your f8 bishop. Use a knight.", g8f6: "That's a real opening (the Petrov), but it doesn't defend e5. Try Nc6." }, wrongDefault: "Which knight can come out and defend e5?" },
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3", accept: ["g8f6", "f8c5", "f8e7"], text: "White played the Italian. Bring out another piece.", success: "Developed! Another piece is in the game.", successFor: { f8e7: "Developed! Be7 is solid and gets you ready to castle. Bc5 or Nf6 do a little more." }, wrong: { g8h6: "A knight on the rim is dim. From f6 it attacks e4.", f8d6: "On d6 the bishop blocks your d-pawn. Try c5 or e7.", d8f6: "The queen can wait, and she takes the knight's best square. Develop a knight or bishop.", f7f5: "That opens lines to your own king while White's bishop aims at it. Develop a piece instead." }, wrongDefault: "Bring out a piece that hasn't moved yet: the g8 knight or the f8 bishop." },
          { type: "quiz", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4", highlight: ["g5", "c4", "f7"], text: "White's knight jumped to g5. Why is that dangerous?", options: ["The knight and the bishop both attack f7", "The knight can take your queen", "It traps your king in the corner"], answer: 0, explain: "Nxf7 would fork your queen and rook. Two attackers, and only the king defends f7." },
          { type: "move", goal: "exact", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4", accept: ["d7d5"], text: "Stop the attack on f7: block the bishop's line with a pawn.", success: "d5! The bishop's line to f7 is blocked, and you fight for the center too.", wrong: { h7h6: "Too slow: Nxf7 comes first, forking your queen and rook.", f8c5: "That's a wild gamble (the Traxler). The safe answer blocks the bishop: d5.", d8e7: "The queen guards f7, but she gets stuck there. d5 blocks the bishop and fights for the center.", f6g4: "That ignores the threat: Nxf7 forks your queen and rook." }, wrongDefault: "Nxf7 would fork your queen and rook. Put a pawn between the bishop and f7." },
        ],
      },
      {
        id: "queens-gambit",
        title: "The Queen's Gambit",
        tip: [
          "1.d4 d5 2.c4 is the Queen's Gambit. A gambit offers a pawn: here White offers the c4 pawn to pull Black's d5 pawn away from the center.",
          "If Black takes, White usually wins the pawn back. Trying to hold on to it with ...b5 can cost a whole rook! A calm answer for Black is ...e6 or ...c6, which keeps the d5 pawn strong.",
        ],
        tipFen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2",
        tipHighlight: ["c4", "d5"],
        tasks: [
          { type: "move", goal: "exact", fen: "rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2", accept: ["c2c4"], text: "Play the Queen's Gambit: offer a pawn that attacks Black's d5 pawn.", success: "c4: the Queen's Gambit! If d5 takes, Black gives up the center.", wrong: { g1f3: "A good developing move, but this lesson is the gambit: offer the c-pawn.", b1c3: "A good developing move, but this lesson is the gambit: offer the c-pawn.", c1f4: "That's the London System, a fine opening, but this lesson is the gambit: offer the c-pawn.", e2e4: "That pawn can just be taken, and it doesn't pull Black's pawn away from the center. Try the c-pawn." }, wrongDefault: "Push a pawn that attacks d5." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2", accept: ["e7e6", "c7c6"], text: "Now you're Black. Keep your d5 pawn strong with a pawn that protects it.", success: "Solid! Your d5 pawn holds the center, and e6 opens the way for your f8 bishop.", successFor: { c7c6: "That's the Slav Defense, another great answer. Your d5 pawn holds the center." }, wrong: { d5c4: "Taking is allowed (the Queen's Gambit Accepted), but this time keep your center: protect d5 with a pawn.", g8f6: "A good piece move, but this task is about protecting d5 with a pawn.", b8c6: "The knight protects d5, but it blocks your c-pawn. Protect d5 with a pawn.", e7e5: "That's a real gambit of Black's own, but it leaves d5 unprotected. Try e6 or c6." }, wrongDefault: "Which pawn can protect d5?" },
          { type: "move", goal: "exact", fen: "rnbqkbnr/p3pppp/8/1p6/2pP4/4P3/1P3PPP/RNBQKBNR w KQkq - 0 6", accept: ["d1f3"], text: "Black took the c4 pawn and clung to it with ...b5 and ...c6, and the long diagonal is open. Find the queen move that attacks the rook in the corner.", success: "Qf3! The queen attacks the rook on a8 and Black can't save everything. Holding on to the gambit pawn cost Black a piece.", wrong: { b2b3: "That attacks the pawns, but there's something much bigger: look at the rook on a8.", d1h5: "The queen comes out, but on h5 she doesn't attack anything big. Look at the a8 rook.", f1e2: "A fine developing move, but there's something better: look at the long diagonal to a8." }, wrongDefault: "Look at the long light diagonal from f3 to a8. What can your queen attack there?" },
          { type: "quiz", text: "Black took the gambit pawn on c4. Should Black try hard to keep it?", options: ["No: it usually comes back, so develop instead", "Yes: an extra pawn is always worth it", "Yes: push ...b5 and ...a6 to protect it"], answer: 0, explain: "Grabbing the pawn is fine, but clinging to it wastes moves and can lose material. Develop your pieces." },
        ],
      },
      {
        id: "traps-2",
        title: "More traps to avoid",
        tip: [
          "Legal's mate: a knight that looks pinned to its queen can still move, if giving up the queen leads to checkmate.",
          "Noah's Ark trap: a bishop on b3 can get shut in by pawns on a6, b5 and c4. Know where your pieces can retreat to!",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5", accept: ["f3e5"], text: "Black's bishop pins your knight to your queen, and Black played the slow g6. Ignore the pin: take on e5!", success: "Nxe5! If Black takes your queen, you have a checkmate ready.", wrong: { h2h3: "That's a fine move, but there's something much stronger. The knight can take on e5 even though it looks pinned.", e1g1: "Castling is good, but there's a trap to spring now. Take on e5 with the knight." }, wrongDefault: "Take the e5 pawn with your 'pinned' knight." },
          { type: "move", goal: "exact", fen: "rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6", accept: ["c4f7"], text: "Black took your queen! Now give check with the bishop to start the checkmate.", success: "Bxf7+! The king has only one square: e7.", wrong: { c3d1: "Taking the bishop back leaves you a queen down. There's a checkmate: start with a bishop check.", e5f7: "Nxf7 attacks the queen and rook, but there's a checkmate. Start with the bishop." }, wrongDefault: "Which bishop move gives check?" },
          { type: "move", goal: "mate", fen: "rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7", text: "Now checkmate in one with a knight!", success: "Nd5#! That's Legal's mate: three minor pieces beat the queen." },
          { type: "move", goal: "exact", fen: "r2qkbnr/3b1ppp/p2p4/1ppQ4/4P3/1B6/PPP2PPP/RNB1K2R b KQkq - 5 11", accept: ["c5c4"], text: "You're Black. White's queen took a pawn on d5 and threatens Qxf7#. Stop the mate and trap the b3 bishop with one pawn move!", success: "c4! It blocks the bishop's line to f7, and the bishop on b3 has nowhere to go. That's the Noah's Ark trap.", wrong: { g8f6: "The knight attacks the queen, but Qxf7 is checkmate! Block the bishop's line first.", a8a7: "Qxf7 is checkmate! Block the bishop's line to f7.", d8e7: "The queen guards f7, but there's better: a pawn move blocks the bishop and traps it." }, wrongDefault: "Qxf7 would be checkmate. Which pawn can block the bishop and trap it too?" },
          { type: "quiz", fen: "r2qkbnr/3b1ppp/p2p4/1p1Q4/2p1P3/1B6/PPP2PPP/RNB1K2R w KQkq - 0 12", highlight: ["b3"], text: "Why is White's bishop on b3 in trouble?", options: ["It's trapped: every square it can go to is blocked or attacked", "It's pinned to the king", "A knight can take it"], answer: 0, explain: "a4 and c4 are covered by Black's pawns, and White's own pawns block a2 and c2. Next move a pawn takes the bishop." },
        ],
      },
      {
        id: "opening-checklist",
        title: "Opening checklist",
        tip: [
          "In your first ten moves: get a pawn to the center, bring out your knights and bishops (knights usually first), castle, and connect your rooks.",
          "Avoid: bringing the queen out early, moving the same piece twice, and pushing pawns on the edge.",
        ],
        tasks: [
          { type: "quiz", text: "Which pieces usually come out before the bishops?", options: ["The knights", "The queen", "The rooks"], answer: 0, explain: "Knights are slow and know where they belong (f3 and c3). Bishops can wait a move to see which diagonal is best." },
          { type: "quiz", text: "Which of these is NOT a good goal for your first ten moves?", options: ["Bring the queen out to grab pawns", "Get a pawn to the center", "Castle"], answer: 0, explain: "An early queen gets chased by enemy pieces, and each chase gives your opponent a free developing move." },
          { type: "move", goal: "exact", fen: "r2q1rk1/ppp1bppp/2npbn2/4p1B1/2B1P3/2NP1N2/PPP2PPP/R2Q1RK1 w - - 4 8", accept: ["d1d2", "d1e2"], text: "Your knights and bishops are out and you've castled. Connect your rooks: move the piece standing between them.", success: "Connected! Now the rooks protect each other and can move to the center files.", wrong: { d1e1: "The queen is still on the back row, between the rooks. Move her up a row.", d1c1: "The queen is still on the back row, between the rooks. Move her up a row.", d1b1: "The queen is still on the back row, between the rooks. Move her up a row." }, wrongDefault: "The queen sits between your rooks. Move her up one row." },
          { type: "quiz", text: "What does it mean to connect your rooks?", options: ["Clear the back row so the rooks protect each other", "Put both rooks on the same square", "Trade one rook away"], answer: 0, explain: "Once the knights, bishops and queen have moved and you've castled, the rooks see each other along the back row." },
          { type: "quiz", text: "Which pawns are usually best to move early?", options: ["The center pawns (e and d)", "The edge pawns (a and h)", "The f and g pawns in front of your king"], answer: 0, explain: "Center pawns take space and open lines for your bishops and queen. The f and g pawns protect your king, and edge pawns do little." },
        ],
      },
    ],
  },
  {
    id: "patterns",
    title: "Checkmate patterns",
    emoji: "🎯",
    lessons: [
      {
        id: "back-rank",
        title: "Back-rank mate",
        tip: [
          "When a king hides behind its own pawns, a rook or queen on the back row can checkmate it: the pawns block every escape.",
          "To stay safe, give your king an escape square (called \"luft\") by moving one pawn in front of it.",
        ],
        tipFen: "3R2k1/5ppp/8/8/8/8/5PPP/6K1 b - - 0 1",
        tipHighlight: ["d8", "g8"],
        tasks: [
          { type: "move", goal: "mate", fen: "6k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", text: "Checkmate on the back row.", success: "Back-rank mate! The pawns trap their own king." },
          { type: "move", goal: "mate", fen: "3r2k1/5ppp/8/8/8/8/5PPP/3RR1K1 w - - 0 1", text: "Black's rook guards the back row. Checkmate anyway!", success: "Rxd8 is checkmate! Your first rook takes the guard, and Black has nothing left to cover the back row." },
          { type: "move", goal: "exact", fen: "4r1k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1", accept: ["h2h3", "h2h4", "g2g3", "g2g4", "f2f3", "f2f4", "g1f1"], wrong: { g1h1: "The king is still trapped behind its pawns there: Re1 would be checkmate. Make an escape square with a pawn." }, text: "Black threatens Re1, back-rank mate. Make an escape square for your king.", success: "Luft! Now Re1+ is just check: your king steps out to h2. h3 is the move most players choose.", successFor: { h2h4: "Luft! It works. h3 is a little safer than h4, which can become a target.", g2g3: "That works! But h3 is the usual choice: moving the g-pawn leaves holes around your king.", g2g4: "That works! But h3 is the usual choice: moving the g-pawn leaves holes around your king.", f2f3: "That works! But it opens the diagonal to your king. h3 is the usual choice, since it weakens the king least.", f2f4: "That works! But it opens the diagonal to your king. h3 is the usual choice, since it weakens the king least.", g1f1: "That works here: after Re1+ your king takes the rook. But with more pieces around it might not, so making luft with h3 is the safer habit." }, wrongDefault: "Move one of the pawns in front of your king, so it has a square to escape to." },
        ],
      },
      {
        id: "smothered",
        title: "Smothered mate",
        tip: [
          "A smothered mate is a knight checkmate against a king that's completely surrounded by its own pieces.",
          "Knight checks can't be blocked, so when the king has nowhere to step, it's over.",
        ],
        tipFen: "6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1",
        tipHighlight: ["f7", "h8"],
        tasks: [
          { type: "move", goal: "mate", fen: "r5rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1", text: "Smother the king with your knight.", success: "Nf7 is checkmate: the king is stuck behind its own rook and pawns." },
          { type: "move", goal: "mate", fen: "6k1/8/8/8/4n3/8/6PP/6RK b - - 0 1", text: "You're Black. Find the smothered mate.", success: "Nf2 is checkmate! White's own rook and pawns trap the king." },
          { type: "quiz", fen: "6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1", text: "Why can't Black get out of this check?", options: ["The king's own pieces fill every escape square, and a knight check can't be blocked", "Because the knight is protected", "It isn't checkmate"], answer: 0, explain: "g8, g7 and h7 are all taken by Black's own pieces, nothing can capture the knight, and knights jump, so there's nothing to block." },
        ],
      },
      {
        id: "teamwork-mates",
        title: "Teamwork mates",
        tip: [
          "Queen kiss: the queen checks right next to the king, protected by your own king, so it can't be captured.",
          "Ladder mate: two rooks (or a rook and queen) take turns. One guards a row, the other checks on the next row, pushing the king to the edge.",
        ],
        tipFen: "6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1",
        tipHighlight: ["a7", "b1"],
        tasks: [
          { type: "move", goal: "mate", fen: "6k1/3Q4/6K1/8/8/8/8/8 w - - 0 1", text: "Checkmate in one. Can you find the queen kiss: the queen right next to the king?", success: "Checkmate! There's also a queen kiss here: Qg7, right next to the king, where your king protects her.", successFor: { d7g7: "The queen kiss! Your king protects the queen, so Black can't take her." } },
          { type: "move", goal: "mate", fen: "6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1", text: "Ladder mate: one rook guards the 7th row. Check with the other!", success: "Rb8 is checkmate: one rook guards row 7, the other checks on row 8." },
          { type: "move", goal: "mate", fen: "8/8/k7/8/8/8/7R/1R4K1 w - - 0 1", text: "The ladder works on columns too: the b1 rook guards the b column. Checkmate in one!", success: "Ra2 is checkmate: one rook guards the b column, the other checks on the a column." },
        ],
      },
    ],
  },
  {
    id: "tactics",
    title: "More tactics",
    emoji: "⚔️",
    lessons: [
      {
        id: "pins",
        title: "Pins",
        tip: [
          "A pin is when a piece can't move without exposing something more valuable behind it. Bishops, rooks and queens make pins.",
          "If the piece behind is the king, the pinned piece can't move at all: that would be illegal. Then attack the pinned piece, and it can't run away!",
        ],
        tipFen: "r3k3/ppp2ppp/2n5/1B6/3P4/8/PPP2PPP/4K2R w K - 0 1",
        tipHighlight: ["b5", "c6", "e8"],
        tasks: [
          { type: "quiz", fen: "r3k3/ppp2ppp/2n5/1B6/3P4/8/PPP2PPP/4K2R b K - 0 1", highlight: ["b5", "c6", "e8"], text: "It's Black's move. Can the knight on c6 move?", options: ["No: it would leave the king in check", "Yes, anywhere it likes", "Only backward"], answer: 0, explain: "The bishop on b5 pins the knight to the king. Moving it would expose the king to check, which is never allowed." },
          { type: "move", goal: "exact", fen: "r3k3/ppp2ppp/2n5/1B6/3P4/8/PPP2PPP/4K2R w K - 0 1", accept: ["d4d5"], text: "The knight is pinned. Attack it!", success: "d5! The pinned knight can't run away, so you'll win it.", wrong: { b5c6: "Taking it trades your bishop for the knight. Attack it with something cheaper, and it's simply lost.", b5a4: "The bishop still pins the knight, but nothing attacks it yet. Attack it with a pawn.", b5a6: "Moving the bishop away sets the knight free. Keep the pin, and attack the knight with a pawn.", b5c4: "Moving the bishop away sets the knight free. Keep the pin, and attack the knight with a pawn.", b5d3: "Moving the bishop away sets the knight free. Keep the pin, and attack the knight with a pawn.", b5e2: "Moving the bishop away sets the knight free. Keep the pin, and attack the knight with a pawn.", b5f1: "Moving the bishop away sets the knight free. Keep the pin, and attack the knight with a pawn." }, wrongDefault: "The knight can't move. Which pawn can attack it?" },
          { type: "move", goal: "exact", fen: "6k1/6pp/8/3q4/8/1P6/4BPPP/6K1 w - - 0 1", accept: ["e2c4"], text: "Pin the queen to the king!", success: "Bc4 pins the queen. If she takes the bishop, your pawn takes her: a queen for a bishop!", wrongDefault: "Find a bishop move that puts the queen and king on one line, with the bishop protected." },
        ],
      },
      {
        id: "skewers",
        title: "Skewers",
        tip: [
          "A skewer is a pin the other way round: the more valuable piece is in front. Attack it, and when it moves out of the way, take the piece behind.",
          "Checking the king with a skewer is the strongest kind: the king must move, and the piece behind it falls.",
        ],
        tipFen: "6B1/8/4k3/8/8/1q6/8/6K1 b - - 0 1",
        tipHighlight: ["g8", "e6", "b3"],
        tasks: [
          { type: "move", goal: "exact", fen: "8/7B/4k3/8/8/1q6/8/6K1 w - - 0 1", accept: ["h7g8"], text: "Skewer the king and queen with your bishop.", success: "Bg8+! The king has to step aside, and then the bishop takes the queen.", wrong: { h7f5: "That's check, but the king simply takes your bishop. Find a check where the bishop is safe and the queen is behind the king." }, wrongDefault: "Look for a bishop check with the queen behind the king on the same line." },
          { type: "move", goal: "exact", fen: "8/8/8/8/q3k3/8/8/6KR w - - 0 1", accept: ["h1h4"], text: "Skewer with your rook.", success: "Rh4+! The king must leave the row, and Rxa4 wins the queen.", wrongDefault: "The king and queen are on the same row. Check along it!" },
          { type: "quiz", text: "What's the difference between a pin and a skewer?", options: ["In a pin the more valuable piece is behind; in a skewer it's in front", "Pins only use bishops, skewers only use rooks", "There's no difference"], answer: 0, explain: "Both line up two pieces. A pin freezes the front piece; a skewer forces the front piece to move and wins the one behind." },
        ],
      },
      {
        id: "discovered",
        title: "Discovered attacks",
        tip: [
          "When a piece moves out of the way, it can uncover an attack from the piece behind it. That's a discovered attack.",
          "It's deadly when the uncovered attack is a check, a discovered check: the moving piece is free to grab something while the opponent deals with the check.",
        ],
        tipFen: "4k3/1q6/8/8/4B3/8/8/4R1K1 w - - 0 1",
        tipHighlight: ["e1", "e4", "e8"],
        tasks: [
          { type: "move", goal: "exact", fen: "4k3/1q6/8/8/4B3/8/8/4R1K1 w - - 0 1", accept: ["e4b7", "e4c6"], text: "Move the bishop to uncover check from your rook, and win the queen.", success: "Discovered check! Black must deal with the rook's check, and the queen is gone.", successFor: { e4c6: "Discovered check, and the bishop attacks the queen: next move it takes her. (Bxb7 took her right away.)" }, wrongDefault: "Move the bishop: every bishop move uncovers check from the rook. Which one also wins the queen?" },
          { type: "move", goal: "exact", fen: "3q2k1/8/8/8/8/3B4/8/3R2K1 w - - 0 1", accept: ["d3c4"], text: "Your rook is aimed at the queen, but your bishop is in the way. Move it with check!", success: "Bc4+! The bishop checks the king and uncovers the rook's attack. Black must answer the check, and you take the queen.", wrong: { d3h7: "That's check too, and you'll win the queen, but the king takes your bishop first. Bc4+ keeps it.", d3b5: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3a6: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3e4: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3f5: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3g6: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3e2: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3f1: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3c2: "Now Black's queen takes your rook first. Move the bishop with check instead.", d3b1: "Now Black's queen takes your rook first. Move the bishop with check instead." }, wrongDefault: "That doesn't win the queen. Keep the rook aimed at her, and move the bishop out of its way with check." },
          { type: "quiz", text: "A discovered check where both pieces give check at once is a double check. How can the king escape it?", options: ["Only by moving: you can't block or capture two checks at once", "By capturing either checking piece", "By blocking one of them"], answer: 0, explain: "Blocking or capturing only stops one of the two checks, so the king has to move. That makes double checks very powerful." },
        ],
      },
      {
        id: "remove-defender",
        title: "Removing the defender",
        tip: [
          "Sometimes a piece is only safe because another piece guards it. Capture or chase away the guard, and the piece it was guarding falls.",
          "Before taking, count: how many times is the target attacked, and how many times is it defended?",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "6k1/pp3ppp/2n5/1B2n3/8/8/PP3PPP/4R1K1 w - - 0 1", accept: ["b5c6"], text: "The knight on e5 is guarded only by the knight on c6. Remove the guard!", success: "Bxc6! After bxc6, the e5 knight has no defender and your rook takes it.", wrong: { e1e5: "The c6 knight takes back. Remove that guard first." }, wrongDefault: "Which piece is guarding the e5 knight? Take it." },
          { type: "quiz", text: "Your rook attacks a knight once, and it's defended once by a pawn. Should you take it?", options: ["No: you'd give a rook (5) for a knight (3)", "Yes, always take", "Only if it's checkmate"], answer: 0, explain: "The pawn takes back, and you've traded your rook for a knight. Count attackers and defenders, and the value of what you give." },
        ],
      },
    ],
  },
  {
    id: "endgames",
    title: "Endgame basics",
    emoji: "🏁",
    lessons: [
      {
        id: "square-rule",
        title: "The square rule",
        tip: [
          "Can a king catch a runaway pawn? Picture a square with one side from the pawn to the row where it promotes.",
          "If the king can step into that square on its move, it catches the pawn. If not, the pawn wins the race.",
        ],
        tipFen: "8/8/8/5k2/1P6/8/8/6K1 b - - 0 1",
        tipHighlight: ["b4", "b8", "f8", "f4"],
        tasks: [
          { type: "quiz", fen: "8/8/8/5k2/1P6/8/8/6K1 b - - 0 1", highlight: ["b4", "b8", "f8", "f4"], text: "Black to move. The pawn's square runs from b4 to f8. Can the black king catch the pawn?", options: ["Yes: the king is already in the square", "No: the pawn is too fast", "Only if White doesn't move"], answer: 0, explain: "The king on f5 is inside the square (b4 to f8), so it can always catch the pawn." },
          { type: "play", goal: "hold", moves: 8, fen: "8/8/8/5k2/1P6/8/8/6K1 b - - 0 1", text: "Catch the pawn before it promotes.", success: "Caught it! The square rule works." },
          { type: "play", goal: "promote", moves: 6, fen: "8/8/8/6k1/1P6/8/8/6K1 w - - 0 1", text: "Now you're White, and the black king is outside the square. Race to promote!", success: "Promoted! The king started outside the square, so it could never catch the pawn." },
        ],
      },
      {
        id: "opposition",
        title: "The opposition",
        tip: [
          "When the two kings stand face to face with one square between them, the player who does NOT have to move has the opposition.",
          "Kings can't step next to each other, so the king with the opposition can push the other king back, or hold it off.",
        ],
        tipFen: "4k3/8/4K3/4P3/8/8/8/8 b - - 0 1",
        tipHighlight: ["e6", "e8"],
        tasks: [
          { type: "quiz", fen: "4k3/8/4K3/4P3/8/8/8/8 b - - 0 1", highlight: ["e6", "e8"], text: "Black to move. Who has the opposition?", options: ["White: Black has to move and give way", "Black", "Nobody"], answer: 0, explain: "The kings face each other with one square between, and Black must move. White has the opposition." },
          { type: "play", goal: "promote", moves: 10, fen: "4k3/8/4K3/4P3/8/8/8/8 w - - 0 1", text: "Promote your pawn. Use your king to push the black king out of the way.", success: "Promoted! Your king cleared the path for the pawn." },
          { type: "play", goal: "hold", moves: 12, fen: "4k3/8/8/4K3/4P3/8/8/8 b - - 0 1", text: "You're Black. Stop the pawn from promoting: take the opposition and keep your king in front of the pawn.", success: "Held! By keeping the opposition, you stopped the pawn. That's a draw." },
        ],
      },
      {
        id: "king-in-front",
        title: "King in front of the pawn",
        tip: [
          "In a king and pawn ending, your king should walk in front of the pawn, not behind it. The king clears the way; the pawn follows.",
          "A king on the 6th row in front of its pawn wins against a lone king, whoever moves first (except with a pawn on the edge of the board).",
        ],
        tasks: [
          { type: "quiz", text: "You have a king and a pawn against a lone king. Where should your king go?", options: ["In front of the pawn, to clear the way", "Behind the pawn, to push it", "Far away, out of trouble"], answer: 0, explain: "The pawn can't push the enemy king aside, but your king can. Lead with the king." },
          { type: "play", goal: "promote", moves: 10, fen: "3k4/8/3K4/3P4/8/8/8/8 w - - 0 1", text: "Your king is on the 6th row in front of the pawn. Promote it!", success: "Promoted! The king in front made it easy." },
        ],
      },
      {
        id: "breakthrough",
        title: "Pawn breakthrough",
        tip: [
          "When pawns face pawns, a sacrifice can let one of them break through and run to promote.",
          "With three pawns against three, pushing the middle pawn first is the famous trick.",
        ],
        tasks: [
          { type: "move", goal: "exact", fen: "8/ppp5/8/PPP5/8/8/8/k6K w - - 0 1", accept: ["b5b6"], text: "The kings are far away. Find the move that breaks through!", success: "b6! Whichever pawn takes, one of yours runs through to promote.", wrong: { a5a6: "After bxa6, Black's other pawns hold. Push the middle pawn first.", c5c6: "After bxc6, Black's other pawns hold. Push the middle pawn first." }, wrongDefault: "The kings are too far away to help. Find the pawn move that breaks through." },
          { type: "play", goal: "promote", moves: 8, fen: "8/ppp5/8/PPP5/8/8/8/k6K w - - 0 1", text: "Now play it out: break through and promote.", success: "Promoted! The breakthrough worked." },
        ],
      },
    ],
  },
];

export const ALL_LESSONS = UNITS.flatMap((unit) => unit.lessons.map((lesson) => ({ ...lesson, unit })));
export const lessonById = (id) => ALL_LESSONS.find((l) => l.id === id);
