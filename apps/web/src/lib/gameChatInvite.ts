import { ChatStore } from './chatStore';
import { getStoredSession, getGameTitle, type FriendWithStreak } from './api';
import type { ChatGamePayload } from '../types/chat';

/**
 * Sends a game invite card into the direct chat with a friend (the same `game_invite` message the chat composer sends),
 * so it shows up in Messages and the friend can tap Join from there.
 */
export function sendGameInviteToChat(
  friend: FriendWithStreak,
  game: { roomCode: string; gameType: string; title?: string; playersCount?: number; maxPlayers?: number }
): void {
  const s = getStoredSession();
  if (!s?.user) throw new Error('Please sign in to invite friends');
  const f = friend.friendUser;
  const conv = ChatStore.getOrCreateDirectConversation({
    id: f.id,
    displayName: f.displayName,
    name: f.displayName,
    avatarUrl: f.avatarUrl ?? null,
    onlineStatus: f.isOnline ? 'ONLINE' : 'OFFLINE',
    isOnline: f.isOnline,
    partnerCode: f.partnerCode
  });
  const payload: ChatGamePayload = {
    gameType: game.gameType,
    roomCode: game.roomCode,
    roomId: game.roomCode,
    title: game.title || `${getGameTitle(game.gameType)} Challenge`,
    playersCount: game.playersCount ?? 1,
    maxPlayers: game.maxPlayers,
    hostName: s.user.displayName,
    status: 'waiting'
  };
  ChatStore.sendMessage({
    conversationId: conv.id,
    senderId: s.user.id,
    senderName: s.user.displayName,
    senderAvatar: s.user.avatarUrl,
    content: `🎮 Invited to ${payload.title}`,
    type: 'game_invite',
    metadata: { game: payload }
  });
}
