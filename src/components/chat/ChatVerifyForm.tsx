"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { uploadFile } from "@/components/library/uploadFile";
import { primaryButton } from "@/components/ui/buttons";
import { startVerification, submitVerification } from "@/server/chat/verification";

type Campus = { key: string; name: string; kind: "campus" | "aspirant" };

// "Verify you're a Law School student" (docs/specs/chat.md): the student's ID card or admission
// letter (an aspirant's university ID or final-year letter) and their number, checked by an admin.
export function ChatVerifyForm({ campuses, campus, apiKey }: { campuses: Campus[]; campus: string | null; apiKey: string }) {
  const id = useId();
  const router = useRouter();
  const [kind, setKind] = useState<"student" | "aspirant">(campus === "aspirant" ? "aspirant" : "student");
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();
  const sites = campuses.filter((c) => c.kind === "campus");

  const submit = async (form: FormData) => {
    setError(undefined);
    const file = form.get("document");
    if (!(file instanceof File) || file.size === 0) return setError("Choose a photo or PDF of your ID or letter.");
    const details = {
      kind,
      campusKey: kind === "aspirant" ? "aspirant" : String(form.get("campus") ?? ""),
      idNumber: String(form.get("idNumber") ?? ""),
      fileName: file.name,
      size: file.size,
    };
    setBusy("Uploading… 0%");
    const started = await startVerification(details);
    if (!started.ok) return (setBusy(undefined), setError(started.message));
    try {
      await uploadFile(started.signedUrl, file, apiKey, (p) => setBusy(`Uploading… ${p}%`));
    } catch {
      return (setBusy(undefined), setError("The upload stopped. Check your connection and try again."));
    }
    setBusy("Sending…");
    const sent = await submitVerification({ ...details, path: started.path });
    setBusy(undefined);
    if (!sent.ok) return setError(sent.message);
    router.refresh();
  };

  return (
    <form action={(f) => void submit(f)} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">I am</legend>
        {(
          [
            ["student", "A Law School student", "Upload your Law School ID card or admission letter."],
            ["aspirant", "A Law School aspirant", "Final-year at university: upload your university ID or final-year letter. You will join the Aspirants group."],
          ] as const
        ).map(([value, label, hint]) => (
          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line px-3 py-2.5 has-[:checked]:border-ink">
            <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="mt-1 size-4 accent-ink" />
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">{label}</span>
              <span className="text-sm text-muted">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {kind === "student" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Your campus
          <select name="campus" defaultValue={campus && campus !== "aspirant" ? campus : ""} required className="h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal sm:max-w-xs">
            <option value="" disabled>
              Choose your campus
            </option>
            {sites.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        {kind === "student" ? "Your Law School number" : "Your university matriculation number"}
        <input name="idNumber" required minLength={3} maxLength={40} autoComplete="off" className="h-11 rounded-lg border border-line bg-surface px-3 text-[16px] font-normal sm:max-w-xs" />
      </label>
      <label htmlFor={`${id}-doc`} className="flex flex-col gap-1 text-sm font-medium">
        {kind === "student" ? "Photo or PDF of your Law School ID card or admission letter" : "Photo or PDF of your university ID or final-year letter"}
        <input id={`${id}-doc`} name="document" type="file" required accept="image/png,image/jpeg,application/pdf" className="text-[15px] font-normal file:mr-3 file:rounded-full file:border file:border-line file:bg-surface file:px-3 file:py-1.5" />
      </label>
      <p className="text-sm text-muted">
        Only Lawdeck admins see your document, only to check you&rsquo;re a student. It is deleted as soon as they decide. PNG, JPEG or PDF, up to 10 MB.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={Boolean(busy)} className={primaryButton}>
          {busy ?? "Send for checking"}
        </button>
        {error && (
          <p role="alert" className="text-sm text-warning">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
