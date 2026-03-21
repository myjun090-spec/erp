"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PermissionButton } from "@/components/auth/permission-button";
import { PermissionLink } from "@/components/auth/permission-link";
import { useViewerPermissions } from "@/components/auth/viewer-permissions-context";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Drawer } from "@/components/ui/drawer";
import { FormField } from "@/components/ui/form-field";
import { Panel } from "@/components/ui/panel";
import { DetailField } from "@/components/ui/detail-field";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tabs } from "@/components/ui/tabs";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/components/ui/toast-provider";
import { canAccessAction } from "@/lib/navigation";
import { generateSiteCode, generateSystemCode, generateUnitNo } from "@/lib/document-numbers";
import { formatIntegerDisplay } from "@/lib/number-input";
import { getProjectDisciplineOptions } from "@/lib/project-disciplines";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;

type SiteDraft = {
  siteId: string | null;
  code: string;
  name: string;
  country: string;
  address: string;
  status: string;
};

type UnitDraft = {
  unitId: string | null;
  siteId: string;
  unitNo: string;
  capacity: string;
  status: string;
};

type SystemDraft = {
  systemId: string | null;
  unitId: string;
  code: string;
  name: string;
  discipline: string;
  status: string;
};

type WbsDraft = {
  wbsId: string | null;
  targetType: "unit" | "system";
  unitId: string;
  systemId: string;
  code: string;
  name: string;
  discipline: string;
  costCategory: string;
  status: string;
};

function parseWbsCode(code: string) {
  const match = code.match(/^WBS-(\d+)$/i);
  if (!match) {
    return null;
  }

  return {
    value: Number(match[1]),
    width: match[1].length,
  };
}

function getNextWbsCode(items: Doc[]) {
  let maxValue = 0;
  let width = 3;

  for (const item of items) {
    const parsed = parseWbsCode(String(item.code || ""));
    if (!parsed) {
      continue;
    }

    if (parsed.value > maxValue) {
      maxValue = parsed.value;
    }
    if (parsed.width > width) {
      width = parsed.width;
    }
  }

  return `WBS-${String(maxValue + 1).padStart(width, "0")}`;
}

type StructureCreateType = "unit" | "system";

const emptySiteDraft: SiteDraft = {
  siteId: null,
  code: "",
  name: "",
  country: "KR",
  address: "",
  status: "active",
};

const siteStatusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

const unitStatusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

const systemStatusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

const wbsStatusTone: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  planning: "info",
  active: "success",
  "on-hold": "warning",
  archived: "default",
};

const emptyWbsDraft: WbsDraft = {
  wbsId: null,
  targetType: "unit",
  unitId: "",
  systemId: "",
  code: "",
  name: "",
  discipline: "",
  costCategory: "direct",
  status: "active",
};

const emptySystemDraft: SystemDraft = {
  systemId: null,
  unitId: "",
  code: "",
  name: "",
  discipline: "",
  status: "active",
};

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { pushToast } = useToast();
  const viewerPermissions = useViewerPermissions();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [siteDrawerOpen, setSiteDrawerOpen] = useState(false);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(emptySiteDraft);
  const [unitDrawerOpen, setUnitDrawerOpen] = useState(false);
  const [unitSaving, setUnitSaving] = useState(false);
  const [unitDeleteConfirmOpen, setUnitDeleteConfirmOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState<UnitDraft>({
    unitId: null,
    siteId: "",
    unitNo: "",
    capacity: "",
    status: "active",
  });
  const [systemDrawerOpen, setSystemDrawerOpen] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemDeleteConfirmOpen, setSystemDeleteConfirmOpen] = useState(false);
  const [systemDraft, setSystemDraft] = useState<SystemDraft>(emptySystemDraft);
  const [structureCreateDrawerOpen, setStructureCreateDrawerOpen] = useState(false);
  const [structureCreateType, setStructureCreateType] = useState<StructureCreateType>("unit");
  const [wbsDrawerOpen, setWbsDrawerOpen] = useState(false);
  const [wbsSaving, setWbsSaving] = useState(false);
  const [wbsDeleteConfirmOpen, setWbsDeleteConfirmOpen] = useState(false);
  const [wbsDraft, setWbsDraft] = useState<WbsDraft>(emptyWbsDraft);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch(`/api/projects/${projectId}`); const json = await res.json(); if (json.ok) setDoc(json.data); else setError(json.message); }
    catch { setError("네트워크 오류"); } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex items-center justify-center py-20 text-[color:var(--text-muted)]">로딩 중...</div>;
  if (error || !doc) return <div className="flex flex-col items-center justify-center py-20"><h2 className="text-lg font-semibold text-[color:var(--danger)]">{error || "데이터 없음"}</h2><Link href="/projects" className="mt-4 text-sm text-[color:var(--primary)]">목록으로</Link></div>;

  const sites = doc._sites || doc.siteSummaries || [];
  const units = doc._units || doc.unitSummaries || [];
  const systems = doc._systems || [];
  const wbs = doc._wbs || [];
  const unitMap = new Map(
    units.map((unit: Doc) => [String(unit._id || unit.unitId || ""), unit] as const),
  );
  const availableWbsSystems = systems.filter((system: Doc) =>
    unitMap.has(String(system.unitSnapshot?.unitId || "")),
  );
  const wbsUnitOptions = units.map((unit: Doc) => ({
    label: `${unit.unitNo}`,
    value: String(unit._id || unit.unitId || ""),
  }));
  const wbsSystemOptions = availableWbsSystems.map((system: Doc) => {
    const unit = unitMap.get(String(system.unitSnapshot?.unitId || "")) as Doc | undefined;

    return {
      label: `${unit?.unitNo || system.unitSnapshot?.unitNo || "-"} · ${system.name || system.code}${
        system.code ? ` (${system.code})` : ""
      }`,
      value: String(system._id || system.systemId || ""),
    };
  });
  const tabItems = [
    { value: "overview", label: "기본정보", caption: "프로젝트 상세" },
    { value: "sites", label: "현장", count: sites.length, caption: "프로젝트 현장 목록" },
    { value: "units", label: "유닛/시스템", count: units.length + systems.length, caption: "유닛과 시스템 구조" },
    { value: "wbs", label: "WBS", count: wbs.length, caption: "Work Breakdown Structure" },
  ];
  const canCreateSite = canAccessAction(viewerPermissions, "site.create");
  const canUpdateSite = canAccessAction(viewerPermissions, "site.update");
  const canCreateUnit = canAccessAction(viewerPermissions, "unit.create");
  const canUpdateUnit = canAccessAction(viewerPermissions, "unit.update");
  const canCreateSystem = canAccessAction(viewerPermissions, "system.create");
  const canUpdateSystem = canAccessAction(viewerPermissions, "system.update");
  const canCreateWbs = canAccessAction(viewerPermissions, "wbs.create");
  const canUpdateWbs = canAccessAction(viewerPermissions, "wbs.update");
  const systemDisciplineOptions = getProjectDisciplineOptions(
    systemDraft.systemId ? systemDraft.discipline : undefined,
  );

  const closeSiteDrawer = () => {
    setSiteDrawerOpen(false);
    setSiteDraft(emptySiteDraft);
  };

  const closeUnitDrawer = () => {
    setUnitDrawerOpen(false);
    setUnitDeleteConfirmOpen(false);
    setUnitDraft({
      unitId: null,
      siteId: "",
      unitNo: "",
      capacity: "",
      status: "active",
    });
  };

  const closeSystemDrawer = () => {
    setSystemDrawerOpen(false);
    setSystemDeleteConfirmOpen(false);
    setSystemDraft(emptySystemDraft);
  };

  const closeStructureCreateDrawer = () => {
    setStructureCreateDrawerOpen(false);
    setStructureCreateType("unit");
    setUnitDraft({
      unitId: null,
      siteId: "",
      unitNo: "",
      capacity: "",
      status: "active",
    });
    setSystemDraft(emptySystemDraft);
  };

  const closeWbsDrawer = () => {
    setWbsDrawerOpen(false);
    setWbsDeleteConfirmOpen(false);
    setWbsDraft(emptyWbsDraft);
  };

  const updateSiteDraft = (key: keyof Omit<SiteDraft, "siteId">) => (value: string) => {
    setSiteDraft((current) => ({ ...current, [key]: value }));
  };

  const openNewSiteDrawer = () => {
    setSiteDraft({
      ...emptySiteDraft,
      code: generateSiteCode(),
    });
    setSiteDrawerOpen(true);
  };

  const openEditSiteDrawer = (site: Doc) => {
    setSiteDraft({
      siteId: String(site._id),
      code: String(site.code || ""),
      name: String(site.name || ""),
      country: String(site.country || "KR"),
      address: String(site.address || ""),
      status: String(site.status || "active"),
    });
    setSiteDrawerOpen(true);
  };

  const updateUnitDraft = (key: keyof Omit<UnitDraft, "unitId">) => (value: string) => {
    setUnitDraft((current) => ({ ...current, [key]: value }));
  };

  const updateSystemDraft = (key: keyof Omit<SystemDraft, "systemId">) => (value: string) => {
    setSystemDraft((current) => ({ ...current, [key]: value }));
  };

  const updateWbsDraft = (key: keyof Omit<WbsDraft, "wbsId">) => (value: string) => {
    setWbsDraft((current) => {
      if (key === "targetType") {
        if (value === "system" && availableWbsSystems.length === 0) {
          pushToast({
            title: "시스템 데이터 필요",
            description: "시스템 연결 WBS를 만들려면 먼저 시스템을 등록해 주세요.",
            tone: "warning",
          });
          return current;
        }

        return {
          ...current,
          targetType: value === "system" ? "system" : "unit",
          systemId: value === "system" ? current.systemId : "",
          discipline: value === "system" ? current.discipline : "",
        };
      }

      if (key === "systemId") {
        const nextSystem = availableWbsSystems.find(
          (system: Doc) => String(system._id || system.systemId || "") === value,
        );

        return {
          ...current,
          unitId: String(nextSystem?.unitSnapshot?.unitId || ""),
          systemId: value,
          discipline: String(nextSystem?.discipline || nextSystem?.systemSnapshot?.discipline || ""),
        };
      }

      return { ...current, [key]: value };
    });
  };

  const prepareNewUnitDraft = () => {
    const firstSite = sites[0] as Doc | undefined;
    return {
      unitId: null,
      siteId: String(firstSite?._id || firstSite?.siteId || ""),
      unitNo: generateUnitNo(),
      capacity: "",
      status: "active",
    } satisfies UnitDraft;
  };

  const prepareNewSystemDraft = () => {
    const firstUnit = units[0] as Doc | undefined;
    return {
      systemId: null,
      unitId: String(firstUnit?._id || firstUnit?.unitId || ""),
      code: generateSystemCode(),
      name: "",
      discipline: "",
      status: "active",
    } satisfies SystemDraft;
  };

  const openCreateStructureDrawer = (type: StructureCreateType = "unit") => {
    if (sites.length === 0) {
      pushToast({
        title: "현장 먼저 등록",
        description: "유닛 또는 시스템을 추가하려면 먼저 현장을 등록해 주세요.",
        tone: "warning",
      });
      return;
    }

    const nextType = type === "system" && units.length === 0 ? "unit" : type;
    if (type === "system" && units.length === 0) {
      pushToast({
        title: "유닛 먼저 등록",
        description: "시스템은 유닛 하위에 생성되므로 먼저 유닛을 추가해 주세요.",
        tone: "warning",
      });
    }

    setStructureCreateType(nextType);
    setUnitDraft(prepareNewUnitDraft());
    setSystemDraft(prepareNewSystemDraft());
    setStructureCreateDrawerOpen(true);
  };

  const handleStructureCreateTypeChange = (value: string) => {
    const nextType = value === "system" ? "system" : "unit";
    if (nextType === "system" && units.length === 0) {
      pushToast({
        title: "유닛 먼저 등록",
        description: "시스템은 유닛 하위에 생성되므로 먼저 유닛을 추가해 주세요.",
        tone: "warning",
      });
      return;
    }

    setStructureCreateType(nextType);
    if (nextType === "unit") {
      setUnitDraft(prepareNewUnitDraft());
      return;
    }
    setSystemDraft(prepareNewSystemDraft());
  };

  const openEditUnitDrawer = (unit: Doc) => {
    setUnitDraft({
      unitId: String(unit._id),
      siteId: String(unit.siteSnapshot?.siteId || ""),
      unitNo: String(unit.unitNo || ""),
      capacity: String(unit.capacity || ""),
      status: String(unit.status || "active"),
    });
    setUnitDeleteConfirmOpen(false);
    setUnitDrawerOpen(true);
  };

  const openEditSystemDrawer = (system: Doc) => {
    setSystemDraft({
      systemId: String(system._id),
      unitId: String(system.unitSnapshot?.unitId || ""),
      code: String(system.code || ""),
      name: String(system.name || ""),
      discipline: String(system.discipline || ""),
      status: String(system.status || "active"),
    });
    setSystemDeleteConfirmOpen(false);
    setSystemDrawerOpen(true);
  };

  const openNewWbsDrawer = () => {
    if (units.length === 0) {
      pushToast({
        title: "유닛 먼저 등록",
        description: "WBS는 유닛 또는 시스템 기준으로 생성되므로 먼저 유닛을 추가해 주세요.",
        tone: "warning",
      });
      return;
    }

    const firstUnit = units[0] as Doc | undefined;

    setWbsDraft({
      ...emptyWbsDraft,
      targetType: "unit",
      unitId: String(firstUnit?._id || firstUnit?.unitId || ""),
      systemId: "",
      code: getNextWbsCode(wbs),
      discipline: "",
    });
    setWbsDrawerOpen(true);
  };

  const openEditWbsDrawer = (item: Doc) => {
    setWbsDraft({
      wbsId: String(item._id),
      targetType: item.systemSnapshot?.systemId ? "system" : "unit",
      unitId: String(item.unitSnapshot?.unitId || ""),
      systemId: String(item.systemSnapshot?.systemId || ""),
      code: String(item.code || ""),
      name: String(item.name || ""),
      discipline: String(item.discipline || item.systemSnapshot?.discipline || ""),
      costCategory: String(item.costCategory || "direct"),
      status: String(item.status || "active"),
    });
    setWbsDeleteConfirmOpen(false);
    setWbsDrawerOpen(true);
  };

  const handleSaveSite = async () => {
    if (!siteDraft.name.trim()) {
      pushToast({
        title: "필수 입력",
        description: "현장명을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSiteSaving(true);
    try {
      const endpoint = siteDraft.siteId
        ? `/api/projects/${projectId}/sites/${siteDraft.siteId}`
        : `/api/projects/${projectId}/sites`;
      const method = siteDraft.siteId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: siteDraft.code,
          name: siteDraft.name,
          country: siteDraft.country,
          address: siteDraft.address,
          status: siteDraft.status,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: siteDraft.siteId ? "현장 수정 실패" : "현장 추가 실패",
          description: json.message || "현장을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeSiteDrawer();
      pushToast({
        title: siteDraft.siteId ? "현장 수정 완료" : "현장 추가 완료",
        description: "프로젝트 현장 정보가 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: siteDraft.siteId ? "현장 수정 실패" : "현장 추가 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSiteSaving(false);
    }
  };

  const saveUnitDraft = async (onSuccess: () => void) => {
    if (!unitDraft.siteId) {
      pushToast({
        title: "현장 선택 필요",
        description: "유닛이 속할 현장을 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    setUnitSaving(true);
    try {
      const endpoint = unitDraft.unitId
        ? `/api/projects/${projectId}/units/${unitDraft.unitId}`
        : `/api/projects/${projectId}/units`;
      const method = unitDraft.unitId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: unitDraft.siteId,
          unitNo: unitDraft.unitNo,
          capacity: unitDraft.capacity,
          status: unitDraft.status,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: unitDraft.unitId ? "유닛 수정 실패" : "유닛 추가 실패",
          description: json.message || "유닛을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      onSuccess();
      pushToast({
        title: unitDraft.unitId ? "유닛 수정 완료" : "유닛 추가 완료",
        description: "유닛 정보가 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: unitDraft.unitId ? "유닛 수정 실패" : "유닛 추가 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setUnitSaving(false);
    }
  };

  const handleSaveUnit = async () => {
    await saveUnitDraft(closeUnitDrawer);
  };

  const handleDeleteUnit = async () => {
    if (!unitDraft.unitId) {
      return;
    }

    setUnitSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/units/${unitDraft.unitId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "유닛 삭제 실패",
          description: json.message || "유닛을 삭제하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeUnitDrawer();
      pushToast({
        title: "유닛 삭제 완료",
        description: "유닛이 프로젝트에서 제거되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "유닛 삭제 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setUnitSaving(false);
    }
  };

  const saveSystemDraft = async (onSuccess: () => void) => {
    if (!systemDraft.unitId) {
      pushToast({
        title: "유닛 선택 필요",
        description: "시스템이 속할 유닛을 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (!systemDraft.name.trim()) {
      pushToast({
        title: "필수 입력",
        description: "시스템명을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (!systemDraft.discipline) {
      pushToast({
        title: "필수 선택",
        description: "전문분야를 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    setSystemSaving(true);
    try {
      const endpoint = systemDraft.systemId
        ? `/api/projects/${projectId}/systems/${systemDraft.systemId}`
        : `/api/projects/${projectId}/systems`;
      const method = systemDraft.systemId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: systemDraft.unitId,
          code: systemDraft.code,
          name: systemDraft.name,
          discipline: systemDraft.discipline,
          status: systemDraft.status,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: systemDraft.systemId ? "시스템 수정 실패" : "시스템 추가 실패",
          description: json.message || "시스템을 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      onSuccess();
      pushToast({
        title: systemDraft.systemId ? "시스템 수정 완료" : "시스템 추가 완료",
        description: "시스템 정보가 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: systemDraft.systemId ? "시스템 수정 실패" : "시스템 추가 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSystemSaving(false);
    }
  };

  const handleSaveSystem = async () => {
    await saveSystemDraft(closeSystemDrawer);
  };

  const handleDeleteSystem = async () => {
    if (!systemDraft.systemId) {
      return;
    }

    setSystemSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/systems/${systemDraft.systemId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "시스템 삭제 실패",
          description: json.message || "시스템을 삭제하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeSystemDrawer();
      pushToast({
        title: "시스템 삭제 완료",
        description: "시스템이 프로젝트에서 제거되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "시스템 삭제 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setSystemSaving(false);
    }
  };

  const handleSaveStructure = async () => {
    if (structureCreateType === "unit") {
      await saveUnitDraft(closeStructureCreateDrawer);
      return;
    }

    await saveSystemDraft(closeStructureCreateDrawer);
  };

  const handleSaveWbs = async () => {
    if (wbsDraft.targetType === "unit" && !wbsDraft.unitId) {
      pushToast({
        title: "유닛 선택 필요",
        description: "WBS가 속할 유닛을 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    if (wbsDraft.targetType === "system" && !wbsDraft.systemId) {
      pushToast({
        title: "시스템 선택 필요",
        description: "WBS가 속할 시스템을 선택해 주세요.",
        tone: "warning",
      });
      return;
    }

    const selectedSystem =
      wbsDraft.targetType === "system"
        ? (availableWbsSystems.find(
            (system: Doc) => String(system._id || system.systemId || "") === wbsDraft.systemId,
          ) as Doc | undefined)
        : undefined;
    const selectedUnitId =
      wbsDraft.targetType === "system"
        ? String(selectedSystem?.unitSnapshot?.unitId || "")
        : wbsDraft.unitId;

    if (!selectedUnitId) {
      pushToast({
        title: "유닛 확인 필요",
        description: "선택한 대상에 연결된 유닛 정보를 찾지 못했습니다.",
        tone: "warning",
      });
      return;
    }

    if (!wbsDraft.name.trim()) {
      pushToast({
        title: "필수 입력",
        description: "WBS명을 입력해 주세요.",
        tone: "warning",
      });
      return;
    }

    setWbsSaving(true);
    try {
      const endpoint = wbsDraft.wbsId
        ? `/api/projects/${projectId}/wbs/${wbsDraft.wbsId}`
        : `/api/projects/${projectId}/wbs`;
      const method = wbsDraft.wbsId ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: selectedUnitId,
          systemId: wbsDraft.targetType === "system" ? wbsDraft.systemId : "",
          code: wbsDraft.code,
          name: wbsDraft.name,
          costCategory: wbsDraft.costCategory,
          status: wbsDraft.status,
        }),
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: wbsDraft.wbsId ? "WBS 수정 실패" : "WBS 추가 실패",
          description: json.message || "WBS를 저장하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeWbsDrawer();
      pushToast({
        title: wbsDraft.wbsId ? "WBS 수정 완료" : "WBS 추가 완료",
        description: "프로젝트 WBS 구조가 반영되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: wbsDraft.wbsId ? "WBS 수정 실패" : "WBS 추가 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setWbsSaving(false);
    }
  };

  const handleDeleteWbs = async () => {
    if (!wbsDraft.wbsId) {
      return;
    }

    setWbsSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/wbs/${wbsDraft.wbsId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!json.ok) {
        pushToast({
          title: "WBS 삭제 실패",
          description: json.message || "WBS를 삭제하지 못했습니다.",
          tone: "warning",
        });
        return;
      }

      await fetchData();
      closeWbsDrawer();
      pushToast({
        title: "WBS 삭제 완료",
        description: "WBS가 프로젝트 구조에서 제거되었습니다.",
        tone: "success",
      });
    } catch {
      pushToast({
        title: "WBS 삭제 실패",
        description: "네트워크 오류가 발생했습니다.",
        tone: "warning",
      });
    } finally {
      setWbsSaving(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow="Projects" title={doc.name} description={`${doc.code} · ${doc.customerSnapshot?.name || "-"} · ${doc.projectType}`}
        meta={[{ label: "Database", tone: "success" }, { label: doc.status, tone: doc.status === "active" ? "success" : "info" }]}
        actions={<><Link href="/projects" className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]">목록으로</Link><PermissionLink permission="project.update" href={`/projects/${doc._id}/edit`} className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">수정</PermissionLink></>} />
      <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
      {activeTab === "overview" && (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">프로젝트 정보</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="프로젝트코드" value={doc.code} /><DetailField label="프로젝트명" value={doc.name} />
              <DetailField label="프로젝트유형" value={doc.projectType} /><DetailField label="고객" value={doc.customerSnapshot?.name} />
              <DetailField label="시작일" value={doc.startDate} /><DetailField label="종료일" value={doc.endDate} />
              <DetailField label="통화" value={doc.currency} /><DetailField label="상태" value={<StatusBadge label={doc.status} tone="success" />} />
            </dl></Panel>
          <Panel className="p-5"><h3 className="mb-4 text-sm font-semibold text-[color:var(--text)]">요약</h3>
            <dl className="grid gap-4 md:grid-cols-2">
              <DetailField label="현장 수" value={`${formatIntegerDisplay(sites.length)}개`} /><DetailField label="유닛 수" value={`${formatIntegerDisplay(units.length)}개`} />
              <DetailField label="WBS 수" value={`${formatIntegerDisplay(wbs.length)}개`} />
            </dl></Panel>
        </div>)}
      {activeTab === "sites" && <DataTable title="현장 목록" description="프로젝트에 등록된 현장입니다."
        actions={
          <PermissionButton
            permission="site.create"
            type="button"
            onClick={openNewSiteDrawer}
            className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            현장 추가
          </PermissionButton>
        }
        columns={[{ key: "code", label: "현장코드" }, { key: "name", label: "현장명" }, { key: "country", label: "국가" }, { key: "status", label: "상태" }]}
        rows={sites.map((s: Doc) => ({
          id: String(s._id || s.siteId || s.code),
          siteRef: s,
          codeValue: String(s.code || ""),
          code: <span className="font-mono">{s.code}</span>,
          name: <span className="font-medium">{s.name}</span>,
          country: s.country || "-",
          status: <StatusBadge label={s.status || "active"} tone={siteStatusTone[s.status || "active"] || "success"} />,
        }))}
        getRowKey={(row) => String(row.id)}
        onRowClick={canUpdateSite ? (row) => openEditSiteDrawer(row.siteRef as Doc) : undefined}
        getRowAriaLabel={(row) => `${String(row.codeValue)} 현장 수정 열기`}
        emptyState={{
          title: "등록된 현장이 없습니다",
          description: "현장 추가로 프로젝트 현장을 등록해 주세요.",
          action: canCreateSite ? (
            <PermissionButton
              permission="site.create"
              type="button"
              onClick={openNewSiteDrawer}
              className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
            >
              현장 추가
            </PermissionButton>
          ) : null,
        }}
      />}
      {activeTab === "units" && (
        <div className="space-y-6">
          <DataTable title="유닛 목록" description="프로젝트 현장 하위 유닛을 관리합니다."
            actions={
              <PermissionButton
                permission="unit.create"
                type="button"
                onClick={() => openCreateStructureDrawer("unit")}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                추가
              </PermissionButton>
            }
            columns={[{ key: "site", label: "현장" }, { key: "unitNo", label: "유닛번호" }, { key: "capacity", label: "용량" }, { key: "status", label: "상태" }]}
            rows={units.map((u: Doc) => ({
              id: String(u._id || u.unitId || u.unitNo),
              unitRef: u,
              unitNoValue: String(u.unitNo || ""),
              site: u.siteSnapshot?.name || "-",
              unitNo: <span className="font-mono font-medium">{u.unitNo}</span>,
              capacity: u.capacity || "-",
              status: <StatusBadge label={u.status || "active"} tone={unitStatusTone[u.status || "active"] || "success"} />,
            }))}
            getRowKey={(row) => String(row.id)}
            onRowClick={canUpdateUnit ? (row) => openEditUnitDrawer(row.unitRef as Doc) : undefined}
            getRowAriaLabel={(row) => `${String(row.unitNoValue)} 유닛 수정 열기`}
            emptyState={{
              title: "등록된 유닛이 없습니다",
              description:
                sites.length === 0
                  ? "현장을 먼저 등록한 뒤 유닛을 추가할 수 있습니다."
                  : "추가 버튼으로 현장 하위 유닛을 등록해 주세요.",
              action: sites.length === 0 || !canCreateUnit ? null : (
                <PermissionButton
                  permission="unit.create"
                  type="button"
                  onClick={() => openCreateStructureDrawer("unit")}
                  className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  추가
                </PermissionButton>
              ),
            }}
          />
          <DataTable title="시스템 목록" description="유닛 하위 시스템을 같은 탭에서 함께 관리합니다."
            columns={[
              { key: "site", label: "현장" },
              { key: "unitNo", label: "유닛번호" },
              { key: "code", label: "시스템코드" },
              { key: "name", label: "시스템명" },
              { key: "discipline", label: "전문분야" },
              { key: "status", label: "상태" },
            ]}
            rows={systems.map((system: Doc) => {
              const unit = unitMap.get(String(system.unitSnapshot?.unitId || "")) as Doc | undefined;
              return {
                id: String(system._id || system.systemId || system.code),
                systemRef: system,
                systemCodeValue: String(system.code || ""),
                site: unit?.siteSnapshot?.name || "-",
                unitNo: unit?.unitNo || system.unitSnapshot?.unitNo || "-",
                code: <span className="font-mono font-medium">{system.code || "-"}</span>,
                name: <span className="font-medium">{system.name || "-"}</span>,
                discipline: system.discipline || "-",
                status: (
                  <StatusBadge
                    label={system.status || "active"}
                    tone={systemStatusTone[system.status || "active"] || "success"}
                  />
                ),
              };
            })}
            getRowKey={(row) => String(row.id)}
            onRowClick={canUpdateSystem ? (row) => openEditSystemDrawer(row.systemRef as Doc) : undefined}
            getRowAriaLabel={(row) => `${String(row.systemCodeValue)} 시스템 수정 열기`}
            emptyState={{
              title: "등록된 시스템이 없습니다",
              description:
                units.length === 0
                  ? "유닛을 먼저 등록한 뒤 시스템을 추가할 수 있습니다."
                  : "추가 버튼으로 유닛 하위 시스템을 등록해 주세요.",
              action: units.length === 0 || !canCreateSystem ? null : (
                <PermissionButton
                  permission="system.create"
                  type="button"
                  onClick={() => openCreateStructureDrawer("system")}
                  className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  추가
                </PermissionButton>
              ),
            }}
          />
        </div>
      )}
      {activeTab === "wbs" && <DataTable
        title="WBS"
        description="유닛 또는 시스템 기준으로 프로젝트 WBS를 관리합니다."
        actions={
          <PermissionButton
            permission="wbs.create"
            type="button"
            onClick={openNewWbsDrawer}
            className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            WBS 추가
          </PermissionButton>
        }
        columns={[
          { key: "targetType", label: "연결수준" },
          { key: "target", label: "연결대상" },
          { key: "code", label: "WBS코드" },
          { key: "name", label: "WBS명" },
          { key: "costCategory", label: "원가구분" },
          { key: "status", label: "상태" },
        ]}
        rows={wbs.map((item: Doc) => ({
          id: String(item._id || item.wbsId || item.code),
          wbsRef: item,
          codeValue: String(item.code || ""),
          targetType: item.systemSnapshot?.systemId ? "시스템" : "유닛",
          target: item.systemSnapshot?.systemId
            ? `${item.unitSnapshot?.unitNo || "-"} · ${item.systemSnapshot?.name || item.systemSnapshot?.code || "-"}`
            : item.unitSnapshot?.unitNo || "-",
          code: <span className="font-mono font-medium">{item.code}</span>,
          name: <span className="font-medium">{item.name}</span>,
          costCategory: item.costCategory === "indirect" ? "간접비" : "직접비",
          status: (
            <StatusBadge
              label={item.status || "active"}
              tone={wbsStatusTone[item.status || "active"] || "success"}
            />
          ),
        }))}
        getRowKey={(row) => String(row.id)}
        onRowClick={canUpdateWbs ? (row) => openEditWbsDrawer(row.wbsRef as Doc) : undefined}
        getRowAriaLabel={(row) => `${String(row.codeValue)} WBS 수정 열기`}
        emptyState={{
          title: "등록된 WBS가 없습니다",
          description:
            units.length === 0
              ? "유닛을 먼저 등록한 뒤 WBS를 추가할 수 있습니다."
              : "WBS 추가로 프로젝트 작업 구조를 등록해 주세요.",
          action:
            units.length === 0 || !canCreateWbs ? null : (
              <PermissionButton
                permission="wbs.create"
                type="button"
                onClick={openNewWbsDrawer}
                className="rounded-full border border-[color:var(--primary)] bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                WBS 추가
              </PermissionButton>
            ),
        }}
      />}

      <Drawer
        open={siteDrawerOpen}
        onClose={closeSiteDrawer}
        eyebrow="Site"
        title={siteDraft.siteId ? "현장 수정" : "현장 추가"}
        description="프로젝트 현장의 코드, 명칭, 국가, 주소, 상태를 관리합니다."
        footer={
          <>
            <button
              type="button"
              onClick={closeSiteDrawer}
              disabled={siteSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSite()}
              disabled={siteSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {siteSaving ? "저장 중..." : siteDraft.siteId ? "수정 저장" : "추가 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="현장코드"
            type="readonly"
            value={siteDraft.code}
          />
          <FormField
            label="현장명"
            required
            value={siteDraft.name}
            onChange={updateSiteDraft("name")}
            placeholder="울진 메인 현장"
          />
          <FormField
            label="국가"
            value={siteDraft.country}
            onChange={updateSiteDraft("country")}
            placeholder="KR"
          />
          <FormField
            label="주소"
            value={siteDraft.address}
            onChange={updateSiteDraft("address")}
            placeholder="경북 울진군 ..."
          />
          <FormField
            label="상태"
            type="select"
            value={siteDraft.status}
            onChange={updateSiteDraft("status")}
            options={[
              { label: "계획", value: "planning" },
              { label: "운영", value: "active" },
              { label: "보류", value: "on-hold" },
              { label: "보관", value: "archived" },
            ]}
          />
        </div>
      </Drawer>

      <Drawer
        open={unitDrawerOpen}
        onClose={closeUnitDrawer}
        eyebrow="Unit"
        title={unitDraft.unitId ? "유닛 수정" : "유닛 추가"}
        description="유닛이 속한 현장, 유닛번호, 용량, 상태를 관리합니다."
        footer={
          <>
            {unitDraft.unitId ? (
              <button
                type="button"
                onClick={() => setUnitDeleteConfirmOpen(true)}
                disabled={unitSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeUnitDrawer}
              disabled={unitSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveUnit()}
              disabled={unitSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {unitSaving ? "저장 중..." : unitDraft.unitId ? "수정 저장" : "추가 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="현장"
            required
            type="select"
            value={unitDraft.siteId}
            onChange={updateUnitDraft("siteId")}
            options={sites.map((site: Doc) => ({
              label: `${site.name} (${site.code})`,
              value: String(site._id || site.siteId || ""),
            }))}
          />
          <FormField
            label="유닛번호"
            type="readonly"
            value={unitDraft.unitNo}
          />
          <FormField
            label="용량"
            value={unitDraft.capacity}
            onChange={updateUnitDraft("capacity")}
            placeholder="170MW"
          />
          <FormField
            label="상태"
            type="select"
            value={unitDraft.status}
            onChange={updateUnitDraft("status")}
            options={[
              { label: "계획", value: "planning" },
              { label: "운영", value: "active" },
              { label: "보류", value: "on-hold" },
              { label: "보관", value: "archived" },
            ]}
          />
        </div>
      </Drawer>

      <Drawer
        open={structureCreateDrawerOpen}
        onClose={closeStructureCreateDrawer}
        eyebrow="Structure"
        title="구조 추가"
        description="유형을 선택해 유닛 또는 시스템을 같은 탭에서 추가합니다."
        footer={
          <>
            <button
              type="button"
              onClick={closeStructureCreateDrawer}
              disabled={structureCreateType === "unit" ? unitSaving : systemSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveStructure()}
              disabled={structureCreateType === "unit" ? unitSaving : systemSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {structureCreateType === "unit"
                ? unitSaving
                  ? "저장 중..."
                  : "유닛 추가"
                : systemSaving
                  ? "저장 중..."
                  : "시스템 추가"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="유형"
            type="select"
            value={structureCreateType}
            onChange={handleStructureCreateTypeChange}
            options={[
              { label: "유닛", value: "unit" },
              ...(units.length > 0 ? [{ label: "시스템", value: "system" }] : []),
            ]}
          />
          {structureCreateType === "unit" ? (
            <>
              <FormField
                label="현장"
                required
                type="select"
                value={unitDraft.siteId}
                onChange={updateUnitDraft("siteId")}
                options={sites.map((site: Doc) => ({
                  label: `${site.name} (${site.code})`,
                  value: String(site._id || site.siteId || ""),
                }))}
              />
              <FormField label="유닛번호" type="readonly" value={unitDraft.unitNo} />
              <FormField
                label="용량"
                value={unitDraft.capacity}
                onChange={updateUnitDraft("capacity")}
                placeholder="170MW"
              />
              <FormField
                label="상태"
                type="select"
                value={unitDraft.status}
                onChange={updateUnitDraft("status")}
                options={[
                  { label: "계획", value: "planning" },
                  { label: "운영", value: "active" },
                  { label: "보류", value: "on-hold" },
                  { label: "보관", value: "archived" },
                ]}
              />
            </>
          ) : (
            <>
              <FormField
                label="유닛"
                required
                type="select"
                value={systemDraft.unitId}
                onChange={updateSystemDraft("unitId")}
                options={units.map((unit: Doc) => ({
                  label: `${unit.unitNo}`,
                  value: String(unit._id || unit.unitId || ""),
                }))}
              />
              <FormField
                label="시스템코드"
                type="readonly"
                value={systemDraft.code}
              />
              <FormField
                label="시스템명"
                required
                value={systemDraft.name}
                onChange={updateSystemDraft("name")}
                placeholder="Reactor Coolant System"
              />
              <FormField
                label="전문분야"
                required
                type="select"
                value={systemDraft.discipline}
                onChange={updateSystemDraft("discipline")}
                options={systemDisciplineOptions}
              />
              <FormField
                label="상태"
                type="select"
                value={systemDraft.status}
                onChange={updateSystemDraft("status")}
                options={[
                  { label: "계획", value: "planning" },
                  { label: "운영", value: "active" },
                  { label: "보류", value: "on-hold" },
                  { label: "보관", value: "archived" },
                ]}
              />
            </>
          )}
        </div>
      </Drawer>

      <Drawer
        open={systemDrawerOpen}
        onClose={closeSystemDrawer}
        eyebrow="System"
        title={systemDraft.systemId ? "시스템 수정" : "시스템 추가"}
        description="유닛 하위 시스템의 코드, 명칭, 전문분야, 상태를 관리합니다."
        footer={
          <>
            {systemDraft.systemId ? (
              <button
                type="button"
                onClick={() => setSystemDeleteConfirmOpen(true)}
                disabled={systemSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeSystemDrawer}
              disabled={systemSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveSystem()}
              disabled={systemSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {systemSaving ? "저장 중..." : systemDraft.systemId ? "수정 저장" : "추가 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="유닛"
            required
            type="select"
            value={systemDraft.unitId}
            onChange={updateSystemDraft("unitId")}
            options={units.map((unit: Doc) => ({
              label: `${unit.unitNo}`,
              value: String(unit._id || unit.unitId || ""),
            }))}
          />
          <FormField
            label="시스템코드"
            type="readonly"
            value={systemDraft.code}
          />
          <FormField
            label="시스템명"
            required
            value={systemDraft.name}
            onChange={updateSystemDraft("name")}
            placeholder="Reactor Coolant System"
          />
          <FormField
            label="전문분야"
            required
            type="select"
            value={systemDraft.discipline}
            onChange={updateSystemDraft("discipline")}
            options={systemDisciplineOptions}
          />
          <FormField
            label="상태"
            type="select"
            value={systemDraft.status}
            onChange={updateSystemDraft("status")}
            options={[
              { label: "계획", value: "planning" },
              { label: "운영", value: "active" },
              { label: "보류", value: "on-hold" },
              { label: "보관", value: "archived" },
            ]}
          />
        </div>
      </Drawer>

      <Drawer
        open={wbsDrawerOpen}
        onClose={closeWbsDrawer}
        eyebrow="WBS"
        title={wbsDraft.wbsId ? "WBS 수정" : "WBS 추가"}
        description="유닛 또는 시스템 하나를 연결해 WBS를 등록하고 원가구분과 상태를 관리합니다."
        footer={
          <>
            {wbsDraft.wbsId ? (
              <button
                type="button"
                onClick={() => setWbsDeleteConfirmOpen(true)}
                disabled={wbsSaving}
                className="rounded-full border border-[color:var(--danger)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--danger)] disabled:opacity-60"
              >
                삭제
              </button>
            ) : null}
            <button
              type="button"
              onClick={closeWbsDrawer}
              disabled={wbsSaving}
              className="rounded-full border border-[color:var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void handleSaveWbs()}
              disabled={wbsSaving}
              className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {wbsSaving ? "저장 중..." : wbsDraft.wbsId ? "수정 저장" : "추가 저장"}
            </button>
          </>
        }
      >
        <div className="grid gap-4">
          <FormField
            label="연결 수준"
            required
            type="select"
            value={wbsDraft.targetType}
            onChange={updateWbsDraft("targetType")}
            options={[
              { label: "유닛", value: "unit" },
              { label: "시스템", value: "system" },
            ]}
          />
          {wbsDraft.targetType === "unit" ? (
            <FormField
              label="유닛"
              required
              type="select"
              value={wbsDraft.unitId}
              onChange={updateWbsDraft("unitId")}
              options={wbsUnitOptions}
            />
          ) : (
            <FormField
              label="시스템"
              required
              type="select"
              value={wbsDraft.systemId}
              onChange={updateWbsDraft("systemId")}
              options={wbsSystemOptions}
            />
          )}
          <FormField
            label="WBS코드"
            type="readonly"
            value={wbsDraft.code || "-"}
          />
          <FormField
            label="WBS명"
            required
            value={wbsDraft.name}
            onChange={updateWbsDraft("name")}
            placeholder="원자로 계통 제작"
          />
          <FormField
            label="전문분야"
            type="readonly"
            value={wbsDraft.discipline || "-"}
          />
          <FormField
            label="원가구분"
            type="select"
            value={wbsDraft.costCategory}
            onChange={updateWbsDraft("costCategory")}
            options={[
              { label: "직접비", value: "direct" },
              { label: "간접비", value: "indirect" },
            ]}
          />
          <FormField
            label="상태"
            type="select"
            value={wbsDraft.status}
            onChange={updateWbsDraft("status")}
            options={[
              { label: "계획", value: "planning" },
              { label: "운영", value: "active" },
              { label: "보류", value: "on-hold" },
              { label: "보관", value: "archived" },
            ]}
          />
        </div>
      </Drawer>

      <ConfirmDialog
        open={unitDeleteConfirmOpen}
        title="유닛을 삭제할까요?"
        description="하위 시스템이 없는 경우에만 삭제됩니다. 연결된 시스템이 있으면 삭제할 수 없습니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setUnitDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteUnit()}
      />

      <ConfirmDialog
        open={systemDeleteConfirmOpen}
        title="시스템을 삭제할까요?"
        description="WBS, 품질, 제작, 시운전 등 연결된 데이터가 있으면 삭제할 수 없습니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setSystemDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteSystem()}
      />

      <ConfirmDialog
        open={wbsDeleteConfirmOpen}
        title="WBS를 삭제할까요?"
        description="실행예산 또는 실적 데이터가 연결된 WBS는 삭제할 수 없습니다."
        confirmLabel="삭제"
        tone="danger"
        onClose={() => setWbsDeleteConfirmOpen(false)}
        onConfirm={() => void handleDeleteWbs()}
      />
    </>
  );
}
