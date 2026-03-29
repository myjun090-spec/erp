import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { searchLawsByQuery, WELFARE_LAW_MAP, type WelfareServiceCategory } from "@/lib/law-utils";

/**
 * 복지 법령 검색 API
 * 
 * GET /api/law-search?q=...&category=...
 */
export async function GET(req: NextRequest) {
  const auth = await requireApiPermission("dashboard.read");
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";
  const category = searchParams.get("category") || "";

  try {
    // 1. 기본 필터링된 결과 가져오기
    let results = searchLawsByQuery(query);

    // 2. 카테고리 필터 적용
    if (category && category !== "all") {
      results = results.filter(r => r.category === category);
    }

    // 3. 만약 검색어가 없고 카테고리만 있다면 해당 카테고리 전체 반환
    if (!query && category && category !== "all") {
      const categoryLaws = WELFARE_LAW_MAP[category as WelfareServiceCategory] || [];
      results = categoryLaws.map((law, idx) => ({
        id: `law-cat-${idx}`,
        lawName: law.name,
        keyword: law.keyword,
        category: category as WelfareServiceCategory,
        keyArticles: law.keyArticles,
        summary: law.summary,
        relevance: "medium"
      }));
    }

    return NextResponse.json({
      ok: true,
      source: "internal-utils",
      data: {
        results,
        count: results.length,
        query,
        category
      }
    });
  } catch (e) {
    console.error("Law search failed:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
