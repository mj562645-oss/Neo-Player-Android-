import React, { useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { UiThemeId } from '../../types/music';

interface GlassShaderCanvasProps {
  primaryColor?: string;
  secondaryColor?: string;
  isDark: boolean;
  variant?: UiThemeId;
  intensity?: number;
  paused?: boolean;
  className?: string;
}

function parseColorToRgbNorm(input: string | undefined, fallback: [number, number, number]): [number, number, number] {
  if (!input) return fallback;
  const trimmed = input.trim();
  if (trimmed.startsWith('#')) {
    const clean = trimmed.slice(1);
    const full =
      clean.length === 3
        ? clean
            .split('')
            .map((c) => c + c)
            .join('')
        : clean.padEnd(6, '0').slice(0, 6);
    const n = parseInt(full, 16);
    if (!Number.isNaN(n)) {
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
  }
  const rgbMatch = trimmed.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    return [
      Math.min(1, Math.max(0, Number(rgbMatch[1]) / 255)),
      Math.min(1, Math.max(0, Number(rgbMatch[2]) / 255)),
      Math.min(1, Math.max(0, Number(rgbMatch[3]) / 255)),
    ];
  }
  return fallback;
}

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `
precision mediump float;
varying vec2 v_uv;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_primary;
uniform vec3 u_secondary;
uniform float u_dark;
uniform float u_variant;
uniform float u_intensity;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / max(u_resolution.y, 1.0), 1.0);
  vec2 uv = (v_uv - 0.5) * aspect;
  float t = u_time * (u_variant > 1.5 ? 0.14 : u_variant > 0.5 ? 0.16 : 0.22);

  // Layered liquid domain warp
  vec2 p = uv * (u_variant > 1.5 ? 1.55 : 1.85);
  for (int i = 0; i < 3; i++) {
    float fi = float(i) + 1.0;
    p += vec2(
      sin(p.y * (1.35 * fi) + t * (0.9 + 0.2 * fi)),
      cos(p.x * (1.25 * fi) - t * (0.8 + 0.15 * fi))
    ) * (0.34 / fi);
  }

  float waveA = 0.5 + 0.5 * sin(p.x * 1.9 + p.y * 1.4 + t * 0.7);
  float waveB = 0.5 + 0.5 * cos(p.y * 2.2 - p.x * 1.3 - t * 0.55);

  // Specular caustic ridge for glass refraction feel
  float ridge = 1.0 - abs(sin(p.x * 2.4 - p.y * 1.8 + t * 0.9));
  float caustic = pow(clamp(ridge, 0.0, 1.0), u_variant > 1.5 ? 4.2 : 3.2);

  // Subtle architectural gallery light sweep for Editorial
  float sweep = smoothstep(0.15, 0.95, 0.55 + 0.45 * sin((uv.x * 0.9 + uv.y * 0.6) * 2.1 + t * 0.45));

  vec3 baseCanvas = u_dark > 0.5
    ? (u_variant > 1.5 ? vec3(0.043, 0.043, 0.052) : u_variant > 0.5 ? vec3(0.055, 0.06, 0.08) : vec3(0.032, 0.035, 0.048))
    : (u_variant > 1.5 ? vec3(0.980, 0.972, 0.957) : u_variant > 0.5 ? vec3(0.960, 0.968, 0.988) : vec3(0.968, 0.968, 0.982));

  vec3 blend = mix(u_primary, u_secondary, smoothstep(0.2, 0.85, waveB));
  float colorWeight = u_dark > 0.5
    ? (u_variant > 1.5 ? 0.24 : u_variant > 0.5 ? 0.28 : 0.34)
    : (u_variant > 1.5 ? 0.13 : u_variant > 0.5 ? 0.16 : 0.19);
  colorWeight *= u_intensity;

  float field = mix(waveA, sweep, u_variant > 1.5 ? 0.55 : 0.15);
  vec3 col = mix(baseCanvas, blend, clamp(field * colorWeight + 0.05 * u_intensity, 0.0, 0.72));

  // Add subtle refractive glass highlights
  vec3 causticTint = mix(u_primary, vec3(1.0), u_dark > 0.5 ? 0.45 : 0.68);
  float causticWeight = (u_variant > 1.5 ? 0.085 : u_variant > 0.5 ? 0.055 : 0.115) * u_intensity;
  col += causticTint * caustic * causticWeight * (u_dark > 0.5 ? 1.0 : 0.55);

  // Subtle film/vellum micro-grain so gradients have zero banding
  float grain = (hash21(gl_FragCoord.xy + fract(u_time)) - 0.5) * (u_variant > 1.5 ? 0.024 : 0.015);
  col += grain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const GlassShaderCanvas: React.FC<GlassShaderCanvasProps> = ({
  primaryColor = '#FF2D55',
  secondaryColor = '#5E5CE6',
  isDark,
  variant = 'neo',
  intensity = 1,
  paused = false,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const targetRef = useRef({
    primary: parseColorToRgbNorm(primaryColor, [1, 0.18, 0.33]),
    secondary: parseColorToRgbNorm(secondaryColor, [0.37, 0.36, 0.9]),
    dark: isDark ? 1 : 0,
    variant: variant === 'editorial' ? 2 : variant === 'material' ? 1 : 0,
    intensity,
    paused,
  });

  targetRef.current = {
    primary: parseColorToRgbNorm(primaryColor, [1, 0.18, 0.33]),
    secondary: parseColorToRgbNorm(secondaryColor, [0.37, 0.36, 0.9]),
    dark: isDark ? 1 : 0,
    variant: variant === 'editorial' ? 2 : variant === 'material' ? 1 : 0,
    intensity,
    paused,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
    });
    if (!gl) return;

    const compileShader = (type: number, source: string): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const primLoc = gl.getUniformLocation(program, 'u_primary');
    const secLoc = gl.getUniformLocation(program, 'u_secondary');
    const darkLoc = gl.getUniformLocation(program, 'u_dark');
    const varLoc = gl.getUniformLocation(program, 'u_variant');
    const intLoc = gl.getUniformLocation(program, 'u_intensity');

    const current = {
      primary: [...targetRef.current.primary],
      secondary: [...targetRef.current.secondary],
      dark: targetRef.current.dark,
      intensity: targetRef.current.intensity,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // Deliberately low internal resolution upscaled cleanly for silky soft fluid shaders + ultra-low battery draw
      const w = Math.max(160, Math.min(460, Math.round(rect.width * 0.36)));
      const h = Math.max(160, Math.min(340, Math.round(rect.height * 0.36)));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let rafId = 0;
    let startTime = performance.now();
    let lastDraw = 0;

    const renderFrame = (now: number) => {
      const target = targetRef.current;

      // Throttle to ~30fps for ambient background shader efficiency
      if (now - lastDraw >= 32 || lastDraw === 0) {
        lastDraw = now;

        for (let i = 0; i < 3; i++) {
          current.primary[i] += (target.primary[i] - current.primary[i]) * 0.06;
          current.secondary[i] += (target.secondary[i] - current.secondary[i]) * 0.06;
        }
        current.dark += (target.dark - current.dark) * 0.1;
        current.intensity += (target.intensity - current.intensity) * 0.08;

        gl.useProgram(program);
        gl.enableVertexAttribArray(posLoc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const elapsedSec = target.paused ? 4.2 : (now - startTime) * 0.001;
        gl.uniform1f(timeLoc, elapsedSec);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform3f(primLoc, current.primary[0], current.primary[1], current.primary[2]);
        gl.uniform3f(secLoc, current.secondary[0], current.secondary[1], current.secondary[2]);
        gl.uniform1f(darkLoc, current.dark);
        gl.uniform1f(varLoc, target.variant);
        gl.uniform1f(intLoc, current.intensity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
      }

      if (!target.paused && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const startLoop = () => {
      if (!targetRef.current.paused && !document.hidden) {
        startTime = performance.now();
        lastDraw = 0;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(renderFrame);
      } else {
        cancelAnimationFrame(rafId);
        // Render one static frame when paused so color changes still apply
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    const handleVisibility = () => {
      if (!document.hidden && !targetRef.current.paused) {
        startLoop();
      } else {
        cancelAnimationFrame(rafId);
      }
    };

    const handleResumeEvent = () => {
      startLoop();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    canvas.addEventListener('neo-shader-sync', handleResumeEvent);
    rafId = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibility);
      canvas.removeEventListener('neo-shader-sync', handleResumeEvent);
      ro.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    canvasRef.current?.dispatchEvent(new CustomEvent('neo-shader-sync'));
  }, [paused, primaryColor, secondaryColor, isDark, variant]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none block w-full h-full', className)}
    />
  );
};
