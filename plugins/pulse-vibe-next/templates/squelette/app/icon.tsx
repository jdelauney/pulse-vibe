import { ImageResponse } from "next/og";
import { projet } from "@src/config/projet";

// Icône du site (onglet du navigateur, résultats de Google : plus de 48 × 48 pixels recommandé).
// Une image fournie, app/icon.png (carrée), la remplace.
export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icone() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111111",
        color: "#ffffff",
        fontSize: 120,
        fontWeight: 700,
      }}
    >
      {projet.nom.trim().charAt(0).toUpperCase() || "•"}
    </div>,
    size,
  );
}
