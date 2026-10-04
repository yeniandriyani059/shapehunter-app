import React, { useState } from 'react';
import { ShapeType } from '../types/game.ts';

interface ShapeMascotProps {
  shape: ShapeType;
  size?: number;
  className?: string;
}

export const ShapeMascot3D: React.FC<ShapeMascotProps> = ({
  shape,
  size = 56,
  className = '',
}) => {
  if (shape === 'lingkaran') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`shrink-0 select-none ${className}`}
        aria-label="Maskot Boni Lingkaran"
      >
        <defs>
          <radialGradient id="circleGrad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="65%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="54" r="38" fill="#075985" opacity="0.25" />
        <circle cx="50" cy="48" r="38" fill="url(#circleGrad)" stroke="#FFFFFF" strokeWidth="4" />
        <ellipse cx="36" cy="30" rx="12" ry="6" fill="#FFFFFF" opacity="0.45" transform="rotate(-20 36 30)" />
        {/* Cute Eyes */}
        <circle cx="37" cy="46" r="5.5" fill="#0F172A" />
        <circle cx="63" cy="46" r="5.5" fill="#0F172A" />
        <circle cx="35" cy="44" r="2" fill="#FFFFFF" />
        <circle cx="61" cy="44" r="2" fill="#FFFFFF" />
        {/* Cheeks & Smile */}
        <ellipse cx="29" cy="53" rx="4.5" ry="2.5" fill="#FDA4AF" opacity="0.8" />
        <ellipse cx="71" cy="53" rx="4.5" ry="2.5" fill="#FDA4AF" opacity="0.8" />
        <path d="M 41 54 Q 50 63 59 54" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  if (shape === 'segitiga') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`shrink-0 select-none ${className}`}
        aria-label="Maskot Tio Segitiga"
      >
        <defs>
          <linearGradient id="triGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FBBF24" />
            <stop offset="65%" stopColor="#D97706" />
            <stop offset="100%" stopColor="#B45309" />
          </linearGradient>
        </defs>
        <polygon points="50,16 88,84 12,84" fill="#78350F" opacity="0.25" transform="translate(0, 5)" />
        <polygon
          points="50,14 88,82 12,82"
          fill="url(#triGrad)"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        {/* Cute Eyes */}
        <circle cx="40" cy="58" r="5" fill="#0F172A" />
        <circle cx="60" cy="58" r="5" fill="#0F172A" />
        <circle cx="38.5" cy="56" r="1.8" fill="#FFFFFF" />
        <circle cx="58.5" cy="56" r="1.8" fill="#FFFFFF" />
        {/* Smile */}
        <path d="M 43 66 Q 50 73 57 66" fill="none" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (shape === 'persegi') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`shrink-0 select-none ${className}`}
        aria-label="Maskot Koko Persegi"
      >
        <defs>
          <linearGradient id="sqGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34D399" />
            <stop offset="65%" stopColor="#059669" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        <rect x="16" y="20" width="68" height="68" rx="14" fill="#064E3B" opacity="0.25" />
        <rect
          x="16"
          y="15"
          width="68"
          height="68"
          rx="14"
          fill="url(#sqGrad)"
          stroke="#FFFFFF"
          strokeWidth="4"
        />
        <rect x="24" y="22" width="24" height="6" rx="3" fill="#FFFFFF" opacity="0.4" />
        {/* Cute Eyes */}
        <circle cx="37" cy="46" r="5.5" fill="#0F172A" />
        <circle cx="63" cy="46" r="5.5" fill="#0F172A" />
        <circle cx="35" cy="44" r="2" fill="#FFFFFF" />
        <circle cx="61" cy="44" r="2" fill="#FFFFFF" />
        {/* Smile */}
        <path d="M 40 57 Q 50 65 60 57" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={`shrink-0 select-none ${className}`}
      aria-label="Maskot Raka Persegi Panjang"
    >
      <defs>
        <linearGradient id="rectGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB7185" />
          <stop offset="65%" stopColor="#E11D48" />
          <stop offset="100%" stopColor="#BE123C" />
        </linearGradient>
      </defs>
      <rect x="8" y="28" width="84" height="52" rx="12" fill="#881337" opacity="0.25" />
      <rect
        x="8"
        y="23"
        width="84"
        height="52"
        rx="12"
        fill="url(#rectGrad)"
        stroke="#FFFFFF"
        strokeWidth="4"
      />
      <rect x="18" y="30" width="32" height="5" rx="2.5" fill="#FFFFFF" opacity="0.4" />
      {/* Cute Eyes */}
      <circle cx="35" cy="46" r="5.2" fill="#0F172A" />
      <circle cx="65" cy="46" r="5.2" fill="#0F172A" />
      <circle cx="33.5" cy="44" r="1.8" fill="#FFFFFF" />
      <circle cx="63.5" cy="44" r="1.8" fill="#FFFFFF" />
      {/* Smile */}
      <path d="M 41 56 Q 50 63 59 56" fill="none" stroke="#FFFFFF" strokeWidth="3.8" strokeLinecap="round" />
    </svg>
  );
};

interface GameAssetImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const GameAssetImage: React.FC<GameAssetImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-sky-100 via-amber-50 to-emerald-100 text-slate-700 p-3 text-center select-none ${className}`}
      >
        <ShapeMascot3D shape="lingkaran" size={42} />
        <span className="mt-1.5 text-xs font-semibold line-clamp-1">
          {fallbackLabel || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`select-none ${className}`}
    />
  );
};
