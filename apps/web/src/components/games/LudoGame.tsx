'use client';

import React, { useState, useEffect } from 'react';
import { RotateCcw, Trophy, Bot, Sparkles } from 'lucide-react';

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';

interface Token {
  id: number;
  color: LudoColor;
  // step: -1 = in yard/base, 0..50 = on track, 51..56 = home stretch, 99 = finished in home
  step: number;
}

interface LudoGameProps {
  sendGameAction?: (payload: any) => void;
  registerGameListener?: (listener: (senderId: string, payload: any) => void) => () => void;
  myUserName?: string;
  isCompact?: boolean;
}

const COLORS: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

const COLOR_THEMES = {
  red: {
    bg: 'bg-rose-600',
    border: 'border-rose-500',
    text: 'text-rose-400',
    ring: 'ring-rose-500',
    light: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    name: 'Red'
  },
  green: {
    bg: 'bg-emerald-600',
    border: 'border-emerald-500',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500',
    light: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    name: 'Green'
  },
  yellow: {
    bg: 'bg-amber-500',
    border: 'border-amber-400',
    text: 'text-amber-400',
    ring: 'ring-amber-400',
    light: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    name: 'Yellow'
  },
  blue: {
    bg: 'bg-blue-600',
    border: 'border-blue-500',
    text: 'text-blue-400',
    ring: 'ring-blue-500',
    light: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    name: 'Blue'
  }
};

function initialTokens(): Record<LudoColor, Token[]> {
  const tokens: any = {};
  COLORS.forEach(c => {
    tokens[c] = [0, 1, 2, 3].map(id => ({ id, color: c, step: -1 }));
  });
  return tokens;
}

export const LudoGame: React.FC<LudoGameProps> = ({
  sendGameAction,
  registerGameListener,
  myUserName = 'Player 1',
  isCompact = false
}) => {
  const [tokens, setTokens] = useState<Record<LudoColor, Token[]>>(initialTokens);
  const [currentTurn, setCurrentTurn] = useState<LudoColor>('red');
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState<LudoColor | null>(null);
  const [movableTokens, setMovableTokens] = useState<number[]>([]);
  const [botPlayers, setBotPlayers] = useState<Record<LudoColor, boolean>>({
    red: false,
    green: true,
    yellow: true,
    blue: true
  });
  const [statusMessage, setStatusMessage] = useState('Roll the dice to start!');

  // Listen to remote WebSocket party moves
  useEffect(() => {
    if (!registerGameListener) return;
    const unregister = registerGameListener((senderId, payload) => {
      if (!payload || payload.gameType !== 'ludo') return;

      if (payload.action === 'DICE_ROLLED') {
        setDiceValue(payload.value);
      } else if (payload.action === 'TOKEN_MOVED') {
        moveToken(payload.color, payload.tokenId, payload.steps, false);
      } else if (payload.action === 'RESET_LUDO') {
        resetGame(false);
      }
    });
    return unregister;
  }, [registerGameListener]);

  // Roll the dice
  const handleRollDice = () => {
    if (isRolling || winner || movableTokens.length > 0) return;

    setIsRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      count++;
      if (count > 6) {
        clearInterval(interval);
        const finalValue = Math.floor(Math.random() * 6) + 1;
        setDiceValue(finalValue);
        setIsRolling(false);
        evaluateMoves(currentTurn, finalValue);

        if (sendGameAction) {
          sendGameAction({
            gameType: 'ludo',
            action: 'DICE_ROLLED',
            value: finalValue,
            color: currentTurn
          });
        }
      }
    }, 60);
  };

  // Evaluate which tokens can move
  const evaluateMoves = (color: LudoColor, dice: number) => {
    const playerTokens = tokens[color];
    const canMove: number[] = [];

    playerTokens.forEach(t => {
      if (t.step === 99) return; // already home
      if (t.step === -1 && dice === 6) {
        canMove.push(t.id); // Can spawn out of base
      } else if (t.step >= 0 && t.step + dice <= 56) {
        canMove.push(t.id); // Can move forward on track
      }
    });

    setMovableTokens(canMove);

    if (canMove.length === 0) {
      setStatusMessage(`${COLOR_THEMES[color].name} rolled a ${dice} (No valid moves)`);
      setTimeout(() => {
        passTurn();
      }, 1000);
    } else {
      setStatusMessage(`${COLOR_THEMES[color].name} rolled a ${dice}! Select a token to move.`);

      // If Bot turn, automatically choose the best token
      if (botPlayers[color]) {
        setTimeout(() => {
          // Prefer spawning new token or moving furthest
          const bestToken = canMove.sort((a, b) => playerTokens[b].step - playerTokens[a].step)[0];
          moveToken(color, bestToken, dice, true);
        }, 800);
      }
    }
  };

  // Move token
  const moveToken = (color: LudoColor, tokenId: number, steps: number, broadcast = true) => {
    setTokens(prev => {
      const updated = { ...prev };
      const colorTokens = [...updated[color]];
      const token = { ...colorTokens[tokenId] };

      if (token.step === -1) {
        token.step = 0; // Spawn onto starting position
      } else {
        const nextStep = token.step + steps;
        if (nextStep >= 56) {
          token.step = 99; // Reached home!
        } else {
          token.step = nextStep;
        }
      }

      colorTokens[tokenId] = token;
      updated[color] = colorTokens;

      // Check win condition (all 4 tokens in home)
      if (colorTokens.every(t => t.step === 99)) {
        setWinner(color);
        setStatusMessage(`🏆 ${COLOR_THEMES[color].name} has won the Ludo Championship!`);
      }

      return updated;
    });

    setMovableTokens([]);

    if (broadcast && sendGameAction) {
      sendGameAction({
        gameType: 'ludo',
        action: 'TOKEN_MOVED',
        color,
        tokenId,
        steps
      });
    }

    // Extra roll on 6
    if (steps === 6 && !winner) {
      setStatusMessage(`${COLOR_THEMES[color].name} rolled a 6! Roll again.`);
      setDiceValue(null);
      if (botPlayers[color]) {
        setTimeout(handleRollDice, 1000);
      }
    } else {
      setTimeout(() => {
        passTurn();
      }, 600);
    }
  };

  // Pass turn to next color
  const passTurn = () => {
    const currentIndex = COLORS.indexOf(currentTurn);
    const nextColor = COLORS[(currentIndex + 1) % COLORS.length];
    setCurrentTurn(nextColor);
    setDiceValue(null);
    setMovableTokens([]);
    setStatusMessage(`${COLOR_THEMES[nextColor].name}'s turn! Roll dice.`);

    if (botPlayers[nextColor] && !winner) {
      setTimeout(handleRollDice, 900);
    }
  };

  const resetGame = (broadcast = true) => {
    setTokens(initialTokens());
    setCurrentTurn('red');
    setDiceValue(null);
    setWinner(null);
    setMovableTokens([]);
    setStatusMessage('Game reset! Red rolls first.');

    if (broadcast && sendGameAction) {
      sendGameAction({
        gameType: 'ludo',
        action: 'RESET_LUDO'
      });
    }
  };

  return (
    <div className={`flex flex-col items-center justify-between h-full max-w-xl mx-auto select-none ${isCompact ? 'p-2 text-xs' : 'p-4'}`}>
      {/* Top Controls */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-zinc-400">Bots:</span>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setBotPlayers(prev => ({ ...prev, [c]: !prev[c] }))}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                botPlayers[c] ? COLOR_THEMES[c].light : 'bg-white/5 border-white/10 text-zinc-400'
              }`}
            >
              {botPlayers[c] ? '🤖' : '👤'} {COLOR_THEMES[c].name}
            </button>
          ))}
        </div>

        <button
          onClick={() => resetGame(true)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition"
          title="Restart Board"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Turn & Status Header */}
      <div className="mb-3 text-center">
        {winner ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-xs animate-bounce">
            <Trophy className="w-3.5 h-3.5" />
            <span>Winner: {COLOR_THEMES[winner].name} Player!</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <span>Current Turn:</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold border ${COLOR_THEMES[currentTurn].light}`}>
                {COLOR_THEMES[currentTurn].name} {botPlayers[currentTurn] ? '(Bot)' : `(${myUserName})`}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">{statusMessage}</p>
          </div>
        )}
      </div>

      {/* LUDO BOARD SVG / GRID */}
      <div className="relative w-full aspect-square max-w-[340px] sm:max-w-[400px] bg-[#121520] rounded-2xl border-4 border-white/10 p-2 shadow-2xl flex flex-col justify-between">
        {/* Top Half: Red Base (left) and Green Base (right) */}
        <div className="flex justify-between h-[40%]">
          {/* Red Yard */}
          <div className="w-[40%] h-full bg-rose-950/60 rounded-xl border-2 border-rose-600/60 p-2 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-rose-400 flex items-center justify-between">
              <span>RED YARD</span>
              <span>{tokens.red.filter(t => t.step === 99).length}/4 🏁</span>
            </div>
            <div className="grid grid-cols-2 gap-2 place-items-center flex-1">
              {tokens.red.map(t => (
                <button
                  key={t.id}
                  disabled={!movableTokens.includes(t.id) || currentTurn !== 'red'}
                  onClick={() => moveToken('red', t.id, diceValue || 6)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-rose-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
                    t.step === 99 ? 'opacity-30' : ''
                  } ${
                    movableTokens.includes(t.id) && currentTurn === 'red'
                      ? 'ring-4 ring-amber-300 scale-125 animate-bounce'
                      : ''
                  }`}
                >
                  {t.step === -1 ? '🔴' : t.step === 99 ? '✓' : t.step}
                </button>
              ))}
            </div>
          </div>

          {/* Center Track Top */}
          <div className="w-[18%] h-full flex flex-col justify-between items-center py-1 text-[10px] text-zinc-500 font-mono">
            <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              ★
            </div>
            <div className="text-zinc-600">▲</div>
            <div className="w-6 h-6 rounded bg-rose-500/20 border border-rose-500/40 flex items-center justify-center">
              ★
            </div>
          </div>

          {/* Green Yard */}
          <div className="w-[40%] h-full bg-emerald-950/60 rounded-xl border-2 border-emerald-600/60 p-2 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between">
              <span>GREEN YARD</span>
              <span>{tokens.green.filter(t => t.step === 99).length}/4 🏁</span>
            </div>
            <div className="grid grid-cols-2 gap-2 place-items-center flex-1">
              {tokens.green.map(t => (
                <button
                  key={t.id}
                  disabled={!movableTokens.includes(t.id) || currentTurn !== 'green'}
                  onClick={() => moveToken('green', t.id, diceValue || 6)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
                    t.step === 99 ? 'opacity-30' : ''
                  } ${
                    movableTokens.includes(t.id) && currentTurn === 'green'
                      ? 'ring-4 ring-amber-300 scale-125 animate-bounce'
                      : ''
                  }`}
                >
                  {t.step === -1 ? '🟢' : t.step === 99 ? '✓' : t.step}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center Home Triangle & Track */}
        <div className="h-[18%] flex items-center justify-between px-2 bg-white/[0.02] rounded-xl border border-white/5">
          <div className="text-[10px] font-bold text-amber-400">★ SAFE</div>
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-emerald-600 flex items-center justify-center font-black text-xs text-white shadow-lg">
            HOME
          </div>
          <div className="text-[10px] font-bold text-blue-400">★ SAFE</div>
        </div>

        {/* Bottom Half: Yellow Base (left) and Blue Base (right) */}
        <div className="flex justify-between h-[40%]">
          {/* Yellow Yard */}
          <div className="w-[40%] h-full bg-amber-950/60 rounded-xl border-2 border-amber-600/60 p-2 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-amber-400 flex items-center justify-between">
              <span>YELLOW YARD</span>
              <span>{tokens.yellow.filter(t => t.step === 99).length}/4 🏁</span>
            </div>
            <div className="grid grid-cols-2 gap-2 place-items-center flex-1">
              {tokens.yellow.map(t => (
                <button
                  key={t.id}
                  disabled={!movableTokens.includes(t.id) || currentTurn !== 'yellow'}
                  onClick={() => moveToken('yellow', t.id, diceValue || 6)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-amber-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
                    t.step === 99 ? 'opacity-30' : ''
                  } ${
                    movableTokens.includes(t.id) && currentTurn === 'yellow'
                      ? 'ring-4 ring-amber-300 scale-125 animate-bounce'
                      : ''
                  }`}
                >
                  {t.step === -1 ? '🟡' : t.step === 99 ? '✓' : t.step}
                </button>
              ))}
            </div>
          </div>

          {/* Center Track Bottom */}
          <div className="w-[18%] h-full flex flex-col justify-between items-center py-1 text-[10px] text-zinc-500 font-mono">
            <div className="w-6 h-6 rounded bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
              ★
            </div>
            <div className="text-zinc-600">▼</div>
            <div className="w-6 h-6 rounded bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
              ★
            </div>
          </div>

          {/* Blue Yard */}
          <div className="w-[40%] h-full bg-blue-950/60 rounded-xl border-2 border-blue-600/60 p-2 flex flex-col justify-between">
            <div className="text-[10px] font-bold text-blue-400 flex items-center justify-between">
              <span>BLUE YARD</span>
              <span>{tokens.blue.filter(t => t.step === 99).length}/4 🏁</span>
            </div>
            <div className="grid grid-cols-2 gap-2 place-items-center flex-1">
              {tokens.blue.map(t => (
                <button
                  key={t.id}
                  disabled={!movableTokens.includes(t.id) || currentTurn !== 'blue'}
                  onClick={() => moveToken('blue', t.id, diceValue || 6)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white shadow-lg transition-transform ${
                    t.step === 99 ? 'opacity-30' : ''
                  } ${
                    movableTokens.includes(t.id) && currentTurn === 'blue'
                      ? 'ring-4 ring-amber-300 scale-125 animate-bounce'
                      : ''
                  }`}
                >
                  {t.step === -1 ? '🔵' : t.step === 99 ? '✓' : t.step}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dice Roller Section */}
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={handleRollDice}
          disabled={isRolling || !!winner || movableTokens.length > 0}
          className={`px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-3 shadow-xl transition-all active:scale-95 ${
            isRolling || movableTokens.length > 0
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-rose-600/30'
          }`}
        >
          {/* Animated 3D Dice Display */}
          <div className="w-8 h-8 rounded-xl bg-white text-zinc-900 flex items-center justify-center text-lg font-black shadow-inner">
            {diceValue || '?'}
          </div>
          <span>{isRolling ? 'Rolling...' : movableTokens.length > 0 ? 'Pick Token' : 'Roll Dice 🎲'}</span>
        </button>
      </div>

      <p className="text-[10px] text-zinc-500 mt-2">
        Roll a 6 to bring tokens out of the yard. Tokens that can move will bounce. First to bring 4 tokens home wins!
      </p>
    </div>
  );
};
