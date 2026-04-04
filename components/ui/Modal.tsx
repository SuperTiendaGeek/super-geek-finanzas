"use client";

import { ReactNode, useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
  error?: string | null;
};

export default function Modal({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onClose,
  onConfirm,
  loading = false,
  error = null,
}: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open && !loading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-lg rounded-xl bg-[var(--card-bg)] text-[var(--text-primary)] border border-[color:var(--border)] shadow-2xl">
        <div className="px-5 pt-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
        </div>
        <div className="px-5 py-4 space-y-3">{children}</div>
        {error ? <p className="px-5 pb-2 text-sm text-rose-600">{error}</p> : null}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <button
            className="rounded-md border border-[color:var(--border)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-60"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="rounded-md bg-[var(--btn-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-bg-hover)] disabled:opacity-60"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
