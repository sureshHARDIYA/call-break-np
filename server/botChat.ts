import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { formatScoreTenths, SUIT_NAMES } from '../src/engine/rules.ts';
import { PlayerSeat, RoomState } from '../src/engine/types.ts';

let cachedAi: GoogleGenAI | null | undefined;

function getAiClient(): GoogleGenAI | null {
  if (cachedAi !== undefined) return cachedAi;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    cachedAi = null;
    return null;
  }
  cachedAi = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  return cachedAi;
}

function buildFallbackReply(
  bot: PlayerSeat,
  senderName: string,
  userMessage: string,
  room: RoomState
): string {
  const lower = userMessage.toLowerCase();
  const shortBotName = bot.displayName.replace(/\s+Bot$/i, '');

  if (/\b(hi|hello|hey|namaste|yo|sup|hola)\b/.test(lower)) {
    return `Namaste ${senderName}! Ready for a sharp Call Break session.`;
  }
  if (/\b(good luck|gl|luck|best of luck)\b/.test(lower)) {
    return `Good luck ${senderName}! Let's see how the spades fall.`;
  }
  if (/\b(nice trump|trump|spade|spades|cut)\b/.test(lower)) {
    return `Spades are always lurking—gotta guard those high cards!`;
  }
  if (/\b(well played|wp|nice|great|gg|good game)\b/.test(lower)) {
    return `Thanks ${senderName}! Good game at the table.`;
  }
  if (/\b(bid|bids|call|calling)\b/.test(lower)) {
    if (bot.bid !== null) {
      return `I called ${bot.bid} and I'm sitting on ${bot.tricksWon} tricks so far.`;
    }
    return `Careful with the calls this round—anything can happen!`;
  }
  if (/\b(score|points|winning|lead)\b/.test(lower)) {
    const leader = [...room.seats].sort(
      (a, b) => b.totalScoreTenths - a.totalScoreTenths
    )[0];
    return `${leader.displayName} leads with ${formatScoreTenths(leader.totalScoreTenths)} pts right now.`;
  }
  if (/\?$/.test(lower.trim())) {
    return `${shortBotName} here—keeping my eyes on the spades and playing it safe!`;
  }

  const replies = [
    `On it, ${senderName}! Let's keep this trick interesting.`,
    `Watching the lead suit closely—good luck this hand!`,
    `Round ${Math.max(1, room.currentRound)} is heating up already.`,
    `Always fun playing Call Break with you, ${senderName}!`,
  ];
  return replies[Math.floor(Math.random() * replies.length)];
}

export function pickRespondingBot(
  room: RoomState,
  userMessage: string,
  lastBotSeat: number | null
): PlayerSeat | null {
  const bots = room.seats.filter(
    (s) => s.occupied && s.playerType === 'bot'
  );
  if (bots.length === 0) return null;

  const lower = userMessage.toLowerCase();
  const mentioned = bots.find((b) => {
    const full = b.displayName.toLowerCase();
    const base = full.replace(/\s+bot$/i, '').trim();
    return lower.includes(full) || (base.length >= 2 && lower.includes(base));
  });
  if (mentioned) return mentioned;

  const others = bots.filter((b) => b.seat !== lastBotSeat);
  const pool = others.length > 0 ? others : bots;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function generateBotChatReply(params: {
  room: RoomState;
  bot: PlayerSeat;
  senderName: string;
  userMessage: string;
}): Promise<string> {
  const { room, bot, senderName, userMessage } = params;
  const ai = getAiClient();
  if (!ai) {
    return buildFallbackReply(bot, senderName, userMessage, room);
  }

  const seatsSummary = room.seats
    .filter((s) => s.occupied)
    .map(
      (s) =>
        `${s.displayName} (${s.playerType}): bid=${s.bid ?? '-'}, won=${s.tricksWon}, total=${formatScoreTenths(
          s.totalScoreTenths
        )}`
    )
    .join('; ');

  const leadSuit = room.currentTrick[0]?.card.suit
    ? SUIT_NAMES[room.currentTrick[0].card.suit]
    : 'none';

  const recentChat = room.chat
    .slice(-5)
    .map((m) => `${m.senderName}: ${m.text}`)
    .join('\n');

  const prompt = [
    `Table state: phase=${room.phase}, round=${room.currentRound}/${room.settings.rounds}, trick=${room.trickNumber}/13, currentLeadSuit=${leadSuit}.`,
    `Seats: ${seatsSummary}.`,
    recentChat ? `Recent chat:\n${recentChat}` : '',
    `${senderName} just sent: "${userMessage}"`,
    `Reply naturally as ${bot.displayName} in 1 short, friendly sentence (under 140 characters).`,
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const response = await Promise.race([
      ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          systemInstruction: `You are ${bot.displayName}, an AI player (${
            bot.botDifficulty ?? room.settings.botDifficulty
          } tier) playing traditional Nepali Call Break (कल ब्रेक) at a friendly card table. Reply in character with 1 concise, conversational sentence (max 140 chars, plain text, no markdown, no quotes). Never claim to know anyone's hidden cards.`,
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Bot chat timeout')), 5000)
      ),
    ]);

    const cleaned = (response.text ?? '')
      .replace(/[\r\n]+/g, ' ')
      .replace(/^["']|["']$/g, '')
      .trim()
      .slice(0, 220);

    if (cleaned.length > 0) {
      return cleaned;
    }
  } catch (err) {
    console.warn('[botChat] falling back after Gemini error:', err);
  }

  return buildFallbackReply(bot, senderName, userMessage, room);
}
