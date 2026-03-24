import { redirect } from "next/navigation";

export default function Home() {
  // Redirige al dashboard principal del sistema contable
  redirect("/dashboard");
}
