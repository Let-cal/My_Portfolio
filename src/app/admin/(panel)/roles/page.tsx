import { Suspense } from "react";
import { RoleForm } from "@/components/admin/SingletonForms";
import { SKILL_GROUPS } from "@/content/schema";
import { getProfileAndRoles, listItems } from "@/lib/admin/data";

async function Editors() {
  const [{ roles }, experiences] = await Promise.all([getProfileAndRoles(), listItems("experiences")]);
  const options = {
    experiences: experiences.map((e) => ({ id: e.id, label: `${e.company} · ${e.start}` })),
    skillGroups: SKILL_GROUPS.map((g) => ({ id: g, label: g })),
  };
  return roles.map((role) => (
    <section key={role.key} className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-lg font-semibold">{role.title.en}</h2>
      <RoleForm initial={role} options={options} />
    </section>
  ));
}

export default function RolesPage() {
  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Vai trò & CV</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Đang tải…</p>}>
        <Editors />
      </Suspense>
    </main>
  );
}
