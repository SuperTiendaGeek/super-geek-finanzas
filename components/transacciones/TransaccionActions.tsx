"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

type Props = {
  currentId: string;
  estado?: string;
  prevId?: string | null;
  nextId?: string | null;
};

function isAnulada(estado?: string) {
  const e = (estado ?? "").toLowerCase();
  return e.includes("anul") || e.includes("cancel");
}

export default function TransaccionActions({ currentId, estado, prevId, nextId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"anular" | "rehabilitar" | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  const goTo = (id?: string | null) => {
    if (!id) return;
    router.push(`/transacciones/${encodeURIComponent(id)}`);
  };

  const handleAction = async (action: "anular" | "rehabilitar") => {
    if (!currentId) return;
    setError(null);

    if (action === "anular") {
      setShowModal(true);
      return;
    }

    // rehabilitar
    setShowRehab(true);
  };

  const submitAnular = async () => {
    const trimmed = motivo.trim();
    if (!trimmed) {
      setError("El motivo de anulación es obligatorio");
      return;
    }
    setLoading("anular");
    setError(null);
    try {
      const url = `/api/transacciones/${encodeURIComponent(currentId)}/anular`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: trimmed }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "No se pudo completar la acción");
      setShowModal(false);
      setMotivo("");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  const [showRehab, setShowRehab] = useState(false);

  const submitRehab = async () => {
    setLoading("rehabilitar");
    setError(null);
    try {
      const url = `/api/transacciones/${encodeURIComponent(currentId)}/rehabilitar`;
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || "No se pudo completar la acción");
      setShowRehab(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setError(message);
    } finally {
      setLoading(null);
    }
  };

  const anulada = isAnulada(estado);

  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="ghost" disabled={!prevId} onClick={() => goTo(prevId)}>
        Anterior
      </Button>
      <Button size="sm" variant="ghost" disabled={!nextId} onClick={() => goTo(nextId)}>
        Siguiente
      </Button>
      <Button size="sm" variant="ghost" onClick={() => router.push("/transacciones")}>
        Volver a transacciones
      </Button>
      {!anulada ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={loading === "anular"}
          onClick={() => handleAction("anular")}
        >
          {loading === "anular" ? "Anulando..." : "Anular"}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          disabled={loading === "rehabilitar"}
          onClick={() => handleAction("rehabilitar")}
        >
          {loading === "rehabilitar" ? "Rehabilitando..." : "Rehabilitar"}
        </Button>
      )}
      <Modal
        open={showModal}
        title="¿Estás seguro de anular esta transacción?"
        description="Esta acción marcará la transacción como anulada y dejará de afectar los cálculos contables."
        confirmLabel={loading === "anular" ? "Anulando..." : "Confirmar anulación"}
        cancelLabel="Cancelar"
        loading={loading === "anular"}
        error={error}
        onClose={() => {
          if (loading === "anular") return;
          setShowModal(false);
          setMotivo("");
          setError(null);
        }}
        onConfirm={submitAnular}
      >
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Motivo de anulación
            <textarea
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={loading === "anular"}
            />
          </label>
        </div>
      </Modal>
      <Modal
        open={showRehab}
        title="¿Estás seguro de rehabilitar esta transacción?"
        description="Esta acción volverá a activar la transacción y hará que vuelva a afectar los cálculos contables del sistema."
        confirmLabel={loading === "rehabilitar" ? "Rehabilitando..." : "Confirmar rehabilitación"}
        cancelLabel="Cancelar"
        loading={loading === "rehabilitar"}
        error={error}
        onClose={() => {
          if (loading === "rehabilitar") return;
          setShowRehab(false);
          setError(null);
        }}
        onConfirm={submitRehab}
      />
    </div>
  );
}
