import { ImageResponse } from "next/og";
import { projet } from "@/lib/projet";

// Icône de l'écran d'accueil des téléphones Apple. Une image fournie, src/app/apple-icon.png, la remplace.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function IconeApple() {
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
        fontSize: 110,
        fontWeight: 700,
      }}
    >
      {projet.nom.trim().charAt(0).toUpperCase() || "•"}
    </div>,
    size,
  );
}
