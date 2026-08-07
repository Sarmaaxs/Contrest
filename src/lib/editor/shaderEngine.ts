/**
 * shaderEngine.ts — minimal WebGL2 video renderer with GLSL fragment shaders.
 * No PixiJS dependency (kept zero-cost / zero extra deps). Draws a <video>
 * element to a <canvas> every frame with a shader effect applied on the GPU,
 * so performance holds up even on low-end phones.
 */

export type ShaderType = 'none' | 'contrast' | 'rgb_split' | 'blur' | 'duotone' | 'vhs' | 'kaleidoscope' | 'edge_glow';

const VERTEX_SRC = `#version 300 es
in vec2 a_position;
in vec2 a_texCoord;
out vec2 v_texCoord;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 v_texCoord;
out vec4 outColor;
uniform sampler2D u_image;
uniform int u_shaderType;
uniform float u_intensity;  // 0..1
uniform vec2 u_texelSize;
uniform float u_time;

vec3 applyContrast(vec3 color, float amount) {
  float c = 1.0 + amount * 1.5;
  return clamp((color - 0.5) * c + 0.5, 0.0, 1.0);
}

vec3 rgbSplit(vec2 uv, float amount) {
  float offset = amount * 0.02;
  float r = texture(u_image, uv + vec2(offset, 0.0)).r;
  float g = texture(u_image, uv).g;
  float b = texture(u_image, uv - vec2(offset, 0.0)).b;
  return vec3(r, g, b);
}

vec3 boxBlur(vec2 uv, float amount) {
  float radius = amount * 3.0;
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize * radius;
      sum += texture(u_image, uv + offset).rgb;
      total += 1.0;
    }
  }
  return sum / total;
}

// "Contrest" duotone — maps luminance onto the app's own brand gradient
// (deep violet shadows -> hot pink/lilac highlights). Nobody else's filter
// pack looks like this because it's tuned to Contrest's own palette.
vec3 contrestDuotone(vec2 uv, float amount) {
  vec3 color = texture(u_image, uv).rgb;
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 shadow = vec3(0.14, 0.05, 0.30);
  vec3 highlight = vec3(0.93, 0.55, 0.98);
  vec3 duo = mix(shadow, highlight, smoothstep(0.05, 0.95, lum));
  return mix(color, duo, amount);
}

// VHS: rolling scanlines + chromatic smear + subtle noise, animated over time.
float vhsNoise(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
vec3 vhsGlitch(vec2 uv, float amount, float t) {
  float roll = mod(t * 0.15, 1.0);
  float band = smoothstep(0.0, 0.02, abs(fract(uv.y * 6.0 - roll * 6.0) - 0.5) - 0.48);
  vec2 shift = vec2(band * amount * 0.01 * sin(t * 20.0), 0.0);
  float r = texture(u_image, uv + shift + vec2(amount * 0.006, 0.0)).r;
  float g = texture(u_image, uv + shift).g;
  float b = texture(u_image, uv + shift - vec2(amount * 0.006, 0.0)).b;
  vec3 color = vec3(r, g, b);
  float scan = sin(uv.y * 800.0) * 0.04 * amount;
  color -= scan;
  float n = (vhsNoise(uv * t) - 0.5) * 0.06 * amount;
  color += n;
  return clamp(color, 0.0, 1.0);
}

// Kaleidoscope — folds the frame into mirrored wedges around the center.
vec3 kaleidoscope(vec2 uv, float amount) {
  vec2 centered = uv - 0.5;
  float radius = length(centered);
  float angle = atan(centered.y, centered.x);
  float segments = mix(12.0, 3.0, amount); // fewer, bigger wedges at high intensity
  float wedge = 3.14159265 * 2.0 / segments;
  angle = mod(angle, wedge);
  angle = abs(angle - wedge * 0.5);
  vec2 folded = vec2(cos(angle), sin(angle)) * radius + 0.5;
  return texture(u_image, clamp(folded, 0.0, 1.0)).rgb;
}

// Edge glow — Sobel edge detection recolored as a neon accent outline over a dimmed frame.
vec3 edgeGlow(vec2 uv, float amount) {
  vec3 base = texture(u_image, uv).rgb * (1.0 - amount * 0.6);
  float tl = dot(texture(u_image, uv + u_texelSize * vec2(-1.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float tr = dot(texture(u_image, uv + u_texelSize * vec2( 1.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float bl = dot(texture(u_image, uv + u_texelSize * vec2(-1.0,  1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float br = dot(texture(u_image, uv + u_texelSize * vec2( 1.0,  1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float top = dot(texture(u_image, uv + u_texelSize * vec2(0.0, -1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float bot = dot(texture(u_image, uv + u_texelSize * vec2(0.0,  1.0)).rgb, vec3(0.299, 0.587, 0.114));
  float left = dot(texture(u_image, uv + u_texelSize * vec2(-1.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float right = dot(texture(u_image, uv + u_texelSize * vec2( 1.0, 0.0)).rgb, vec3(0.299, 0.587, 0.114));
  float gx = -tl - 2.0 * left - bl + tr + 2.0 * right + br;
  float gy = -tl - 2.0 * top - tr + bl + 2.0 * bot + br;
  float edge = clamp(sqrt(gx * gx + gy * gy), 0.0, 1.0);
  vec3 neon = mix(vec3(0.1, 0.9, 1.0), vec3(1.0, 0.2, 0.85), sin(u_time * 0.6) * 0.5 + 0.5);
  return base + neon * edge * amount * 1.6;
}

void main() {
  vec3 color;
  if (u_shaderType == 1) {
    color = applyContrast(texture(u_image, v_texCoord).rgb, u_intensity);
  } else if (u_shaderType == 2) {
    color = rgbSplit(v_texCoord, u_intensity);
  } else if (u_shaderType == 3) {
    color = boxBlur(v_texCoord, u_intensity);
  } else if (u_shaderType == 4) {
    color = contrestDuotone(v_texCoord, u_intensity);
  } else if (u_shaderType == 5) {
    color = vhsGlitch(v_texCoord, u_intensity, u_time);
  } else if (u_shaderType == 6) {
    color = kaleidoscope(v_texCoord, u_intensity);
  } else if (u_shaderType == 7) {
    color = edgeGlow(v_texCoord, u_intensity);
  } else {
    color = texture(u_image, v_texCoord).rgb;
  }
  outColor = vec4(color, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

export class ShaderEngine {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private uShaderType: WebGLUniformLocation;
  private uIntensity: WebGLUniformLocation;
  private uTexelSize: WebGLUniformLocation;
  private uTime: WebGLUniformLocation;
  private rafId: number | null = null;
  private startedAt = performance.now();

  shaderType: ShaderType = 'none';
  intensity = 0.5;

  constructor(private canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL2 not supported on this device/browser.');
    this.gl = gl;

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SRC);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SRC);
    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link error: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    gl.useProgram(program);

    // Full-screen quad
    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
    const uvLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    this.uShaderType = gl.getUniformLocation(program, 'u_shaderType')!;
    this.uIntensity = gl.getUniformLocation(program, 'u_intensity')!;
    this.uTexelSize = gl.getUniformLocation(program, 'u_texelSize')!;
    this.uTime = gl.getUniformLocation(program, 'u_time')!;
  }

  private shaderTypeToInt(t: ShaderType): number {
    switch (t) {
      case 'contrast': return 1;
      case 'rgb_split': return 2;
      case 'blur': return 3;
      case 'duotone': return 4;
      case 'vhs': return 5;
      case 'kaleidoscope': return 6;
      case 'edge_glow': return 7;
      default: return 0;
    }
  }

  /** Draw a single frame from the given video element with the current effect applied. */
  drawFrame(video: HTMLVideoElement) {
    const gl = this.gl;
    if (video.videoWidth === 0) return;
    if (this.canvas.width !== video.videoWidth || this.canvas.height !== video.videoHeight) {
      this.canvas.width = video.videoWidth;
      this.canvas.height = video.videoHeight;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    gl.useProgram(this.program);
    gl.uniform1i(this.uShaderType, this.shaderTypeToInt(this.shaderType));
    gl.uniform1f(this.uIntensity, this.intensity);
    gl.uniform2f(this.uTexelSize, 1 / this.canvas.width, 1 / this.canvas.height);
    gl.uniform1f(this.uTime, (performance.now() - this.startedAt) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Continuously render `video` to the canvas at the browser's refresh rate (~60fps capable). */
  startLoop(video: HTMLVideoElement) {
    const tick = () => {
      this.drawFrame(video);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stopLoop() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** Momentarily spike shader intensity — used for beat-synced glitch hits. */
  applyBeatGlitch(peak: number = 1) {
    const original = this.intensity;
    this.intensity = Math.min(1, peak);
    setTimeout(() => {
      this.intensity = original;
    }, 90);
  }
}
