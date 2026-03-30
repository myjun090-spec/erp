declare module "pdf-parse" {
  interface PDFInfo {
    Title?: string;
    Author?: string;
    [key: string]: unknown;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: unknown;
    version: string;
    text: string;
  }

  function pdfParse(
    dataBuffer: Buffer | ArrayBuffer,
    options?: Record<string, unknown>,
  ): Promise<PDFData>;

  export default pdfParse;
}
