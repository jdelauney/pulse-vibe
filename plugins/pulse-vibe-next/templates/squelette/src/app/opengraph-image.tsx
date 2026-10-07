import { ImageResponse } from "next/og";
import { projet } from "@/lib/projet";

// L'image affichée quand un lien du site est partagé (LinkedIn, WhatsApp, X…), 1200 × 630 pixels.
// Couleurs à accorder à docs/design.md (une image se dessine avec des valeurs, pas avec les rôles du thème).
// Une image fournie, src/app/opengraph-image.png avec opengraph-image.alt.txt, la remplace.
export const alt = projet.nom;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function ImageDePartage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        background: "#ffffff",
        color: "#111111",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 700 }}>{projet.nom}</div>
      <div style={{ fontSize: 36, marginTop: 24, color: "#555555" }}>
        {projet.description}
      </div>
    </div>,
    size,
  );
}
