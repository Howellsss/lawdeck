import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PICKER_SHOW_LIMIT_MS, pickDriveFiles } from "@/components/library/googlePicker";

// A stand-in for Google's scripts: the picker never shows its window unless the test says so.
type Callback = (data: { action: string; docs?: { id: string; name: string; sizeBytes?: number }[] }) => void;
let callback: Callback | null = null;
const picker = { setVisible: vi.fn(), dispose: vi.fn() };
const keyListeners = new Set<(event: KeyboardEvent) => void>();

function fakeGoogle() {
  class Builder {
    addView() { return this; }
    enableFeature() { return this; }
    setOAuthToken() { return this; }
    setDeveloperKey() { return this; }
    setAppId() { return this; }
    setTitle() { return this; }
    setCallback(next: Callback) { callback = next; return this; }
    build() { return picker; }
  }
  class DocsView {
    setMimeTypes() {}
    setIncludeFolders() {}
    setSelectFolderEnabled() {}
    setMode() {}
  }
  return {
    accounts: {
      oauth2: {
        initTokenClient: (config: { callback: (r: { access_token: string }) => void }) => ({
          requestAccessToken: () => config.callback({ access_token: "token" }),
        }),
      },
    },
    picker: {
      PickerBuilder: Builder,
      DocsView,
      ViewId: { DOCS: "docs" },
      DocsViewMode: { LIST: "list" },
      Feature: { MULTISELECT_ENABLED: "multi" },
      Action: { PICKED: "picked", CANCEL: "cancel", LOADED: "loaded" },
    },
  };
}

const config = { clientId: "c", apiKey: "k", appId: "1", liveOrigin: "https://mylawdeck.com" };

// Starts the picker and lets Google's (fake) scripts finish loading, without moving the clock.
async function open() {
  const result = pickDriveFiles(config);
  result.catch(() => {}); // Each test checks the outcome itself.
  for (let i = 0; i < 10 && !callback; i++) await Promise.resolve();
  expect(callback).not.toBeNull();
  return { result };
}

beforeEach(() => {
  vi.useFakeTimers();
  callback = null;
  picker.setVisible.mockClear();
  picker.dispose.mockClear();
  keyListeners.clear();
  vi.stubGlobal("window", {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    gapi: { load: (_name: string, done: () => void) => done() },
    google: fakeGoogle(),
  });
  vi.stubGlobal("document", {
    querySelector: () => ({}), // Google's scripts count as already loaded.
    addEventListener: (_type: string, listener: (event: KeyboardEvent) => void) => keyListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: KeyboardEvent) => void) => keyListeners.delete(listener),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Google Drive picker never leaves the page stuck", () => {
  it("removes Google's grey cover and says so when the picker window never appears", async () => {
    const { result } = await open();
    const outcome = expect(result).rejects.toThrow("picker_not_shown");
    await vi.advanceTimersByTimeAsync(PICKER_SHOW_LIMIT_MS);
    await outcome;
    expect(picker.setVisible).toHaveBeenLastCalledWith(false);
    expect(picker.dispose).toHaveBeenCalledOnce();
    expect(keyListeners.size).toBe(0);
  });

  it("keeps the picker open once Google shows it, and returns the files picked", async () => {
    const { result } = await open();
    callback?.({ action: "loaded" });
    await vi.advanceTimersByTimeAsync(PICKER_SHOW_LIMIT_MS * 3);
    expect(picker.dispose).not.toHaveBeenCalled();
    callback?.({ action: "picked", docs: [{ id: "f1", name: "Notes.pdf", sizeBytes: 10 }] });
    await expect(result).resolves.toEqual({ token: "token", files: [{ id: "f1", name: "Notes.pdf", sizeBytes: 10 }] });
    expect(picker.dispose).toHaveBeenCalledOnce();
  });

  it("closes on Escape even if the window never appeared", async () => {
    const { result } = await open();
    for (const listener of keyListeners) listener({ key: "Escape" } as KeyboardEvent);
    await expect(result).resolves.toEqual({ token: "token", files: [] });
    expect(picker.dispose).toHaveBeenCalledOnce();
  });

  it("treats Google's error report like a picker that did not appear", async () => {
    const { result } = await open();
    callback?.({ action: "error" });
    await expect(result).rejects.toThrow("picker_not_shown");
  });
});
