// Sends a file to a one-time Supabase upload link, reporting progress (0–100).
// Uses the browser's own XMLHttpRequest, so no extra library is needed.
export function uploadFile(
  signedUrl: string,
  file: File,
  apiKey: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    const request = new XMLHttpRequest();
    request.open("PUT", signedUrl);
    request.setRequestHeader("apikey", apiKey);
    request.setRequestHeader("x-upsert", "false");
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error("upload")));
    request.onerror = () => reject(new Error("network"));
    request.send(body);
  });
}
