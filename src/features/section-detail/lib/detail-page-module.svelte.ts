import { onMount } from "svelte";

/** Load this page's interactive component after hydration, retaining its retry action. */
export function detailPageModule<T>(load: () => Promise<{ default: T }>) {
  let component = $state.raw<T | null>(null);
  let failed = $state(false);
  let mounted = false;
  let pending = false;

  async function retry() {
    if (!mounted || pending) return;
    pending = true;
    failed = false;
    try {
      const result = await load();
      if (mounted) component = result.default;
    } catch {
      if (mounted) failed = true;
    } finally {
      pending = false;
    }
  }

  onMount(() => {
    mounted = true;
    void retry();
    return () => {
      mounted = false;
    };
  });
  return {
    get component() {
      return component;
    },
    get failed() {
      return failed;
    },
    retry,
  };
}
