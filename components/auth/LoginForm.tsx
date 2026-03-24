"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      setLoading(true);
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error ?? "No se pudo iniciar sesión");
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md shadow-md" title="Acceso" description="Ingresa con tus credenciales">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Usuario o email
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="usuario@supertiendageek.com"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="••••••••"
              required
            />
          </label>

          {error ? <p className="text-sm text-amber-700">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="submit" className="px-4 py-2 text-sm" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
