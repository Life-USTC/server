import { describe, expect, it } from "vitest";
import {
  buildContentDisposition,
  sanitizeFilename,
} from "@/features/uploads/lib/upload-utils";
import { hasAsciiControlCharacters } from "@/lib/text/ascii-control-characters";

function hasHeaderControlCharacters(value: string) {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

describe("upload filename utilities", () => {
  it("detects and normalizes filename control characters", () => {
    expect(hasAsciiControlCharacters("report\nfinal.txt")).toBe(true);
    expect(hasAsciiControlCharacters("report-final.txt")).toBe(false);
    expect(sanitizeFilename(" report\r\nfinal\u0000.txt ")).toBe(
      "report final .txt",
    );
  });

  it("builds Content-Disposition without invalid header characters", () => {
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
