import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";

/**
 * 문서 파싱 API (HWP/PDF 업로드 -> 텍스트 추출)
 *
 * POST /api/documents/parse
 * Content-Type: multipart/form-data
 * Body: file (HWP 또는 PDF 파일)
 *
 * kordoc 패키지를 사용하여 HWP 파일을 파싱합니다.
 * PDF 파일은 pdf-parse 패키지로 처리합니다.
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiPermission("document.read");
  if ("error" in auth) return auth.error;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { ok: false, message: "파일을 업로드해 주세요." },
        { status: 400 },
      );
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileSizeMB = buffer.length / (1024 * 1024);

    if (fileSizeMB > 20) {
      return NextResponse.json(
        { ok: false, message: "파일 크기는 20MB 이하여야 합니다." },
        { status: 400 },
      );
    }

    let text = "";
    let metadata: Record<string, string> = {};
    let parserUsed = "";

    if (fileName.endsWith(".hwp") || fileName.endsWith(".hwpx")) {
      // kordoc로 HWP 파싱
      try {
        const { parse: kordocParse } = await import("kordoc");
        const result = await kordocParse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));

        if (result.success) {
          text = result.markdown;
          metadata = {};
        } else {
          throw new Error(result.error);
        }
        parserUsed = "kordoc";
      } catch (kordocError) {
        console.error("kordoc 파싱 실패:", kordocError);
        return NextResponse.json(
          {
            ok: false,
            message: "HWP 파일 파싱에 실패했습니다. kordoc 패키지가 설치되어 있는지 확인해 주세요.",
            detail: kordocError instanceof Error ? kordocError.message : String(kordocError),
          },
          { status: 500 },
        );
      }
    } else if (fileName.endsWith(".pdf")) {
      // PDF 파싱 (pdf-parse)
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const result = await pdfParse(buffer);
        text = result.text ?? "";
        metadata = {
          title: result.info?.Title ?? "",
          author: result.info?.Author ?? "",
          pages: String(result.numpages ?? 0),
        };
        parserUsed = "pdf-parse";
      } catch (pdfError) {
        console.error("PDF 파싱 실패:", pdfError);
        return NextResponse.json(
          {
            ok: false,
            message: "PDF 파일 파싱에 실패했습니다. pdf-parse 패키지가 설치되어 있는지 확인해 주세요.",
            detail: pdfError instanceof Error ? pdfError.message : String(pdfError),
          },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, message: "지원하지 않는 파일 형식입니다. HWP, HWPX, PDF만 지원됩니다." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        fileName: file.name,
        fileSize: buffer.length,
        parserUsed,
        metadata,
        text,
        charCount: text.length,
      },
    });
  } catch (e) {
    console.error("문서 파싱 실패:", e);
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "문서 파싱 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
