import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";

/**
 * 우편번호 검색 API (행정안전부 도로명주소 API)
 *
 * GET /api/zipcode?q=세종대로
 *
 * 환경변수: JUSO_CONFIRM_KEY 또는 EPOST_API_KEY
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const countPerPage = searchParams.get("countPerPage") || "20";
  const currentPage = searchParams.get("currentPage") || "1";

  if (!query.trim()) {
    return NextResponse.json(
      { ok: false, message: "검색어(q)를 입력해 주세요." },
      { status: 400 },
    );
  }

  const confmKey = process.env.JUSO_CONFIRM_KEY || process.env.EPOST_API_KEY;

  if (!confmKey) {
    return NextResponse.json(
      { ok: false, message: "JUSO_CONFIRM_KEY 또는 EPOST_API_KEY 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const apiUrl = new URL("https://business.juso.go.kr/addrlink/addrLinkApi.do");
    apiUrl.searchParams.set("confmKey", confmKey);
    apiUrl.searchParams.set("keyword", query);
    apiUrl.searchParams.set("resultType", "json");
    apiUrl.searchParams.set("countPerPage", countPerPage);
    apiUrl.searchParams.set("currentPage", currentPage);

    const response = await fetch(apiUrl.toString());

    if (!response.ok) {
      throw new Error(`주소 API 응답 오류: ${response.status}`);
    }

    const raw = await response.json();
    const result = raw?.results;
    const common = result?.common ?? {};
    const jusoList = Array.isArray(result?.juso) ? result.juso : [];

    if (common.errorCode !== "0") {
      return NextResponse.json(
        { ok: false, message: common.errorMessage || "주소 검색 오류" },
        { status: 400 },
      );
    }

    const items = jusoList.map((j: Record<string, string>) => ({
      zipNo: j.zipNo ?? "",
      roadAddr: j.roadAddr ?? "",
      roadAddrPart1: j.roadAddrPart1 ?? "",
      roadAddrPart2: j.roadAddrPart2 ?? "",
      jibunAddr: j.jibunAddr ?? "",
      engAddr: j.engAddr ?? "",
      siNm: j.siNm ?? "",
      sggNm: j.sggNm ?? "",
      emdNm: j.emdNm ?? "",
      bdNm: j.bdNm ?? "",
    }));

    return NextResponse.json({
      ok: true,
      source: "juso.go.kr",
      data: {
        items,
        totalCount: Number(common.totalCount ?? 0),
        currentPage: Number(currentPage),
        countPerPage: Number(countPerPage),
      },
    });
  } catch (e) {
    console.error("우편번호 검색 실패:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "우편번호 검색 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
