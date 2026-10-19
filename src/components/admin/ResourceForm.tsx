"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveResource, type ActionResult } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ZodObject } from "zod";
import type { Option } from "@/lib/admin/data";
import {
  resources,
  type FieldSpec,
  type ResourceKey,
} from "@/lib/admin/resources";
import {
  adminResolver,
  flattenErrors,
  isRequired,
} from "@/lib/admin/validation";
import { cn } from "@/lib/utils";
import { ErrorSummary, focusField } from "./ErrorSummary";
import {
  FormSectionBlock,
  FormSectionNav,
  type FormSection,
} from "./FormSections";
import { SaveBar, useUnsavedGuard } from "./SaveBar";
import { a11yProps, FieldError, FieldShell } from "./FieldShell";
import {
  EMPTY_I18N,
  I18nField,
  LocaleModeProvider,
  LocaleModeSwitch,
  type I18nErrors,
  type I18nValue,
} from "./I18nField";
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

export type Options = Partial<
  Record<"experiences" | "projects" | "skillGroups", Option[]>
> & {
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
  sections,
}: {
  sections?: FormSection[];
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
  const [focusKey, setFocusKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const form = useForm<Values>({
    defaultValues: initial,
    mode: "onSubmit",
    reValidateMode: "onChange",
    // The error summary takes focus after a failed save (GOV.UK pattern), not the first input.
    shouldFocusError: false,
    resolver: adminResolver(schema, fields),
  });
  const { control, register, handleSubmit, formState, setError } = form;
  const isNew = !lockId;
  const errors = flattenErrors(formState.errors, fields);
  const errAt = (path: string) => errors.find((e) => e.path === path)?.message;
  const i18nErrors = (prefix: string): I18nErrors => ({
    en: errAt(`${prefix}.en`),
    ja: errAt(`${prefix}.ja`),
    vi: errAt(`${prefix}.vi`),
  });

  const onSubmit = handleSubmit(
    (parsed) =>
      startTransition(async () => {
        // The resolver drops keys the schema does not know, so put virtual fields back.
        const raw = form.getValues();
        const values = { ...parsed };
        for (const f of fields) if (f.virtual) values[f.name] = raw[f.name];
        const result = await onSave(values);
        if (!result.ok) {
          if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
            for (const [path, message] of Object.entries(result.fieldErrors))
              setError(path, { type: "server", message });
            setFocusKey((k) => k + 1);
          } else {
            toast.error(result.error);
          }
          return;
        }
        // Mark the current values as saved so the unsaved-changes guard lets go.
        form.reset(raw);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        toast.success("Đã lưu");
        if (doneHref) router.push(doneHref);
        router.refresh();
      }),
    () => setFocusKey((k) => k + 1),
  );

  function renderField(f: FieldSpec) {
    const id = `field-${f.name}`;
    const error = errAt(f.name);
    const required = isRequired(f);
    const nullableText = "nullable" in f && f.nullable;
    const invalid = (e?: string) => (e ? "border-destructive" : undefined);
    switch (f.kind) {
      case "text":
      case "url":
      case "month":
      case "date":
        return (
          <FieldShell
            key={f.name}
            id={id}
            label={f.label}
            required={required}
            hint={f.hint}
            error={error}
          >
            <Input
              {...a11yProps(id, error)}
              className={invalid(error)}
              type={f.kind === "text" ? "text" : f.kind}
              disabled={f.name === "id" && !isNew}
              {...register(f.name, {
                setValueAs: (v: string) =>
                  nullableText && v === "" ? null : v,
              })}
            />
          </FieldShell>
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
                  <span>{f.label}: chưa có (không bắt buộc)</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => field.onChange({ ...EMPTY_I18N })}
                  >
                    Thêm
                  </Button>
                </div>
              ) : (
                <I18nField
                  label={f.label}
                  idPrefix={f.name}
                  required={required}
                  value={(field.value as I18nValue) ?? EMPTY_I18N}
                  onChange={field.onChange}
                  multiline={f.multiline}
                  errors={i18nErrors(f.name)}
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
                <Switch
                  id={id}
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
                {f.label}
              </label>
            )}
          />
        );
      case "select":
        return (
          <FieldShell
            key={f.name}
            id={id}
            label={f.label}
            required={required}
            error={error}
          >
            <select
              {...a11yProps(id, error)}
              className={cn(
                "h-9 rounded-md border bg-background px-2 text-sm",
                invalid(error),
              )}
              {...register(f.name)}
            >
              {f.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </FieldShell>
        );
      case "skills":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <SkillPicker
                label={f.label}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
                options={options.skills ?? []}
              />
            )}
          />
        );
      case "tags":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) =>
              f.suggest === "skills" ? (
                <TagCombobox
                  label={f.label}
                  value={(field.value as string[]) ?? []}
                  onChange={field.onChange}
                  suggestions={options.skillNames ?? []}
                />
              ) : (
                <FieldShell
                  id={id}
                  label={f.label}
                  hint="Mỗi dòng một mục"
                  error={
                    error ?? errors.find((e) => e.field === f.name)?.message
                  }
                >
                  <Textarea
                    {...a11yProps(id, error)}
                    rows={3}
                    value={((field.value as string[]) ?? []).join("\n")}
                    onChange={(e) => field.onChange(e.target.value.split("\n"))}
                    onBlur={() =>
                      field.onChange(
                        ((field.value as string[]) ?? [])
                          .map((s) => s.trim())
                          .filter(Boolean),
                      )
                    }
                  />
                </FieldShell>
              )
            }
          />
        );
      case "upload":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <UploadField
                label={f.label}
                kind={f.upload}
                value={(field.value as string) ?? null}
                onChange={field.onChange}
              />
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
                <FieldShell group id={id} label={f.label} error={error}>
                  {(options[f.source] ?? []).map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          field.onChange(
                            (options[f.source] ?? [])
                              .map((x) => x.id)
                              .filter((x) => next.has(x)),
                          );
                        }}
                      />
                      {o.label}
                    </label>
                  ))}
                </FieldShell>
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
              const labels = new Map(
                (options[f.source] ?? []).map((o) => [o.id, o.label]),
              );
              const ids = (field.value as string[]) ?? [];
              const missing = (options[f.source] ?? []).filter(
                (o) => !ids.includes(o.id),
              );
              return (
                <FieldShell group id={id} label={f.label} error={error}>
                  <SortableList
                    items={ids.map((x) => ({ id: x }))}
                    onReorder={(next) => field.onChange(next.map((i) => i.id))}
                    renderItem={(item, handle) => (
                      <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
                        {handle}
                        <span className="flex-1">
                          {labels.get(item.id) ?? item.id}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            field.onChange(ids.filter((x) => x !== item.id))
                          }
                        >
                          Bỏ
                        </Button>
                      </div>
                    )}
                  />
                  {missing.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {missing.map((o) => (
                        <Button
                          key={o.id}
                          type="button"
                          variant="outline"
                          size="xs"
                          onClick={() => field.onChange([...ids, o.id])}
                        >
                          + {o.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </FieldShell>
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
                  <legend className="px-1 text-sm font-medium">
                    {f.label} (không bắt buộc)
                  </legend>
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      id={id}
                      checked={value !== null}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on
                            ? Object.fromEntries(
                                CASE_STUDY_PARTS.map(([k]) => [
                                  k,
                                  { ...EMPTY_I18N },
                                ]),
                              )
                            : null,
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
                        idPrefix={`${f.name}.${part}`}
                        required
                        multiline
                        value={value[part] ?? EMPTY_I18N}
                        onChange={(v) =>
                          field.onChange({ ...value, [part]: v })
                        }
                        errors={i18nErrors(`${f.name}.${part}`)}
                      />
                    ))}
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
              const links =
                (field.value as { label: string; url: string }[]) ?? [];
              const set = (
                i: number,
                patch: Partial<{ label: string; url: string }>,
              ) =>
                field.onChange(
                  links.map((l, j) => (j === i ? { ...l, ...patch } : l)),
                );
              return (
                <FieldShell
                  group
                  id={id}
                  label={f.label}
                  hint="Không bắt buộc. Mỗi liên kết cần nhãn và URL đầy đủ."
                >
                  {links.map((l, i) => {
                    const labelId = `field-${f.name}.${i}.label`;
                    const urlId = `field-${f.name}.${i}.url`;
                    const labelErr = errAt(`${f.name}.${i}.label`);
                    const urlErr = errAt(`${f.name}.${i}.url`);
                    return (
                      <div
                        key={i}
                        className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                      >
                        <div className="flex flex-col gap-1">
                          <Input
                            {...a11yProps(labelId, labelErr)}
                            className={invalid(labelErr)}
                            aria-label={`Nhãn liên kết ${i + 1}`}
                            placeholder="Nhãn"
                            value={l.label}
                            onChange={(e) => set(i, { label: e.target.value })}
                          />
                          <FieldError id={labelId} message={labelErr} />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Input
                            {...a11yProps(urlId, urlErr)}
                            className={invalid(urlErr)}
                            aria-label={`URL liên kết ${i + 1}`}
                            placeholder="https://"
                            value={l.url}
                            onChange={(e) => set(i, { url: e.target.value })}
                          />
                          <FieldError id={urlId} message={urlErr} />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            field.onChange(links.filter((_, j) => j !== i))
                          }
                        >
                          Xóa
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() =>
                      field.onChange([...links, { label: "", url: "" }])
                    }
                  >
                    Thêm liên kết
                  </Button>
                </FieldShell>
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
              const [from, to] = (field.value as [string, string]) ?? [
                "#000000",
                "#000000",
              ];
              const colorErr = errAt(`${f.name}.0`) ?? errAt(`${f.name}.1`);
              return (
                <FieldShell
                  group
                  id={id}
                  label={f.label}
                  required
                  error={colorErr}
                >
                  <div className="flex items-center gap-3">
                    <input
                      id={`field-${f.name}.0`}
                      type="color"
                      aria-label="Màu bắt đầu"
                      value={from}
                      onChange={(e) => field.onChange([e.target.value, to])}
                    />
                    <input
                      id={`field-${f.name}.1`}
                      type="color"
                      aria-label="Màu kết thúc"
                      value={to}
                      onChange={(e) => field.onChange([from, e.target.value])}
                    />
                    <span
                      className="h-6 w-24 rounded"
                      style={{
                        background: `linear-gradient(90deg, ${from}, ${to})`,
                      }}
                    />
                  </div>
                </FieldShell>
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
              const stat = field.value as {
                value: number;
                prefix?: string;
                suffix?: string;
                label: I18nValue;
              } | null;
              const valueErr = errAt(`${f.name}.value`);
              return (
                <fieldset className="flex flex-col gap-3 rounded-md border p-3">
                  <legend className="px-1 text-sm font-medium">
                    {f.label} (không bắt buộc)
                  </legend>
                  <label className="flex items-center gap-3 text-sm">
                    <Switch
                      id={id}
                      checked={stat !== null}
                      onCheckedChange={(on) =>
                        field.onChange(
                          on ? { value: 0, label: { ...EMPTY_I18N } } : null,
                        )
                      }
                    />
                    Hiển thị con số
                  </label>
                  {stat && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          aria-label="Tiền tố"
                          placeholder="Tiền tố (vd ~)"
                          value={stat.prefix ?? ""}
                          onChange={(e) =>
                            field.onChange({
                              ...stat,
                              prefix: e.target.value || undefined,
                            })
                          }
                        />
                        <div className="flex flex-col gap-1">
                          <Input
                            {...a11yProps(`field-${f.name}.value`, valueErr)}
                            aria-label="Giá trị"
                            type="number"
                            value={stat.value}
                            onChange={(e) =>
                              field.onChange({
                                ...stat,
                                value: Number(e.target.value),
                              })
                            }
                          />
                          <FieldError
                            id={`field-${f.name}.value`}
                            message={valueErr}
                          />
                        </div>
                        <Input
                          aria-label="Hậu tố"
                          placeholder="Hậu tố (vd +)"
                          value={stat.suffix ?? ""}
                          onChange={(e) =>
                            field.onChange({
                              ...stat,
                              suffix: e.target.value || undefined,
                            })
                          }
                        />
                      </div>
                      <I18nField
                        label="Chú thích"
                        idPrefix={`${f.name}.label`}
                        required
                        value={stat.label}
                        onChange={(label) => field.onChange({ ...stat, label })}
                        errors={i18nErrors(`${f.name}.label`)}
                      />
                    </>
                  )}
                </fieldset>
              );
            }}
          />
        );
    }
  }

  const dirty = formState.isDirty;
  useUnsavedGuard(dirty);
  const shownErrors = formState.submitCount > 0 ? errors : [];
  const errorsByField = new Map<string, number>();
  for (const e of shownErrors)
    errorsByField.set(e.field, (errorsByField.get(e.field) ?? 0) + 1);

  const placed = new Set(sections?.flatMap((s) => s.fields));
  const byName = new Map(fields.map((f) => [f.name, f]));
  const body = sections?.length ? (
    <>
      {sections.map((section) => (
        <FormSectionBlock key={section.id} section={section}>
          {section.fields
            .map((name) => byName.get(name))
            .filter((f) => f !== undefined)
            .map(renderField)}
        </FormSectionBlock>
      ))}
      {fields.filter((f) => !placed.has(f.name)).map(renderField)}
    </>
  ) : (
    fields.map(renderField)
  );

  const translated = fields.some(
    (f) => f.kind === "i18n" || f.kind === "caseStudy" || f.kind === "stat",
  );
  const errorLocales = new Set(
    shownErrors.flatMap((e) => (e.locale ? [e.locale] : [])),
  );

  return (
    <LocaleModeProvider>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Mục có * là bắt buộc</p>
          {translated && <LocaleModeSwitch errorLocales={errorLocales} />}
        </div>
        <ErrorSummary errors={shownErrors} focusKey={focusKey} />
        {sections?.length ? (
          <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <FormSectionNav sections={sections} errorsByField={errorsByField} />
            <div className="flex min-w-0 flex-col gap-6">{body}</div>
          </div>
        ) : (
          body
        )}
        <SaveBar
          dirty={dirty}
          pending={pending}
          saved={saved}
          errorCount={shownErrors.length}
          onSave={() => void onSubmit()}
          onShowErrors={() => shownErrors[0] && focusField(shownErrors[0].path)}
          onCancel={doneHref ? () => router.push(doneHref) : undefined}
        />
      </form>
    </LocaleModeProvider>
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
      sections={resource.sections}
    />
  );
}
