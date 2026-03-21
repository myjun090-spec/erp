"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PurchaseOrderForm, type PurchaseOrderFormInitialValues } from "../../purchase-order-form";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

function toInitialValues(doc: Doc): PurchaseOrderFormInitialValues {
  return {
    poNo: typeof doc.poNo === "string" ? doc.poNo : "",
    vendorId:
      doc.vendorSnapshot && typeof doc.vendorSnapshot === "object"
        ? String(doc.vendorSnapshot.partyId ?? "")
        : "",
    projectId:
      doc.projectSnapshot && typeof doc.projectSnapshot === "object"
        ? String(doc.projectSnapshot.projectId ?? "")
        : "",
    wbsId:
      doc.wbsSnapshot && typeof doc.wbsSnapshot === "object"
        ? String(doc.wbsSnapshot.wbsId ?? "")
        : "",
    budgetId:
      doc.budgetSnapshot && typeof doc.budgetSnapshot === "object"
        ? String(doc.budgetSnapshot.budgetId ?? "")
        : "",
    orderDate: typeof doc.orderDate === "string" ? doc.orderDate : "",
    dueDate: typeof doc.dueDate === "string" ? doc.dueDate : "",
    currency: typeof doc.currency === "string" ? doc.currency : "KRW",
    lines: Array.isArray(doc.lines)
      ? doc.lines.map((line: Doc, index: number) => ({
          lineNo:
            typeof line.lineNo === "number" && line.lineNo > 0 ? line.lineNo : index + 1,
          materialId:
            line.materialSnapshot && typeof line.materialSnapshot === "object"
              ? String(line.materialSnapshot.materialId ?? "")
              : "",
          materialSnapshot: {
            materialId:
              line.materialSnapshot && typeof line.materialSnapshot === "object"
                ? String(line.materialSnapshot.materialId ?? "")
                : "",
            materialCode:
              line.materialSnapshot && typeof line.materialSnapshot === "object"
                ? String(line.materialSnapshot.materialCode ?? "")
                : "",
            description:
              line.materialSnapshot && typeof line.materialSnapshot === "object"
                ? String(line.materialSnapshot.description ?? "")
                : String(line.description ?? ""),
            uom:
              line.materialSnapshot && typeof line.materialSnapshot === "object"
                ? String(line.materialSnapshot.uom ?? "")
                : "",
          },
          quantity:
            typeof line.quantity === "number" ? line.quantity : Number(line.quantity || 0),
          unitPrice:
            typeof line.unitPrice === "number" ? line.unitPrice : Number(line.unitPrice || 0),
          lineAmount:
            typeof line.lineAmount === "number"
              ? line.lineAmount
              : Number(line.lineAmount ?? line.amount ?? 0),
        }))
      : [],
  };
}

export default function PurchaseOrderEditPage() {
  const { poId } = useParams<{ poId: string }>();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}`);
      const json = await res.json();
      if (json.ok) {
        setDoc(json.data);
      } else {
        setError(json.message || "발주를 불러오지 못했습니다.");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [poId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">
        로딩 중...
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-lg font-semibold text-[color:var(--danger)]">
          {error || "데이터 없음"}
        </h2>
        <Link
          href="/supply-chain/purchase-orders"
          className="mt-4 text-sm text-[color:var(--primary)]"
        >
          목록으로
        </Link>
      </div>
    );
  }

  return (
    <PurchaseOrderForm
      mode="edit"
      purchaseOrderId={poId}
      initialValues={toInitialValues(doc)}
    />
  );
}
