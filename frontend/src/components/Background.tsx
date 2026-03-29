// ✅ src/components/Background.tsx
import React from "react";

/**
 * Dark, premium medical background (no blobs).
 * - Multi-layer gradient
 * - Subtle film grain (data-URL)
 */
export default function Background() {
  // tiny grain png (data url) for premium texture
  const grain =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='0.06'/></feComponentTransfer></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-hero-dark"
      style={{
        backgroundBlendMode: "screen, screen, normal",
      }}
    >
      <div
        className="absolute inset-0 opacity-60 mix-blend-soft-light"
        style={{ backgroundImage: grain, backgroundSize: "160px 160px" }}
      />
    </div>
  );
}
