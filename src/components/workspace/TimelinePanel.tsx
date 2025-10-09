import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Pause, Play } from "lucide-react";

interface TimelinePanelProps {
  progress: number;
  duration: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onSeek?: (time: number) => void;
  className?: string;
}

export default function TimelinePanel({
  progress,
  duration,
  isPlaying = false,
  onTogglePlay,
  onSeek,
  className = "",
}: TimelinePanelProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), duration || 0);
  const disabled = duration <= 0;

  const format = (value: number) => value.toFixed(2);

  return (
    <footer className={`flex-shrink-0 border-t border-slate-200 bg-white/80 backdrop-blur px-4 py-3 ${className}`}>
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={onTogglePlay}
          disabled={disabled}
          className="h-8 w-8"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          <span className="sr-only">{isPlaying ? 'Pause' : 'Play'}</span>
        </Button>
        <div className="flex-1">
          <Slider
            value={[disabled ? 0 : clampedProgress]}
            min={0}
            max={duration || 1}
            step={0.01}
            onValueChange={(value) => onSeek?.(value[0])}
            disabled={disabled}
          />
        </div>
        <div className="w-24 text-right text-xs font-medium text-slate-500">
          {format(progress)}s
          <span className="text-slate-400"> / {format(duration)}s</span>
        </div>
      </div>
    </footer>
  );
}
