"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { FormField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast-provider";
import { generateArInvoiceNo } from "@/lib/document-numbers";
import { formatIntegerInput, parseFormattedInteger } from "@/lib/number-input";

type CustomerOption = {
  _id: string;
  code: string;
  name: string;
};

type ProjectOption = {
  _id: string;
  code: string;
  name: string;
  customerSnapshot?: {
    partyId?: string;
  } | null;
};

type ContractOption = {
  contractId: string;
  contractNo: string;
  title: string;
  contractType: string;
  contractAmount: number;
  currency: string;
  customerSnapshot?: {
    partyId?: string;
  } | null;
  projectSnapshot?: {
    projectId?: string;
  } | null;
  billingSummary?: {
    contractAmount?: number;
    billedAmount?: number;
    remainingBillableAmount?: number;
    invoiceCount?: number;
  } | null;
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

export default function Page() {
  const router = useRouter();
  const { pushToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [customerPartyId, setCustomerPartyId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contractId, setContractId] = useState("");
  const [form, setForm] = useState(() => ({
    invoiceNo: generateArInvoiceNo(),
    invoiceDate: getToday(),
    dueDate: getToday(),
    totalAmount: "",
    currency: "KRW",
  }));

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      setLoadingCustomers(true);
      try {
        const response = await fetch("/api/ar/options");
        const json = await response.json();

        if (cancelled) {
          return;
        }

        if (!json.ok) {
          pushToast({
            title: "고객 조회 실패",
            description: json.message || "고객 목록을 불러오지 못했습니다.",
            tone: "warning",
          });
          return;
        }

        setCustomers(Array.isArray(json.data?.customers) ? json.data.customers : []);
        const nextProjects = Array.isArray(json.data?.projects) ? json.data.projects : [];
        const nextContracts = Array.isArray(json.data?.contracts) ? json.data.contracts : [];
        setProjects(nextProjects);
        setContracts(nextContracts);
        if (
          !projectId &&
          typeof json.meta?.defaultProjectId === "string" &&
          json.meta.defaultProjectId
        ) {
          setProjectId(json.meta.defaultProjectId);
        } else if (!projectId && nextProjects.length === 1) {
          setProjectId(nextProjects[0]._id);
        }
      } catch {
        if (!cancelled) {
          pushToast({
            title: "고객 조회 실패",
            description: "고객 목록을 불러오는 중 오류가 발생했습니다.",
            tone: "warning",
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingCustomers(false);
        }
      }
    }

    void loadOptions();

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const selectedProject = projects.find((project) => project._id === projectId);
    const projectCustomerPartyId =
      selectedProject?.customerSnapshot && typeof selectedProject.customerSnapshot === "object"
        ? String(selectedProject.customerSnapshot.partyId ?? "")
        : "";

    if (!projectCustomerPartyId) {
      return;
    }

    if (!customerPartyId || customerPartyId !== projectCustomerPartyId) {
      setCustomerPartyId(projectCustomerPartyId);
    }
  }, [customerPartyId, projectId, projects]);

  const filteredContracts = contracts.filter((contract) => {
    const contractProjectId =
      contract.projectSnapshot && typeof contract.projectSnapshot === "object"
        ? String(contract.projectSnapshot.projectId ?? "")
        : "";
    const contractCustomerPartyId =
      contract.customerSnapshot && typeof contract.customerSnapshot === "object"
        ? String(contract.customerSnapshot.partyId ?? "")
        : "";

    const matchesProject = !projectId || contractProjectId === projectId;
    const matchesCustomer = !customerPartyId || contractCustomerPartyId === customerPartyId;
    return matchesProject && matchesCustomer;
  });

  useEffect(() => {
    if (!contractId) {
      return;
    }

    if (!filteredContracts.some((contract) => contract.contractId === contractId)) {
      setContractId("");
    }
  }, [contractId, filteredContracts]);

  const selectedContract =
    filteredContracts.find((contract) => contract.contractId === contractId) ?? null;
  const remainingBillableAmount = Number(
    selectedContract?.billingSummary?.remainingBillableAmount ?? 0,
  );
  const billedAmount = Number(selectedContract?.billingSummary?.billedAmount ?? 0);
  const requestedAmount = parseFormattedInteger(form.totalAmount);
  const isBillableAmountExceeded = !!selectedContract && requestedAmount > remainingBillableAmount;

  useEffect(() => {
    if (!selectedContract) {
      return;
    }

    const nextProjectId =
      selectedContract.projectSnapshot && typeof selectedContract.projectSnapshot === "object"
        ? String(selectedContract.projectSnapshot.projectId ?? "")
        : "";
    const nextCustomerPartyId =
      selectedContract.customerSnapshot && typeof selectedContract.customerSnapshot === "object"
        ? String(selectedContract.customerSnapshot.partyId ?? "")
        : "";

    if (nextProjectId && nextProjectId !== projectId) {
      setProjectId(nextProjectId);
    }
    if (nextCustomerPartyId && nextCustomerPartyId !== customerPartyId) {
      setCustomerPartyId(nextCustomerPartyId);
    }

    setForm((prev) => ({
      ...prev,
      currency: selectedContract.currency || prev.currency,
      totalAmount:
        prev.totalAmount ||
        formatIntegerInput(
          remainingBillableAmount > 0 ? remainingBillableAmount : selectedContract.contractAmount,
        ),
    }));
  }, [
    customerPartyId,
    projectId,
    remainingBillableAmount,
    selectedContract,
  ]);

  const update = (key: keyof typeof form) => (value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: key === "totalAmount" ? formatIntegerInput(value) : value,
    }));
  };

  const handleSubmit = async () => {
    if (
      !customerPartyId ||
      !projectId ||
      !contractId ||
      !form.invoiceDate ||
      !form.dueDate ||
      !form.totalAmount
    ) {
      pushToast({
        title: "필수 입력",
        description: "고객, 프로젝트, 계약, 청구일, 만기일, 총액을 확인해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (selectedContract && requestedAmount > remainingBillableAmount) {
      pushToast({
        title: "청구 가능 금액 초과",
        description: `남은 청구 가능 금액 ${remainingBillableAmount.toLocaleString()}원을 초과할 수 없습니다.`,
        tone: "warning",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/ar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerPartyId,
          projectId,
          contractId,
          invoiceDate: form.invoiceDate,
          dueDate: form.dueDate,
          totalAmount: parseFormattedInteger(form.totalAmount),
          currency: form.currency,
        }),
      });
      const json = await res.json();

      if (json.ok) {
        pushToast({
          title: "등록 완료",
          description: "AR가 등록되었습니다.",
          tone: "success",
        });
        router.push("/finance/ar");
        return;
      }

      pushToast({
        title: "등록 실패",
        description: json.message || "AR를 저장하지 못했습니다.",
        tone: "warning",
      });
    } catch {
      pushToast({
        title: "오류",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="AR 등록"
        description="매출전표를 등록하고 이후 발행 및 수금 흐름으로 이어집니다."
        actions={
          <>
            <Link
              href="/finance/ar"
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
            >
              취소
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </>
        }
      />

      <Panel className="p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="청구번호" type="readonly" value={form.invoiceNo} />
          <FormField
            label="고객"
            required
            type="select"
            value={customerPartyId}
            onChange={setCustomerPartyId}
            options={customers.map((customer) => ({
              label: `${customer.code} · ${customer.name}`,
              value: customer._id,
            }))}
          />
          <FormField
            label="프로젝트"
            required
            type="select"
            value={projectId}
            onChange={setProjectId}
            options={projects.map((project) => ({
              label: `${project.code} · ${project.name}`,
              value: project._id,
            }))}
          />
          <FormField
            label="계약"
            required
            type="select"
            value={contractId}
            onChange={setContractId}
            options={filteredContracts.map((contract) => ({
              label: `${contract.contractNo} · ${contract.title}`,
              value: contract.contractId,
            }))}
          />
          <FormField
            label="청구일"
            required
            type="date"
            value={form.invoiceDate}
            onChange={update("invoiceDate")}
          />
          <FormField
            label="만기일"
            required
            type="date"
            value={form.dueDate}
            onChange={update("dueDate")}
          />
          <FormField
            label="총액"
            required
            type="text"
            inputMode="numeric"
            value={form.totalAmount}
            onChange={update("totalAmount")}
            placeholder="0"
          />
          <FormField
            label="통화"
            type="select"
            value={form.currency}
            onChange={update("currency")}
            options={[
              { label: "KRW", value: "KRW" },
              { label: "USD", value: "USD" },
            ]}
          />
        </div>
        {selectedContract ? (
          <div className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  계약 금액
                </div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                  {formatIntegerInput(selectedContract.contractAmount)}원
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  기청구 금액
                </div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                  {formatIntegerInput(billedAmount)}원
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  남은 청구 가능 금액
                </div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                  {formatIntegerInput(remainingBillableAmount)}원
                </div>
              </div>
              <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-[color:var(--text-muted)]">
                  발행 건수
                </div>
                <div className="mt-1 text-sm font-semibold text-[color:var(--text)]">
                  {selectedContract.billingSummary?.invoiceCount ?? 0}건
                </div>
              </div>
            </div>
          </div>
        ) : null}
        {loadingCustomers ? (
          <p className="mt-4 text-xs text-[color:var(--text-muted)]">고객/프로젝트/계약 옵션을 불러오는 중입니다.</p>
        ) : null}
        {!loadingCustomers && projectId && customerPartyId && filteredContracts.length === 0 ? (
          <p className="mt-4 text-xs font-medium text-[color:var(--danger)]">
            선택한 고객과 프로젝트에 연결된 청구 가능 계약이 없습니다.
          </p>
        ) : null}
        {selectedContract ? (
          isBillableAmountExceeded ? (
            <p className="mt-4 text-sm font-medium text-[color:var(--danger)]">
              입력 금액이 남은 청구 가능 금액 {remainingBillableAmount.toLocaleString()}원을 초과했습니다.
            </p>
          ) : (
            <p className="mt-4 text-sm text-[color:var(--text-muted)]">
              남은 청구 가능 금액은 {remainingBillableAmount.toLocaleString()}원입니다.
            </p>
          )
        ) : null}
      </Panel>
    </>
  );
}
