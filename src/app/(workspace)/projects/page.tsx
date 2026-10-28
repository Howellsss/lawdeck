import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemList } from "@/components/projects/ItemList";
import { NewProjectForm } from "@/components/projects/NewProjectForm";
import { LoadingRows } from "@/components/ui/LoadingRows";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { listProjects } from "@/server/db/workspace";

export const metadata: Metadata = { title: "Projects · Lawdeck" };

export default function ProjectsPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 lg:px-8">
      <h1 className="font-serif text-3xl font-normal text-greeting">Projects</h1>
      <Suspense fallback={<LoadingRows label="Loading your projects" />}>
        <Projects />
      </Suspense>
    </div>
  );
}

async function Projects() {
  const result = await listProjects();
  if (result.status === "signed-out") return <SignInPrompt what="projects" returnTo="/projects" />;

  return (
    <>
      <p className="text-muted">Projects keep related chats together, for example one per course or assignment.</p>
      <NewProjectForm />
      {result.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-muted">
          No projects yet. Name your first one above.
        </p>
      ) : (
        <ItemList
          label="Your projects"
          icon="folder"
          items={result.data}
          hrefFor={(id) => `/projects/${id}`}
        />
      )}
    </>
  );
}
