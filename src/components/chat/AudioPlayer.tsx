import { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  src: string;
  messageId: string;
  isFromMe: boolean;
}

const BAR_COUNT = 32;

function seedRandom(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
    h = Math.imul(h ^ (h >>> 13), 0x45d9f3b);
    h = (h ^ (h >>> 16)) >>> 0;
    return (h % 100) / 100;
  };
}

function generateBars(messageId: string): number[] {
  const rng = seedRandom(messageId);
  return Array.from({ length: BAR_COUNT }, () => 0.15 + rng() * 0.85);
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({ src, messageId, isFromMe }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);
  const barsContainerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [bars] = useState(() => generateBars(messageId));

  // Try to extract real waveform data
  const [realBars, setRealBars] = useState<number[] | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audioRef.current = audio;

    const onLoaded = () => setDuration(audio.duration);
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('ended', onEnded);

    // Try Web Audio API for real amplitudes
    (async () => {
      try {
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(buf);
        const raw = decoded.getChannelData(0);
        const step = Math.floor(raw.length / BAR_COUNT);
        const amplitudes: number[] = [];
        for (let i = 0; i < BAR_COUNT; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) {
            sum += Math.abs(raw[i * step + j]);
          }
          amplitudes.push(sum / step);
        }
        const max = Math.max(...amplitudes, 0.01);
        setRealBars(amplitudes.map(a => 0.15 + (a / max) * 0.85));
        ctx.close();
      } catch {
        // fallback to decorative bars
      }
    })();

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('ended', onEnded);
      cancelAnimationFrame(rafRef.current);
    };
  }, [src]);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      const p = audio.duration ? audio.currentTime / audio.duration : 0;
      setProgress(p);
      setCurrentTime(audio.currentTime);
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      cancelAnimationFrame(rafRef.current);
    } else {
      audio.play();
      rafRef.current = requestAnimationFrame(tick);
    }
    setPlaying(!playing);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const container = barsContainerRef.current;
    if (!audio || !container || !audio.duration) return;
    const rect = container.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    audio.currentTime = x * audio.duration;
    setProgress(x);
    setCurrentTime(audio.currentTime);
  };

  const SPEEDS = [1, 1.5, 2];
  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(playbackRate) + 1) % SPEEDS.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const displayBars = realBars || bars;

  return (
    <div className="flex items-center gap-2 w-full max-w-[280px] mb-1">
      <button
        onClick={togglePlay}
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
          isFromMe
            ? 'bg-whatsapp-green/20 text-whatsapp-green hover:bg-whatsapp-green/30'
            : 'bg-whatsapp-muted/20 text-whatsapp-icon hover:bg-whatsapp-muted/30'
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
      </button>

      <div
        ref={barsContainerRef}
        onClick={handleBarClick}
        className="flex-1 flex items-end gap-[1.5px] h-7 cursor-pointer"
      >
        {displayBars.map((h, i) => {
          const filled = i / displayBars.length < progress;
          return (
            <div
              key={i}
              className={cn(
                'flex-1 rounded-full min-w-[2px] transition-colors duration-150',
                filled
                  ? 'bg-whatsapp-green'
                  : isFromMe
                    ? 'bg-whatsapp-muted/40'
                    : 'bg-whatsapp-muted/30'
              )}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      <div className="flex flex-col items-end flex-shrink-0 gap-0.5">
        <span className="text-[11px] text-whatsapp-muted w-8 text-right tabular-nums">
          {playing ? formatTime(currentTime) : formatTime(duration)}
        </span>
        {playing && (
          <button
            onClick={cycleSpeed}
            className="text-[10px] font-medium text-whatsapp-green bg-whatsapp-green/15 rounded px-1 py-0.5 leading-none hover:bg-whatsapp-green/25 transition-colors"
          >
            {playbackRate}x
          </button>
        )}
      </div>
    </div>
  );
}
