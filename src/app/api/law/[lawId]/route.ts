import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";

/**
 * 법령 본문 조회 API (law.go.kr Open API)
 *
 * GET /api/law/:lawId
 *
 * 환경변수: LAW_OC (법제처 Open API 인증키)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ lawId: string }> },
) {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const { lawId } = await params;

  if (!lawId) {
    return NextResponse.json(
      { ok: false, message: "lawId가 필요합니다." },
      { status: 400 },
    );
  }

  const OC = process.env.LAW_OC;
  if (!OC) {
    return NextResponse.json(
      { ok: false, message: "LAW_OC 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const apiUrl = new URL("http://www.law.go.kr/DRF/lawService.do");
    apiUrl.searchParams.set("OC", OC);
    apiUrl.searchParams.set("target", "law");
    apiUrl.searchParams.set("type", "JSON");
    apiUrl.searchParams.set("ID", lawId);

    const response = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    });

    if (!response.ok) {
      throw new Error(`law.go.kr responded with ${response.status}`);
    }

    const raw = await response.json();
    const info = raw?.법령 ?? raw?.law ?? raw;

    const articles = Array.isArray(info?.조문 ?? info?.articles)
      ? (info.조문 ?? info.articles)
      : [];

    return NextResponse.json({
      ok: true,
      source: "law.go.kr",
      data: {
        lawId,
        lawNameKo: info["법령명_한글"] ?? info.lawNameKo ?? "",
        lawType: info["법령구분"] ?? info.lawType ?? "",
        ministry: info["소관부처"] ?? info.ministry ?? "",
        enforcementDate: info["시행일자"] ?? info.enforcementDate ?? "",
        promulgationDate: info["공포일자"] ?? info.promulgationDate ?? "",
        promulgationNumber: info["공포번호"] ?? info.promulgationNumber ?? "",
        articles: articles.map((a: Record<string, string>) => ({
          articleNumber: a["조문번호"] ?? a.articleNumber ?? "",
          articleTitle: a["조문제목"] ?? a.articleTitle ?? "",
          articleContent: a["조문내용"] ?? a.articleContent ?? "",
        })),
      },
    });
  } catch (e) {
    console.error("법령 본문 조회 실패:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "법령 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
