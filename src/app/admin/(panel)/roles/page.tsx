import { FormSkeleton } from "@/components/admin/Skeletons";
import { Suspense } from "react";
import { RoleTabs } from "@/components/admin/SingletonForms";
import { SKILL_GROUPS } from "@/content/schema";
import { getProfileAndRoles, listItems } from "@/lib/admin/data";

async function Editors() {
  const [{ roles }, experiences] = await Promise.all([
    getProfileAndRoles(),
    listItems("experiences"),
  ]);
  const options = {
    experiences: experiences.map((e) => ({
      id: e.id,
      label: `${e.company} · ${e.start}`,
    })),
    skillGroups: SKILL_GROUPS.map((g) => ({ id: g, label: g })),
  };
  return <RoleTabs roles={roles} options={options} />;
}

export default function RolesPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Vai trò & CV</h1>
      <Suspense fallback={<FormSkeleton />}>
        <Editors />
      </Suspense>
    </main>
  );
}
