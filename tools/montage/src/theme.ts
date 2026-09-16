// theme.ts — single source of truth for the book films. Never inline colors or easings.
import { Easing } from "remotion";

export const theme = {
  colors: {
    bg: "#0a0806",
    bgAlt: "#15110c",
    primary: "#d6b774",   // the gold: THE hero colour, one element per frame
    accent: "#f2dcac",
    text: "#f6f1e7",
    textDim: "#a89f90",
    glow: "rgba(214, 183, 116, 0.35)",
  },
  fonts: {
    display: "'Cormorant Garamond', 'Iowan Old Style', 'Palatino Linotype', Georgia, serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, Menlo, monospace",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;
