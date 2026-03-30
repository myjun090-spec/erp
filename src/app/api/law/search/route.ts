import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";

/**
 * 법령 키워드 검색 API (law.go.kr Open API)
 *
 * GET /api/law/search?q=사회복지사업법&page=1&display=20
 *
 * 환경변수: LAW_OC (법제처 Open API 인증키)
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const page = searchParams.get("page") || "1";
  const display = searchParams.get("display") || "20";

  if (!query.trim()) {
    return NextResponse.json(
      { ok: false, message: "검색어(q)를 입력해 주세요." },
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
    const apiUrl = new URL("http://www.law.go.kr/DRF/lawSearch.do");
    apiUrl.searchParams.set("OC", OC);
    apiUrl.searchParams.set("target", "law");
    apiUrl.searchParams.set("type", "JSON");
    apiUrl.searchParams.set("query", query);
    apiUrl.searchParams.set("display", display);
    apiUrl.searchParams.set("page", page);

    const response = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      throw new Error(`law.go.kr responded with ${response.status}`);
    }

    const raw = await response.json();

    const laws = Array.isArray(raw?.LawSearch?.law)
      ? raw.LawSearch.law
      : raw?.LawSearch?.law
        ? [raw.LawSearch.law]
        : [];

    const totalCount = Number(raw?.LawSearch?.totalCnt ?? 0);

    const items = laws.map((item: Record<string, string>) => ({
      lawId: item["법령ID"] ?? item.lawId ?? "",
      lawNameKo: item["법령명한글"] ?? item.lawNameKo ?? "",
      lawType: item["법령구분"] ?? item.lawType ?? "",
      promulgationDate: item["공포일자"] ?? item.promulgationDate ?? "",
      promulgationNumber: item["공포번호"] ?? item.promulgationNumber ?? "",
      enforcementDate: item["시행일자"] ?? item.enforcementDate ?? "",
      lawMstLink: item["법령상세링크"] ?? item.lawMstLink ?? "",
    }));

    return NextResponse.json({
      ok: true,
      source: "law.go.kr",
      data: { items, totalCount, page: Number(page), display: Number(display) },
    });
  } catch (e) {
    console.error("법령 검색 실패:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "법령 검색 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
