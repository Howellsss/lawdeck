// Google's own file picker, loaded from Google's servers only when an admin clicks
// "Import from Google Drive". Lawdeck asks only for "drive.file" access: the files picked.

export type PickerConfig = { clientId: string; apiKey: string; appId: string };
export type PickedFile = { id: string; name: string; sizeBytes: number };

const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
].join(",");

// The small part of Google's scripts that Lawdeck uses.
type TokenResponse = { access_token?: string; error?: string };
type PickerDoc = { id: string; name: string; sizeBytes?: number | string };
type PickerData = { action: string; docs?: PickerDoc[] };
type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: unknown): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (data: PickerData) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
};
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type: string }) => void;
      }): { requestAccessToken(options?: { prompt?: string }): void };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId?: unknown) => {
      setMimeTypes(types: string): unknown;
      setIncludeFolders(include: boolean): unknown;
      setSelectFolderEnabled(enabled: boolean): unknown;
      setMode(mode: unknown): unknown;
    };
    ViewId: { DOCS: unknown };
    DocsViewMode: { LIST: unknown };
    Feature: { MULTISELECT_ENABLED: unknown };
    Action: { PICKED: string; CANCEL: string };
  };
};
type GapiGlobal = { load(name: string, callback: () => void): void };
type GoogleWindow = Window & { google?: GoogleGlobal; gapi?: GapiGlobal };

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script"));
    document.head.append(script);
  });
}

async function loadGoogle(): Promise<GoogleGlobal> {
  await Promise.all([loadScript("https://accounts.google.com/gsi/client"), loadScript("https://apis.google.com/js/api.js")]);
  const win = window as GoogleWindow;
  if (!win.gapi) throw new Error("gapi");
  await new Promise<void>((resolve) => win.gapi?.load("picker", resolve));
  if (!win.google?.picker || !win.google.accounts) throw new Error("google");
  return win.google;
}

// Asks Google for a short-lived token that opens only the files the admin picks.
function requestToken(google: GoogleGlobal, clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => (response.access_token ? resolve(response.access_token) : reject(new Error(response.error ?? "token"))),
      error_callback: (error) => reject(new Error(error.type)),
    });
    client.requestAccessToken({ prompt: "" });
  });
}

// Opens the picker. Resolves with the token and the files picked (an empty list if cancelled).
export async function pickDriveFiles(config: PickerConfig): Promise<{ token: string; files: PickedFile[] }> {
  const google = await loadGoogle();
  const token = await requestToken(google, config.clientId);
  return new Promise((resolve) => {
    const view = new google.picker.DocsView(google.picker.ViewId.DOCS);
    view.setMimeTypes(ACCEPTED_TYPES);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(false);
    view.setMode(google.picker.DocsViewMode.LIST);
    new google.picker.PickerBuilder()
      .addView(view)
      .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setTitle("Choose library files")
      .setCallback((data) => {
        if (data.action === google.picker.Action.PICKED) {
          resolve({
            token,
            files: (data.docs ?? []).map((doc) => ({ id: doc.id, name: doc.name, sizeBytes: Number(doc.sizeBytes ?? 0) })),
          });
        } else if (data.action === google.picker.Action.CANCEL) {
          resolve({ token, files: [] });
        }
      })
      .build()
      .setVisible(true);
  });
}
