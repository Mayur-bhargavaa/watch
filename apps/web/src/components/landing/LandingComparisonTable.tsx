'use client';

import React from 'react';
import { Check, X, Sparkles } from 'lucide-react';

export function LandingComparisonTable() {
  const comparisons = [
    {
      feature: 'Clock Synchronization Precision',
      stitchbyte: 'Sub-15ms (Cristian NTP-Lite)',
      teleparty: '2,000 - 5,000ms delay',
      discord: 'Network stream lag (~1s)',
      zoom: 'Unsynced screen stream'
    },
    {
      feature: 'Streaming Video Quality',
      stitchbyte: 'Original Native 4K HDR',
      teleparty: 'Local Stream',
      discord: 'Compressed 720p/1080p',
      zoom: 'Compressed 720p (Low FPS)'
    },
    {
      feature: 'No Browser Extension Needed',
      stitchbyte: true,
      teleparty: false,
      discord: false,
      zoom: false
    },
    {
      feature: 'DRM-Compliant (No Black Screens)',
      stitchbyte: true,
      teleparty: true,
      discord: false,
      zoom: false
    },
    {
      feature: 'Built-in Mesh Facecam & Voice',
      stitchbyte: true,
      teleparty: false,
      discord: true,
      zoom: true
    },
    {
      feature: 'Post-Watch AI Recap & Reaction Heatmaps',
      stitchbyte: true,
      teleparty: false,
      discord: false,
      zoom: false
    },
    {
      feature: 'Mobile & Tablet Support without App',
      stitchbyte: true,
      teleparty: false,
      discord: false,
      zoom: false
    },
    {
      feature: 'Time to First Watch Party',
      stitchbyte: '3 Seconds (1-Click)',
      teleparty: 'Requires Extension Install',
      discord: 'Requires Server & App Setup',
      zoom: 'Requires Meeting Scheduling'
    }
  ];

  return (
    <div className="w-full max-w-6xl mx-auto rounded-3xl bg-[#0f121d] border border-white/10 p-6 sm:p-10 shadow-2xl overflow-hidden">
      <div className="text-center space-y-3 mb-8">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Architectural Superiority</span>
        </div>
        <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          How StitchByte Cinema Compares
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400 max-w-xl mx-auto">
          See why couples, movie clubs, and gaming squads choose StitchByte Cinema over legacy screen-sharing and browser extensions.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-zinc-400">
              <th className="py-4 px-4 font-semibold text-zinc-300 w-1/3">Capability</th>
              <th className="py-4 px-4 font-bold text-emerald-400 bg-emerald-500/[0.07] rounded-t-xl">
                StitchByte Cinema
              </th>
              <th className="py-4 px-4 font-medium">Teleparty</th>
              <th className="py-4 px-4 font-medium">Discord Screenshare</th>
              <th className="py-4 px-4 font-medium">Zoom / Meet</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {comparisons.map((row, idx) => (
              <tr key={idx} className="hover:bg-white/[0.02] transition">
                <td className="py-4 px-4 font-medium text-zinc-200">
                  {row.feature}
                </td>

                {/* StitchByte Column */}
                <td className="py-4 px-4 font-bold text-white bg-emerald-500/[0.07]">
                  {typeof row.stitchbyte === 'boolean' ? (
                    <div className="flex items-center space-x-1 text-emerald-400">
                      <div className="p-0.5 rounded-full bg-emerald-500/20">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold">Yes</span>
                    </div>
                  ) : (
                    <span className="text-emerald-300">{row.stitchbyte}</span>
                  )}
                </td>

                {/* Teleparty Column */}
                <td className="py-4 px-4 text-zinc-400">
                  {typeof row.teleparty === 'boolean' ? (
                    row.teleparty ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 text-zinc-600" />
                    )
                  ) : (
                    row.teleparty
                  )}
                </td>

                {/* Discord Column */}
                <td className="py-4 px-4 text-zinc-400">
                  {typeof row.discord === 'boolean' ? (
                    row.discord ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 text-zinc-600" />
                    )
                  ) : (
                    row.discord
                  )}
                </td>

                {/* Zoom Column */}
                <td className="py-4 px-4 text-zinc-400">
                  {typeof row.zoom === 'boolean' ? (
                    row.zoom ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <X className="w-4 h-4 text-zinc-600" />
                    )
                  ) : (
                    row.zoom
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
