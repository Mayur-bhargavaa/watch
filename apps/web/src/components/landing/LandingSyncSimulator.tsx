'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Zap, CheckCircle2, RotateCw, Activity, ArrowRight } from 'lucide-react';

export function LandingSyncSimulator() {
  const [hostPos, setHostPos] = useState(42.5);
  const [viewer1Drift, setViewer1Drift] = useState(2); // London (ms)
  const [viewer2Drift, setViewer2Drift] = useState(-3); // New York (ms)
  const [viewer3Drift, setViewer3Drift] = useState(4); // Tokyo (ms)
  const [isWarping, setIsWarping] = useState(false);
  const [algorithmState, setAlgorithmState] = useState<'IDLE' | 'CORRECTING' | 'LOCKED'>('LOCKED');

  // Continuous playback tick
  useEffect(() => {
    const timer = setInterval(() => {
      setHostPos((prev) => Number((prev + 0.1).toFixed(1)));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const triggerNetworkSpike = () => {
    setIsWarping(true);
    setAlgorithmState('CORRECTING');
    // Inject massive simulated network delay
    setViewer1Drift(380);
    setViewer2Drift(-290);
    setViewer3Drift(520);

    // After 600ms, Cristian algorithm computes NTP offset and micro-warps playback speed
    setTimeout(() => {
      setViewer1Drift(45);
      setViewer2Drift(-30);
      setViewer3Drift(60);
    }, 900);

    // After 1400ms, drift is completely compensated back to sub-10ms!
    setTimeout(() => {
      setViewer1Drift(2);
      setViewer2Drift(-1);
      setViewer3Drift(3);
      setIsWarping(false);
      setAlgorithmState('LOCKED');
    }, 1800);
  };

  const triggerHostSeek = () => {
    const newPos = Number((hostPos + 15).toFixed(1));
    setHostPos(newPos);
    setAlgorithmState('CORRECTING');
    setIsWarping(true);
    setViewer1Drift(120);
    setViewer2Drift(140);
    setViewer3Drift(130);

    setTimeout(() => {
      setViewer1Drift(2);
      setViewer2Drift(-2);
      setViewer3Drift(1);
      setIsWarping(false);
      setAlgorithmState('LOCKED');
    }, 700);
  };

  return (
    <div className="w-full bg-[#101420] rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/10">
        <div className="space-y-1">
          <div className="inline-flex items-center space-x-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
            <Cpu className="w-4 h-4" />
            <span>Interactive Cristian Algorithm Engine</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white">
            Watch Multi-Tier Drift Compensation in Real-Time
          </h3>
          <p className="text-xs text-zinc-400 max-w-xl">
            Click the test buttons to introduce network spikes or seek commands, and observe how our continuous NTP-lite clock sync snaps all global peers within ±5ms.
          </p>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={triggerNetworkSpike}
            disabled={isWarping}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Simulate 500ms Spike</span>
          </button>

          <button
            onClick={triggerHostSeek}
            disabled={isWarping}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isWarping ? 'animate-spin' : ''}`} />
            <span>Host Jump +15s</span>
          </button>
        </div>
      </div>

      {/* Live Peer Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        {/* Host Node */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-400/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">Host (London)</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold">
              AUTHORITY
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {hostPos.toFixed(1)}s
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
            <span>Clock Drift:</span>
            <span className="font-mono text-emerald-400 font-bold">0.0 ms</span>
          </div>
        </div>

        {/* Viewer 1: New York */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">Viewer (New York)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
              RTT: 32ms
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {(hostPos + viewer1Drift / 1000).toFixed(1)}s
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
            <span>Drift Delta:</span>
            <span className={`font-mono font-bold ${Math.abs(viewer1Drift) > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {viewer1Drift > 0 ? `+${viewer1Drift}` : viewer1Drift} ms
            </span>
          </div>
        </div>

        {/* Viewer 2: Tokyo */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">Viewer (Tokyo)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
              RTT: 142ms
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {(hostPos + viewer2Drift / 1000).toFixed(1)}s
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
            <span>Drift Delta:</span>
            <span className={`font-mono font-bold ${Math.abs(viewer2Drift) > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {viewer2Drift > 0 ? `+${viewer2Drift}` : viewer2Drift} ms
            </span>
          </div>
        </div>

        {/* Viewer 3: Sydney */}
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-200">Viewer (Sydney)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
              RTT: 184ms
            </span>
          </div>
          <div className="text-2xl font-mono font-black text-white">
            {(hostPos + viewer3Drift / 1000).toFixed(1)}s
          </div>
          <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-1">
            <span>Drift Delta:</span>
            <span className={`font-mono font-bold ${Math.abs(viewer3Drift) > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {viewer3Drift > 0 ? `+${viewer3Drift}` : viewer3Drift} ms
            </span>
          </div>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          {algorithmState === 'LOCKED' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
          )}
          <span className="text-zinc-300">
            Engine Status:{' '}
            <strong className={algorithmState === 'LOCKED' ? 'text-emerald-400' : 'text-amber-400'}>
              {algorithmState === 'LOCKED'
                ? 'All Peers Synced (Deviation < 5ms • No pitch-shift warp)'
                : 'Drift Detected • Micro-pitch Rate Scaling 1.05x Applied'}
            </strong>
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">
          Algorithm: Cristian Round-Trip Clock Filter + Linear Regress
        </span>
      </div>
    </div>
  );
}
