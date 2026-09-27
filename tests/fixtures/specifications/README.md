The JSON fixtures are native output from Vitest 5.0.0 and Playwright 1.62.1,
captured on September 27, 2026 from this passing probe:

```ts
import { expect, test } from "vitest"; // @playwright/test for Playwright
test("example.native", () => expect(2 + 3).toBe(5));
```

Vitest used `--reporter=json --outputFile=vitest.json`. Playwright used its
`json` reporter with `outputFile: "playwright.json"` and no browser fixture.
Only absolute checkout/configuration paths were replaced with `/repo` paths;
native statuses, result shapes, timestamps, and metadata remain intact.
