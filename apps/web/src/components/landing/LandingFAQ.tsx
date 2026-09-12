'use client';

import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: 'Do my friends need to install any Chrome extensions or create accounts?',
    answer: 'Zero extensions and zero app downloads required. Watch runs 100% in the modern web browser. When you create a party and share the link, your friends simply click it, type a nickname, and instantly drop right into the theater in less than 3 seconds.'
  },
  {
    question: 'How does the sub-second sync engine work without stuttering or audio pitch-shifts?',
    answer: 'We use Cristian’s Algorithm for continuous round-trip clock synchronization (NTP-Lite). Instead of hard seeking every second—which causes jarring video pauses and chipmunk audio—our decision engine applies subtle micro-playback rate scaling (e.g. 1.02x or 0.98x) over milliseconds until all participants are locked within ±15ms.'
  },
  {
    question: 'Does it work with Netflix, Disney+, Prime Video, and YouTube?',
    answer: 'Yes! You can stream YouTube directly in 4K, direct MP4/HLS streams, or launch our native In-App Virtual Browser to synchronize co-browsing and co-watching on major streaming platforms with zero DRM black-screen issues.'
  },
  {
    question: 'Is my webcam, voice, and chat private and encrypted?',
    answer: 'Yes. Video facecams and voice streams use encrypted peer-to-peer WebRTC mesh connections directly between participant browsers. Media data never passes through intermediate recording servers, ensuring strict privacy and end-to-end security.'
  },
  {
    question: 'Can we use Watch on Mac, Windows, iPad, and mobile phones?',
    answer: 'Yes! Because Watch is built on modern Web standards (HTML5 video, WebRTC, WebSockets), it works seamlessly across Chrome, Safari, Firefox, Edge, iOS Safari, and Android Chrome.'
  },
  {
    question: 'How many friends can join a single viewing room?',
    answer: 'Each viewing room comfortably supports up to 50 active synchronized viewers with real-time text chat, timestamped reactions, and interactive playback remote controls.'
  }
];

export function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Got Questions?</span>
        </div>
        <h3 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Frequently Asked Questions
        </h3>
        <p className="text-xs sm:text-sm text-zinc-400">
          Everything you need to know about setting up and streaming on Watch.
        </p>
      </div>

      <div className="space-y-3 pt-4">
        {FAQ_ITEMS.map((item, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className="rounded-2xl bg-[#0f121d] border border-white/10 overflow-hidden transition-all duration-200"
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition"
              >
                <span className="text-sm font-semibold text-zinc-100 pr-4">
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-emerald-400 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isOpen && (
                <div className="px-4 sm:px-5 pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/5 pt-3">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
