const ICONS = {
  height: ["M12 4 3 8.5l9 4.5 9-4.5L12 4Z", "m3 13 9 4.5 9-4.5", "m3 17.5 9 4.5 9-4.5"],
  block: ["M12 3 4 7v10l8 4 8-4V7l-8-4Z", "m4 7 8 4 8-4", "M12 11v10"],
  transfer: ["M4 8h13", "m13 4 4 4-4 4", "M20 16H7", "m11 12-4 4 4 4"],
  bolt: ["M13 2 5 13h6l-1 9 8-11h-6l1-9Z"],
  target: ["M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0", "M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0", "M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0"],
  inbox: ["M4 13h4l2 3h4l2-3h4", "M4 13 6 5h12l2 8v6H4v-6Z"],
  tag: ["M3 12V4h8l10 10-8 8L3 12Z", "M7.5 7.5h.01"],
  coins: ["M4 6c0 1.7 3.6 3 8 3s8-1.3 8-3-3.6-3-8-3-8 1.3-8 3Z", "M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"],
  shield: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z", "m9 12 2 2 4-4"],
  cycle: ["M20 12a8 8 0 1 1-2.3-5.6", "M20 4v4h-4"],
  copy: ["M9 9h11v11H9V9Z", "M5 15H4V4h11v1"],
  check: ["m5 12.5 5 4.5 9-10"],
  search: ["M10.5 18a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z", "m21 21-5.2-5.2"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={className ? `icon ${className}` : "icon"} viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name].map((shape) => (
        <path key={shape} d={shape} />
      ))}
    </svg>
  );
}

const EDGES = [
  "M55 70C90 70 90 40 125 40",
  "M55 70C90 70 90 130 125 130",
  "M55 170C90 170 90 130 125 130",
  "M55 170C90 170 90 220 125 220",
  "M55 250C90 250 90 220 125 220",
  "M155 40C190 40 190 90 225 90",
  "M155 130C190 130 190 90 225 90",
  "M155 130C190 130 190 180 225 180",
  "M155 220C190 220 190 180 225 180",
  "M155 220C190 220 190 270 225 270",
  "M255 90C290 90 290 50 325 50",
  "M255 90C290 90 290 140 325 140",
  "M255 180C290 180 290 140 325 140",
  "M255 180C290 180 290 230 325 230",
  "M255 270C290 270 290 230 325 230",
];
const FLOWS = ["M355 50C390 50 390 100 425 100", "M355 140C390 140 390 100 425 100", "M355 140C390 140 390 200 425 200", "M355 230C390 230 390 200 425 200"];
const NODES: [number, number, string?][] = [
  [25, 55], [25, 155], [25, 235], [125, 25], [125, 115], [125, 205], [225, 75], [225, 165], [225, 255],
  [325, 35, "recent"], [325, 125, "recent"], [325, 215, "recent"], [425, 85, "new"], [425, 185, "new"],
];

export function DagArt() {
  return (
    <svg className="hero__art" viewBox="0 0 480 310" aria-hidden="true" focusable="false">
      <line className="dag-cut" x1="190" y1="8" x2="190" y2="302" />
      <line className="dag-cut" x1="390" y1="8" x2="390" y2="302" />
      <g className="dag-edges">
        {EDGES.map((path) => (
          <path key={path} d={path} />
        ))}
        {FLOWS.map((path) => (
          <path key={path} className="flow" d={path} />
        ))}
      </g>
      <g className="dag-nodes">
        {NODES.map(([x, y, kind]) => (
          <rect key={`${x}-${y}`} className={kind} x={x} y={y} width="30" height="30" rx="8" />
        ))}
      </g>
    </svg>
  );
}
