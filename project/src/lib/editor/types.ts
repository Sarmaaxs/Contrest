export interface Project {
  id: string;
  name: string;
  fps: number;
  width: number;
  height: number;
  tracks: Track[];
}

export interface Track {
  id: string;
  type: 'video' | 'audio' | 'text' | 'effect';
  clips: Clip[];
  locked: boolean;
  muted: boolean;
}

export interface Clip {
  id: string;
  src: string;
  startTime: number;
  duration: number;
  mediaOffset: number;
  keyframes: Keyframe[];
  shaders: ShaderEffect[];
}

export interface Keyframe {
  time: number;
  property: 'position' | 'scale' | 'opacity' | 'contrast';
  value: number;
  easing: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';
}

export interface ShaderEffect {
  id: string;
  type: 'rgb_split' | 'contrast' | 'blur';
  intensity: number;
  beatTriggered: boolean;
}
