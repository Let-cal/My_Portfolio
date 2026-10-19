"use client";

import { useTransition, useState } from "react";
import { toast } from "sonner";
import { saveProfile, saveRole, setOpenToWork } from "@/app/admin/actions";
import { Switch } from "@/components/ui/switch";
import { profileSchema, roleSchema } from "@/content/schema";
import { PROFILE_FIELDS, ROLE_FIELDS } from "@/lib/admin/singletons";
import { FieldsForm, type Options } from "./ResourceForm";

export function ProfileForm({ initial }: { initial: Record<string, unknown> }) {
  return <FieldsForm fields={PROFILE_FIELDS} schema={profileSchema} initial={initial} lockId onSave={saveProfile} />;
}

/** The role key is fixed; it is merged back in on save. */
export function RoleForm({ initial, options }: { initial: Record<string, unknown>; options: Options }) {
  const { key, ...rest } = initial;
  return (
    <FieldsForm
      fields={ROLE_FIELDS}
      schema={roleSchema.omit({ key: true })}
      initial={rest}
      options={options}
      lockId
      onSave={(values) => saveRole({ ...values, key })}
    />
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
