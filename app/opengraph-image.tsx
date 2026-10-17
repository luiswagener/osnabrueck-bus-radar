import { ImageResponse } from "next/og";

export const alt = "Osnabrück Busradar: Alle Busse in Osnabrück live auf einer 3D-Karte";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// link preview for messengers and social media, rendered once at build time
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "#0a0a0a", color: "#fafafa" }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 48 }}>
          {["M1", "M2", "M3", "M4", "M5"].map((l) => (
            <div key={l} style={{ display: "flex", padding: "10px 22px", borderRadius: 14, background: "#8cc63f", color: "#000", fontSize: 40 }}>{l}</div>
          ))}
        </div>
        <div style={{ fontSize: 88 }}>Osnabrück Busradar</div>
        <div style={{ fontSize: 40, marginTop: 20, color: "#a3a3a3" }}>Alle Busse live, mit Echtzeit-Verspätungen</div>
      </div>
    ),
    size,
  );
}
