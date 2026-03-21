"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { DataTable } from "@/components/ui/data-table";
import { Drawer } from "@/components/ui/drawer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { DatePicker } from "@/components/ui/date-picker";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import type { MaterialCertificate } from "@/lib/material-certificates";

type MaterialDetail = {
  _id: string;
  materialCode: string;
  description: string;
  specification?: string;
  uom: string;
  manufacturerName?: string;
  category?: string;
  status: string;
  certificates: MaterialCertificate[];
};

type CertificateDraft = {
  itemIndex: number | null;
  type: string;
  certNo: string;
  issuedAt: string;
  validTo: string;
  status: string;
  note: string;
};

const emptyCertificateDraft: CertificateDraft = {
  itemIndex: null,
  type: "",
  certNo: "",
  issuedAt: "",
  validTo: "",
  status: "valid",
  note: "",
};

const certificateStatusOptions = [
  { label: "유효", value: "valid" },
  { label: "검토 필요", value: "review" },
  { label: "만료", value: "expired" },
];

function getCertificateStatusLabel(value: string) {
  if (value === "expired") {
    return "만료";
  }

  if (value === "review") {
    return "검토 필요";
  }

  return "유효";
}

function getCertificateStatusTone(value: string) {
  if (value === "expired") {
    return "warning" as const;
  }

  if (value === "review") {
    return "info" as const;
  }

  return "success" as const;
}

export default function MaterialDetailPage() {
  const { materialId } = useParams<{ materialId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<MaterialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certificateDrawerOpen, setCertificateDrawerOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [certificateDraft, setCertificateDraft] = useState<CertificateDraft>(emptyCertificateDraft);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/materials/${materialId}`);
      const json = await res.json();
      if (json.ok) setDoc(json.data);
      else setError(json.message);
    }
    catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [materialId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateCertificateDraft =
    (key: keyof Omit<CertificateDraft, "itemIndex">) => (value: string) => {
      setCertificateDraft((current) => ({
        ...current,
        [key]: value,
      }));
    };

  const closeCertificateDrawer = () => {
    setCertificateDrawerOpen(false);
    setDeleteConfirmOpen(false);
    setCertificateDraft(emptyCertificateDraft);
  };

  const openNewCertificateDrawer = () => {
    setCertificateDraft(emptyCertificateDraft);
    setDeleteConfirmOpen(false);
    setCertificateDrawerOpen(true);
  };

  const openEditCertificateDrawer = (item: MaterialCertificate, index: number) => {
    setCertificateDraft({
      itemIndex: index,
      type: item.type,
      certNo: item.certNo,
      issuedAt: item.issuedAt,
      validTo: item.validTo,
      status: item.status,
      note: item.note,
    });
    setDeleteConfirmOpen(false);
    setCertificateDrawerOpen(true);
  };

  const saveCertificates = async (certificates: MaterialCertificate[]) => {
    try {
      const res = await fetch(`/api/materials/${materialId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificates }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "저장 실패",
          description: json.message || "성적서를 저장하지 못했습니다.",
          tone: "warning",
        });
        return false;
      }

      setDoc(json.data);
      return true;
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
      return false;
    }
  };

  const handleSaveCertificate = async () => {
    if (!doc) {
      return;
    }

    if (!certificateDraft.type.trim()) {
      pushToast({
        title: "필수 입력",
        description: "성적서 유형을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextItem: MaterialCertificate = {
      type: certificateDraft.type.trim(),
      certNo: certificateDraft.certNo.trim(),
      issuedAt: certificateDraft.issuedAt,
      validTo: certificateDraft.validTo,
      status: certificateDraft.status || "valid",
      note: certificateDraft.note.trim(),
    };

    const nextCertificates =
      certificateDraft.itemIndex === null
        ? [nextItem, ...doc.certificates]
        : doc.certificates.map((item, index) =>
            index === certificateDraft.itemIndex ? nextItem : item,
          );

    const saved = await saveCertificates(nextCertificates);

    if (!saved) {
      return;
    }

    pushToast({
      title: certificateDraft.itemIndex === null ? "성적서 추가" : "성적서 수정",
      description: "성적서 정보가 저장되었습니다.",
      tone: "success",
    });
    closeCertificateDrawer();
  };

  const handleDeleteCertificate = async () => {
    if (!doc || certificateDraft.itemIndex === null) {
      return;
    }

    const nextCertificates = doc.certificates.filter(
      (_item, index) => index !== certificateDraft.itemIndex,
    );

    const saved = await saveCertificates(nextCertificates);

    if (!saved) {
      return;
    }

    pushToast({
      title: "성적서 삭제",
      description: "성적서가 삭제되었습니다.",
      tone: "success",
    });
    closeCertificateDrawer();
  };

  if (loading) return <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">로딩 중...</div>;
  if (error || !doc) return <div className="flex flex-col items-center justify-center py-20"><h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2><Link href="/supply-chain/materials" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link></div>;
  const canUpdateMaterial =
    doc.status !== "archived" &&
    canAccessAction(viewerPermissions, "material.update");

  async function archiveMaterial() {
    const res = await fetch(`/api/materials/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const json = await res.json();
    if (!json.ok) {
      pushToast({
        title: "보관 실패",
        description: json.message || "자재를 보관하지 못했습니다.",
        tone: "warning",
      });
      return;
    }

    pushToast({
      title: "자재 보관",
      description: "자재를 보관했습니다.",
      tone: "success",
    });
    setArchiveConfirmOpen(false);
    router.push("/supply-chain/materials");
  }

  const certificateRows = doc.certificates.map((item, index) => ({
    id: `${index}`,
    typeValue: item.type,
    type: <span className="font-medium text-[color:var(--text)]">{item.type}</span>,
    certNo: item.certNo || "-",
    issuedAt: item.issuedAt || "-",
    validTo: item.validTo || "-",
    status: <StatusBadge label={getCertificateStatusLabel(item.status)} tone={getCertificateStatusTone(item.status)} />,
  }));

  return (
    <>
      <PageHeader eyebrow="Supply Chain" title={doc.description} description={`${doc.materialCode} · ${doc.specification || ""}`}
        meta={[{ label: "Database", tone: "success" }, { label: doc.status, tone: doc.status === "active" ? "success" : "default" }]}
        actions={
          <>
            <Link href="/supply-chain/materials" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link>
            {doc.status !== "archived" ? (
              <PermissionLink permission="material.update" href={`/supply-chain/materials/${materialId}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">수정</PermissionLink>
            ) : null}
            {doc.status !== "archived" ? (
              <PermissionButton
                permission="material.archive"
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
              >
                보관
              </PermissionButton>
            ) : null}
          </>
        } />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">자재정보</h3>
          <dl className="grid gap-4 md:grid-cols-2">
            <DetailField label="자재코드" value={doc.materialCode} /><DetailField label="자재명" value={doc.description} />
            <DetailField label="규격" value={doc.specification} /><DetailField label="단위" value={doc.uom} />
            <DetailField label="제조사" value={doc.manufacturerName} /><DetailField label="분류" value={doc.category} />
            <DetailField label="상태" value={<StatusBadge label={doc.status} tone="success" />} />
          </dl></Panel>
        <DataTable
          title="성적서"
          description="자재 적합성 확인용 성적서와 시험 메타데이터를 관리합니다."
          actions={
            <PermissionButton
              permission="material.update"
              type="button"
              onClick={openNewCertificateDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              성적서 추가
            </PermissionButton>
          }
          columns={[
            { key: "type", label: "성적서 유형" },
            { key: "certNo", label: "문서번호" },
            { key: "issuedAt", label: "발행일" },
            { key: "validTo", label: "유효기한" },
            { key: "status", label: "상태" },
          ]}
          rows={certificateRows}
          getRowKey={(row) => String(row.id)}
          onRowClick={canUpdateMaterial ? (row) => {
            const index = Number(row.id);
            const item = doc.certificates[index];
            if (!Number.isNaN(index) && item) {
              openEditCertificateDrawer(item, index);
            }
          } : undefined}
          getRowAriaLabel={(row) => `${row.typeValue} 수정`}
          emptyState={{
            title: "등록된 성적서가 없습니다",
            description: "성적서 추가 버튼으로 관련 문서를 등록해 주세요.",
          }}
        />
      </div>

      <Drawer
        open={certificateDrawerOpen}
        onClose={closeCertificateDrawer}
        eyebrow="Certificates"
        title={certificateDraft.itemIndex === null ? "성적서 추가" : "성적서 수정"}
        description="자재에 연결되는 검사 성적서와 시험 기록 메타데이터를 관리합니다."
        footer={
          <>
            {certificateDraft.itemIndex !== null ? (
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeCertificateDrawer}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)]"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                void handleSaveCertificate();
              }}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              저장
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField
            label="성적서 유형"
            required
            value={certificateDraft.type}
            onChange={updateCertificateDraft("type")}
            placeholder="MTC, FAT, Type Test"
          />
          <FormField
            label="문서번호"
            value={certificateDraft.certNo}
            onChange={updateCertificateDraft("certNo")}
            placeholder="CERT-2026-001"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <DatePicker label="발행일" value={certificateDraft.issuedAt} onChange={updateCertificateDraft("issuedAt")} />
            <DatePicker label="유효기한" value={certificateDraft.validTo} onChange={updateCertificateDraft("validTo")} />
          </div>
          <FormField
            label="상태"
            type="select"
            value={certificateDraft.status}
            onChange={updateCertificateDraft("status")}
            options={certificateStatusOptions}
          />
          <FormField
            label="비고"
            type="textarea"
            value={certificateDraft.note}
            onChange={updateCertificateDraft("note")}
            placeholder="시험 범위, 비고, 주의사항"
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="성적서를 삭제할까요?"
        description="삭제한 성적서는 되돌릴 수 없습니다."
        confirmLabel="삭제"
        tone="danger"
        onConfirm={() => {
          void handleDeleteCertificate();
        }}
        onClose={() => setDeleteConfirmOpen(false)}
      />
      <ConfirmDialog
        open={archiveConfirmOpen}
        title="자재를 보관할까요?"
        description="보관된 자재는 목록에서 기본적으로 숨겨집니다."
        confirmLabel="보관"
        tone="danger"
        onConfirm={() => {
          void archiveMaterial();
        }}
        onClose={() => setArchiveConfirmOpen(false)}
      />
    </>
  );
}
