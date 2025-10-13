import * as THREE from "three";

export type RetargetResult = {
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip;
};

export type ModelMetadata = {
  displayName: string;
  isMixamo: boolean;
  source: string;
};

export interface CanvasProps {
  bvhFile: string | null;
  trigger?: boolean;
  selectedCharacters: string[];
  onProgressChange?: (progress: number) => void;
  onDurationChange?: (duration: number) => void;
  onTrimRangeChange?: (trimRange: number[]) => void;
  onPlayStateChange?: (playing: boolean) => void;
  multiCharacterMode?: boolean;
  onMultiCharacterModeChange?: (mode: boolean) => void;
  onFileReceived?: (filename: string) => void;
  onSend?: () => void;
  onAvatarUpdate?: () => void;
  onExportHandlersReady?: (handlers: {
    exportSelectedToGLB: () => Promise<void>;
    exportCurrentBVH: () => Promise<void>;
  }) => void;
  onPlaybackHandlersReady?: (handlers: {
    play: () => void;
    pause: () => void;
    seek: (time: number) => void;
    toggle: () => void;
  }) => void;
}