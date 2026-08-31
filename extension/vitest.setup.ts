import { vi } from "vitest";

// The real webextension-polyfill requires a browser/chrome global that doesn't
// exist under Node, so tests get an in-memory stand-in for storage.local.
vi.mock("webextension-polyfill", () => {
  const store: Record<string, unknown> = {};

  return {
    default: {
      storage: {
        local: {
          get: async (keys: string | string[]) => {
            const keyList = Array.isArray(keys) ? keys : [keys];
            return Object.fromEntries(keyList.map((key) => [key, store[key]]));
          },
          set: async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          },
        },
      },
    },
  };
});
