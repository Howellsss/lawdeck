import { DriveFileRow } from "@/components/library/DriveFileRow";
const courses = [{ id: "a", name: "Civil Litigation" }, { id: "b", name: "Corporate Law Practice" }];
export default function Preview() {
  return (
    <div className="mx-auto max-w-3xl p-4">
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        <DriveFileRow index={0} courses={courses} disabled={false} row={{ fileId: "1", fileName: "REVIEW CIVIL LITIGATION HANDBOOK 2025.docx", sizeBytes: 378483, title: "REVIEW CIVIL LITIGATION HANDBOOK 2025", courseId: "a", year: "2025", status: "reading", message: "Reading… 12 of 40 pages read." }} />
        <DriveFileRow index={1} courses={courses} disabled={false} row={{ fileId: "2", fileName: "REVIEW PROF ETHICS HANDBOOK 2025 NEW.docx", sizeBytes: 394240, title: "REVIEW PROF ETHICS HANDBOOK 2025 NEW", courseId: "", year: "2025", status: "failed", message: "Check this file's details.", errors: { courseId: "Choose a course." } }} />
      </ul>
    </div>
  );
}
