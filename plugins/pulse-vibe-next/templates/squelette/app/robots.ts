import { adresseDuSite } from "@src/config/site";
import {
  cheminsFermes,
  politiqueRobotsIa,
  reglesRobots,
  signalDeContenu,
} from "@src/lib/seo/politique-robots";
import type { MetadataRoute } from "next";

// robots.txt : le panneau à l'entrée du site, lu par les robots polis. Une page privée se protège
// par la connexion (et noindex), pas ici. La politique des robots IA vient de src/lib/seo/politique-robots.ts.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: reglesRobots(politiqueRobotsIa, {
      fermes: cheminsFermes,
      signal: signalDeContenu,
    }),
    sitemap:
      politiqueRobotsIa === "D" ? undefined : `${adresseDuSite()}/sitemap.xml`,
  };
}
