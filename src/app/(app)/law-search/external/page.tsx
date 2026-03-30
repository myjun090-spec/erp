"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";

type LawItem = {
  lawId: string;
  lawNameKo: string;
  lawType: string;
  promulgationDate: string;
  enforcementDate: string;
  lawMstLink: string;
};

type LawArticle = {
  articleNumber: string;
  articleTitle: string;
  articleContent: string;
};

type LawDetail = {
  lawId: string;
  lawNameKo: string;
  lawType: string;
  ministry: string;
  enforcementDate: string;
  promulgationDate: string;
  articles: LawArticle[];
};

const WELFARE_QUICK_SEARCH = [
  { label: "사회복지사업법", query: "사회복지사업법" },
  { label: "노인복지법", query: "노인복지법" },
  { label: "아동복지법", query: "아동복지법" },
  { label: "장애인복지법", query: "장애인복지법" },
  { label: "국민기초생활보장법", query: "국민기초생활보장법" },
  { label: "긴급복지지원법", query: "긴급복지지원법" },
  { label: "영유아보육법", query: "영유아보육법" },
  { label: "한부모가족지원법", query: "한부모가족지원법" },
];

export default function ExternalLawSearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LawItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [selectedLaw, setSelectedLaw] = useState<LawDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleSearch(searchQuery?: string) {
    const q = searchQuery ?? query;
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    setSelectedLaw(null);
    try {
      const res = await fetch(`/api/law/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.ok) {
        setResults(json.data.items);
        setTotalCount(json.data.totalCount);
      } else {
        setError(json.message || "검색 실패");
        setResults([]);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleViewDetail(lawId: string) {
    setDetailLoading(true);
    setSelectedLaw(null);
    try {
      const res = await fetch(`/api/law/${encodeURIComponent(lawId)}`);
      const json = await res.json();
      if (json.ok) {
        setSelectedLaw(json.data);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="연계"
        title="법령 검색 (법제처)"
        description="법제처 Open API를 통해 전체 법령을 검색하고 본문을 조회합니다."
      />

      {/* 검색 */}
      <Panel className="p-4 mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="법령명을 입력하세요 (예: 사회복지사업법)"
            className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "검색 중..." : "검색"}
          </button>
        </form>

        {/* 빠른 검색 */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-[color:var(--text-secondary)] leading-6">빠른 검색:</span>
          {WELFARE_QUICK_SEARCH.map((item) => (
            <button
              key={item.query}
              onClick={() => {
                setQuery(item.query);
                handleSearch(item.query);
              }}
              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs hover:bg-[color:var(--hover)] transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>
      </Panel>

      {error && (
        <Panel className="p-4 mb-4 text-sm text-red-600">{error}</Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 검색 결과 목록 */}
        <div>
          {results.length > 0 && (
            <div className="mb-2 text-sm text-[color:var(--text-secondary)]">
              총 {totalCount}건 중 {results.length}건 표시
            </div>
          )}
          <div className="space-y-2">
            {results.map((law) => (
              <Panel
                key={law.lawId}
                className="p-4 cursor-pointer hover:border-[color:var(--primary)] transition-colors"
              >
                <button
                  onClick={() => handleViewDetail(law.lawId)}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge label={law.lawType} tone="info" />
                    <span className="font-semibold text-sm">{law.lawNameKo}</span>
                  </div>
                  <div className="text-xs text-[color:var(--text-secondary)]">
                    시행일: {law.enforcementDate || "-"} | 공포일: {law.promulgationDate || "-"}
                  </div>
                </button>
              </Panel>
            ))}
          </div>
          {results.length === 0 && !loading && !error && (
            <Panel className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
              검색어를 입력하거나 빠른 검색 버튼을 클릭하세요.
            </Panel>
          )}
        </div>

        {/* 법령 본문 */}
        <div>
          {detailLoading && (
            <Panel className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
              법령 본문을 불러오는 중...
            </Panel>
          )}
          {selectedLaw && (
            <Panel className="p-4">
              <h3 className="font-semibold mb-1">{selectedLaw.lawNameKo}</h3>
              <div className="text-xs text-[color:var(--text-secondary)] mb-3">
                {selectedLaw.lawType} | 소관: {selectedLaw.ministry || "-"} | 시행일: {selectedLaw.enforcementDate || "-"}
              </div>
              <div className="max-h-[600px] overflow-y-auto space-y-3">
                {selectedLaw.articles.length > 0 ? (
                  selectedLaw.articles.map((article, idx) => (
                    <div key={idx} className="border-b border-[color:var(--border)] pb-2 last:border-0">
                      <div className="text-sm font-medium">
                        {article.articleNumber && `제${article.articleNumber}조`}
                        {article.articleTitle && ` (${article.articleTitle})`}
                      </div>
                      <div className="text-sm text-[color:var(--text-secondary)] whitespace-pre-wrap mt-1">
                        {article.articleContent}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--text-secondary)]">
                    조문 정보가 없습니다.
                  </p>
                )}
              </div>
            </Panel>
          )}
          {!selectedLaw && !detailLoading && results.length > 0 && (
            <Panel className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
              왼쪽에서 법령을 선택하면 본문이 표시됩니다.
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
