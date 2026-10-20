import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { COURSES } from "@/lib/courses";

export const metadata: Metadata = { title: "Courses · Lawdeck" };

export default function CoursesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-serif text-3xl font-normal text-greeting">Courses</h1>
        <p className="text-muted">The five Bar Part II courses. Topics and study material arrive once the library is loaded (Phase 2).</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {COURSES.map((course) => (
          <li key={course.slug} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-4">
            <Icon name="book" className="text-muted" />
            <span className="text-[15px] font-medium">{course.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
