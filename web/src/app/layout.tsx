import type { Metadata } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import { IconSprite } from "../components/icons";
import "./design/shared.css";
import "./design/journey.css";
import "./design/contract.css";
import "./design/contract-services.css";
import "./design/contract-review.css";
import "./design/repertoire.css";
import "./design/access.css";
import "./design/management.css";
import "./design/quote.css";

export const metadata: Metadata = {
  title: "Anima Cantus",
  description: "Música ao vivo para cerimônias e acompanhamento da jornada do casal.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
