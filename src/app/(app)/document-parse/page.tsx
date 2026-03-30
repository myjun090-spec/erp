"use client";

import { useState, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";

type ParseResult = {
  fileName: string;
  fileSize: number;
  parserUsed: string;
  metadata: Record<string, string>;
  text: string;
  charCount: number;
};

export default function DocumentParsePage() {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        setResult(json.data);
      } else {
        setError(json.message || "파싱 실패");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <>
      <PageHeader
        eyebrow="업무도구"
        title="문서 파싱"
        description="HWP/PDF 파일을 업로드하면 텍스트 내용을 추출합니다."
      />

      {/* 업로드 영역 */}
      <Panel className="p-4 mb-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors ${
            dragOver
              ? "border-[color:var(--primary)] bg-blue-50"
              : "border-[color:var(--border)] hover:border-[color:var(--primary)]"
          }`}
        >
          <svg
            className="w-10 h-10 mb-3 text-[color:var(--text-secondary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <p className="text-sm font-medium">
            {loading ? "파일 처리 중..." : "클릭하거나 파일을 끌어다 놓으세요"}
          </p>
          <p className="text-xs text-[color:var(--text-secondary)] mt-1">
            HWP, HWPX, PDF (최대 20MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".hwp,.hwpx,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </Panel>

      {error && (
        <Panel className="p-4 mb-4 text-sm text-red-600">{error}</Panel>
      )}

      {/* 파싱 결과 */}
      {result && (
        <div className="space-y-4">
          <Panel className="p-4">
            <h3 className="font-semibold mb-2">파일 정보</h3>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-[color:var(--text-secondary)]">파일명: </span>
                <span className="font-medium">{result.fileName}</span>
              </div>
              <div>
                <span className="text-[color:var(--text-secondary)]">크기: </span>
                <span className="font-medium">{formatFileSize(result.fileSize)}</span>
              </div>
              <div>
                <span className="text-[color:var(--text-secondary)]">파서: </span>
                <span className="font-medium">{result.parserUsed}</span>
              </div>
              <div>
                <span className="text-[color:var(--text-secondary)]">글자 수: </span>
                <span className="font-medium">{result.charCount.toLocaleString()}</span>
              </div>
            </div>
            {Object.keys(result.metadata).length > 0 && (
              <div className="mt-2 text-xs text-[color:var(--text-secondary)]">
                {Object.entries(result.metadata)
                  .filter(([, v]) => v)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" | ")}
              </div>
            )}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">추출된 텍스트</h3>
              <button
                onClick={() => navigator.clipboard.writeText(result.text)}
                className="rounded-lg border border-[color:var(--border)] px-3 py-1 text-xs hover:bg-[color:var(--hover)] transition-colors"
              >
                복사
              </button>
            </div>
            <div className="max-h-[500px] overflow-y-auto rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap font-mono">
              {result.text || "(추출된 텍스트가 없습니다)"}
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
