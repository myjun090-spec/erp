"use client";

import { Dialog } from "@/components/ui/dialog";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "info" | "success" | "warning" | "danger";
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "확인",
  cancelLabel = "취소",
  tone = "info",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const confirmClassName =
    tone === "danger"
      ? "border-[color:var(--danger)] bg-[color:var(--danger)] text-white"
      : "border-[color:var(--primary)] bg-[color:var(--primary)] text-white";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow="Confirm"
      title={title}
      description={description}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full border px-4 py-2 text-sm font-semibold ${confirmClassName}`}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4 text-sm leading-7 text-[color:var(--text-muted)]">
        이 작업은 확인 즉시 처리되며, 연결된 승인 이력과 감사 로그에도 함께 반영될 수 있도록 설계되어 있습니다.
      </div>
    </Dialog>
  );
}
