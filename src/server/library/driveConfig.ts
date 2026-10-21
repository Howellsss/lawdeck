import "server-only";
import type { PickerConfig } from "@/components/library/googlePicker";

// Google Drive import settings. None is secret: the API key only works on Lawdeck's own
// address (restricted in Google Cloud), and the picker can open only files the admin picks.
// Returns null until all three are set, so the button only appears once Google is set up.
export function getDrivePickerConfig(): PickerConfig | null {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;
  if (!clientId || !apiKey || !appId) return null;
  return { clientId, apiKey, appId };
}
