// The Learn path. Each lesson opens with a Tip Card and then a few short tasks:
//   stars  Move one kind of piece to collect every ⭐ (a ⭐ on an enemy piece means capture it).
//          Only pieces of type `piece` move; the other side never moves.
//   move   Find one move. `goal`: mate (any checkmate), check (any check), exact (one of `accept`),
//          escape (get out of check by `way`: king, block or capture), safe (afterwards none of
//          your pieces can be won), promote. `pre` is a move the other side makes first.
//          `wrong` gives a reason for particular wrong moves.
//   quiz   A question, with an optional board (`fen`, `highlight`).
//   play   Play on from a position against the bot until `goal` (mate) within `moves` moves.
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
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", accept: ["e2e4", "d2d4", "c2c4", "g1f3"], text: "Make a strong first move that controls the center.", success: "A great start: you claim the center and free your pieces.", wrongDefault: "That's legal, but it doesn't do much for the center. Try a pawn to e4 or d4." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2", accept: ["g1f3", "b1c3", "f1c4", "f1b5"], text: "Bring out a knight or a bishop.", success: "Developed! Your pieces are heading into the game.", wrong: { d1h5: "Bringing the queen out early lets Black chase her with tempo. Develop a knight or bishop first.", d1f3: "The queen came out too early, and she took the knight's best square. Develop a knight or bishop first.", d1g4: "Bringing the queen out early lets Black chase her. Develop a knight or bishop first." }, wrongDefault: "Try a knight or a bishop: they're the pieces to bring out first." },
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
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1", accept: ["e7e5", "d7d5", "c7c5", "e7e6", "c7c6", "g8f6"], text: "White took the center with e4. Answer by fighting for the center too.", success: "Good! You're not letting White have the center for free.", wrong: { a7a5: "Edge pawns don't help in the center. Try e5, d5 or c5.", h7h5: "Edge pawns don't help in the center. Try e5, d5 or c5.", g8h6: "A knight on the rim is dim. Bring it toward the middle instead (f6)." }, wrongDefault: "Fight for the center: a pawn to e5, d5 or c5, or the knight to f6." },
          { type: "move", goal: "exact", fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2", accept: ["g1f3", "b1c3"], text: "Bring out a knight toward the center.", success: "From there the knight reaches the center squares.", wrong: { g1h3: "A knight on the rim is dim: on h3 it reaches only a few squares. Try f3.", b1a3: "A knight on the rim is dim: on a3 it reaches only a few squares. Try c3." }, wrongDefault: "Move a knight toward the middle: f3 or c3." },
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
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3", accept: ["f1c4", "f1b5", "b1c3"], text: "Bring a new piece into the game.", success: "Developed! Another piece is ready to play.", wrong: { f3g5: "That moves the same knight twice. Bring out a new piece instead.", f3e5: "The pawn is protected by the knight on c6: you'd lose your knight for a pawn.", d1e2: "The queen can wait. Develop a knight or a bishop first." }, wrongDefault: "Bring out a piece that hasn't moved yet: the bishop or the other knight." },
          { type: "quiz", text: "White has moved four different pieces. Black has moved the same knight four times. Who is ahead?", options: ["White: more pieces are ready to play", "Black: the knight has gone further", "It's equal"], answer: 0, explain: "Each move should bring something new into the game. Moving one piece over and over leaves the rest asleep." },
          { type: "move", goal: "exact", fen: "rnb1kbnr/pppp1ppp/8/4p2q/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 2 3", accept: ["f1e2"], text: "Black brought the queen out early. Develop a piece that attacks her!", success: "The bishop comes out and attacks the queen, so she has to run again. Black wastes another move.", wrong: { g2g4: "That attacks the queen, but it's a pawn move that weakens your king. Develop a piece that attacks her." }, wrongDefault: "Which piece can come out and attack the queen at the same time? Look at the f1 bishop." },
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
          { type: "move", goal: "exact", fen: "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3", accept: ["g7g6", "d8e7", "d8f6", "g8h6"], text: "White is aiming at f7 with the queen and bishop. Stop Scholar's mate!", success: "Defended! f7 is safe, and White's queen came out too early.", wrong: { g8f6: "The knight attacks the queen, but Qxf7 is checkmate! Defend f7 first." }, wrongDefault: "Qxf7 would be checkmate. Block the queen (g6) or protect f7 with your queen." },
          { type: "move", goal: "mate", fen: "rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2", text: "White moved the f and g pawns. Punish it: checkmate in one!", success: "Fool's mate, the fastest checkmate there is." },
          { type: "quiz", text: "Why did White lose so quickly in Fool's mate?", options: ["Moving the f and g pawns opened a path to the king", "White moved too fast", "The queen was captured"], answer: 0, explain: "With the f and g pawns gone, the queen could reach the king along the h4–e1 diagonal." },
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
          { type: "move", goal: "exact", fen: "4r1k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 1", accept: ["h2h3", "h2h4", "g2g3", "g2g4", "f2f3", "f2f4"], text: "Black threatens Re1, back-rank mate. Make an escape square for your king.", success: "Luft! Now Re1+ is just check: your king can step out.", wrongDefault: "Move one of the pawns in front of your king, so it has a square to escape to." },
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
          { type: "move", goal: "exact", fen: "6k1/3Q4/6K1/8/8/8/8/8 w - - 0 1", accept: ["d7g7"], text: "Give the queen kiss: checkmate with the queen right next to the king.", success: "The queen kiss! Your king protects the queen, so Black can't take her.", wrong: { d7d8: "That's checkmate too, nicely seen! For this one, find the queen kiss: right next to the king.", d7e8: "That's checkmate too, nicely seen! For this one, find the queen kiss: right next to the king." }, wrongDefault: "Find the queen kiss: put the queen right next to the black king, where your king protects her." },
          { type: "move", goal: "mate", fen: "6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1", text: "Ladder mate: one rook guards the 7th row. Check with the other!", success: "Rb8 is checkmate: one rook guards row 7, the other checks on row 8." },
          { type: "move", goal: "mate", fen: "8/8/k7/8/8/8/7R/1R4K1 w - - 0 1", text: "The ladder works on columns too: the b1 rook guards the b column. Checkmate in one!", success: "Ra2 is checkmate: one rook guards the b column, the other checks on the a column." },
        ],
      },
    ],
  },
];

export const ALL_LESSONS = UNITS.flatMap((unit) => unit.lessons.map((lesson) => ({ ...lesson, unit })));
export const lessonById = (id) => ALL_LESSONS.find((l) => l.id === id);
