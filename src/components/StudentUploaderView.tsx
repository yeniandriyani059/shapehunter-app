import React, { useState, useRef } from 'react';
import {
  Camera,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  FullSessionState,
  ShapeType,
  Discovery,
  SHAPE_LIST,
  SHAPE_DEFINITIONS,
  formatCampDisplayName,
} from '../types/game.ts';
import { ShapeMascot3D, GameAssetImage } from './ShapeMascot3D.tsx';
import { CharacterGuide, TeamCampBadge } from './GameAssets3D.tsx';
import { ProveModal } from './ProveModal.tsx';
import { LiveCameraModal } from './LiveCameraModal.tsx';
import { analyzeShapeClientSide } from '../utils/shapeDetector.ts';
import { addDiscoveryToState } from '../utils/gameStore.ts';
import {
  playClickSound,
  playPhotoIncomingSound,
} from '../utils/sound.ts';

interface StudentUploaderViewProps {
  state: FullSessionState;
  onDiscoveryUploaded: (newState: FullSessionState) => void;
  onJoinSessionByCode: (code: string) => Promise<void>;
  onSwitchToPid: () => void;
  onSwitchToHome?: () => void;
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 720;
        const maxH = 540;
        let w = img.width;
        let h = img.height;
        if (w > maxW || h > maxH) {
          const ratio = Math.min(maxW / w, maxH / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const StudentUploaderView: React.FC<StudentUploaderViewProps> = ({
  state,
  onDiscoveryUploaded,
  onSwitchToPid,
  onSwitchToHome,
}) => {
  const { session, groups, discoveries } = state;

  const [selectedGroupId, setSelectedGroupId] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('shape_hunter_student_group_id');
      const parsed = saved ? parseInt(saved, 10) : NaN;
      if (!isNaN(parsed) && groups.some((g) => g.id === parsed)) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return groups[0]?.id || 1;
  });
  const [studentName, setStudentName] = useState('');
  const [objectName, setObjectName] = useState('');
  const [expectedShape, setExpectedShape] = useState<ShapeType>('lingkaran');
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [provingDiscovery, setProvingDiscovery] = useState<Discovery | null>(
    null
  );
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCaptureFromLiveCamera = (dataUrl: string, file: File) => {
    setHintMsg(null);
    setPhotoPreview(dataUrl);
    setRawFile(file);
    setIsCameraModalOpen(false);

    // Instant client-side shape analysis
    analyzeShapeClientSide(dataUrl).then((res) => {
      if (res.namaBenda && (!objectName || objectName === 'Temuan Hebatku')) {
        setObjectName(res.namaBenda);
      }
      setExpectedShape(res.realShape);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    playClickSound();
    setHintMsg(null);
    setRawFile(file);
    try {
      const compressedDataUrl = await compressImageFile(file);
      setPhotoPreview(compressedDataUrl);

      // Instant client-side shape analysis
      analyzeShapeClientSide(compressedDataUrl).then((res) => {
        if (res.namaBenda && (!objectName || objectName === 'Temuan Hebatku')) {
          setObjectName(res.namaBenda);
        }
        setExpectedShape(res.realShape);
      });
    } catch {
      setHintMsg('Yuk coba ambil foto sekali lagi!');
    }
  };

  const handleSubmitDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoPreview || !objectName.trim()) {
      setHintMsg('Ambil foto benda dan beri namanya dulu ya, Petualang!');
      return;
    }

    setUploading(true);
    setHintMsg(null);
    setUploadSuccess(null);

    try {
      // Analyze shape client-side (intelligent computer vision / Gemini client)
      const aiResult = await analyzeShapeClientSide(photoPreview);
      const finalObjectName = objectName.trim() || aiResult.namaBenda || 'Benda Temuan';

      // Store in client-side state
      const { newState } = addDiscoveryToState(state, {
        groupId: selectedGroupId,
        studentName: studentName.trim() || 'Petualang Cilik',
        objectName: finalObjectName,
        photoUrl: photoPreview,
        expectedShape,
        realShape: aiResult.realShape,
        studentClaimedShape: expectedShape,
      });

      playPhotoIncomingSound();
      const targetGroup = groups.find((g) => g.id === selectedGroupId);
      setUploadSuccess(
        `HEBAT! Kartu "${finalObjectName}" (${aiResult.realShape.toUpperCase()}) sudah terbang ke Kemah ${
          targetGroup ? formatCampDisplayName(targetGroup.name) : 'Timmu'
        }!`
      );
      setObjectName('');
      setPhotoPreview('');
      setRawFile(null);
      onDiscoveryUploaded(newState);
    } catch (err: any) {
      setHintMsg(err.message || 'Coba kirim sekali lagi ya!');
    } finally {
      setUploading(false);
    }
  };

  const teamDiscoveries = discoveries.filter(
    (d) => d.groupId === selectedGroupId
  );

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-4 py-5 flex flex-col gap-6">
      {/* Active Mission Live Status Banner */}
      <div className="rounded-2xl bg-slate-900/90 text-white px-4 py-2.5 border-2 border-amber-400 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-display font-black flex items-center justify-center text-xs shrink-0">
            {session.currentLevel === 1 ? 'M1' : session.currentLevel === 2 ? 'M2' : 'M3'}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block">
              Misi Kelas Aktif
            </span>
            <p className="font-display font-bold text-sm text-white truncate">
              {session.currentLevel === 1
                ? 'Misi 1: Kelompokkan Bentuk ke Pulau'
                : session.currentLevel === 2
                ? 'Misi 2: Detektif Bentuk — Buktikan Ciri Sisi & Sudut'
                : 'Misi 3: Peta Harta Karun — Ekspedisi Sekolah'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onSwitchToHome && (
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onSwitchToHome();
              }}
              className="btn-3d px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-display font-bold text-xs whitespace-nowrap cursor-pointer"
            >
              Beranda
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onSwitchToPid();
            }}
            className="btn-3d px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-xs whitespace-nowrap shadow-[0_2px_0_#B45309] cursor-pointer"
          >
            Arena Kemah
          </button>
        </div>
      </div>

      {/* Luna Explorer Guide Header */}
      <div className="rounded-[28px] bg-white/95 border-4 border-sky-400 shadow-[0_8px_0_#38BDF8] p-5 flex flex-col gap-4">
        <CharacterGuide
          character="luna"
          mood={uploadSuccess ? 'celebrating' : 'cheerful'}
          message={
            uploadSuccess ||
            SHAPE_DEFINITIONS[expectedShape].lunaPrompt
          }
        />

        {uploadSuccess && (
          <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-50 border-2 border-emerald-400 rounded-2xl p-3.5 animate-pop-in">
            <div className="font-display text-base font-bold text-emerald-950">
              +2 XP! {uploadSuccess}
            </div>
            <button
              type="button"
              onClick={onSwitchToPid}
              className="btn-3d px-4 py-2 rounded-2xl bg-emerald-500 text-white font-display font-bold text-sm shadow-[0_4px_0_#047857]"
            >
              Mainkan di Kemah Sekarang!
            </button>
          </div>
        )}

        {hintMsg && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-amber-950 font-display font-bold text-sm">
            {hintMsg}
          </div>
        )}

        <form onSubmit={handleSubmitDiscovery} className="flex flex-col gap-5">
          {/* 1. Pilih Kemah Timmu */}
          <div>
            <label className="block font-display text-lg font-bold text-slate-900 mb-2.5">
              1. Pilih Kemah Timmu:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {groups.map((g) => {
                const isSelected = selectedGroupId === g.id;
                const dotBg =
                  g.color === 'blue'
                    ? 'bg-blue-500'
                    : g.color === 'emerald'
                    ? 'bg-emerald-500'
                    : g.color === 'amber'
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setSelectedGroupId(g.id);
                      try {
                        localStorage.setItem('shape_hunter_student_group_id', String(g.id));
                      } catch {
                        // ignore
                      }
                    }}
                    className={`btn-3d p-3.5 rounded-3xl border-3 text-left flex items-center gap-3.5 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-300/60 shadow-[0_5px_0_#F59E0B]'
                        : 'border-slate-200 bg-white shadow-[0_4px_0_#CBD5E1]'
                    }`}
                  >
                    <TeamCampBadge color={g.color} size={46} />
                    <div className="min-w-0">
                      <div className="font-display text-lg font-bold text-slate-900 truncate flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full ${dotBg} shrink-0`} />
                        <span>{formatCampDisplayName(g.name)}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-500">
                        Ketuk untuk memilih kemah ini
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Potret Benda */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block font-display text-lg font-bold text-slate-900">
                2. Potret Benda di Sekitarmu:
              </label>
            </div>

            {/* Petunjuk Lokasi Pencarian Sekolah */}
            <div className="mb-3 rounded-2xl bg-amber-50 border-2 border-amber-300 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="font-bold text-amber-950">
                Petunjuk Lokasi Sekolah:
              </div>
              <div className="flex items-center gap-1.5 flex-wrap text-amber-900 font-semibold">
                <span className="bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                  Kelas (jam, buku, ubin)
                </span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                  Taman (pot, dedaunan)
                </span>
                <span className="bg-white px-2 py-0.5 rounded-lg border border-amber-200">
                  Lapangan (roda, cone)
                </span>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {!photoPreview ? (
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setIsCameraModalOpen(true);
                  }}
                  className="btn-3d w-full py-7 px-6 rounded-3xl bg-gradient-to-b from-sky-400 via-sky-500 to-sky-600 hover:from-sky-300 hover:to-sky-500 text-white border-4 border-sky-300 shadow-[0_8px_0_#0369A1] font-display text-xl sm:text-2xl font-bold flex flex-col sm:flex-row items-center justify-center gap-3.5 cursor-pointer"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/50 flex items-center justify-center shrink-0 shadow-inner">
                    <Camera className="w-9 h-9 text-white animate-pulse" />
                  </div>
                  <div className="text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <span>Ambil Foto Kamera (Real-Time)</span>
                      <span className="bg-amber-400 text-slate-950 text-xs px-2 py-0.5 rounded-full font-bold">
                        Belakang
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-white/90 font-sans mt-0.5">
                      Buka jendela kamera langsung untuk membidik benda di lingkungan sekolah!
                    </div>
                  </div>
                </button>

                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-slate-400 font-semibold">atau</span>
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      fileInputRef.current?.click();
                    }}
                    className="text-xs font-bold text-sky-600 hover:text-sky-700 underline cursor-pointer"
                  >
                    Gunakan Kamera Bawaan HP / Pilih dari Galeri
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3.5">
                <div className="relative rounded-3xl overflow-hidden border-4 border-amber-400 shadow-lg bg-slate-900 aspect-4/3 max-h-72 w-full max-w-md mx-auto">
                  <img
                    src={photoPreview}
                    alt="Pratinjau Temuanmu"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-3 right-3 bg-amber-400 text-slate-950 font-display font-bold text-xs px-3 py-1.5 rounded-full shadow-md">
                    <span>Foto Siap!</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setIsCameraModalOpen(true);
                    }}
                    className="btn-3d px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-500 font-display text-sm font-bold flex items-center gap-2 shadow-[0_3px_0_#B45309] cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-slate-950" />
                    <span>Buka Kamera Lagi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      fileInputRef.current?.click();
                    }}
                    className="btn-3d px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-300 font-display text-sm font-bold flex items-center gap-2 shadow-[0_3px_0_#CBD5E1] cursor-pointer"
                  >
                    <span>Pilih dari Perangkat</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Nama Benda & Nama Petualang */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-display text-base font-bold text-slate-800 mb-1.5">
                Nama Benda Temuanmu:
              </label>
              <input
                type="text"
                required
                value={objectName}
                onChange={(e) => setObjectName(e.target.value)}
                placeholder="Contoh: Jam Dinding Kelas"
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-300 font-display text-base font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block font-display text-base font-bold text-slate-800 mb-1.5">
                Nama Petualang:
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Contoh: Budi & Siti"
                className="w-full px-4 py-3 rounded-2xl border-2 border-slate-300 font-display text-base font-bold focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* 4. Pilih Tebakan Bentuknya */}
          <div>
            <label className="block font-display text-lg font-bold text-slate-900 mb-1">
              3. Tebakan Bentukmu: (Menurutmu apa bentuk benda ini?)
            </label>
            <p className="text-xs text-slate-500 mb-2.5">
              Pilih tebakan awalmu, lalu sistem AI dan Guru akan memverifikasi bentuk aslinya!
            </p>
            <div className="grid grid-cols-2 gap-3">
              {SHAPE_LIST.map((shapeDef) => {
                const active = expectedShape === shapeDef.id;
                return (
                  <button
                    key={shapeDef.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setExpectedShape(shapeDef.id);
                    }}
                    className={`btn-3d p-3.5 rounded-3xl border-3 flex items-center gap-3 text-left ${
                      active
                        ? 'border-amber-500 bg-amber-50 ring-4 ring-amber-300/60 shadow-[0_5px_0_#F59E0B]'
                        : 'border-slate-200 bg-white shadow-[0_4px_0_#CBD5E1]'
                    }`}
                  >
                    <ShapeMascot3D shape={shapeDef.id} size={46} />
                    <div className="min-w-0">
                      <div className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                        {shapeDef.symbol} {shapeDef.upperName}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 truncate">
                        {shapeDef.shortRule}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading}
            className="btn-3d w-full py-4 px-6 rounded-[24px] bg-gradient-to-b from-emerald-400 to-emerald-600 text-white border-2 border-emerald-300 shadow-[0_6px_0_#047857] font-display text-xl font-bold flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
          >
            <Send className="w-6 h-6" />
            <span>
              {uploading
                ? 'MENGIRIM KARTU TEMUAN...'
                : 'KIRIM TEMUANMU KE KEMAH!'}
            </span>
          </button>
        </form>
      </div>

      {/* Buku Koleksi Temuan Tim */}
      <div className="rounded-[28px] bg-white/95 border-4 border-amber-400 shadow-[0_8px_0_#FBBF24] p-5">
        <h2 className="font-display text-xl font-bold text-slate-900 mb-3">
          Koleksi Kartu Temuan Kemah ({teamDiscoveries.length} Kartu)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {teamDiscoveries.map((disc) => {
            const shapeKey = (disc.realShape || disc.expectedShape) as ShapeType;
            const shapeDef =
              SHAPE_DEFINITIONS[shapeKey] ||
              SHAPE_DEFINITIONS.lingkaran;
            return (
              <div
                key={disc.id}
                onClick={() => {
                  playClickSound();
                  setProvingDiscovery(disc);
                }}
                className={`rounded-3xl border-3 ${
                  disc.traitsVerified
                    ? 'border-amber-400 bg-amber-50/60 ring-2 ring-amber-300'
                    : 'border-slate-200 bg-white hover:-translate-y-1'
                } p-2.5 shadow-[0_5px_0_#CBD5E1] flex flex-col justify-between cursor-pointer transition-transform`}
                title="Ketuk untuk membuktikan ciri bentuk!"
              >
                <div className="relative aspect-4/3 rounded-2xl overflow-hidden bg-slate-100 mb-2">
                  <GameAssetImage
                    src={disc.photoUrl}
                    alt={disc.objectName}
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded-xl bg-slate-900/80 text-white font-display font-bold text-[11px]">
                    {shapeDef.symbol} {shapeDef.name}
                  </span>
                  {disc.traitsVerified && (
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 font-display font-bold text-[10px] shadow-sm">
                      Terbukti
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <div className="font-display text-sm font-bold text-slate-900 truncate">
                    {disc.objectName}
                  </div>
                  <div className="text-xs font-bold mt-0.5">
                    {disc.traitsVerified ? (
                      <span className="text-emerald-700">Terbukti</span>
                    ) : disc.isLocked ? (
                      <span className="text-sky-700">Ketuk Buktikan</span>
                    ) : (
                      <span className="text-slate-500">Siap Dimainkan</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={handleCaptureFromLiveCamera}
      />

      {/* ProveModal Pop-Up for Students */}
      {provingDiscovery && (
        <ProveModal
          isOpen={!!provingDiscovery}
          onClose={() => setProvingDiscovery(null)}
          discovery={provingDiscovery}
          sessionId={session.id}
          groupId={selectedGroupId}
          guideCharacter="luna"
          onProvedSuccess={(newState) => {
            onDiscoveryUploaded(newState);
            const updated = newState.discoveries?.find(
              (d: Discovery) => d.id === provingDiscovery.id
            );
            if (updated) {
              setProvingDiscovery(updated);
            }
          }}
        />
      )}
    </div>
  );
};
