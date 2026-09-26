'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  ScrollText,
  Info,
  Send,
  Copy,
  Check,
  Sparkles,
  Swords
} from 'lucide-react';
import { ChessMove } from '@synccinema/common';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string | null;
  content: string;
  timestamp?: string | number;
}

interface ChessRightPanelProps {
  chatMessages: ChatMessage[];
  onSendChat: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  myUserId: string;
  moves: ChessMove[];
  currentMoveIndex?: number;
  onSelectMove?: (index: number) => void;
  roomCode: string;
  timeControl?: string;
  isGameOver?: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '🔥', '👏', '🎉', '👑'];

function UserAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl && !avatarUrl.includes('api.dicebear.com/7.x/bottts')) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-pink-200/50"
      />
    );
  }

  const initial = (name || 'G')[0].toUpperCase();
  return (
    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-400 to-[#ff2b70] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs ring-1 ring-white/50">
      {initial}
    </div>
  );
}

export const ChessRightPanel: React.FC<ChessRightPanelProps> = ({
  chatMessages = [],
  onSendChat,
  onSendReaction,
  myUserId,
  moves = [],
  currentMoveIndex,
  onSelectMove,
  roomCode,
  timeControl = '10 min',
  isGameOver = false
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'moves' | 'info'>('chat');
  const [inputText, setInputText] = useState('');
  const [copiedPgn, setCopiedPgn] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const movesScrollRef = useRef<HTMLDivElement>(null);

  // Group moves into pairs (1. white, black)
  const movePairs = React.useMemo(() => {
    const pairs: {
      number: number;
      white?: ChessMove;
      black?: ChessMove;
      whiteIndex: number;
      blackIndex?: number;
    }[] = [];
    for (let i = 0; i < moves.length; i += 2) {
      pairs.push({
        number: Math.floor(i / 2) + 1,
        white: moves[i],
        whiteIndex: i,
        black: moves[i + 1],
        blackIndex: i + 1 < moves.length ? i + 1 : undefined
      });
    }
    return pairs;
  }, [moves]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (activeTab === 'chat' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  // Auto scroll moves to bottom
  useEffect(() => {
    if (activeTab === 'moves' && movesScrollRef.current) {
      movesScrollRef.current.scrollTop = movesScrollRef.current.scrollHeight;
    }
  }, [moves.length, activeTab]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendChat(inputText.trim());
    setInputText('');
  };

  const handleCopyPgn = () => {
    const pgn = movePairs
      .map(p => `${p.number}. ${p.white?.san || ''} ${p.black?.san || ''}`.trim())
      .join(' ');
    navigator.clipboard.writeText(pgn);
    setCopiedPgn(true);
    setTimeout(() => setCopiedPgn(false), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-3.5 select-none">
      {/* Main Tabbed Card */}
      <div className="flex flex-col h-[520px] rounded-[24px] bg-white/85 dark:bg-[#191627]/85 backdrop-blur-md border border-pink-100/70 dark:border-white/10 shadow-[0_10px_35px_rgba(255,43,112,0.06)] overflow-hidden">
        
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/10 px-3 pt-2.5 bg-slate-50/50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === 'chat'
                  ? 'border-[#ff2b70] text-[#ff2b70]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Chat</span>
              {chatMessages.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-pink-100 text-[#ff2b70] dark:bg-pink-950/60 dark:text-pink-300 font-extrabold">
                  {chatMessages.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('moves')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === 'moves'
                  ? 'border-[#ff2b70] text-[#ff2b70]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>Moves</span>
              {moves.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300 font-mono font-bold">
                  {moves.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('info')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold transition border-b-2 cursor-pointer ${
                activeTab === 'info'
                  ? 'border-[#ff2b70] text-[#ff2b70]'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>Info</span>
            </button>
          </div>

          {activeTab === 'moves' && moves.length > 0 && (
            <button
              type="button"
              onClick={handleCopyPgn}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-[#ff2b70] dark:bg-pink-950/40 dark:text-pink-300 text-[11px] font-bold transition cursor-pointer"
              title="Copy PGN notation"
            >
              {copiedPgn ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              <span>{copiedPgn ? 'Copied' : 'PGN'}</span>
            </button>
          )}
        </div>

        {/* Tab 1: Live Chat */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
            {/* Messages Scroll Area */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto space-y-3 pr-1.5 text-xs select-text"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500">
                  <div className="w-10 h-10 rounded-2xl bg-pink-50 dark:bg-pink-950/30 text-[#ff2b70] flex items-center justify-center mb-2 shadow-xs">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-xs text-slate-700 dark:text-zinc-300">
                    Friendly duel chat
                  </p>
                  <p className="text-[11px] mt-0.5">
                    Say hi or send an encouraging emoji below!
                  </p>
                </div>
              ) : (
                chatMessages.map(msg => {
                  const isMe = msg.userId === myUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 max-w-[90%] ${isMe ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
                    >
                      <UserAvatar name={msg.userName} avatarUrl={msg.avatarUrl} />
                      <div className="flex flex-col">
                        <span
                          className={`text-[10px] font-bold mb-0.5 text-slate-400 dark:text-zinc-500 ${
                            isMe ? 'text-right' : 'text-left'
                          }`}
                        >
                          {isMe ? 'You' : msg.userName}
                        </span>
                        <div
                          className={`p-2.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                            isMe
                              ? 'bg-[#ff2b70]/10 text-[#16132b] dark:text-pink-100 border border-[#ff2b70]/25 rounded-tr-xs'
                              : 'bg-slate-100/90 dark:bg-white/10 text-slate-800 dark:text-zinc-100 border border-slate-200/60 dark:border-white/10 rounded-tl-xs'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick Emoji Reaction Strip */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between gap-1 mb-2">
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                React:
              </span>
              <div className="flex items-center gap-1.5">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSendReaction(emoji)}
                    className="w-7 h-7 rounded-xl bg-slate-100/80 hover:bg-pink-50 hover:scale-115 active:scale-95 text-sm flex items-center justify-center transition cursor-pointer dark:bg-white/5 dark:hover:bg-pink-950/40"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Field */}
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Send message to room..."
                className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 rounded-xl px-3.5 py-2 text-xs text-[#16132b] dark:text-white placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#ff2b70] focus:border-[#ff2b70]"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-[#ff2b70] hover:bg-[#e11d48] disabled:opacity-40 disabled:hover:bg-[#ff2b70] text-white shadow-sm transition cursor-pointer"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Move History */}
        {activeTab === 'moves' && (
          <div className="flex-1 flex flex-col justify-between overflow-hidden p-3.5">
            <div
              ref={movesScrollRef}
              className="flex-1 overflow-y-auto space-y-1 font-mono text-xs select-none pr-1"
            >
              {movePairs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-zinc-500">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-500 flex items-center justify-center mb-2 shadow-xs">
                    <Swords className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-xs text-slate-700 dark:text-zinc-300">
                    No moves played yet
                  </p>
                  <p className="text-[11px] mt-0.5">
                    White makes the opening move.
                  </p>
                </div>
              ) : (
                movePairs.map(pair => (
                  <div
                    key={`move-pair-${pair.number}`}
                    className="grid grid-cols-[32px_1fr_1fr] items-center gap-1.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100/60 dark:hover:bg-white/5 transition"
                  >
                    <span className="text-slate-400 dark:text-zinc-500 font-bold text-right pr-1">
                      {pair.number}.
                    </span>

                    {pair.white ? (
                      <button
                        type="button"
                        onClick={() => onSelectMove && onSelectMove(pair.whiteIndex)}
                        className={`text-left px-2 py-1 rounded-lg font-black transition cursor-pointer ${
                          currentMoveIndex === pair.whiteIndex
                            ? 'bg-[#ff2b70] text-white shadow-xs'
                            : 'text-[#16132b] dark:text-zinc-200 hover:text-[#ff2b70]'
                        }`}
                      >
                        {pair.white.san}
                      </button>
                    ) : (
                      <span />
                    )}

                    {pair.black ? (
                      <button
                        type="button"
                        onClick={() => onSelectMove && pair.blackIndex !== undefined && onSelectMove(pair.blackIndex)}
                        className={`text-left px-2 py-1 rounded-lg font-black transition cursor-pointer ${
                          currentMoveIndex === pair.blackIndex
                            ? 'bg-[#ff2b70] text-white shadow-xs'
                            : 'text-slate-700 dark:text-zinc-300 hover:text-[#ff2b70]'
                        }`}
                      >
                        {pair.black.san}
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Bottom summary */}
            <div className="pt-2 border-t border-black/[0.06] dark:border-white/10 flex items-center justify-between text-[11px] text-slate-500 font-bold px-1">
              <span>Total: {moves.length} half-moves</span>
              <span className="font-mono">
                Turn {Math.floor(moves.length / 2) + 1}
              </span>
            </div>
          </div>
        )}

        {/* Tab 3: Game Info */}
        {activeTab === 'info' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                Room Details
              </span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Room Code</span>
                  <span className="font-mono font-black text-[#16132b] dark:text-white">{roomCode}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Time Control</span>
                  <span className="font-bold text-[#16132b] dark:text-white">{timeControl}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
                  <span className="text-slate-600 dark:text-zinc-400 font-medium">Format</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">Casual 2-Player</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-500 tracking-wider">
                Standard Rules
              </span>
              <ul className="mt-2 space-y-1.5 text-slate-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                <li className="flex items-start gap-1.5">
                  <span className="text-[#ff2b70] font-bold">•</span>
                  <span><strong>Castling:</strong> Click the King, then the destination rook square when path is clear.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#ff2b70] font-bold">•</span>
                  <span><strong>En Passant:</strong> Valid when opponent advances pawn two squares past yours.</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-[#ff2b70] font-bold">•</span>
                  <span><strong>Promotion:</strong> Moving a pawn to the final rank prompts for Queen, Rook, Bishop, or Knight.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
