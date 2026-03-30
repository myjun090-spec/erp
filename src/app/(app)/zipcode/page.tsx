"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";

type ZipcodeItem = {
  zipNo: string;
  roadAddr: string;
  roadAddrPart1: string;
  roadAddrPart2: string;
  jibunAddr: string;
  engAddr: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
  bdNm: string;
};

export default function ZipcodePage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ZipcodeItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/zipcode?q=${encodeURIComponent(query)}`);
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

  function handleCopy(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  return (
    <>
      <PageHeader
        eyebrow="연계"
        title="우편번호 검색"
        description="도로명주소 API를 통해 우편번호와 주소를 검색합니다."
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
            placeholder="도로명, 건물명, 지번 등을 입력하세요"
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
      </Panel>

      {error && (
        <Panel className="p-4 mb-4 text-sm text-red-600">{error}</Panel>
      )}

      {results.length > 0 && (
        <div className="mb-2 text-sm text-[color:var(--text-secondary)]">
          총 {totalCount}건 중 {results.length}건 표시
        </div>
      )}

      <div className="space-y-2">
        {results.map((item, idx) => (
          <Panel key={idx} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                    {item.zipNo}
                  </span>
                  {item.bdNm && (
                    <span className="text-xs text-[color:var(--text-secondary)]">{item.bdNm}</span>
                  )}
                </div>
                <p className="text-sm font-medium">{item.roadAddr}</p>
                {item.jibunAddr && (
                  <p className="text-xs text-[color:var(--text-secondary)] mt-0.5">
                    [지번] {item.jibunAddr}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleCopy(`(${item.zipNo}) ${item.roadAddr}`, idx)}
                className="shrink-0 rounded-lg border border-[color:var(--border)] px-3 py-1 text-xs hover:bg-[color:var(--hover)] transition-colors"
              >
                {copiedIdx === idx ? "복사됨" : "복사"}
              </button>
            </div>
          </Panel>
        ))}
      </div>

      {results.length === 0 && !loading && !error && (
        <Panel className="p-8 text-center text-sm text-[color:var(--text-secondary)]">
          도로명, 건물명, 지번 등으로 검색하세요.
        </Panel>
      )}
    </>
  );
}
