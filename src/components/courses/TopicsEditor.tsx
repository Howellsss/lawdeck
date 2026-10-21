"use client";

import { useState, useTransition, type FormEvent } from "react";
import { FormAlert } from "@/components/ui/FormAlert";
import { TextField } from "@/components/ui/TextField";
import { compactPrimaryButton } from "@/components/ui/buttons";
import { addTopic } from "@/server/courses/actions";
import type { TopicSummary } from "@/server/db/workspace";
import { TopicEditRow } from "./TopicEditRow";

// Admins add, rename, reorder and remove a course's topics (curriculum structure only).
export function TopicsEditor({ courseId, topics }: { courseId: string; topics: TopicSummary[] }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ tone: "warning" | "success"; text: string }>();
  const [pending, startTransition] = useTransition();

  function add(event: FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await addTopic(courseId, name);
      if (!result.ok) return setMessage({ tone: "warning", text: result.message });
      setMessage({ tone: "success", text: `“${name.trim()}” was added.` });
      setName("");
    });
  }

  return (
    <section aria-labelledby="edit-topics" className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5">
      <div>
        <h2 id="edit-topics" className="text-lg font-medium">
          Manage topics
        </h2>
        <p className="text-sm text-muted">Admins only. Students see the list above, in this order.</p>
      </div>
      <FormAlert message={message?.text} tone={message?.tone} />
      <form onSubmit={add} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextField label="New topic" name="topic" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} />
        </div>
        <button type="submit" disabled={pending || !name.trim()} className={compactPrimaryButton}>
          {pending ? "Adding…" : "Add topic"}
        </button>
      </form>
      {topics.length > 0 && (
        <ol aria-label="Topics to manage" className="flex flex-col divide-y divide-line rounded-2xl border border-line">
          {topics.map((topic, index) => (
            <TopicEditRow key={topic.id} topic={topic} first={index === 0} last={index === topics.length - 1} />
          ))}
        </ol>
      )}
    </section>
  );
}
