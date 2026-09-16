import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { Entrance, Grade, Grain, Vignette, WordReveal } from "./Layers";

export type Shot = {
  n: number; case: number; file: string; title: string; line: string; source: string;
  move: string; zoomFrom: number; zoomTo: number; panX: number;
  /* "fill": the plate covers the frame and is cropped to focusY.
     "plate": the plate is a poster, so it is shown whole beside its caption. */
  fit?: "fill" | "plate"; focusY?: number;
};
export type MontageProps = {
  title: string; subtitle: string; repo: string; shots: Shot[];
  timing: { intro: number; shot: number; overlap: number; step: number; outro: number };
};

/* A plate: one still, held long enough to read and moved the whole time it is
   held. It fades up over the plate before it, so the film never cuts hard. */
const Plate: React.FC<{ shot: Shot; start: number; dur: number; fade: number }> =
({ shot, start, dur, fade }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < -fade || t > dur) return null;
  const opacity = Math.min(
    interpolate(t, [0, fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(t, [dur - fade, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const p = interpolate(t, [0, dur], [0, 1], { easing: theme.ease.inOut,
    extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = shot.zoomFrom + (shot.zoomTo - shot.zoomFrom) * p;
  const pan = shot.panX * p;
  /* the caption comes in a little after the plate and leaves a little before it */
  const cap = Math.min(
    interpolate(t, [fade + 4, fade + 22], [0, 1], { easing: theme.ease.out, extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(t, [dur - fade - 10, dur - fade + 4], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  const isPoster = shot.fit === "plate";
  const caption = (
    <div style={{ opacity: cap, transform: `translateY(${interpolate(cap, [0, 1], [26, 0])}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
        <span style={{ fontFamily: theme.fonts.mono, fontSize: 15, letterSpacing: "0.3em",
          color: theme.colors.primary }}>{String(shot.n).padStart(2, "0")}</span>
        <span style={{ width: 54, height: 1, background: theme.colors.primary, opacity: 0.6,
          transform: "translateY(-6px)" }} />
        <span style={{ fontFamily: theme.fonts.mono, fontSize: 13, letterSpacing: "0.26em",
          textTransform: "uppercase", color: theme.colors.textDim }}>plate {shot.case}</span>
      </div>
      <div style={{ fontFamily: theme.fonts.display, fontSize: 62, lineHeight: 1.04, fontWeight: 500,
        color: theme.colors.text, marginTop: 12, textShadow: "0 4px 24px rgba(0,0,0,0.7)" }}>{shot.title}</div>
      <div style={{ fontFamily: theme.fonts.display, fontStyle: "italic", fontSize: 25, lineHeight: 1.3,
        color: theme.colors.accent, marginTop: 10, maxWidth: isPoster ? 620 : 940,
        textShadow: "0 3px 18px rgba(0,0,0,0.75)" }}>{shot.line}</div>
      <div style={{ fontFamily: theme.fonts.mono, fontSize: 13, letterSpacing: "0.2em",
        color: theme.colors.textDim, marginTop: 16 }}>{shot.source}</div>
    </div>
  );

  if (isPoster) {
    /* a poster is meant to be read, so it is hung whole on the dark ground and
       the caption stands beside it instead of over it */
    return (
      <AbsoluteFill style={{ opacity, background: theme.colors.bg }}>
        <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 92px", gap: 64 }}>
          <div style={{ flex: "1 1 0", minWidth: 0 }}>{caption}</div>
          {/* a poster only breathes: a big zoom would push it past the margin */}
          <div style={{ height: 686, display: "flex", alignItems: "center", flex: "0 0 auto",
            transform: `scale(${shot.move === "out" ? 1.05 - p * 0.05 : 1 + p * 0.05}) translateY(${(p - 0.5) * 16}px)` }}>
            <Img src={staticFile(shot.file)} style={{ height: "100%", width: "auto", objectFit: "contain",
              border: `1px solid ${theme.colors.primary}55`,
              boxShadow: "0 50px 90px -24px rgba(0,0,0,0.85)",
              filter: "saturate(1.04) contrast(1.03)" }} />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ opacity }}>
      <AbsoluteFill style={{ overflow: "hidden", background: theme.colors.bg }}>
        <Img src={staticFile(shot.file)} style={{ width: "100%", height: "100%", objectFit: "cover",
          objectPosition: `50% ${(shot.focusY ?? 0.5) * 100}%`,
          transform: `scale(${scale}) translateX(${pan}px)`, filter: "saturate(1.04) contrast(1.04)" }} />
      </AbsoluteFill>
      {/* the plate is titled on a shelf of shadow, so the type stays readable on any image */}
      <AbsoluteFill style={{ pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(6,5,4,0.5) 0%, transparent 24%, transparent 44%, rgba(6,5,4,0.93) 100%)" }} />
      {/* pale plates would swallow the type, so the caption corner is darkened too */}
      <AbsoluteFill style={{ pointerEvents: "none",
        background: "linear-gradient(100deg, rgba(6,5,4,0.66) 0%, rgba(6,5,4,0.3) 34%, transparent 56%)" }} />
      <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
        <div style={{ padding: "0 84px 76px" }}>{caption}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Card: React.FC<{ start: number; dur: number; fade: number; children: React.ReactNode }> =
({ start, dur, fade, children }) => {
  const frame = useCurrentFrame();
  const t = frame - start;
  if (t < -fade || t > dur) return null;
  const opacity = Math.min(
    interpolate(t, [0, fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    interpolate(t, [dur - fade, dur], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  );
  return <AbsoluteFill style={{ opacity, background: theme.colors.bg, justifyContent: "center",
    padding: "0 110px" }}>{children}</AbsoluteFill>;
};

export const Montage: React.FC<MontageProps> = ({ title, subtitle, repo, shots, timing }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { intro, shot: SHOT, overlap: FADE, step, outro } = timing;
  const outroStart = intro + (shots.length - 1) * step + SHOT - FADE;
  const run = interpolate(frame, [0, durationInFrames], [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: theme.colors.bg, color: theme.colors.text }}>
      <Card start={0} dur={intro + FADE} fade={FADE}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 14, letterSpacing: "0.34em",
          textTransform: "uppercase", color: theme.colors.primary }}>Aurelia · plates</div>
        <WordReveal text={title} delay={6} per={3}
          style={{ fontFamily: theme.fonts.display, fontSize: 96, lineHeight: 1.02, fontWeight: 500, marginTop: 18 }} />
        <Entrance delay={26}>
          <div style={{ fontFamily: theme.fonts.display, fontStyle: "italic", fontSize: 30,
            color: theme.colors.accent, marginTop: 16 }}>{subtitle}</div>
        </Entrance>
      </Card>

      {shots.map((s, i) => (
        <Plate key={s.case} shot={s} start={intro + i * step} dur={SHOT} fade={FADE} />
      ))}

      <Card start={outroStart} dur={outro} fade={FADE}>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 14, letterSpacing: "0.34em",
          textTransform: "uppercase", color: theme.colors.primary }}>Plates from</div>
        <div style={{ fontFamily: theme.fonts.display, fontSize: 62, marginTop: 14 }}>awesome-gpt-image-2</div>
        <div style={{ fontFamily: theme.fonts.mono, fontSize: 16, color: theme.colors.textDim, marginTop: 14 }}>{repo}</div>
        <div style={{ fontFamily: theme.fonts.display, fontStyle: "italic", fontSize: 24,
          color: theme.colors.accent, marginTop: 20 }}>
          Every image belongs to its author, named on its own plate.
        </div>
      </Card>

      {/* how far through the film you are, in one gold line */}
      <AbsoluteFill style={{ justifyContent: "flex-end", pointerEvents: "none" }}>
        <div style={{ height: 2, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${run * 100}%`, background: theme.colors.primary,
            boxShadow: `0 0 14px ${theme.colors.glow}` }} />
        </div>
      </AbsoluteFill>

      <Grade />
      <Grain />
      <Vignette />
    </AbsoluteFill>
  );
};
