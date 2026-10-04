import React from 'react';
import { GAME_ASSETS } from '../types/game.ts';
import { GameAssetImage, ShapeMascot3D } from './ShapeMascot3D.tsx';
import { Star } from 'lucide-react';

/**
 * 1. LUNA & RAKA — 3D Chibi Shape Explorer Character Guides
 */
interface CharacterGuideProps {
  character: 'luna' | 'raka';
  message: string;
  mood?: 'cheerful' | 'celebrating' | 'hint';
  compact?: boolean;
  className?: string;
}

export const CharacterGuide: React.FC<CharacterGuideProps> = ({
  character,
  message,
  mood = 'cheerful',
  compact = false,
  className = '',
}) => {
  const isLuna = character === 'luna';
  const name = isLuna ? 'Luna' : 'Raka';
  const portrait = isLuna ? GAME_ASSETS.lunaExplorer : GAME_ASSETS.rakaExplorer;

  const bubbleColors =
    mood === 'celebrating'
      ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-[0_4px_0_#34D399]'
      : mood === 'hint'
      ? 'bg-amber-50 border-amber-400 text-amber-950 shadow-[0_4px_0_#FBBF24]'
      : 'bg-white border-sky-300 text-slate-900 shadow-[0_4px_0_#BAE6FD]';

  return (
    <div
      className={`flex items-center gap-3 select-none ${className}`}
      aria-label={`Pemandu ${name}`}
    >
      {/* 3D Chibi Portrait Frame */}
      <div
        className={`relative shrink-0 rounded-2xl overflow-hidden border-3 ${
          isLuna ? 'border-amber-400 bg-amber-100' : 'border-sky-400 bg-sky-100'
        } shadow-md ${compact ? 'w-12 h-12' : 'w-16 h-16'}`}
      >
        <GameAssetImage
          src={portrait}
          alt={name}
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[10px] font-display font-bold text-center py-0.5 leading-none">
          {name}
        </span>
      </div>

      {/* Speech Bubble */}
      <div
        className={`relative flex-1 rounded-2xl border-2 px-3.5 py-2.5 ${bubbleColors}`}
      >
        <p
          className={`font-display font-bold leading-snug ${
            compact ? 'text-sm' : 'text-base'
          }`}
        >
          “{message}”
        </p>
      </div>
    </div>
  );
};

/**
 * 2. XP STARS DISPLAY — Clean SVG Stars + XP Counter for Adventure Camps
 */
interface XpStarsDisplayProps {
  xp: number;
  size?: 'sm' | 'md' | 'lg';
}

export const XpStarsDisplay: React.FC<XpStarsDisplayProps> = ({
  xp,
  size = 'md',
}) => {
  const filledStars = Math.min(5, Math.max(1, Math.floor(xp / 12) + 1));
  const starIconSize = size === 'lg' ? 'w-5 h-5' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className="inline-flex items-center gap-2 bg-slate-900/25 backdrop-blur-xs px-3 py-1.5 rounded-2xl border border-white/25">
      <div className="flex items-center gap-1" aria-label={`${filledStars} bintang`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`${starIconSize} ${
              i < filledStars
                ? 'fill-amber-400 text-amber-400 drop-shadow-xs'
                : 'fill-slate-400/30 text-slate-400/40'
            }`}
          />
        ))}
      </div>
      <span
        className={`font-display font-bold text-white tabular-nums ${
          size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-base'
        }`}
      >
        {xp} XP
      </span>
    </div>
  );
};

/**
 * 3. TEAM CAMP MASCOT EMBLEM (Harimau Biru, Elang Hijau, Kancil Emas, Garuda Merah)
 */
interface TeamCampBadgeProps {
  color: string;
  size?: number;
}

export const TeamCampBadge: React.FC<TeamCampBadgeProps> = ({
  color,
  size = 48,
}) => {
  const code =
    color === 'blue'
      ? 'HB'
      : color === 'emerald'
      ? 'EH'
      : color === 'amber'
      ? 'KE'
      : 'GM';
  const ringBg =
    color === 'blue'
      ? 'from-sky-400 to-blue-600 border-sky-300 text-white'
      : color === 'emerald'
      ? 'from-emerald-400 to-teal-600 border-emerald-300 text-white'
      : color === 'amber'
      ? 'from-amber-400 to-orange-500 border-amber-300 text-slate-950'
      : 'from-rose-400 to-red-600 border-rose-300 text-white';

  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-2xl bg-gradient-to-br ${ringBg} border-3 flex items-center justify-center shadow-md shrink-0 select-none font-display font-black tracking-wider text-sm sm:text-base`}
    >
      {code}
    </div>
  );
};

/**
 * 4. PLAYFUL SCHOOL ADVENTURE WORLD BACKDROP
 * Subtle illustrated elementary school environment (clouds, school roof, trees, grassy hills, path)
 * that frames the game world without interfering with student photos or drag-and-drop targets.
 */
export const SchoolWorldBackdrop: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
      aria-hidden="true"
    >
      {/* Cheerful Sky Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#BAE6FD] via-[#E0F2FE] to-[#DCFCE7]" />

      {/* Fluffy 3D-style Clouds & Floating Geometric Clouds */}
      <svg
        className="absolute top-6 left-8 w-44 h-24 opacity-70 animate-float-slow"
        viewBox="0 0 200 100"
      >
        <path
          d="M 45 75 L 155 75 A 22 22 0 0 0 155 32 A 32 32 0 0 0 98 18 A 28 28 0 0 0 45 35 A 20 20 0 0 0 45 75 Z"
          fill="#FFFFFF"
        />
      </svg>

      <svg
        className="absolute top-10 right-12 w-52 h-28 opacity-65 animate-float-slow"
        viewBox="0 0 220 110"
      >
        <path
          d="M 50 80 L 170 80 A 24 24 0 0 0 170 35 A 35 35 0 0 0 105 18 A 30 30 0 0 0 50 38 A 22 22 0 0 0 50 80 Z"
          fill="#FFFFFF"
        />
      </svg>

      {/* Bottom Rolling Schoolyard Hills, School Building Silhouette, Trees & Path */}
      <svg
        className="absolute bottom-0 inset-x-0 w-full h-44 object-cover"
        viewBox="0 0 1440 220"
        preserveAspectRatio="none"
      >
        {/* Distant Green Hill */}
        <path
          d="M0,140 Q360,60 720,130 T1440,110 L1440,220 L0,220 Z"
          fill="#86EFAC"
          opacity="0.55"
        />
        {/* Foreground Meadow Hill */}
        <path
          d="M0,165 Q420,115 820,160 T1440,145 L1440,220 L0,220 Z"
          fill="#4ADE80"
          opacity="0.45"
        />
        {/* Playful Dirt Adventure Path */}
        <path
          d="M 650 220 Q 710 175 720 150 Q 735 175 790 220 Z"
          fill="#FDE68A"
          opacity="0.6"
        />
        {/* Cute Elementary School Building on Center Horizon */}
        <g transform="translate(665, 78)" opacity="0.55">
          {/* Main Building */}
          <rect x="12" y="28" width="86" height="48" rx="6" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="3" />
          {/* Red SD Roof (Segitiga/Trapesium) */}
          <polygon points="4,30 55,2 106,30" fill="#FB7185" stroke="#E11D48" strokeWidth="3" strokeLinejoin="round" />
          {/* School Clock (Lingkaran) */}
          <circle cx="55" cy="19" r="7" fill="#FFFFFF" stroke="#0284C7" strokeWidth="2.5" />
          {/* School Door & Windows (Persegi & Persegi Panjang) */}
          <rect x="46" y="48" width="18" height="28" rx="3" fill="#38BDF8" />
          <rect x="22" y="42" width="14" height="14" rx="2" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2" />
          <rect x="74" y="42" width="14" height="14" rx="2" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2" />
        </g>
        {/* Cute Rounded Trees */}
        <g transform="translate(90, 95)" opacity="0.5">
          <rect x="20" y="42" width="10" height="28" rx="3" fill="#B45309" />
          <circle cx="25" cy="30" r="24" fill="#22C55E" />
          <circle cx="15" cy="36" r="16" fill="#4ADE80" />
        </g>
        <g transform="translate(1290, 85)" opacity="0.5">
          <rect x="20" y="42" width="10" height="28" rx="3" fill="#B45309" />
          <circle cx="25" cy="30" r="24" fill="#22C55E" />
          <circle cx="35" cy="36" r="16" fill="#4ADE80" />
        </g>
      </svg>
    </div>
  );
};

/**
 * 5. WOODEN / COLORFUL ADVENTURE SIGNBOARD
 */
export const AdventureMissionSign: React.FC<{
  badge: string;
  title: string;
  subtitle?: string;
  onClick?: () => void;
}> = ({ badge, title, subtitle, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-gradient-to-b from-amber-300 to-amber-400 border-2 border-amber-600 shadow-[0_4px_0_#B45309] text-slate-950 ${
        onClick ? 'cursor-pointer btn-3d' : ''
      }`}
    >
      <span className="px-2.5 py-1 rounded-xl bg-amber-950 text-amber-200 font-display font-bold text-xs tracking-wide">
        {badge}
      </span>
      <div className="text-left">
        <div className="font-display font-bold text-sm sm:text-base leading-tight">
          {title}
        </div>
        {subtitle && (
          <div className="text-xs font-semibold text-amber-950/80 leading-tight">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 6. FLOATING Geometric Mascot Parade Row
 */
export const GeometricMascotParade: React.FC<{ size?: number }> = ({
  size = 54,
}) => {
  return (
    <div className="flex items-center justify-center gap-4">
      <div className="animate-float-slow">
        <ShapeMascot3D shape="lingkaran" size={size} />
      </div>
      <div className="animate-float-slow" style={{ animationDelay: '0.4s' }}>
        <ShapeMascot3D shape="segitiga" size={size} />
      </div>
      <div className="animate-float-slow" style={{ animationDelay: '0.8s' }}>
        <ShapeMascot3D shape="persegi" size={size} />
      </div>
      <div className="animate-float-slow" style={{ animationDelay: '1.2s' }}>
        <ShapeMascot3D shape="persegi_panjang" size={size} />
      </div>
    </div>
  );
};
