export type ShapeType = 'lingkaran' | 'segitiga' | 'persegi' | 'persegi_panjang';

export interface GameSession {
  id: number;
  code: string;
  title: string;
  teacherUid: string | null;
  status: 'waiting' | 'playing' | 'paused' | 'ended';
  currentLevel: number; // 1 = Misi 1 — Kelompokkan!, 2 = Misi 2 — Buktikan!, 3 = Misi 3 — Jelajah!
  timerDurationSeconds: number;
  timerRemainingSeconds: number;
  activeGroupCount?: number; // 2, 3, or 4 active camps
  missionTitle: string;
  missionTargetShape: string;
  missionTargetCount: number;
  createdAt: string;
}

export interface Group {
  id: number;
  sessionId: number;
  name: string;
  color: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple' | string;
  mascot: string;
  arenaSlot: number;
  createdAt: string;
}

export interface AnnotationMarker {
  x: number; // percentage 0..100
  y: number; // percentage 0..100
  type: 'sudut' | 'sisi';
}

export interface Discovery {
  id: number;
  sessionId: number;
  groupId: number;
  studentName: string;
  objectName: string;
  photoUrl: string;
  realShape?: ShapeType | null; // Real key answer (detected by Gemini AI or corrected by Teacher)
  studentClaimedShape?: ShapeType | null; // Initial guess selected by student in form
  expectedShape: ShapeType;
  classifiedShape: ShapeType | null;
  island?: ShapeType | null; // Target shape island where the card has been dropped
  targetShape?: ShapeType | null; // Shape island placement
  isLocked: boolean;
  annotationsJson: string;
  traitsVerified: boolean;
  isProven?: boolean;
  xp?: number;
  createdAt: string;
}

export interface GameAttempt {
  id: number;
  sessionId: number;
  groupId: number;
  discoveryId: number;
  selectedShape: ShapeType;
  isCorrect: boolean;
  levelAtAttempt: number;
  pointsAwarded: number;
  bonusAwarded: number;
  reasonText: string | null;
  createdAt: string;
}

export interface GroupScore {
  id: number;
  sessionId: number;
  groupId: number;
  xp: number;
  totalDiscoveries: number;
  correctCount: number;
  attemptCount: number;
  bonusPoints: number;
  accuracy: number;
  updatedAt: string;
}

export interface FullSessionState {
  session: GameSession;
  groups: Group[];
  discoveries: Discovery[];
  scores: GroupScore[];
  attempts: GameAttempt[];
}

export const GAME_ASSETS = {
  heroBanner: '/assets/images/hero_shape_hunters_3d_1790776655817.jpg',
  rakaExplorer: '/assets/images/mascot_kapten_geo_3d_1790776671881.jpg',
  lunaExplorer: '/assets/images/mascot_putri_prisma_3d_1790776685529.jpg',
  kaptenGeo: '/assets/images/mascot_kapten_geo_3d_1790776671881.jpg',
  putriPrisma: '/assets/images/mascot_putri_prisma_3d_1790776685529.jpg',
  treasureChest: '/assets/images/treasure_chest_badge_3d_1790776698230.jpg',
} as const;

export interface MissionLevelInfo {
  level: number;
  badgeText: string;
  title: string;
  shortLabel: string;
  storySteps: string[];
  lunaQuote: string;
  rakaQuote: string;
}

export const MISSION_LEVELS: Record<number, MissionLevelInfo> = {
  1: {
    level: 1,
    badgeText: 'Misi 1',
    title: 'Misi 1 — Kelompokkan!',
    shortLabel: 'Misi 1 — Kelompokkan!',
    storySteps: [
      'Cari benda nyata di sekitar sekolah.',
      'Foto temuanmu dengan kamera.',
      'Masukkan kartu foto ke pulau bentuk yang tepat!',
    ],
    lunaQuote: 'Yuk, seret kartu fotomu ke pulau bentuk yang cocok!',
    rakaQuote: 'Amati tepi bendanya baik-baik ya, Petualang!',
  },
  2: {
    level: 2,
    badgeText: 'Misi 2',
    title: 'Misi 2 — Buktikan!',
    shortLabel: 'Misi 2 — Buktikan!',
    storySteps: [
      'Pilih pulau bentuk untuk kartu fotomu.',
      'Sentuh pojok sudut atau sisi pada foto untuk membuktikannya.',
      'Kumpulkan poin pembuktian untuk kemahmu!',
    ],
    lunaQuote: 'Sentuh pojok dan tepi benda di foto untuk bukti hebat!',
    rakaQuote: 'Hitung jumlah sudutnya, lalu tekan Cek Jawaban!',
  },
  3: {
    level: 3,
    badgeText: 'Misi 3',
    title: 'Misi 3 — Kuali Ramuan Ajaib',
    shortLabel: 'Misi 3 — Kuali Ajaib',
    storySteps: [
      'Amati Buku Resep Sang Guru: butuh masing-masing 2 bentuk seimbang.',
      'Seret atau ketuk kartu foto dari Kantong Bahan ke dalam Kuali Ajaib.',
      'Lengkapi ke-8 bahan resep untuk memecahkan gembok Peti Harta Karun!',
    ],
    lunaQuote: 'Yuk masukkan bahan bentuk yang tepat ke kuali ajaib!',
    rakaQuote: 'Awas! Kuali akan menolak bentuk yang sudah lengkap (2/2)!',
  },
};

export interface ShapeDefinition {
  id: ShapeType;
  symbol: string;
  name: string;
  upperName: string;
  mascotName: string;
  islandName: string;
  shortRule: string;
  hintMessage: string;
  lunaPrompt: string;
  sidesCount: number;
  cornersCount: number;
  correctTraitOption: string;
  portalBg: string;
  portalBorder: string;
  portalShadow: string;
  portalRing: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  accentHex: string;
  examples: string[];
}

export const SHAPE_DEFINITIONS: Record<ShapeType, ShapeDefinition> = {
  lingkaran: {
    id: 'lingkaran',
    symbol: '○',
    name: 'Lingkaran',
    upperName: 'LINGKARAN',
    mascotName: 'Boni Lingkaran',
    islandName: 'Pulau Lingkaran',
    shortRule: 'Melengkung bulat · Tanpa pojok',
    hintMessage:
      'Coba amati lagi! Lingkaran itu bulat melengkung penuh dan tidak punya pojok lancip.',
    lunaPrompt: 'Yuk, cari benda bulat seperti jam dinding atau roda!',
    sidesCount: 1,
    cornersCount: 0,
    correctTraitOption: 'Memiliki 1 sisi lengkung dan 0 sudut',
    portalBg: 'from-sky-100 via-sky-50 to-white',
    portalBorder: 'border-sky-400',
    portalShadow: 'shadow-[0_6px_0_#38BDF8]',
    portalRing: 'bg-sky-500 text-white',
    bgClass: 'bg-sky-50',
    borderClass: 'border-sky-300',
    textClass: 'text-sky-900',
    accentHex: '#0284C7',
    examples: ['Jam Dinding', 'Roda Sepeda', 'Koin Logam', 'Piring Makan'],
  },
  segitiga: {
    id: 'segitiga',
    symbol: '△',
    name: 'Segitiga',
    upperName: 'SEGITIGA',
    mascotName: 'Tio Segitiga',
    islandName: 'Pulau Segitiga',
    shortRule: '3 sisi lurus · 3 pojok sudut',
    hintMessage:
      'Hitung pojoknya yuk! Segitiga selalu punya 3 garis lurus dan 3 pojok sudut.',
    lunaPrompt: 'Coba cari benda dengan 3 pojok seperti atap atau penggaris segitiga!',
    sidesCount: 3,
    cornersCount: 3,
    correctTraitOption: 'Memiliki 3 sisi lurus dan 3 titik sudut',
    portalBg: 'from-amber-100 via-amber-50 to-white',
    portalBorder: 'border-amber-400',
    portalShadow: 'shadow-[0_6px_0_#FBBF24]',
    portalRing: 'bg-amber-500 text-slate-950',
    bgClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-900',
    accentHex: '#D97706',
    examples: ['Penggaris Segitiga', 'Atap Rumah', 'Rambu Peringatan', 'Potongan Pizza'],
  },
  persegi: {
    id: 'persegi',
    symbol: '□',
    name: 'Persegi',
    upperName: 'PERSEGI',
    mascotName: 'Koko Persegi',
    islandName: 'Pulau Persegi',
    shortRule: '4 sisi sama panjang · 4 pojok',
    hintMessage:
      'Perhatikan panjang sisinya! Persegi punya 4 sisi yang semuanya sama panjang seperti ubin.',
    lunaPrompt: 'Yuk, cari benda kotak yang keempat sisinya sama panjang!',
    sidesCount: 4,
    cornersCount: 4,
    correctTraitOption: 'Memiliki 4 sisi yang sama panjang dan 4 sudut',
    portalBg: 'from-emerald-100 via-emerald-50 to-white',
    portalBorder: 'border-emerald-400',
    portalShadow: 'shadow-[0_6px_0_#34D399]',
    portalRing: 'bg-emerald-500 text-white',
    bgClass: 'bg-emerald-50',
    borderClass: 'border-emerald-300',
    textClass: 'text-emerald-900',
    accentHex: '#059669',
    examples: ['Ubin Lantai', 'Jendela Kotak', 'Papan Catur', 'Sapu Tangan'],
  },
  persegi_panjang: {
    id: 'persegi_panjang',
    symbol: '▭',
    name: 'Persegi Panjang',
    upperName: 'PERSEGI PANJANG',
    mascotName: 'Raka Persegi Panjang',
    islandName: 'Pulau Persegi Panjang',
    shortRule: 'Kotak memanjang · 4 pojok',
    hintMessage:
      'Lihat bentuknya! Persegi Panjang punya 4 pojok, tapi bentuknya lebih memanjang seperti papan tulis atau pintu.',
    lunaPrompt: 'Cari benda kotak yang memanjang seperti buku atau papan tulis!',
    sidesCount: 4,
    cornersCount: 4,
    correctTraitOption: 'Memiliki 4 sisi (2 pasang sama panjang) dan 4 sudut',
    portalBg: 'from-rose-100 via-rose-50 to-white',
    portalBorder: 'border-rose-400',
    portalShadow: 'shadow-[0_6px_0_#FB7185]',
    portalRing: 'bg-rose-500 text-white',
    bgClass: 'bg-rose-50',
    borderClass: 'border-rose-300',
    textClass: 'text-rose-900',
    accentHex: '#E11D48',
    examples: ['Papan Tulis', 'Buku Tulis', 'Pintu Kelas', 'Meja Guru'],
  },
};

export const SHAPE_LIST: ShapeDefinition[] = [
  SHAPE_DEFINITIONS.lingkaran,
  SHAPE_DEFINITIONS.segitiga,
  SHAPE_DEFINITIONS.persegi,
  SHAPE_DEFINITIONS.persegi_panjang,
];

/**
 * Formats a group name into child-friendly adventure camp name
 * e.g. "Kelompok 1 · Harimau Biru" -> "HARIMAU BIRU"
 */
export function formatCampDisplayName(rawName: string): string {
  if (rawName.includes('·')) {
    return rawName.split('·')[1].trim().toUpperCase();
  }
  return rawName.toUpperCase();
}
