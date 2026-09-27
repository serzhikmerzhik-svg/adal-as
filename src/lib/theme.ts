// SVG/Recharts сияқты CSS айнымалысын оқи алмайтын жерлерге арналған түстер (globals.css-пен бірдей).
export const THEME = {
  primary: "#22d3ee",
  grid: "#22304a",
  tick: "#8fa0b8",
  yellow: "#f59e0b",
  red: "#ef4444",
  green: "#22c55e",
  tooltip: {
    contentStyle: { background: "#16223a", border: "1px solid #33415e", borderRadius: 8, color: "#e6edf7", fontSize: 12 },
    labelStyle: { color: "#8fa0b8" },
    cursor: { stroke: "#33415e" },
  },
} as const;
