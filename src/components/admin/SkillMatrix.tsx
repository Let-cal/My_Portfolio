"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  saveResource,
  saveSkillLinks,
  type LinkChange,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SKILL_GROUPS } from "@/content/schema";
import type { AdminContent } from "@/lib/admin/health";
import {
  buildMatrix,
  columnKey,
  filterMatrix,
  matrixQuery,
  type MatrixColumn,
  type MatrixFilter,
} from "@/lib/admin/matrix";
import { slugify } from "@/lib/admin/slug";
import { cn } from "@/lib/utils";
import { useUnsavedGuard } from "./SaveBar";

const cellId = (skillId: string, colKey: string) => `${skillId}|${colKey}`;

/**
 * Skills × Evidence grid. Clicking a cell only marks a change; "Lưu" (or Ctrl/⌘+S) saves all
 * changes in one request and refreshes the public site once. Rows edited since the filter was
 * set stay visible, so a skill does not vanish from "Chưa có bằng chứng" while being linked.
 */
export function SkillMatrix({
  content,
  initialFilter,
}: {
  content: AdminContent;
  initialFilter: MatrixFilter;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState(initialFilter);
  // Unsaved changes: cell id → wanted state (only cells that differ from the saved data).
  const [draft, setDraft] = useState<Map<string, boolean>>(new Map());
  // Saved in this session but not yet in `content` (until the page refresh brings it).
  const [saved, setSaved] = useState<Map<string, boolean>>(new Map());
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const base = useMemo(() => buildMatrix(content), [content]);
  const view = useMemo(
    () => filterMatrix(base, filter, content, pinned),
    [base, filter, content, pinned],
  );
  const columns = useMemo(
    () => new Map(base.columns.map((col) => [columnKey(col), col])),
    [base],
  );

  const serverLinked = (skillId: string, colKey: string) =>
    saved.get(cellId(skillId, colKey)) ??
    base.groups.some((g) =>
      g.rows.some((r) => r.skill.id === skillId && r.linked.has(colKey)),
    );
  const isLinked = (skillId: string, colKey: string) =>
    draft.get(cellId(skillId, colKey)) ?? serverLinked(skillId, colKey);

  function updateFilter(next: MatrixFilter) {
    setFilter(next);
    setPinned(new Set());
    router.replace(`${pathname}${matrixQuery(next)}`, { scroll: false });
  }

  function toggle(skillId: string, col: MatrixColumn) {
    const key = columnKey(col);
    const id = cellId(skillId, key);
    const next = !isLinked(skillId, key);
    setDraft((m) => {
      const copy = new Map(m);
      if (next === serverLinked(skillId, key)) copy.delete(id);
      else copy.set(id, next);
      return copy;
    });
    setPinned((p) => (p.has(skillId) ? p : new Set(p).add(skillId)));
  }

  const save = useCallback(async () => {
    if (!draft.size || saving) return;
    const changes: LinkChange[] = [...draft].map(([id, linked]) => {
      const [skillId, colKey] = id.split("|");
      const col = columns.get(colKey)!;
      return col.kind === "experience"
        ? { skillId, experienceId: col.id, linked }
        : { skillId, projectId: col.id, linked };
    });
    setSaving(true);
    let result: Awaited<ReturnType<typeof saveSkillLinks>>;
    try {
      result = await saveSkillLinks(changes);
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
    setSaving(false);
    if (!result.ok) {
      toast.error(`Không lưu được: ${result.error}`);
      return;
    }
    setSaved((m) => new Map([...m, ...draft]));
    setDraft(new Map());
    toast.success(`Đã lưu ${changes.length} thay đổi`);
    router.refresh();
  }, [draft, saving, columns, router]);

  // Ctrl/⌘+S saves; leaving (tab close, links, ⌘K) with unsaved changes asks first.
  useUnsavedGuard(draft.size > 0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Roving focus over the visible checkboxes.
  const rows = view.groups.flatMap((g) => g.rows);
  const gridRef = useRef<HTMLTableElement>(null);
  function onKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    r: number,
    c: number,
  ) {
    const moves: Record<string, [number, number]> = {
      ArrowRight: [r, c + 1],
      ArrowLeft: [r, c - 1],
      ArrowDown: [r + 1, c],
      ArrowUp: [r - 1, c],
      Home: [r, 0],
      End: [r, view.columns.length - 1],
    };
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(rows[r].skill.id, view.columns[c]);
      return;
    }
    const to = moves[e.key];
    if (!to) return;
    e.preventDefault();
    const [nr, nc] = [
      Math.max(0, Math.min(rows.length - 1, to[0])),
      Math.max(0, Math.min(view.columns.length - 1, to[1])),
    ];
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${nr}:${nc}"]`)
      ?.focus();
  }

  const orphanCount = filterMatrix(
    base,
    { ...filter, q: "", group: "all", only: "orphan" },
    content,
  ).groups.flatMap((g) => g.rows).length;
  const hiddenCount = filterMatrix(
    base,
    { ...filter, q: "", group: "all", only: "hidden-evidence" },
    content,
  ).groups.flatMap((g) => g.rows).length;
  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-xs transition-colors",
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "hover:bg-muted",
    );
  let rowIndex = -1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Tìm skill"
          placeholder="Tìm skill…"
          className="w-48"
          value={filter.q}
          onChange={(e) => updateFilter({ ...filter, q: e.target.value })}
        />
        <button
          type="button"
          className={chip(filter.only === "orphan")}
          aria-pressed={filter.only === "orphan"}
          onClick={() =>
            updateFilter({
              ...filter,
              only: filter.only === "orphan" ? "all" : "orphan",
            })
          }
        >
          Chưa có bằng chứng ({orphanCount})
        </button>
        <button
          type="button"
          className={chip(filter.only === "hidden-evidence")}
          aria-pressed={filter.only === "hidden-evidence"}
          onClick={() =>
            updateFilter({
              ...filter,
              only:
                filter.only === "hidden-evidence" ? "all" : "hidden-evidence",
            })
          }
        >
          Bằng chứng đang ẩn ({hiddenCount})
        </button>
        <select
          aria-label="Nhóm"
          className="h-8 rounded-md border bg-background px-2 text-sm"
          value={filter.group}
          onChange={(e) =>
            updateFilter({
              ...filter,
              group: e.target.value as MatrixFilter["group"],
            })
          }
        >
          <option value="all">Mọi nhóm</option>
          {SKILL_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={filter.showHidden}
            onCheckedChange={(v) => updateFilter({ ...filter, showHidden: v })}
          />
          Hiện cột đang ẩn
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Không có skill nào khớp bộ lọc.
        </p>
      ) : (
        <div className="max-h-[75dvh] overflow-auto rounded-md border">
          <table
            ref={gridRef}
            role="grid"
            aria-label="Skills × Bằng chứng"
            className="border-separate border-spacing-0 text-sm"
          >
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky top-0 left-0 z-30 bg-background p-2 text-left"
                >
                  Skill
                </th>
                {view.columns.map((col, i) => (
                  <th
                    key={columnKey(col)}
                    scope="col"
                    className={cn(
                      "sticky top-0 z-20 bg-background px-1 py-2 align-bottom text-xs font-medium whitespace-nowrap",
                      i > 0 &&
                        view.columns[i - 1].kind !== col.kind &&
                        "border-l-2",
                      col.hidden && "text-muted-foreground italic",
                    )}
                  >
                    <Link
                      href={`/admin/${col.kind === "experience" ? "experiences" : "projects"}/${col.id}`}
                      title={`${col.kind === "experience" ? "Kinh nghiệm" : "Dự án"}: ${col.label}${col.hidden ? " (đang ẩn)" : ""}`}
                      className="inline-block max-h-40 rotate-180 truncate align-bottom [writing-mode:vertical-rl] hover:underline"
                    >
                      {col.label}
                    </Link>
                  </th>
                ))}
                <th
                  scope="col"
                  className="sticky top-0 z-20 bg-background p-2 text-xs"
                >
                  Tổng
                </th>
              </tr>
            </thead>
            <tbody>
              {view.groups.map((g) => (
                <GroupRows
                  key={g.group}
                  label={`${g.group} (${g.rows.length})`}
                  span={view.columns.length + 2}
                  footer={
                    <AddSkillRow
                      group={g.group}
                      span={view.columns.length + 2}
                      onAdded={() => router.refresh()}
                    />
                  }
                >
                  {g.rows.map((row) => {
                    rowIndex++;
                    const r = rowIndex;
                    const total = base.columns.filter((col) =>
                      isLinked(row.skill.id, columnKey(col)),
                    ).length;
                    return (
                      <tr
                        key={row.skill.id}
                        className={cn(total === 0 && "bg-amber-500/10")}
                      >
                        <th
                          scope="row"
                          className="sticky left-0 z-10 bg-background p-2 text-left font-medium whitespace-nowrap"
                        >
                          <Link
                            href={`/admin/skills/${row.skill.id}`}
                            className="hover:underline"
                          >
                            {row.skill.name}
                          </Link>
                        </th>
                        {view.columns.map((col, c) => {
                          const on = isLinked(row.skill.id, columnKey(col));
                          const changed = draft.has(
                            cellId(row.skill.id, columnKey(col)),
                          );
                          return (
                            <td
                              key={columnKey(col)}
                              role="gridcell"
                              className={cn(
                                "p-1 text-center",
                                c > 0 &&
                                  view.columns[c - 1].kind !== col.kind &&
                                  "border-l-2",
                              )}
                            >
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                data-changed={changed || undefined}
                                aria-label={`${row.skill.name} × ${col.label}`}
                                data-cell={`${r}:${c}`}
                                tabIndex={r === 0 && c === 0 ? 0 : -1}
                                onClick={() => toggle(row.skill.id, col)}
                                onKeyDown={(e) => onKeyDown(e, r, c)}
                                className={cn(
                                  "size-6 rounded-full border transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-90",
                                  on &&
                                    !col.hidden &&
                                    "border-emerald-600 bg-emerald-500",
                                  on &&
                                    col.hidden &&
                                    "border-2 border-amber-500 bg-transparent",
                                  !on &&
                                    "border-muted-foreground/30 hover:border-foreground/60",
                                  changed &&
                                    "ring-2 ring-sky-500 ring-offset-2 ring-offset-background",
                                )}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center tabular-nums">
                          {total}
                        </td>
                      </tr>
                    );
                  })}
                </GroupRows>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th
                  scope="row"
                  className="sticky left-0 bg-background p-2 text-left text-xs"
                >
                  Số skill
                </th>
                {view.columns.map((col) => (
                  <td
                    key={columnKey(col)}
                    className="p-2 text-center text-xs tabular-nums"
                  >
                    {
                      rows.filter((row) =>
                        isLinked(row.skill.id, columnKey(col)),
                      ).length
                    }
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Chấm xanh: đã gắn. Vòng cam: gắn với mục đang ẩn (khách không thấy).
        Viền xanh dương: thay đổi chưa lưu. Phím mũi tên để di chuyển, Space để
        bật/tắt, Ctrl/⌘+S để lưu.
      </p>
      {draft.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          role="region"
          aria-label="Thay đổi chưa lưu"
          className="sticky bottom-3 z-40 flex items-center justify-between gap-3 rounded-lg border bg-background/95 px-4 py-2.5 shadow-lg backdrop-blur"
        >
          <span className="text-sm font-medium">
            {draft.size} thay đổi chưa lưu
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => setDraft(new Map())}
            >
              Hủy
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? "Đang lưu…" : "Lưu"}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function GroupRows({
  label,
  span,
  children,
  footer,
}: {
  label: string;
  span: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <th
          colSpan={span}
          scope="colgroup"
          className="sticky left-0 bg-muted/60 px-2 py-1 text-left text-xs font-semibold tracking-wide uppercase"
        >
          {label}
        </th>
      </tr>
      {children}
      {footer}
    </>
  );
}

/** "+ Thêm skill" at the end of a group: type a name, Enter adds it (the id comes from the name). */
function AddSkillRow({
  group,
  span,
  onAdded,
}: {
  group: string;
  span: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const errorId = `add-skill-${group}-error`;
  const close = () => {
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  async function submit() {
    const trimmed = name.trim();
    const id = slugify(trimmed);
    const fail = (message: string) => {
      setError(message);
      inputRef.current?.focus();
    };
    if (!trimmed) return fail("Nhập tên skill");
    if (!id) return fail("Tên cần có ít nhất một chữ cái hoặc chữ số");
    setBusy(true);
    let result: Awaited<ReturnType<typeof saveResource>>;
    try {
      result = await saveResource(
        "skills",
        { id, name: trimmed, group, experienceIds: [], projectIds: [] },
        true,
      );
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    setBusy(false);
    if (!result.ok) {
      // The row has no ID field: a clashing id means the skill (or one with the same id) exists.
      fail(
        result.fieldErrors?.id
          ? `Đã có skill với ID "${id}" (${result.fieldErrors.id.split(",")[0]}). Đổi tên hoặc sửa skill đó.`
          : (Object.values(result.fieldErrors ?? {})[0] ?? result.error),
      );
      return;
    }
    toast.success(`Đã thêm ${trimmed} vào nhóm ${group}`);
    // Stay open, empty and focused so several skills can be added in a row.
    setName("");
    setError(null);
    onAdded();
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <tr>
      <td colSpan={span} className="p-1">
        <div className="sticky left-0 flex w-max flex-wrap items-center gap-2 px-1">
          {open ? (
            <>
              <Input
                ref={inputRef}
                autoFocus
                aria-label={`Tên skill mới (${group})`}
                aria-busy={busy || undefined}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                placeholder="Tên skill, ví dụ LangGraph"
                className="h-8 w-56"
                value={name}
                readOnly={busy}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void submit();
                  } else if (e.key === "Escape") {
                    close();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void submit()}
              >
                {busy ? "Đang thêm…" : "Thêm"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={close}
              >
                Hủy
              </Button>
              {error && (
                <span
                  id={errorId}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {error}
                </span>
              )}
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              ref={triggerRef}
              aria-label={`Thêm skill vào nhóm ${group}`}
              onClick={() => setOpen(true)}
            >
              + Thêm skill
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
