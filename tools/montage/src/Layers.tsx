import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

export const Entrance: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> =
({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: theme.spring.smooth });
  return (
    <div style={{ opacity: p,
      transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
      ...style }}>{children}</div>
  );
};

export const WordReveal: React.FC<{ text: string; delay?: number; per?: number; style?: React.CSSProperties }> =
({ text, delay = 0, per = 3, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, ...style }}>
      {text.split(" ").map((word, i) => {
        const p = spring({ frame: frame - delay - i * per, fps, config: theme.spring.snappy });
        return (
          <span key={i} style={{ display: "inline-block", opacity: p,
            transform: `translateY(${interpolate(p, [0, 1], [30, 0])}px)` }}>{word}</span>
        );
      })}
    </div>
  );
};

export const BgMesh: React.FC = () => {
  const frame = useCurrentFrame();
  const d1 = Math.sin(frame / 55) * 50, d2 = Math.cos(frame / 70) * 40;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", top: -520, left: -260 + d1,
        filter: "blur(60px)", background: `radial-gradient(circle, ${theme.colors.primary}2e, transparent 62%)` }} />
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: "50%", bottom: -420, right: -220 - d2,
        filter: "blur(70px)", background: `radial-gradient(circle, ${theme.colors.accent}1a, transparent 65%)` }} />
      <div style={{ position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(0deg, transparent 0 46px, ${theme.colors.primary}0c 46px 47px)` }} />
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: theme.colors.primary, mixBlendMode: "soft-light", opacity: 0.18 }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.12), transparent 28%, transparent 72%, rgba(0,0,0,0.3))" }} />
  </AbsoluteFill>
);

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
    backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`, opacity: 0.07, mixBlendMode: "overlay" }} />;
};

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none",
    background: "radial-gradient(ellipse at center, transparent 54%, rgba(0,0,0,0.34) 100%)" }} />
);

export const KenBurns: React.FC<{ src: string; zoomFrom?: number; zoomTo?: number; panX?: number }> =
({ src, zoomFrom = 1, zoomTo = 1.1, panX = -20 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [zoomFrom, zoomTo], { easing: theme.ease.inOut,
    extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pan = interpolate(frame, [0, durationInFrames], [0, panX], { easing: theme.ease.inOut,
    extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover",
    transform: `scale(${scale}) translateX(${pan}px)` }} />;
};
