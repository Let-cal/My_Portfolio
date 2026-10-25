"use client";
import { useAdminRouter as useRouter } from "@/lib/admin/use-admin-router";

import Link from "next/link";
import { holdRefresh, onChange } from "@/lib/admin/own-writes";
import {
  clearDraft,
  draftKey,
  parseDraft,
  pruneDrafts,
  saveDraft,
} from "@/lib/admin/drafts";
import { runAction } from "@/lib/admin/action-errors";
import { publicUrl } from "@/lib/admin/public-link";
import { ADMIN_DISCARD_EVENT, signature } from "@/lib/admin/sync";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { TranslationProgress } from "./TranslationProgress";
import { publicAnchor } from "@/lib/admin/public-link";
import { toast } from "sonner";
import {
  saveResource,
  type ActionResult,
  undoDelete,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import { slugify } from "@/lib/admin/slug";
import { cn } from "@/lib/utils";
import { ErrorSummary, focusField } from "./ErrorSummary";
import {
  FormSectionBlock,
  FormSectionNav,
  type FormSection,
} from "./FormSections";
import { SaveBar, useUnsavedGuard } from "./SaveBar";
import { useAdminAccess } from "./AdminAccessProvider";
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
  /** IDs already used in this list, for the live "ID đã được dùng" check on new items. */
  existingIds?: string[];
  /** Items a why card can point to as evidence. */
  evidence?: { experiences: Option[]; projects: Option[] };
};

/** Field that seeds a new item's ID, in order of preference. */
const ID_SOURCES = ["name", "title", "company", "school"];

const DAY = 24 * 60 * 60 * 1000;

/** Drafts changed in another tab show up here too (the storage event). */
const subscribeStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};
const readStorage = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
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
  onSaved,
  draftId: draftIdProp,
  table,
  itemKey,
  onSaveAsNew,
  sections,
  idScope,
  active = true,
}: {
  /** False for forms on hidden tabs: they keep their state but ignore Ctrl/⌘+S. */
  active?: boolean;
  sections?: FormSection[];
  /** Prefix for input ids when several forms share a page (e.g. one per role). */
  idScope?: string;
  fields: FieldSpec[];
  schema: ZodObject;
  initial: Values;
  options?: Options;
  lockId?: boolean;
  onSave: (values: Values) => Promise<ActionResult>;
  /** Where to go after a successful save; stay on the page when omitted. */
  doneHref?: string;
  /** Replaces the default "Đã lưu" toast and `doneHref` navigation after a successful save. */
  onSaved?: (values: Values) => void;
  /** Storage key for autosaved drafts (see draftKey); no drafts when omitted. */
  draftId?: string;
  /** The saved item this form edits, to notice when it changes or is deleted elsewhere. */
  table?: string;
  itemKey?: string;
  /** Saves the form as a new item, for when the edited item was deleted elsewhere. */
  onSaveAsNew?: (values: Values) => Promise<ActionResult>;
}) {
  // The reviewer: every value readable in a disabled fieldset; no save, drafts or leave prompt.
  const { readOnly } = useAdminAccess();
  const draftId = readOnly ? undefined : draftIdProp;
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
  const translationValues = useWatch({ control });
  const isNew = !lockId;
  const scoped = (path: string) => (idScope ? `${idScope}-${path}` : path);
  const fid = (path: string) => `field-${scoped(path)}`;
  // Chips have one input for the whole list, so their item errors point at that input.
  const kindOf = new Map(fields.map((f) => [f.name, f.kind]));
  const errorTarget = (e: { path: string; field: string }) =>
    kindOf.get(e.field) === "tags" || kindOf.get(e.field) === "upload"
      ? fid(e.field)
      : fid(e.path);

  // New items: the ID follows the name/title until the user edits the ID field.
  const idEdited = useRef(false);
  const idSource =
    fields.find((f) => ID_SOURCES.includes(f.name))?.name ??
    (fields.some((f) => f.name === "name") ? "name" : undefined);
  useEffect(() => {
    if (!isNew || !idSource || !fields.some((f) => f.name === "id")) return;
    const sub = form.watch((values, { name }) => {
      if (name !== idSource && name !== `${idSource}.en`) return;
      if (idEdited.current) return;
      const source = values[idSource];
      const text =
        typeof source === "string"
          ? source
          : ((source as { en?: string } | undefined)?.en ?? "");
      form.setValue("id", slugify(text), {
        shouldDirty: true,
        shouldValidate: formState.submitCount > 0,
      });
    });
    return () => sub.unsubscribe();
  }, [form, idSource, isNew, fields, formState.submitCount]);
  const watchedId = form.watch("id");
  const takenId =
    isNew &&
    typeof watchedId === "string" &&
    watchedId &&
    options.existingIds?.includes(watchedId)
      ? `ID "${watchedId}" đã được dùng, chọn ID khác`
      : undefined;
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
        // Field errors show on their inputs; session and network problems are reported globally.
        const save = saveAsNew.current && onSaveAsNew ? onSaveAsNew : onSave;
        saveAsNew.current = false;
        const result = await runAction(() => save(values), {
          silent: true,
          retry: () => void onSubmit(),
        });
        if (!result.ok) {
          if (result.fieldErrors && Object.keys(result.fieldErrors).length) {
            for (const [path, message] of Object.entries(result.fieldErrors))
              setError(path, { type: "server", message });
            setFocusKey((k) => k + 1);
          } else if (!result.code || result.code === "FORBIDDEN") {
            toast.error(result.error);
          }
          return;
        }
        if (draftId) clearDraft(localStorage, draftId);
        // Mark the current values as saved so the unsaved-changes guard lets go.
        form.reset(raw);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        if (onSaved) {
          onSaved(values);
        } else {
          toast.success("Đã lưu");
          if (doneHref) router.push(doneHref);
        }
      }),
    () => setFocusKey((k) => k + 1),
  );

  function renderField(f: FieldSpec) {
    const id = fid(f.name);
    const error = errAt(f.name);
    const required = isRequired(f);
    const nullableText = "nullable" in f && f.nullable;
    const invalid = (e?: string) => (e ? "border-destructive" : undefined);
    switch (f.kind) {
      case "text":
      case "url":
      case "month":
      case "date": {
        const shownError = error ?? (f.name === "id" ? takenId : undefined);
        const hint =
          f.name === "id" && isNew
            ? "Tự tạo từ tên; sửa nếu muốn. Chỉ chữ thường không dấu, số và dấu gạch ngang."
            : f.hint;
        const reg = register(f.name, {
          setValueAs: (v: string) => (nullableText && v === "" ? null : v),
        });
        return (
          <FieldShell
            key={f.name}
            id={id}
            label={f.label}
            required={required}
            hint={hint}
            error={shownError}
          >
            <Input
              {...a11yProps(id, shownError)}
              className={invalid(shownError)}
              type={f.kind === "text" ? "text" : f.kind}
              disabled={f.name === "id" && !isNew}
              // Server HTML shows the value before hydration (register only fills it in the browser).
              defaultValue={
                (initial[f.name] as string | null | undefined) ?? ""
              }
              {...reg}
              onChange={(e) => {
                if (f.name === "id") idEdited.current = true;
                return reg.onChange(e);
              }}
            />
          </FieldShell>
        );
      }
      case "evidence": {
        const ev = options.evidence ?? { experiences: [], projects: [] };
        return (
          <FieldShell
            key={f.name}
            id={id}
            label={f.label}
            hint="Thẻ sẽ dẫn tới mục này trên trang."
            error={error}
          >
            <select
              {...a11yProps(id, error)}
              className={cn(
                "h-9 rounded-md border bg-background px-2 text-sm",
                invalid(error),
              )}
              {...register(f.name, {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
              // Server HTML shows the saved choice before hydration (as text inputs do).
              defaultValue={
                (initial[f.name] as string | null | undefined) ?? ""
              }
            >
              <option value="">Không có</option>
              <optgroup label="Kinh nghiệm">
                {ev.experiences.map((o) => (
                  <option key={o.id} value={`#exp-${o.id}`}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Dự án">
                {ev.projects.map((o) => (
                  <option key={o.id} value={`#proj-${o.id}`}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </FieldShell>
        );
      }
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
                  idPrefix={scoped(f.name)}
                  // An optional text that has been opened needs its EN (the schema checks it).
                  required={required || Boolean(f.nullable)}
                  value={(field.value as I18nValue) ?? EMPTY_I18N}
                  onChange={field.onChange}
                  onRemove={f.nullable ? () => field.onChange(null) : undefined}
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
      case "tags": {
        const tagErrors = errors.filter((e) => e.field === f.name);
        const tagError =
          tagErrors.map((e) => e.message).join(" · ") || undefined;
        const invalidIndexes = new Set(
          tagErrors.map((e) => Number(e.path.split(".").at(-1))),
        );
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <TagCombobox
                id={id}
                label={f.label}
                error={tagError}
                invalidIndexes={invalidIndexes}
                value={(field.value as string[]) ?? []}
                onChange={field.onChange}
                suggestions={
                  f.suggest === "skills" ? (options.skillNames ?? []) : []
                }
              />
            )}
          />
        );
      }
      case "upload":
        return (
          <Controller
            key={f.name}
            control={control}
            name={f.name}
            render={({ field }) => (
              <UploadField
                id={id}
                label={f.label}
                required={required}
                error={error}
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
                        idPrefix={scoped(`${f.name}.${part}`)}
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
                    const labelId = fid(`${f.name}.${i}.label`);
                    const urlId = fid(`${f.name}.${i}.url`);
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
                      id={fid(`${f.name}.0`)}
                      type="color"
                      aria-label="Màu bắt đầu"
                      aria-invalid={Boolean(colorErr)}
                      aria-describedby={colorErr ? `${id}-error` : undefined}
                      value={from}
                      onChange={(e) => field.onChange([e.target.value, to])}
                    />
                    <input
                      id={fid(`${f.name}.1`)}
                      type="color"
                      aria-label="Màu kết thúc"
                      aria-invalid={Boolean(colorErr)}
                      aria-describedby={colorErr ? `${id}-error` : undefined}
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
                            {...a11yProps(fid(`${f.name}.value`), valueErr)}
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
                            id={fid(`${f.name}.value`)}
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
                        idPrefix={scoped(`${f.name}.label`)}
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
  useUnsavedGuard(dirty && !readOnly);

  // Server data that changed while the form is open (own save, another tab, a restore): taken
  // as is when nothing is edited, otherwise offered, never forced over unsaved edits.
  const initialSignature = signature(initial);
  const [base, setBase] = useState({
    signature: initialSignature,
    values: initial,
    resets: 0,
  });
  const serverMoved = initialSignature !== base.signature;
  if (serverMoved && !dirty) {
    setBase({
      signature: initialSignature,
      values: initial,
      resets: base.resets + 1,
    });
  }
  const { resets, values: baseValues } = base;
  useEffect(() => {
    if (resets > 0) form.reset(baseValues);
  }, [form, resets, baseValues]);
  // A restore of this item (history panel): drop the edits and show the server version.
  const latest = useRef(initial);
  useEffect(() => {
    latest.current = initial;
  }, [initial]);
  useEffect(() => {
    const discard = (event: Event) => {
      const detail = (
        event as CustomEvent<{ table?: string; itemKey?: string }>
      ).detail;
      if (!table || detail?.table !== table || detail?.itemKey !== itemKey)
        return;
      form.reset(latest.current);
    };
    window.addEventListener(ADMIN_DISCARD_EVENT, discard);
    return () => window.removeEventListener(ADMIN_DISCARD_EVENT, discard);
  }, [form, table, itemKey]);
  const reloadFromServer = () =>
    setBase({
      signature: initialSignature,
      values: initial,
      resets: base.resets + 1,
    });
  const keepMine = () => setBase({ ...base, signature: initialSignature });

  // Autosaved drafts: written about a second after the last edit, offered when the form opens
  // again with nothing edited yet, forgotten after a save or after 7 days.
  const draftRaw = useSyncExternalStore(
    subscribeStorage,
    () => (draftId ? readStorage(draftId) : null),
    () => null,
  );
  const draft = draftRaw ? parseDraft(draftRaw) : null;
  const [draftHandled, setDraftHandled] = useState(false);
  const draftFresh =
    draft !== null && Date.now() - new Date(draft.savedAt).getTime() < 7 * DAY;
  const showDraft =
    draftFresh &&
    !draftHandled &&
    !dirty &&
    signature(draft.values) !== signature(initial);
  useEffect(() => {
    pruneDrafts(localStorage, Date.now());
  }, []);
  useEffect(() => {
    if (!draftId) return;
    let timer: number | undefined;
    const sub = form.watch(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!form.formState.isDirty) return;
        saveDraft(localStorage, draftId, {
          values: form.getValues(),
          savedAt: new Date().toISOString(),
          baseSignature: initialSignature,
        });
      }, 1000);
    });
    return () => {
      window.clearTimeout(timer);
      sub.unsubscribe();
    };
  }, [form, draftId, initialSignature]);
  // The edited item deleted in another tab or device: unsaved edits stay, with three ways out.
  const [deletedElsewhere, setDeletedElsewhere] = useState(false);
  const saveAsNew = useRef(false);
  useEffect(() => {
    if (!table || !itemKey) return;
    return onChange((event) => {
      if (
        event.op !== "delete" ||
        event.table !== table ||
        event.key !== itemKey
      )
        return;
      if (form.formState.isDirty) {
        // A refresh would now show a 404 in place of the form: hold it until the user decides.
        holdRefresh(window.location.pathname, true);
        setDeletedElsewhere(true);
      } else {
        toast("Mục đã bị xóa ở nơi khác");
        router.push(doneHref ?? "/admin");
      }
    });
  }, [table, itemKey, form, router, doneHref]);
  // Leaving the page (sidebar, Back) must not keep its refreshes held.
  useEffect(
    () => () => {
      if (table && itemKey) holdRefresh(window.location.pathname, false);
    },
    [table, itemKey],
  );
  const leaveDeleted = () => {
    holdRefresh(window.location.pathname, false);
    setDeletedElsewhere(false);
  };
  const restoreThenSave = async () => {
    if (!table || !itemKey) return;
    const result = await runAction(() => undoDelete(table, itemKey));
    if (!result.ok) return;
    leaveDeleted();
    void onSubmit();
  };
  const saveDeletedAsNew = () => {
    leaveDeleted();
    saveAsNew.current = true;
    void onSubmit();
  };

  const restoreDraft = () => {
    if (!draft) return;
    form.reset({ ...initial, ...draft.values }, { keepDefaultValues: true });
    setDraftHandled(true);
  };
  const dropDraft = () => {
    if (draftId) clearDraft(localStorage, draftId);
    setDraftHandled(true);
  };
  const shownErrors = formState.submitCount > 0 ? errors : [];
  const errorsByField = new Map<string, number>();
  for (const e of shownErrors)
    errorsByField.set(e.field, (errorsByField.get(e.field) ?? 0) + 1);

  const placed = new Set(sections?.flatMap((s) => s.fields));
  const byName = new Map(fields.map((f) => [f.name, f]));
  const editable = sections?.length ? (
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
  const body = readOnly ? (
    <fieldset disabled className="contents">
      {editable}
    </fieldset>
  ) : (
    editable
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
          <TranslationProgress value={translationValues} />
        </div>
        {deletedElsewhere && !readOnly && (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm"
          >
            <span>
              Mục này đã bị xóa ở nơi khác. Thay đổi bạn đang sửa vẫn còn ở đây.
            </span>
            <span className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void restoreThenSave()}
              >
                Khôi phục rồi lưu bản của tôi
              </Button>
              {onSaveAsNew && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={saveDeletedAsNew}
                >
                  Lưu thành mục mới
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  leaveDeleted();
                  router.push(doneHref ?? "/admin");
                }}
              >
                Về danh sách
              </Button>
            </span>
          </div>
        )}
        {showDraft && draft && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
          >
            <span>
              Có bản nháp chưa lưu lúc{" "}
              {new Date(draft.savedAt).toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
              {draft.baseSignature !== initialSignature &&
                " (dữ liệu đã thay đổi kể từ bản nháp)"}
              .
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={dropDraft}
              >
                Bỏ
              </Button>
              <Button type="button" size="sm" onClick={restoreDraft}>
                Khôi phục
              </Button>
            </span>
          </div>
        )}
        {serverMoved && dirty && !readOnly && (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm"
          >
            <span>
              Có bản mới hơn của mục này (vừa lưu ở nơi khác). Bạn đang có thay
              đổi chưa lưu.
            </span>
            <span className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={keepMine}
              >
                Giữ bản của tôi
              </Button>
              <Button type="button" size="sm" onClick={reloadFromServer}>
                Tải lại
              </Button>
            </span>
          </div>
        )}
        <ErrorSummary
          errors={shownErrors}
          focusKey={focusKey}
          idFor={errorTarget}
        />
        {sections?.length ? (
          <div className="grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
            <FormSectionNav sections={sections} errorsByField={errorsByField} />
            <div className="flex min-w-0 flex-col gap-6">{body}</div>
          </div>
        ) : (
          body
        )}
        {!readOnly && (
          <SaveBar
            dirty={dirty}
            pending={pending}
            saved={saved}
            errorCount={shownErrors.length}
            onSave={() => void onSubmit()}
            onShowErrors={() =>
              shownErrors[0] && focusField(errorTarget(shownErrors[0]))
            }
            active={active}
            onCancel={doneHref ? () => router.push(doneHref) : undefined}
          />
        )}
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
  const router = useRouter();
  const resource = resources[resourceKey];
  const { sortIndex: _sortIndex, ...defaults } = initial;
  void _sortIndex;
  // Back to the list at the saved item, with the likely next steps one click away.
  const onSaved = (values: Values) => {
    const id = String(values.id);
    const label = String(
      (values.name as string | undefined) ??
        (values.title as string | undefined) ??
        (values.company as string | undefined) ??
        (values.school as string | undefined) ??
        id,
    );
    const visible = values.published !== false;
    // The id comes from an input: always encoded before it goes into a URL.
    const path = `/admin/${resourceKey}/${encodeURIComponent(id)}`;
    const link =
      "rounded-md border px-2 py-1 text-xs font-medium hover:bg-muted";
    toast.success(isNew ? `Đã tạo ${label}` : `Đã lưu ${label}`, {
      duration: 8000,
      description: (
        <span className="mt-1 flex flex-wrap gap-1.5">
          <Link className={link} href={path}>
            Mở lại
          </Link>
          {isNew && (
            <Link className={link} href={`/admin/${resourceKey}/new`}>
              Tạo thêm
            </Link>
          )}
          {visible && (
            <a
              className={link}
              href={publicUrl(resourceKey, id, window.location.origin)}
              target="_blank"
              rel="noopener"
            >
              Xem trên trang ↗
            </a>
          )}
        </span>
      ),
    });
    router.push(`/admin/${resourceKey}?highlight=${encodeURIComponent(id)}`);
  };
  return (
    <>
      {!isNew && (
        <div className="flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/admin/preview?locale=en&target=${encodeURIComponent(publicAnchor(resourceKey, String(initial.id)))}`}
              prefetch={false}
              target="_blank"
              rel="noopener"
            >
              Xem trước nội dung đã lưu ↗
            </Link>
          </Button>
        </div>
      )}
      <FieldsForm
        fields={resource.fields}
        schema={resource.schema.omit({ sortIndex: true })}
        initial={defaults}
        options={options}
        lockId={!isNew}
        onSave={(values) => saveResource(resourceKey, values, isNew)}
        doneHref={`/admin/${resourceKey}`}
        onSaved={onSaved}
        draftId={draftKey(resource.table, isNew ? "new" : String(initial.id))}
        table={resource.table}
        itemKey={isNew ? undefined : String(initial.id)}
        onSaveAsNew={(values) => saveResource(resourceKey, values, true)}
        sections={resource.sections}
      />
    </>
  );
}
