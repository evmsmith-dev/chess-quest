// Endgame bosses (in Challenges): win from a position against the bot. Stars for doing it in few
// moves: 3 within `par`, 2 within par and a half, 1 within the limit (`moves`). Every position was
// checked with a deep engine search (each is a win for the side to move with good play).
// goal: "mate" (checkmate the king) or "promote" (make a new queen that can't be taken).
export const BOSSES = [
  {
    id: "boss-queen",
    title: "Queen vs king",
    emoji: "♛",
    goal: "mate",
    moves: 25,
    par: 10,
    fen: "8/8/3k4/8/8/8/8/4K2Q w - - 0 1",
    text: "Checkmate the lone king.",
    tip: ["Use the queen to box the king in, a knight's move away from it, until it's on the edge. Then bring your king up and deliver mate.", "Watch out for stalemate: always leave the king a move until you can give checkmate."],
  },
  {
    id: "boss-two-rooks",
    title: "Two rooks",
    emoji: "🪜",
    goal: "mate",
    moves: 15,
    par: 6,
    fen: "8/8/8/3k4/8/8/8/R3K2R w - - 0 1",
    text: "Checkmate with the ladder: the rooks take turns.",
    tip: ["One rook guards a row, the other checks on the next row, pushing the king back step by step.", "If the king comes close to a rook, move that rook to the far side of the board."],
  },
  {
    id: "boss-rook",
    title: "Rook vs king",
    emoji: "♜",
    goal: "mate",
    moves: 35,
    par: 18,
    fen: "8/8/8/8/4k3/8/8/4K2R w - - 0 1",
    text: "Checkmate the lone king with your king and rook.",
    tip: ["Cut the king off with your rook, then walk your king toward it.", "When the kings face each other with one square between, check along the edge. If they don't, make a waiting move with the rook."],
  },
  {
    id: "boss-race",
    title: "Pawn race",
    emoji: "🏃",
    goal: "promote",
    moves: 6,
    par: 4,
    fen: "8/8/8/7p/P7/8/8/K6k w - - 0 1",
    text: "Both pawns are racing. Promote first!",
    tip: ["Count the moves: your pawn needs four, and you move first.", "A new queen on the long diagonal can even attack the corner where the other pawn wants to promote."],
  },
  {
    id: "boss-breakthrough",
    title: "Breakthrough",
    emoji: "💥",
    goal: "promote",
    moves: 8,
    par: 4,
    fen: "8/5ppp/8/5PPP/8/8/8/K6k w - - 0 1",
    text: "Three pawns against three. Break through and promote!",
    tip: ["The kings are too far away to help.", "Sacrifice the middle pawn first, then push the pawn that gets free."],
  },
  {
    id: "boss-king-leads",
    title: "King leads the way",
    emoji: "👑",
    goal: "promote",
    moves: 14,
    par: 7,
    fen: "8/4k3/8/3K4/3P4/8/8/8 w - - 0 1",
    text: "Promote the pawn. Only one first move wins: find it!",
    tip: ["Your king should go in front of the pawn, toward the 6th row, before the pawn moves.", "Use the opposition: kings face to face with one square between, and the other side to move."],
  },
];

export const bossById = (id) => BOSSES.find((b) => b.id === id);

/** Stars for winning in `used` moves. */
export const bossStars = (boss, used) => (used <= boss.par ? 3 : used <= Math.ceil(boss.par * 1.5) ? 2 : 1);
