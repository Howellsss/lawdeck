"use client";

import { useState } from "react";
import { uploadFile } from "@/components/library/uploadFile";
import { chatFileProblem, type ChatFileKind } from "@/lib/chatFiles";
import { kindFromFileName } from "@/lib/libraryFiles";
import { startChatFile } from "@/server/chat/actions";

export type Attached = { path: string; name: string; kind: ChatFileKind; size: number; seconds?: number };
export type Pending = { key: string; name: string; size: number; progress: number; done: Attached | null };

// Files picked for the next message: each goes straight to the group's private store, showing
// progress; the server checks its real type when the message is sent.
export function useAttachments(groupId: string, apiKey: string) {
  const [files, setFiles] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string>();

  const add = async (picked: FileList | null) => {
    setProblem(undefined);
    let count = files.length;
    for (const file of Array.from(picked ?? [])) {
      const issue = chatFileProblem(file.name, file.size, count);
      const kind = kindFromFileName(file.name);
      if (issue || !kind) return setProblem(issue ?? "That file can’t be attached.");
      count += 1;
      const key = crypto.randomUUID();
      setFiles((list) => [...list, { key, name: file.name, size: file.size, progress: 0, done: null }]);
      const update = (patch: Partial<Pending>) => setFiles((list) => list.map((f) => (f.key === key ? { ...f, ...patch } : f)));
      const drop = (message: string) => (setFiles((list) => list.filter((f) => f.key !== key)), setProblem(message));
      const started = await startChatFile({ groupId, name: file.name, size: file.size, kind });
      if (!started.ok) {
        drop(started.message);
        continue;
      }
      try {
        await uploadFile(started.signedUrl, file, apiKey, (progress) => update({ progress }));
        update({ progress: 100, done: { path: started.path, name: file.name, kind, size: file.size } });
      } catch {
        drop(`“${file.name}” didn’t upload. Check your connection and try again.`);
      }
    }
  };

  const remove = (key: string) => setFiles((list) => list.filter((f) => f.key !== key));
  const clear = () => (setFiles([]), setProblem(undefined));
  const ready = files.flatMap((f) => (f.done ? [f.done] : []));
  const uploading = files.some((f) => !f.done);
  return { files, ready, uploading, problem, add, remove, clear };
}
