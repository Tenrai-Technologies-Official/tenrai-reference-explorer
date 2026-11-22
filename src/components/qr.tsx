declare global {
  interface Window {
    /** Encoder from `public/qr.js` using error correction level M. */
    TenraiQr?: { modules(text: string): boolean[][] };
  }
}

const QUIET_ZONE = 4;

/** Preserve the quiet zone and contrast in both themes. */
export function QrCode({ text, label }: { text: string; label: string }) {
  let modules: boolean[][];
  try {
    modules = window.TenraiQr?.modules(text) ?? [];
  } catch {
    return null;
  }
  if (modules.length === 0) {
    return null;
  }
  const side = modules.length + QUIET_ZONE * 2;
  let path = "";
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) {
        path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h1v1h-1z`;
      }
    });
  });
  return (
    <svg className="qr" viewBox={`0 0 ${side} ${side}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={side} height={side} fill="#ffffff" />
      <path d={path} fill="#000000" />
    </svg>
  );
}
