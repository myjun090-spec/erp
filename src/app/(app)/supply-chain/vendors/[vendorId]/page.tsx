"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { StatePanel } from "@/components/ui/state-panel";
import { useToast } from "@/components/ui/toast-provider";

type VendorDetail = {
  _id: string;
  code: string;
  name: string;
  legalName: string;
  taxId: string;
  country: string;
  status: string;
  contacts: Array<{ name: string; position: string; phone: string; email: string }>;
  qualifications: Array<{ type: string; certNo?: string; validTo?: string; status: string }>;
  purchaseOrders: Array<{ _id: string; poNo: string; projectSnapshot?: { name: string }; totalAmount: number; status: string }>;
};

export default function VendorDetailPage() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const router = useRouter();
  const { pushToast } = useToast();
  const [data, setData] = useState<VendorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vendors/${vendorId}`);
      const json = await res.json();
      if (!json.ok) {
        setError(json.message || "공급업체를 불러오지 못했습니다.");
        return;
      }
      setData(json.data);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function archiveVendor() {
    const response = await fetch(`/api/parties/${vendorId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    const json = await response.json();
    if (!json.ok) {
      pushToast({
        title: "보관 실패",
        description: json.message || "공급업체를 보관하지 못했습니다.",
        tone: "warning",
      });
      return;
    }

    pushToast({
      title: "공급업체 보관",
      description: "공급업체를 보관했습니다.",
      tone: "success",
    });
    setArchiveConfirmOpen(false);
    router.push("/supply-chain/vendors");
  }

  if (loading) return <StatePanel variant="loading" title="공급업체 로딩 중" description="공급업체 상세 정보를 불러오고 있습니다." />;
  if (error || !data) return <StatePanel variant="error" title="공급업체 조회 실패" description={error || "데이터가 없습니다."} />;

  const tabItems = [
    { value: "overview", label: "기본정보", caption: "공급업체 상세" },
    { value: "qualifications", label: "적격심사", count: data.qualifications.length, caption: "자격 인증 현황" },
    { value: "orders", label: "발주이력", count: data.purchaseOrders.length, caption: "발주 현황" },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Supply Chain"
        title={data.name}
        description={`${data.code} · ${data.taxId} · ${data.country}`}
        meta={[
          { label: "Vendor", tone: "warning" },
          { label: data.status, tone: data.status === "active" ? "success" : "default" },
        ]}
        actions={
          <>
            <Link
              href="/supply-chain/vendors"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              목록으로
            </Link>
            <PermissionLink
              permission="vendor.update"
              href={`/supply-chain/vendors/${vendorId}/edit`}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              수정
            </PermissionLink>
            {data.status !== "archived" ? (
              <PermissionButton
                permission="vendor.archive"
                type="button"
                onClick={() => setArchiveConfirmOpen(true)}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)]"
              >
                보관
              </PermissionButton>
            ) : null}
          </>
        }
      />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">기본정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="코드" value={data.code} />
              <DetailField label="업체명" value={data.name} />
              <DetailField label="법인명" value={data.legalName || "-"} />
              <DetailField label="사업자번호" value={data.taxId || "-"} />
              <DetailField label="국가" value={data.country} />
              <DetailField label="상태" value={<StatusBadge label={data.status} tone={data.status === "active" ? "success" : "default"} />} />
            </dl>
          </Panel>
          <Panel className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">연락처</h3>
            {data.contacts.length === 0 ? (
              <p className="text-sm text-[color:var(--text-muted)]">등록된 연락처가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                {data.contacts.map((contact) => (
                  <dl key={`${contact.name}-${contact.email}`} className="grid gap-4 md:grid-cols-2">
                    <DetailField label="담당자" value={`${contact.name || "-"} ${contact.position ? `(${contact.position})` : ""}`} />
                    <DetailField label="전화" value={contact.phone || "-"} />
                    <DetailField label="이메일" value={contact.email || "-"} />
                  </dl>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {activeTab === "qualifications" && (
        <DataTable
          title="적격심사 이력"
          description="공급업체 자격 인증 현황입니다."
          columns={[
            { key: "type", label: "인증유형" },
            { key: "certNo", label: "인증번호" },
            { key: "validUntil", label: "유효기한" },
            { key: "status", label: "상태" },
          ]}
          rows={data.qualifications.map((item) => ({
            type: <span className="font-medium">{item.type}</span>,
            certNo: <span className="font-mono">{item.certNo || "-"}</span>,
            validUntil: item.validTo || "-",
            status: <StatusBadge label={item.status === "valid" ? "적격" : item.status} tone={item.status === "valid" ? "success" : "warning"} />,
          }))}
          emptyState={{ title: "등록된 자격 인증이 없습니다" }}
        />
      )}

      {activeTab === "orders" && (
        <DataTable
          title="발주 이력"
          description="이 공급업체에 발주한 이력입니다."
          columns={[
            { key: "poNo", label: "발주번호" },
            { key: "project", label: "프로젝트" },
            { key: "amount", label: "금액", align: "right" },
            { key: "status", label: "상태" },
          ]}
          rows={data.purchaseOrders.map((item) => ({
            poNo: <Link href={`/supply-chain/purchase-orders/${item._id}`} className="font-medium text-[color:var(--primary)] hover:underline">{item.poNo}</Link>,
            project: item.projectSnapshot?.name || "-",
            amount: <span className="font-mono">₩ {Number(item.totalAmount || 0).toLocaleString()}</span>,
            status: <StatusBadge label={item.status} tone={item.status === "approved" ? "success" : "warning"} />,
          }))}
          emptyState={{ title: "발주 이력이 없습니다" }}
        />
      )}
      <ConfirmDialog
        open={archiveConfirmOpen}
        title="공급업체를 보관할까요?"
        description="보관된 공급업체는 목록에서 기본적으로 숨겨집니다."
        confirmLabel="보관"
        tone="danger"
        onClose={() => setArchiveConfirmOpen(false)}
        onConfirm={() => {
          void archiveVendor();
        }}
      />
    </>
  );
}
