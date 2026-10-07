import type { Metadata } from "next";
import { JsonLd } from "@/components/json-ld";
import { siteWeb } from "@/lib/donnees-structurees";
import { projet } from "@/lib/projet";
import { metadonneesDePage } from "@/lib/seo";
import { adresseDuSite } from "@/lib/site";

export const metadata: Metadata = metadonneesDePage({
  titre: projet.nom,
  description: projet.description,
  chemin: "/",
  accueil: true,
});

export default function Accueil() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <JsonLd
        donnees={siteWeb({ nom: projet.nom, adresse: adresseDuSite() })}
      />
      <h1 className="font-heading text-4xl font-semibold tracking-tight">
        {projet.nom}
      </h1>
      <p className="text-lg text-muted-foreground">{projet.description}</p>
    </main>
  );
}
