'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGameRoomWithPartner, getFriendsWithStreaks, getStoredSession } from '../../../lib/api';
import { gameRoutePath } from '../../../lib/gameRoutes';
import { decideEndAction } from '../../../lib/spectator';

interface NewGameWithOpponentProps {
  gameType: string;
  opponentUserId?: string | null;
  opponentName?: string | null;
  /** Shown instead of the Rematch button; both buttons share this class. */
  className?: string;
  backClassName?: string;
}

/**
 * Replaces the dead Rematch button when the opponent left (or the server answered REMATCH_UNAVAILABLE):
 * starts a fresh room of the same game with the opponent when they are still a friend, else "Back to games".
 */
export const NewGameWithOpponent: React.FC<NewGameWithOpponentProps> = ({
  gameType,
  opponentUserId,
  opponentName,
  className = 'w-full rounded-2xl bg-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-60',
  backClassName
}) => {
  const router = useRouter();
  const [friendIds, setFriendIds] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const s = getStoredSession();
    if (!s?.token || !opponentUserId) {
      setFriendIds([]);
      return;
    }
    getFriendsWithStreaks(s.token)
      .then(res => {
        if (!cancelled) setFriendIds((res.friends || []).map(f => f.friendUser.id));
      })
      .catch(() => {
        if (!cancelled) setFriendIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [opponentUserId]);

  const action = friendIds
    ? decideEndAction({ opponentLeft: true, rematchUnavailable: true, opponentUserId, friendIds })
    : 'back';
  const name = opponentName || 'your friend';

  const start = async () => {
    if (!opponentUserId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await createGameRoomWithPartner(gameType as any, opponentUserId);
      if (res?.room?.roomCode) {
        router.push(gameRoutePath(gameType, res.room.roomCode));
        return;
      }
      setErr('Could not create a new game.');
    } catch (e: any) {
      setErr(e?.message || 'Could not create a new game.');
    }
    setBusy(false);
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {action === 'new_game' ? (
        <button type="button" onClick={start} disabled={busy} className={className}>
          {busy ? 'Creating...' : `Start a new game with ${name}`}
        </button>
      ) : (
        <button type="button" onClick={() => router.push('/games')} className={backClassName || className}>
          Back to games
        </button>
      )}
      {err ? <p className="text-center text-xs text-rose-300">{err}</p> : null}
    </div>
  );
};

export default NewGameWithOpponent;
