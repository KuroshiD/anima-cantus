import type { Metadata } from "next";
import { AccessForm } from "../../components/access-form";

export const metadata: Metadata = {
  title: "Entrar — Anima Cantus",
};

export default function AccessPage() {
  return <AccessForm />;
}
