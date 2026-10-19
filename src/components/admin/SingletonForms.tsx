"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { saveProfile, saveRole, setOpenToWork } from "@/app/admin/actions";
import { Switch } from "@/components/ui/switch";
import { profileSchema, roleSchema, type Role } from "@/content/schema";
import { PROFILE_FIELDS, ROLE_FIELDS } from "@/lib/admin/singletons";
import { FieldsForm, type Options } from "./ResourceForm";

export function ProfileForm({ initial }: { initial: Record<string, unknown> }) {
  return <FieldsForm fields={PROFILE_FIELDS} schema={profileSchema} initial={initial} lockId onSave={saveProfile} />;
}

/** The role key is fixed; it is merged back in on save. */
export function RoleForm({
  initial,
  options,
  active = true,
}: {
  initial: Record<string, unknown>;
  options: Options;
  active?: boolean;
}) {
  const { key, ...rest } = initial;
  return (
    <FieldsForm
      fields={ROLE_FIELDS}
      schema={roleSchema.omit({ key: true })}
      initial={rest}
      options={options}
      lockId
      idScope={String(key)}
      active={active}
      onSave={(values) => saveRole({ ...values, key })}
    />
  );
}

/**
 * One tab per role. All three forms stay mounted (inactive ones are hidden) so switching tabs
 * never loses unsaved edits.
 */
export function RoleTabs({ roles, options }: { roles: Role[]; options: Options }) {
  const [active, setActive] = useState(roles[0]?.key);
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Vai trò" className="flex flex-wrap gap-1 border-b">
        {roles.map((role) => (
          <button
            key={role.key}
            id={`tab-${role.key}`}
            type="button"
            role="tab"
            aria-selected={active === role.key}
            aria-controls={`panel-${role.key}`}
            onClick={() => setActive(role.key)}
            className={
              active === role.key
                ? "-mb-px border-b-2 border-primary px-3 py-2 text-sm font-medium"
                : "-mb-px border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            }
          >
            {role.title.en}
          </button>
        ))}
      </div>
      {roles.map((role) => (
        <div key={role.key} id={`panel-${role.key}`} role="tabpanel" aria-labelledby={`tab-${role.key}`} hidden={active !== role.key}>
          <RoleForm initial={role} options={options} active={active === role.key} />
        </div>
      ))}
    </div>
  );
}

export function OpenToWorkSwitch({ initial }: { initial: boolean }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-3 text-sm font-medium">
      <Switch
        checked={value}
        disabled={pending}
        onCheckedChange={(next) => {
          setValue(next);
          startTransition(async () => {
            const result = await setOpenToWork(next);
            if (result.ok) toast.success(next ? "Đang hiện Open to work" : "Đã tắt Open to work");
            else {
              setValue(!next);
              toast.error(result.error);
            }
          });
        }}
      />
      Open to work
    </label>
  );
}
