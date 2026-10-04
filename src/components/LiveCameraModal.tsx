import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, AlertCircle, Sparkles, Image as ImageIcon } from 'lucide-react';
import { playClickSound, playCameraSnapSound } from '../utils/sound.ts';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string, file: File) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileFallbackRef = useRef<HTMLInputElement | null>(null);

  // Stop current active stream
  const stopCurrentStream = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  // Initialize or restart camera stream
  useEffect(() => {
    if (!isOpen) {
      stopCurrentStream();
      return;
    }

    let isMounted = true;
    setIsInitializing(true);
    setCameraError(null);

    const startCamera = async () => {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isMounted) {
          setCameraError(
            'Kamera langsung tidak didukung di browser ini. Gunakan tombol kamera bawaan HP di bawah ya!'
          );
          setIsInitializing(false);
        }
        return;
      }

      try {
        // Stop any old stream first
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }

        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (isMounted) {
          setStream(newStream);
          if (videoRef.current) {
            videoRef.current.srcObject = newStream;
            videoRef.current.play().catch(() => {});
          }
          setIsInitializing(false);
        } else {
          newStream.getTracks().forEach((t) => t.stop());
        }
      } catch (err: any) {
        console.warn('getUserMedia error:', err);
        if (isMounted) {
          setIsInitializing(false);
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            setCameraError(
              'Izin kamera belum diaktifkan. Klik Izinkan (Allow) atau gunakan kamera bawaan HP.'
            );
          } else if (err.name === 'OverconstrainedError' && facingMode === 'environment') {
            // Try fallback to user facing
            setFacingMode('user');
          } else {
            setCameraError(
              'Tidak dapat membuka kamera belakang secara langsung. Silakan gunakan tombol kamera bawaan HP di bawah.'
            );
          }
        }
      }
    };

    startCamera();

    return () => {
      isMounted = false;
      stopCurrentStream();
    };
  }, [isOpen, facingMode]);

  // Flip camera between environment and user
  const handleToggleFacingMode = () => {
    playClickSound();
    stopCurrentStream();
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from video feed
  const handleCaptureSnapshot = () => {
    if (!videoRef.current || !stream) return;

    playCameraSnapSound();
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 960;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // If facing user, flip horizontally for mirror preview
    if (facingMode === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], `temuan_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          stopCurrentStream();
          onCapture(dataUrl, file);
        } else {
          stopCurrentStream();
          const fallbackFile = new File([], 'capture.jpg', { type: 'image/jpeg' });
          onCapture(dataUrl, fallbackFile);
        }
      },
      'image/jpeg',
      0.85
    );
  };

  // Fallback native input capture
  const handleNativeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    playClickSound();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      stopCurrentStream();
      onCapture(result, file);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-xl bg-slate-900 border-4 border-amber-400 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Flash Animation Overlay */}
        {flashActive && (
          <div className="absolute inset-0 z-40 bg-white pointer-events-none animate-ping" />
        )}

        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950/90 border-b-2 border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-bold flex items-center justify-center text-sm">
              <Camera className="w-4 h-4" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base sm:text-lg text-white">
                Kamera Real-Time Siswa
              </h3>
              <p className="text-[11px] text-amber-300 font-medium">
                {facingMode === 'environment' ? 'Kamera Belakang Aktif' : 'Kamera Depan Aktif'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 cursor-pointer text-xs font-bold flex items-center gap-1.5"
              title="Balik Kamera Depan/Belakang"
            >
              <RefreshCw className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Balik</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                stopCurrentStream();
                onClose();
              }}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-white border border-slate-700 cursor-pointer"
              title="Tutup Kamera"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Main Viewport */}
        <div className="relative flex-1 bg-black min-h-[300px] sm:min-h-[380px] flex items-center justify-center overflow-hidden">
          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${
              facingMode === 'user' ? 'scale-x-[-1]' : ''
            }`}
          />

          {/* Framing Target Brackets */}
          <div className="absolute inset-8 sm:inset-12 pointer-events-none flex flex-col justify-between border-2 border-dashed border-amber-400/60 rounded-3xl p-4">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
              <div className="w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
            </div>
            <div className="text-center">
              <span className="bg-slate-950/70 text-amber-300 text-xs sm:text-sm font-display font-bold px-3 py-1 rounded-full border border-amber-400/40 backdrop-blur-xs">
                Arahkan kamera ke bendamu
              </span>
            </div>
            <div className="flex justify-between">
              <div className="w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
              <div className="w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
            </div>
          </div>

          {/* Loading State */}
          {isInitializing && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 text-white">
              <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
              <p className="font-display font-bold text-base text-amber-300">
                Membuka Kamera Belakang...
              </p>
            </div>
          )}

          {/* Error / Fallback State */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/95 p-6 flex flex-col items-center justify-center text-center gap-4 z-20">
              <div className="w-14 h-14 rounded-2xl bg-amber-400/20 text-amber-400 flex items-center justify-center text-3xl">
                <AlertCircle className="w-8 h-8 text-amber-400" />
              </div>
              <div className="max-w-md">
                <h4 className="font-display font-bold text-lg text-white mb-1">
                  Kamera Langsung Tidak Tersedia
                </h4>
                <p className="text-xs sm:text-sm text-slate-300">{cameraError}</p>
              </div>

              <button
                type="button"
                onClick={() => fileFallbackRef.current?.click()}
                className="btn-3d px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-base flex items-center gap-2 shadow-[0_4px_0_#B45309] cursor-pointer"
              >
                <Camera className="w-5 h-5 text-slate-950" />
                <span>Buka Kamera Bawaan HP</span>
              </button>
            </div>
          )}
        </div>

        {/* Hidden fallback file input */}
        <input
          ref={fileFallbackRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleNativeFileChange}
          className="hidden"
        />

        {/* Bottom Shutter Controls */}
        <div className="px-5 py-4 bg-slate-950 border-t-2 border-slate-800 flex items-center justify-between gap-4">
          {/* Gallery / Native Fallback Button */}
          <button
            type="button"
            onClick={() => fileFallbackRef.current?.click()}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-2 cursor-pointer text-xs font-bold"
            title="Gunakan Kamera Bawaan atau Unggah Foto"
          >
            <ImageIcon className="w-5 h-5 text-sky-400" />
            <span className="hidden sm:inline">Kamera Bawaan / Galeri</span>
          </button>

          {/* Central Big Shutter Button */}
          <button
            type="button"
            disabled={isInitializing || !!cameraError}
            onClick={handleCaptureSnapshot}
            className="group relative flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Jepret Foto"
          >
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-amber-400 p-1 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-transform group-hover:scale-105 active:scale-95">
              <div className="w-full h-full rounded-full bg-gradient-to-tr from-amber-400 to-amber-300 flex items-center justify-center text-slate-950 shadow-inner">
                <Camera className="w-8 h-8 text-slate-950" />
              </div>
            </div>
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              stopCurrentStream();
              onClose();
            }}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1.5 cursor-pointer text-xs font-bold"
          >
            <X className="w-5 h-5 text-rose-400" />
            <span className="hidden sm:inline">Batal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
