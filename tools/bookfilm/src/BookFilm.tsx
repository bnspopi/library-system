import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { BgMesh, Entrance, Grade, Grain, KenBurns, Vignette, WordReveal } from "./Layers";

export type Character = { name: string; role: string; image: string };
export type BookFilmProps = {
  title: string; author: string; hall: string; line: string; characters: Character[];
};

/* one title's film: its people arrive one by one out of the dark, breathe,
   and the story's line is spoken across them. Five layers, bottom to top:
   mesh, the figures, the type, the grade, grain and vignette. */
export const BookFilm: React.FC<BookFilmProps> = ({ title, author, hall, line, characters }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const n = Math.max(1, characters.length);
  /* one or two figures get a bigger plate, so a short cast still fills the frame */
  const cardW = Math.min(n === 1 ? 400 : n === 2 ? 340 : 300, (width * 0.62) / n), cardH = cardW * 4 / 3;
  const colW = width - (n * cardW + (n - 1) * 26) - width * 0.05 * 2 - 24;   // the type keeps clear of the figures
  const exit = interpolate(frame, [durationInFrames - 12, durationInFrames - 2], [0, 1],
    { easing: theme.ease.in, extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const breathe = 1 + Math.sin(frame / 22) * 0.012;
  const drift = interpolate(frame, [0, durationInFrames], [0, -26], { easing: theme.ease.inOut,
    extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ fontFamily: theme.fonts.display, color: theme.colors.text, opacity: 1 - exit }}>
      <BgMesh />
      {/* the figures */}
      <AbsoluteFill style={{ display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end",
        gap: 26, padding: `0 ${width * 0.05}px ${height * 0.10}px 0`, transform: `translateX(${drift * 0.6}px)` }}>
        {characters.map((c, i) => (
          <Entrance key={i} delay={Math.round(fps * 0.5) + i * 7}
            style={{ width: cardW, height: cardH, borderRadius: 14, overflow: "hidden",
              border: `1px solid ${theme.colors.primary}55`, boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7)",
              transform: `scale(${breathe}) translateY(${Math.sin(frame / 30 + i) * 3}px)`,
              position: "relative", background: theme.colors.bgAlt }}>
            <KenBurns src={c.image} zoomFrom={i % 2 ? 1.1 : 1} zoomTo={i % 2 ? 1 : 1.1} panX={i % 2 ? 14 : -14} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "38px 14px 12px",
              background: "linear-gradient(180deg, transparent, rgba(5,4,4,0.86))" }}>
              <div style={{ fontFamily: theme.fonts.mono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase",
                color: theme.colors.primary }}>{c.role}</div>
              <div style={{ fontSize: 22, lineHeight: 1.05, marginTop: 4, fontWeight: 500 }}>{c.name}</div>
            </div>
          </Entrance>
        ))}
      </AbsoluteFill>
      {/* the type */}
      <AbsoluteFill style={{ padding: `${height * 0.13}px ${width * 0.05}px`, justifyContent: "flex-start",
        transform: `translateX(${drift * 0.3}px)` }}>
        <Entrance delay={4}>
          <div style={{ fontFamily: theme.fonts.mono, fontSize: 11, letterSpacing: "0.3em", textTransform: "uppercase",
            color: theme.colors.primary }}>Aurelia · {hall}</div>
        </Entrance>
        <WordReveal text={title} delay={10} per={3}
          style={{ fontSize: Math.min(64, 1500 / Math.max(12, title.length)), lineHeight: 1.02, fontWeight: 500,
            maxWidth: colW, marginTop: 14 }} />
        <Entrance delay={26}>
          <div style={{ fontFamily: theme.fonts.body, fontSize: 15, color: theme.colors.textDim, marginTop: 10 }}>{author}</div>
        </Entrance>
        <WordReveal text={line} delay={Math.round(fps * 2.2)} per={2}
          style={{ fontSize: 22, fontStyle: "italic", lineHeight: 1.3, maxWidth: colW, marginTop: 30,
            color: theme.colors.accent }} />
      </AbsoluteFill>
      <Grade />
      <Grain />
      <Vignette />
    </AbsoluteFill>
  );
};
