"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { saveResource, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ZodObject } from "zod";
import type { Option } from "@/lib/admin/data";
import { resources, type FieldSpec, type ResourceKey } from "@/lib/admin/resources";
import { EMPTY_I18N, I18nField, type I18nValue } from "./I18nField";
import { SkillPicker, type SkillOption } from "./SkillPicker";
import { SortableList } from "./SortableList";
import { TagCombobox } from "./TagCombobox";
import { UploadField } from "./UploadField";

type Values = Record<string, unknown>;

const CASE_STUDY_PARTS = [
  ["problem", "Vấn đề"],
  ["role", "Vai trò"],
  ["decisions", "Quyết định"],
  ["result", "Kết quả"],
] as const;

function errorText(errors: FieldErrors, name: string): string | undefined {
  const e = name.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], errors) as
    | { message?: string }
    | undefined;
  return e?.message ?? (e ? "Giá trị chưa hợp lệ" : undefined);
}

export type Options = Partial<Record<"experiences" | "projects" | "skillGroups", Option[]>> & {
  /** Skills that can be attached to an experience or project. */
  skills?: SkillOption[];
  /** Skill names suggested for free-text tags (certificates, activities). */
  skillNames?: string[];
};

/** A form for any list of field specs, validated with `schema` and saved with `onSave`. */
export function FieldsForm({
  fields,
  schema,
  initial,
  options = {},
  lockId = false,
  onSave,
  doneHref,
}: {
  fields: FieldSpec[];
  schema: ZodObject;
  initial: Values;
  options?: Options;
  lockId?: boolean;
  onSave: (values: Values) => Promise<ActionResult>;
  /** Where to go after a successful save; stay on the page when omitted. */
  doneHref?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<Values>({
    defaultValues: initial,
    resolver: zodResolver(schema) as unknown as Resolver<Values>,
  });
  const { control, register, handleSubmit, formState } = form;
  const isNew = !lockId;

  const onSubmit = handleSubmit((parsed) =>
    startTransition(async () => {
      // The resolver drops keys the schema does not know, so put virtual fields back.
      const raw = form.getValues();
      const values = { ...parsed };
      for (const f of fields) if (f.virtual) values[f.name] = raw[f.name];
      const result = await onSave(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Đã lưu");
      if (doneHref) router.push(doneHref);
      router.refresh();
    }),
  );

  function renderField(f: FieldSpec) {
    const error = errorText(formState.errors, f.name);
    const nullableText = "nullable" in f && f.nullable;
    switch (f.kind) {
      case "text":
      case "url":
      case "month":
      case "date":
        return (
          <label key={f.name} className="flex flex-col gap-1 text-sm font-medium">
            {f.label}
            <Input
              type={f.kind === "text" ? "text" : f.kind}
              disabled={f.name === "id" && !isNew}
              {...register(f.name, { setValueAs: (v: string) => (nullableText && v === "" ? null : v) })}
            />
            {f.hint && <span className="text-xs font-normal text-muted-foreground">{f.hint}</span>}
            {error && <span className="text-sm font-normal text-destructive">{error}</span>}
          </label>
        );
      case "i18n":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) =>
              f.nullable && field.value === null ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-dashed p-3 text-sm">
                  <span>{f.label}: chưa có</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => field.onChange({ ...EMPTY_I18N })}>
                    Thêm
                  </Button>
                </div>
              ) : (
                <I18nField
                  label={f.label}
                  value={(field.value as I18nValue) ?? EMPTY_I18N}
                  onChange={field.onChange}
                  multiline={f.multiline}
                  error={error}
                />
              )
            }
          />
        );
      case "boolean":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <label className="flex items-center gap-3 text-sm font-medium">
                <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                {f.label}
              </label>
            )}
          />
        );
      case "select":
        return (
          <label key={f.name} className="flex flex-col gap-1 text-sm font-medium">
            {f.label}
            <select className="h-8 rounded-md border bg-background px-2" {...register(f.name)}>
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
        );
      case "skills":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <SkillPicker label={f.label} value={(field.value as string[]) ?? []} onChange={field.onChange} options={options.skills ?? []} />
            )}
          />
        );
      case "tags":
        if (f.suggest === "skills") {
          return (
            <Controller
              key={f.name}
              control={control}
              name={f.name}
              render={({ field }) => (
                <TagCombobox label={f.label} value={(field.value as string[]) ?? []} onChange={field.onChange} suggestions={options.skillNames ?? []} />
              )}
            />
          );
        }
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <label className="flex flex-col gap-1 text-sm font-medium">
                {f.label}
                <Textarea
                  rows={3}
                  value={((field.value as string[]) ?? []).join("\n")}
                  onChange={(e) => field.onChange(e.target.value.split("\n"))}
                  onBlur={() => field.onChange(((field.value as string[]) ?? []).map((s) => s.trim()).filter(Boolean))}
                />
                <span className="text-xs font-normal text-muted-foreground">Mỗi dòng một mục</span>
                {error && <span className="text-sm font-normal text-destructive">{error}</span>}
              </label>
            )}
          />
        );
      case "upload":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <UploadField label={f.label} kind={f.upload} value={(field.value as string) ?? null} onChange={field.onChange} />
            )}
          />
        );
      case "relations":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const selected = new Set((field.value as string[]) ?? []);
              return (
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-sm font-medium">{f.label}</legend>
                  {(options[f.source] ?? []).map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          field.onChange((options[f.source] ?? []).map((x) => x.id).filter((id) => next.has(id)));
                        }}
                      />
                      {o.label}
                    </label>
                  ))}
                </fieldset>
              );
            }}
          />
        );
      case "order":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const labels = new Map((options[f.source] ?? []).map((o) => [o.id, o.label]));
              const ids = (field.value as string[]) ?? [];
              const missing = (options[f.source] ?? []).filter((o) => !ids.includes(o.id));
              return (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{f.label}</legend>
                  <SortableList
                    items={ids.map((id) => ({ id }))}
                    onReorder={(next) => field.onChange(next.map((i) => i.id))}
                    renderItem={(item, handle) => (
                      <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                        {handle}
                        <span className="flex-1">{labels.get(item.id) ?? item.id}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(ids.filter((x) => x !== item.id))}>
                          Bỏ
                        </Button>
                      </div>
                    )}
                  />
                  {missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {missing.map((o) => (
                        <Button key={o.id} type="button" variant="outline" size="xs" onClick={() => field.onChange([...ids, o.id])}>
                          + {o.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            }}
          />
        );
      case "caseStudy":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const value = field.value as Record<string, I18nValue> | null;
              return (
                <fieldset className="flex flex-col gap-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">{f.label}</legend>
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      checked={value !== null}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on ? Object.fromEntries(CASE_STUDY_PARTS.map(([k]) => [k, { ...EMPTY_I18N }])) : null,
                        )
                      }
                    />
                    Có case study
                  </label>
                  {value &&
                    CASE_STUDY_PARTS.map(([part, label]) => (
                      <I18nField
                        key={part}
                        label={label}
                        multiline
                        value={value[part] ?? EMPTY_I18N}
                        onChange={(v) => field.onChange({ ...value, [part]: v })}
                      />
                    ))}
                  {error && <span className="text-sm text-destructive">Case study cần đủ nội dung</span>}
                </fieldset>
              );
            }}
          />
        );
      case "links":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const links = (field.value as { label: string; url: string }[]) ?? [];
              const set = (i: number, patch: Partial<{ label: string; url: string }>) =>
                field.onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
              return (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-1 text-sm font-medium">{f.label}</legend>
                  {links.map((l, i) => (
                    <div key={i} className="flex gap-2">
                      <Input aria-label="Nhãn" placeholder="Nhãn" value={l.label} onChange={(e) => set(i, { label: e.target.value })} />
                      <Input aria-label="URL" placeholder="https://" value={l.url} onChange={(e) => set(i, { url: e.target.value })} />
                      <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(links.filter((_, j) => j !== i))}>
                        Xóa
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => field.onChange([...links, { label: "", url: "" }])}>
                    Thêm liên kết
                  </Button>
                  {error && <span className="text-sm text-destructive">Mỗi liên kết cần nhãn và URL hợp lệ</span>}
                </fieldset>
              );
            }}
          />
        );
      case "colors":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const [from, to] = (field.value as [string, string]) ?? ["#000000", "#000000"];
              return (
                <fieldset className="flex items-center gap-3">
                  <legend className="mb-1 text-sm font-medium">{f.label}</legend>
                  <input type="color" aria-label="Màu bắt đầu" value={from} onChange={(e) => field.onChange([e.target.value, to])} />
                  <input type="color" aria-label="Màu kết thúc" value={to} onChange={(e) => field.onChange([from, e.target.value])} />
                  <span className="h-6 w-24 rounded" style={{ background: `linear-gradient(90deg, ${from}, ${to})` }} />
                </fieldset>
              );
            }}
          />
        );
      case "stat":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => {
              const stat = field.value as { value: number; prefix?: string; suffix?: string; label: I18nValue } | null;
              return (
                <fieldset className="flex flex-col gap-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">{f.label}</legend>
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      checked={stat !== null}
                      onCheckedChange={(on) => field.onChange(on ? { value: 0, label: { ...EMPTY_I18N } } : null)}
                    />
                    Hiển thị con số
                  </label>
                  {stat && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <Input aria-label="Tiền tố" placeholder="Tiền tố (vd ~)" value={stat.prefix ?? ""} onChange={(e) => field.onChange({ ...stat, prefix: e.target.value || undefined })} />
                        <Input aria-label="Giá trị" type="number" value={stat.value} onChange={(e) => field.onChange({ ...stat, value: Number(e.target.value) })} />
                        <Input aria-label="Hậu tố" placeholder="Hậu tố (vd +)" value={stat.suffix ?? ""} onChange={(e) => field.onChange({ ...stat, suffix: e.target.value || undefined })} />
                      </div>
                      <I18nField label="Chú thích" value={stat.label} onChange={(label) => field.onChange({ ...stat, label })} />
                    </>
                  )}
                </fieldset>
              );
            }}
          />
        );
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {fields.map(renderField)}
      <div className="sticky bottom-0 flex gap-2 border-t bg-background py-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Đang lưu…" : "Lưu"}
        </Button>
        {doneHref && (
          <Button type="button" variant="outline" onClick={() => router.push(doneHref)}>
            Hủy
          </Button>
        )}
      </div>
    </form>
  );
}

export function ResourceForm({
  resourceKey,
  initial,
  isNew,
  options,
}: {
  resourceKey: ResourceKey;
  initial: Values;
  isNew: boolean;
  options: Options;
}) {
  const resource = resources[resourceKey];
  const { sortIndex: _sortIndex, ...defaults } = initial;
  void _sortIndex;
  return (
    <FieldsForm
      fields={resource.fields}
      schema={resource.schema.omit({ sortIndex: true })}
      initial={defaults}
      options={options}
      lockId={!isNew}
      onSave={(values) => saveResource(resourceKey, values, isNew)}
      doneHref={`/admin/${resourceKey}`}
    />
  );
}
