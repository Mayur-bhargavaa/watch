'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, Check, ChevronDown } from 'lucide-react';

interface Slide {
  badge?: string;
  titleLines: string[];
  subtitle: string;
  image: string;
  doodleCrown?: boolean;
  doodleStar?: boolean;
  doodleSparkle?: boolean;
  handwrittenNote?: {
    line1: string;
    line2: string;
    hasHeart?: boolean;
  };
  ctaText: string;
}

const ONBOARDING_SLIDES: Slide[] = [
  {
    titleLines: ['Movie', 'Nights', 'Start Here'],
    subtitle: 'Start a private room, share your link on WhatsApp, and stream movies & videos in sub-second sync.',
    image: '/images/welcome-slide-character.png',
    doodleCrown: true,
    doodleStar: true,
    doodleSparkle: true,
    handwrittenNote: {
      line1: 'Watch in Sync',
      line2: '0ms Lag',
      hasHeart: true,
    },
    ctaText: 'Continue',
  },
  {
    titleLines: ['Stream', 'In Sync,', 'Zero Lag'],
    subtitle: 'Ultra-low latency Cristian NTP sync engine keeps playback aligned within 15ms across phones and laptops.',
    image: '/theater/cinema_ultra_lux.png',
    doodleCrown: false,
    doodleStar: true,
    doodleSparkle: true,
    handwrittenNote: {
      line1: 'Exact Sync',
      line2: '4K Ultra HDR',
      hasHeart: true,
    },
    ctaText: 'Continue',
  },
  {
    titleLines: ['Play 13+', 'Party Games', 'Face to Face'],
    subtitle: 'Roll dice in 3D Ludo, duel in Four in a Row, or host Mafia and Quiz Show with live video call feeds.',
    image: '/images/welcome-slide-games.png',
    doodleCrown: true,
    doodleStar: true,
    doodleSparkle: true,
    handwrittenNote: {
      line1: '100% Real Humans',
      line2: 'Zero Bots Guarantee',
      hasHeart: true,
    },
    ctaText: 'Sign Up',
  },
];

interface MobileWelcomeOnboardingProps {
  onGetStarted: () => void;
  onExploreMore: () => void;
}

export function MobileWelcomeOnboarding({ onGetStarted, onExploreMore }: MobileWelcomeOnboardingProps) {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const totalSlides = ONBOARDING_SLIDES.length;
  const slide = ONBOARDING_SLIDES[currentSlide];

  // Handle swipe left / right
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;

    if (diff > minSwipeDistance) {
      // Swiped left -> next slide
      handleNext();
    } else if (diff < -minSwipeDistance) {
      // Swiped right -> prev slide
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide((prev) => prev + 1);
    } else {
      onGetStarted();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    onGetStarted();
  };

  return (
    <div
      className="relative w-full min-h-screen bg-[#FDF9F6] text-[#1D1B41] flex flex-col justify-between overflow-hidden select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Soft warm decorative peach blob in top-left */}
      <div className="absolute -top-12 -left-12 w-44 h-44 rounded-full bg-[#FDE7CA] opacity-80 blur-xl pointer-events-none" />

      {/* Subtle brand glow on top-right */}
      <div className="absolute top-10 -right-12 w-36 h-36 rounded-full bg-[#FCE6EE] opacity-60 blur-xl pointer-events-none" />

      {/* TOP HEADER: Brand indicator + Skip button */}
      <div className="relative z-10 px-6 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#d2281e]" />
          <span className="font-extrabold tracking-tight text-sm text-[#1D1B41]">
            watch<span className="text-[#d2281e]">.</span>
          </span>
        </div>

        <button
          onClick={handleSkip}
          type="button"
          className="text-xs font-semibold text-[#8B91A5] hover:text-[#1D1B41] transition-colors py-1 px-2.5 rounded-full active:bg-[#F2ECE4]"
        >
          Skip
        </button>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="relative z-10 px-6 pt-2 pb-4 flex-1 flex flex-col justify-center">
        {/* Playful Headline */}
        <div className="relative inline-block mb-3">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.12] text-[#1D1B41]">
            {slide.titleLines.map((line, idx) => {
              const isLast = idx === slide.titleLines.length - 1;
              return (
                <div key={idx} className="relative inline-block w-full">
                  <span>{line}</span>
                  {isLast && slide.doodleSparkle && (
                    <span className="inline-block ml-2 align-middle relative -top-3">
                      {/* Playful yellow sparkle rays */}
                      <svg
                        className="w-7 h-7 text-[#F5BA42] inline-block"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      >
                        <line x1="3" y1="12" x2="8" y2="10" />
                        <line x1="9" y1="4" x2="13" y2="8" />
                      </svg>
                    </span>
                  )}
                </div>
              );
            })}
          </h1>
        </div>

        {/* Subtitle */}
        <p className="text-xs sm:text-sm text-[#504C6E] leading-relaxed max-w-xs font-medium">
          {slide.subtitle}
        </p>

        {/* ILLUSTRATION & DOODLE STAGE */}
        <div className="relative mt-6 mb-4 flex items-center justify-center min-h-[300px]">
          {/* Crown doodle on left */}
          {slide.doodleCrown && (
            <div className="absolute left-1 top-8 z-20">
              <svg
                className="w-9 h-9 text-[#F5BA42] drop-shadow-sm transform -rotate-12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 18h18L19 7l-5 4-2-6-2 6-5-4-2 11z" />
              </svg>
            </div>
          )}

          {/* Star doodle on left lower */}
          {slide.doodleStar && (
            <div className="absolute left-3 bottom-12 z-20">
              <svg
                className="w-5 h-5 text-[#F5BA42] fill-[#F5BA42] transform rotate-12"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </div>
          )}

          {/* Handwritten doodle text: Slide 1 (top right), Slide 2 (top left), Slide 3 (top right) */}
          {slide.handwrittenNote && (
            <div
              className={`absolute top-2 z-20 pointer-events-none ${
                currentSlide === 1 ? 'left-2 text-left pl-1' : 'right-2 text-right pr-1'
              }`}
            >
              <div className="font-serif italic font-bold text-[#1D1B41] text-[11px] sm:text-xs leading-tight tracking-wide">
                <div>{slide.handwrittenNote.line1}</div>
                <div>{slide.handwrittenNote.line2}</div>
                {slide.handwrittenNote.hasHeart && (
                  <div className="text-sm mt-0.5 text-[#1D1B41]">♡</div>
                )}
              </div>
            </div>
          )}

          {/* Character / Scene Card with Soft Pink Cloud Backdrop */}
          <div className="relative w-full max-w-[340px] aspect-[4/3.8] rounded-3xl overflow-hidden flex items-center justify-center p-2">
            {/* Soft pink cloud shape */}
            <div className="absolute inset-4 rounded-[40px] bg-gradient-to-tr from-[#FCE6EE] via-[#FCE4EC] to-[#FFF0F5] opacity-90 blur-sm pointer-events-none" />

            {/* Slide Image */}
            <img
              src={slide.image}
              alt={slide.titleLines.join(' ')}
              className="relative z-10 max-h-full max-w-full object-contain drop-shadow-md transition-transform duration-300 transform active:scale-95"
            />
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Curved Wave, Dots & Continue CTA */}
      <div className="relative z-20 bg-white/90 backdrop-blur-md border-t border-[#F0EBE5] rounded-t-[32px] px-6 pt-5 pb-6 shadow-lg">
        {/* Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {ONBOARDING_SLIDES.map((_, idx) => {
            const isActive = idx === currentSlide;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full ${
                  isActive
                    ? 'w-7 h-2.5 bg-[#1D1B41]'
                    : 'w-2.5 h-2.5 bg-[#D7D8E7] hover:bg-[#B5B7CF]'
                }`}
              />
            );
          })}
        </div>

        {/* Action Buttons: Sign Up & Log In on last slide, Continue on earlier slides */}
        {currentSlide === totalSlides - 1 ? (
          <div className="flex items-center gap-2.5 w-full">
            <button
              onClick={() => router.push('/login?tab=signup')}
              type="button"
              className="flex-[1.2] py-3.5 sm:py-4 rounded-2xl bg-[#1D1B41] hover:bg-[#12102B] text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-[#1D1B41]/25 active:scale-95 transition flex items-center justify-center gap-1.5"
            >
              <span>Sign Up</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => router.push('/login')}
              type="button"
              className="flex-1 py-3.5 sm:py-4 rounded-2xl bg-[#1D1B41]/5 hover:bg-[#1D1B41]/10 border border-[#1D1B41]/15 text-[#1D1B41] font-extrabold text-xs sm:text-sm active:scale-95 transition flex items-center justify-center"
            >
              <span>Log In</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleNext}
            type="button"
            className="w-full py-3.5 sm:py-4 rounded-2xl bg-[#1D1B41] hover:bg-[#12102B] text-white font-extrabold text-xs sm:text-sm shadow-xl shadow-[#1D1B41]/25 active:scale-95 transition flex items-center justify-center gap-2"
          >
            <span>{slide.ctaText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Explore Full Landing Page Link */}
        <button
          onClick={onExploreMore}
          type="button"
          className="w-full mt-3 text-center text-[11px] font-bold text-[#8B91A5] hover:text-[#1D1B41] transition-colors flex items-center justify-center gap-1"
        >
          <span>Explore all features, games & pricing</span>
          <ChevronDown className="w-3.5 h-3.5 animate-bounce" />
        </button>
      </div>
    </div>
  );
}
