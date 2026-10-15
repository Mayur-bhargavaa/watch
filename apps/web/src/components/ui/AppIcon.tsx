import React from 'react';
import {
  Flame, Trophy, Crown, PartyPopper, Sparkles, Rocket, Heart, Clapperboard, Popcorn, Gamepad2, Dice5, Bell, MessageCircle,
  CalendarDays, TriangleAlert, RefreshCw, ShieldCheck, Zap, Smartphone, Laptop, Palette, ThumbsUp, Laugh, Smile, Frown, Angry,
  Meh, Handshake, Target, Pizza, Camera, Mic, Lock, Link as LinkIcon, Users, Gem, Cake, Wine, Moon, Sun, Star, Cat, Dog, Bird,
  Fish, Rabbit, PawPrint, Skull, Coffee, Repeat, Search, Eye, Gift, Music, Headphones, Video, Play, Pause, Bot, Swords, Flag,
  Lightbulb, Package, Circle, X, Check, Clock, Globe, Share2, Ghost, Bomb, Medal, Pencil, Brush, Scissors, Shirt, Glasses,
  WandSparkles, Utensils, Tv, Film, Ticket, Phone, Volume2, Info, HeartHandshake, Flower, Leaf, Snowflake, Umbrella, Dices,
  Key, Anchor, Cookie, Squirrel, Turtle, Bug, Waves, Hand, Wand2, Award, type LucideIcon
} from 'lucide-react';

/**
 * Semantic icon names used instead of emoji across the app. Emoji are reserved for chat content (messages, stickers,
 * reactions); everything else is drawn with these icons so it looks the same on every device and follows text colour/size.
 */
export const APP_ICONS = {
  fire: Flame,
  trophy: Trophy,
  crown: Crown,
  party: PartyPopper,
  sparkles: Sparkles,
  rocket: Rocket,
  heart: Heart,
  movie: Clapperboard,
  popcorn: Popcorn,
  game: Gamepad2,
  dice: Dice5,
  dices: Dices,
  bell: Bell,
  message: MessageCircle,
  calendar: CalendarDays,
  warning: TriangleAlert,
  refresh: RefreshCw,
  shield: ShieldCheck,
  zap: Zap,
  phone: Smartphone,
  laptop: Laptop,
  palette: Palette,
  thumbsUp: ThumbsUp,
  laugh: Laugh,
  smile: Smile,
  sad: Frown,
  angry: Angry,
  meh: Meh,
  handshake: Handshake,
  target: Target,
  food: Pizza,
  camera: Camera,
  mic: Mic,
  lock: Lock,
  link: LinkIcon,
  users: Users,
  ring: Gem,
  cake: Cake,
  drink: Wine,
  moon: Moon,
  sun: Sun,
  star: Star,
  cat: Cat,
  dog: Dog,
  bird: Bird,
  fish: Fish,
  rabbit: Rabbit,
  paw: PawPrint,
  skull: Skull,
  coffee: Coffee,
  repeat: Repeat,
  search: Search,
  eye: Eye,
  gift: Gift,
  music: Music,
  headphones: Headphones,
  video: Video,
  play: Play,
  pause: Pause,
  bot: Bot,
  swords: Swords,
  flag: Flag,
  idea: Lightbulb,
  package: Package,
  dot: Circle,
  close: X,
  check: Check,
  clock: Clock,
  globe: Globe,
  share: Share2,
  ghost: Ghost,
  bomb: Bomb,
  medal: Medal,
  pencil: Pencil,
  brush: Brush,
  scissors: Scissors,
  shirt: Shirt,
  glasses: Glasses,
  wand: WandSparkles,
  utensils: Utensils,
  tv: Tv,
  film: Film,
  ticket: Ticket,
  call: Phone,
  volume: Volume2,
  info: Info,
  love: HeartHandshake,
  flower: Flower,
  leaf: Leaf,
  snow: Snowflake,
  umbrella: Umbrella,
  key: Key,
  anchor: Anchor,
  cookie: Cookie,
  squirrel: Squirrel,
  turtle: Turtle,
  bug: Bug,
  waves: Waves,
  hand: Hand,
  magic: Wand2,
  award: Award
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof APP_ICONS;

export function isIconName(value: unknown): value is IconName {
  return typeof value === 'string' && value in APP_ICONS;
}

interface AppIconProps {
  name: IconName | string;
  className?: string;
  strokeWidth?: number;
  /** Accessible name. Omit for purely decorative icons (they are hidden from screen readers). */
  label?: string;
}

/** Renders a semantic icon; unknown names fall back to a sparkle so a typo never breaks a screen. */
export const AppIcon: React.FC<AppIconProps> = ({ name, className = 'w-4 h-4', strokeWidth, label }) => {
  const Icon = isIconName(name) ? APP_ICONS[name] : Sparkles;
  return label ? (
    <Icon className={className} strokeWidth={strokeWidth} role="img" aria-label={label} />
  ) : (
    <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />
  );
};
