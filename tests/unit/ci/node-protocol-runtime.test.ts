import { expect, it, onTestFinished } from "vitest";
import { getPublicOrigin } from "@/lib/site-url";
import { createDeferred } from "../../shared/deferred";
import { createNodeProtocolRuntime } from "../../shared/node-protocol-runtime";

it("uses the configured origin for workflows and requests without changing another runtime", async () => {
  const bindings = { APP_PUBLIC_ORIGIN: "http://localhost:3000" };
  const first = createNodeProtocolRuntime(bindings);
  const second = createNodeProtocolRuntime(bindings);
  onTestFinished(async () => {
    const results = await Promise.allSettled([first.close(), second.close()]);
    const failures = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );
    if (failures.length) throw new AggregateError(failures);
  });
  first.setPublicOrigin("http://127.0.0.1:41001");
  await expect(
    first.run(async () => [
      getPublicOrigin(),
      await first.request(getPublicOrigin),
    ]),
  ).resolves.toEqual(["http://127.0.0.1:41001", "http://127.0.0.1:41001"]);
  await expect(second.run(getPublicOrigin)).resolves.toBe(
    "http://localhost:3000",
  );
  expect(bindings.APP_PUBLIC_ORIGIN).toBe("http://localhost:3000");
});

it("rejects a second origin configuration before any work and keeps the first origin", async () => {
  const runtime = createNodeProtocolRuntime({
    APP_PUBLIC_ORIGIN: "http://localhost:3000",
  });
  onTestFinished(() => runtime.close());
  runtime.setPublicOrigin("https://account.example");
  expect(() => runtime.setPublicOrigin("https://other.example")).toThrow(
    "Configure the public origin once before runtime work",
  );
  await expect(runtime.request(getPublicOrigin)).resolves.toBe(
    "https://account.example",
  );
});

it.each(["run", "request"] as const)(
  "rejects origin changes after %s begins, before its work settles",
  async (entry) => {
    const runtime = createNodeProtocolRuntime({
      APP_PUBLIC_ORIGIN: "http://localhost:3000",
    });
    const gate = createDeferred();
    const work = runtime[entry](async () => {
      await gate.promise;
      return getPublicOrigin();
    });
    onTestFinished(async () => {
      gate.resolve();
      const results = await Promise.allSettled([work]);
      const cleanup = await Promise.allSettled([runtime.close()]);
      const failures = [...results, ...cleanup].flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );
      if (failures.length) throw new AggregateError(failures);
    });
    expect(() => runtime.setPublicOrigin("https://changed.example")).toThrow(
      "Configure the public origin once before runtime work",
    );
    gate.resolve();
    await expect(work).resolves.toBe("http://localhost:3000");
  },
);

it("rejects origin configuration after closing before any work", async () => {
  const runtime = createNodeProtocolRuntime({
    APP_PUBLIC_ORIGIN: "http://localhost:3000",
  });
  const closing = runtime.close();
  onTestFinished(() => closing);
  expect(() => runtime.setPublicOrigin("https://changed.example")).toThrow(
    "Configure the public origin once before runtime work",
  );
  await closing;
});

it("rejects non-origin inputs without consuming the one valid configuration", async () => {
  const runtime = createNodeProtocolRuntime({
    APP_PUBLIC_ORIGIN: "http://localhost:3000",
  });
  onTestFinished(() => runtime.close());
  for (const origin of [
    "https://account.example/path",
    "https://account.example?query=1",
    "https://account.example#fragment",
    "https://user:secret@account.example",
    "file:///tmp/account",
    "not-a-url",
  ]) {
    expect(() => runtime.setPublicOrigin(origin)).toThrow();
  }
  runtime.setPublicOrigin("https://account.example");
  await expect(runtime.run(getPublicOrigin)).resolves.toBe(
    "https://account.example",
  );
});

it("locks the origin after draining workflows while requests retain their original origin", async () => {
  const runtime = createNodeProtocolRuntime({
    APP_PUBLIC_ORIGIN: "http://localhost:3000",
  });
  onTestFinished(() => runtime.close());
  const draining = runtime.drain();
  expect(() => runtime.setPublicOrigin("https://changed.example")).toThrow(
    "Configure the public origin once before runtime work",
  );
  await draining;
  await expect(runtime.request(getPublicOrigin)).resolves.toBe(
    "http://localhost:3000",
  );
  await expect(runtime.run(getPublicOrigin)).rejects.toThrow(
    "Node runtime is closing",
  );
});
