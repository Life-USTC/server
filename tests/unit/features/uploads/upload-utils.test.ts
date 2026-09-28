import { describe, expect, it } from "vitest";
import {
  buildContentDisposition,
  sanitizeFilename,
} from "@/features/uploads/lib/upload-utils";
import {
  uploadCompleteRequestSchema,
  uploadCreateRequestSchema,
  uploadRenameRequestSchema,
} from "@/lib/api/schemas/request-upload-mutation-schemas";
import { hasAsciiControlCharacters } from "@/lib/text/ascii-control-characters";

function hasHeaderControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

describe("上传文件名工具函数", () => {
  it("检测并规范化文件名控制字符", () => {
    expect(hasAsciiControlCharacters("report\nfinal.txt")).toBe(true);
    expect(hasAsciiControlCharacters("report-final.txt")).toBe(false);
    expect(sanitizeFilename(" report\r\nfinal\u0000.txt ")).toBe(
      "report final .txt",
    );
  });

  it("upload.download-filename-header", () => {
    const header = buildContentDisposition('课程\r\n"final".txt');

    expect(header).toContain('filename="__ _final_.txt"');
    expect(header).toContain(
      "filename*=UTF-8''%E8%AF%BE%E7%A8%8B%20%22final%22.txt",
    );
    expect(hasHeaderControlCharacters(header)).toBe(false);
    expect(() => {
      new Headers({ "Content-Disposition": header });
    }).not.toThrow();
  });
});

it("upload.safe-filenames", () => {
  const schemas = [
    uploadCreateRequestSchema,
    uploadCompleteRequestSchema,
    uploadRenameRequestSchema,
  ];
  for (const schema of schemas) {
    for (const code of [
      ...Array.from({ length: 32 }, (_, index) => index),
      127,
    ]) {
      const control = String.fromCharCode(code);
      for (const filename of [
        `${control}report.txt`,
        `report${control}.txt`,
        `report.txt${control}`,
      ]) {
        expect(
          schema.safeParse({ filename, key: "key", size: 1 }).success,
          `${code}:${JSON.stringify(filename)}`,
        ).toBe(false);
      }
    }
    expect(
      schema.parse({ filename: "  课程报告 😀.txt  ", key: "key", size: 1 })
        .filename,
    ).toBe("课程报告 😀.txt");
    expect(
      schema.safeParse({ filename: "   ", key: "key", size: 1 }).success,
    ).toBe(false);
  }
});
