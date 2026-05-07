import type { ThemeId, ThemeMode } from "./useTheme";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  /** [surface, accent, text] for preview swatches. */
  swatches: [string, string, string];
}

export const THEMES: ThemeMeta[] = [
  {
    id: "light",
    label: "SAIT Light",
    mode: "light",
    swatches: ["#f4f5f7", "#005eb8", "#212529"],
  },
  {
    id: "dark",
    label: "SAIT Dark",
    mode: "dark",
    swatches: ["#0d1b30", "#00a3e0", "#eaf0f6"],
  },
  {
    id: "plum-dark",
    label: "Plum Dark",
    mode: "dark",
    swatches: ["#180c26", "#c06dd8", "#f0eaf5"],
  },
  {
    id: "plum-light",
    label: "Plum Light",
    mode: "light",
    swatches: ["#f9f5fa", "#7c2d8c", "#212529"],
  },
  {
    id: "mono-dark",
    label: "Mono Dark",
    mode: "dark",
    swatches: ["#161616", "#d4d4d4", "#e8e8e8"],
  },
  {
    id: "mono-light",
    label: "Mono Light",
    mode: "light",
    swatches: ["#f5f5f5", "#333333", "#1a1a1a"],
  },
];
