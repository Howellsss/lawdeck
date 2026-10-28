import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DeleteProjectButton } from "@/components/projects/DeleteProjectButton";
import { ItemList } from "@/components/projects/ItemList";
import { RenameProjectForm } from "@/components/projects/RenameProjectForm";
import { ShareSection } from "@/components/sharing/ShareSection";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { getProject } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Project · Lawdeck" };

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <Link href="/projects" className="text-sm">
        All projects
      </Link>
      <Suspense fallback={<LoadingRows label="Loading the project" />}>
        <Project params={params} />
      </Suspense>
    </div>
  );
}

async function Project({ params }: Pick<PageProps<"/projects/[id]">, "params">) {
  const { id } = await params;
  const result = await getProject(id);
  if (result.status === "signed-out") return <SignInPrompt level={1} what="projects" returnTo={`/projects/${id}`} />;
  // Missing, or another student's project (row-level security hides it): the same "not found".
  if (!result.data) notFound();
  const { project, chats } = result.data;

  return (
    <>
      <h1 className="break-words font-serif text-3xl font-normal text-greeting">{project.name}</h1>

      <section aria-labelledby="project-chats" className="flex flex-col gap-3">
        <h2 id="project-chats" className="text-lg font-medium">
          Chats
        </h2>
        {chats.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
            No chats in this project yet. Chats start once Lawdeck can answer questions.
          </p>
        ) : (
          <ItemList
            label="Chats in this project"
            icon="chat"
            items={chats.map((chat) => ({ id: chat.id, name: chat.title, updatedAt: chat.updatedAt }))}
            hrefFor={(chatId) => `/chats/${chatId}`}
          />
        )}
      </section>

      <ShareSection kind="project" id={project.id} />

      <section aria-labelledby="project-settings" className="flex flex-col gap-4 border-t border-line pt-6">
        <h2 id="project-settings" className="text-lg font-medium">
          Settings
        </h2>
        <RenameProjectForm key={project.name} id={project.id} name={project.name} />
        <div>
          <DeleteProjectButton id={project.id} name={project.name} />
        </div>
      </section>
    </>
  );
}
