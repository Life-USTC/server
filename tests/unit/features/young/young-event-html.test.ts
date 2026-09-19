import { describe, expect, it } from "vitest";
import { renderYoungEventHtml } from "@/features/young/server/young-event-html";

describe("renderYoungEventHtml", () => {
  it("rewrites absolute young image URLs to the local proxy", () => {
    const out = renderYoungEventHtml(
      '<p>看图</p><img src="https://young.ustc.edu.cn/login/group1/M00/31/B5/x.jpg" alt="" width="786" />',
    );
    expect(out).toContain(
      'src="/api/catalog/young-events/images/group1/M00/31/B5/x.jpg"',
    );
    expect(out).toContain("<p>看图</p>");
    expect(out).not.toContain("young.ustc.edu.cn");
  });

  it("rewrites relative pic paths", () => {
    const out = renderYoungEventHtml('<img src="group1/M00/x.png">');
    expect(out).toContain(
      'src="/api/catalog/young-events/images/group1/M00/x.png"',
    );
  });

  it("leaves foreign image hosts untouched", () => {
    const out = renderYoungEventHtml('<img src="https://example.com/a.png">');
    expect(out).toContain('src="https://example.com/a.png"');
  });

  it("drops the src of young paths that fail normalization", () => {
    const out = renderYoungEventHtml(
      '<img src="https://young.ustc.edu.cn/login/../secret.jpg">',
    );
    expect(out).not.toContain("secret.jpg");
    expect(out).not.toContain("src=");
  });

  it("strips scripts, iframes and event handlers", () => {
    const out = renderYoungEventHtml(
      '<p onclick="alert(1)">a</p><script>alert(2)</script><iframe src="https://evil.test"></iframe>',
    );
    expect(out).toContain("<p>a</p>");
    expect(out).not.toContain("script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("iframe");
  });

  it("keeps benign upstream markup such as <br> and formatting", () => {
    const out = renderYoungEventHtml("<p><strong>标题</strong><br />正文</p>");
    expect(out).toContain("<strong>标题</strong>");
    expect(out).toContain("<br>");
  });

  it("returns an empty string for empty input", () => {
    expect(renderYoungEventHtml("")).toBe("");
  });
});
