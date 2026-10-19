"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { flushContent, setSkillLink } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SKILL_GROUPS } from "@/content/schema";
import type { AdminContent } from "@/lib/admin/health";
import type { LinkTarget } from "@/lib/admin/links";
import {
  buildMatrix,
  columnKey,
  filterMatrix,
  matrixQuery,
  type MatrixColumn,
  type MatrixFilter,
} from "@/lib/admin/matrix";
import { cn } from "@/lib/utils";

const FLUSH_DELAY_MS = 800;
const cellId = (skillId: string, colKey: string) => `${skillId}|${colKey}`;
const targetOf = (col: MatrixColumn): LinkTarget =>
  col.kind === "experience" ? { experienceId: col.id } : { projectId: col.id };

/**
 * Skills × Evidence grid. Each cell toggles one skill_links row at once (optimistic), keeps
 * only the latest intent per cell while a save is in flight, and refreshes the public site
 * cache once after the clicks stop.
 */
export function SkillMatrix({ content, initialFilter }: { content: AdminContent; initialFilter: MatrixFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState(initialFilter);
  const base = useMemo(() => buildMatrix(content), [content]);
  const view = useMemo(() => filterMatrix(base, filter, content), [base, filter, content]);

  // Shown state per cell (overrides the server data), the last state the server confirmed,
  // and the cells with a request in flight.
  const [shown, setShown] = useState<Map<string, boolean>>(new Map());
  const confirmed = useRef(new Map<string, boolean>());
  const wanted = useRef(new Map<string, boolean>());
  const inflight = useRef(new Set<string>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (flushTimer.current && clearTimeout(flushTimer.current)), []);

  const serverLinked = (skillId: string, colKey: string) =>
    base.groups.some((g) => g.rows.some((r) => r.skill.id === skillId && r.linked.has(colKey)));
  const isLinked = (skillId: string, colKey: string) => shown.get(cellId(skillId, colKey)) ?? serverLinked(skillId, colKey);

  function updateFilter(next: MatrixFilter) {
    setFilter(next);
    router.replace(`${pathname}${matrixQuery(next)}`, { scroll: false });
  }

  function scheduleFlush() {
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      void flushContent();
    }, FLUSH_DELAY_MS);
  }

  async function send(skillId: string, col: MatrixColumn) {
    const id = cellId(skillId, columnKey(col));
    const value = wanted.current.get(id)!;
    inflight.current.add(id);
    const result = await setSkillLink(skillId, targetOf(col), value);
    inflight.current.delete(id);
    if (!result.ok) {
      const back = confirmed.current.get(id) ?? serverLinked(skillId, columnKey(col));
      wanted.current.set(id, back);
      setShown((m) => new Map(m).set(id, back));
      toast.error(`Không lưu được: ${result.error}`);
      return;
    }
    confirmed.current.set(id, value);
    if (wanted.current.get(id) !== value) await send(skillId, col);
  }

  function toggle(skillId: string, col: MatrixColumn) {
    const key = columnKey(col);
    const id = cellId(skillId, key);
    const next = !isLinked(skillId, key);
    wanted.current.set(id, next);
    setShown((m) => new Map(m).set(id, next));
    scheduleFlush();
    if (!inflight.current.has(id)) void send(skillId, col);
  }

  // Roving focus over the visible checkboxes.
  const rows = view.groups.flatMap((g) => g.rows);
  const gridRef = useRef<HTMLTableElement>(null);
  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
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
    const [nr, nc] = [Math.max(0, Math.min(rows.length - 1, to[0])), Math.max(0, Math.min(view.columns.length - 1, to[1]))];
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${nr}:${nc}"]`)?.focus();
  }

  const orphanCount = filterMatrix(base, { ...filter, q: "", group: "all", only: "orphan" }, content).groups.flatMap((g) => g.rows).length;
  const hiddenCount = filterMatrix(base, { ...filter, q: "", group: "all", only: "hidden-evidence" }, content).groups.flatMap((g) => g.rows).length;
  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1 text-xs transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted");
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
        <button type="button" className={chip(filter.only === "orphan")} aria-pressed={filter.only === "orphan"}
          onClick={() => updateFilter({ ...filter, only: filter.only === "orphan" ? "all" : "orphan" })}>
          Chưa có bằng chứng ({orphanCount})
        </button>
        <button type="button" className={chip(filter.only === "hidden-evidence")} aria-pressed={filter.only === "hidden-evidence"}
          onClick={() => updateFilter({ ...filter, only: filter.only === "hidden-evidence" ? "all" : "hidden-evidence" })}>
          Bằng chứng đang ẩn ({hiddenCount})
        </button>
        <select aria-label="Nhóm" className="h-8 rounded-md border bg-background px-2 text-sm" value={filter.group}
          onChange={(e) => updateFilter({ ...filter, group: e.target.value as MatrixFilter["group"] })}>
          <option value="all">Mọi nhóm</option>
          {SKILL_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={filter.showHidden} onCheckedChange={(v) => updateFilter({ ...filter, showHidden: v })} />
          Hiện cột đang ẩn
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Không có skill nào khớp bộ lọc.</p>
      ) : (
        <div className="max-h-[75dvh] overflow-auto rounded-md border">
          <table ref={gridRef} role="grid" aria-label="Skills × Bằng chứng" className="border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky top-0 left-0 z-30 bg-background p-2 text-left">Skill</th>
                {view.columns.map((col, i) => (
                  <th key={columnKey(col)} scope="col"
                    className={cn("sticky top-0 z-20 bg-background p-2 text-xs font-medium whitespace-nowrap", i > 0 && view.columns[i - 1].kind !== col.kind && "border-l-2", col.hidden && "text-muted-foreground italic")}>
                    <Link href={`/admin/${col.kind === "experience" ? "experiences" : "projects"}/${col.id}`} className="hover:underline">
                      {col.label}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="sticky top-0 z-20 bg-background p-2 text-xs">Tổng</th>
              </tr>
            </thead>
            <tbody>
              {view.groups.map((g) => (
                <GroupRows key={g.group} label={`${g.group} (${g.rows.length})`} span={view.columns.length + 2}>
                  {g.rows.map((row) => {
                    rowIndex++;
                    const r = rowIndex;
                    const total = base.columns.filter((col) => isLinked(row.skill.id, columnKey(col))).length;
                    return (
                      <tr key={row.skill.id} className={cn(total === 0 && "bg-amber-500/10")}>
                        <th scope="row" className="sticky left-0 z-10 bg-background p-2 text-left font-medium whitespace-nowrap">
                          <Link href={`/admin/skills/${row.skill.id}`} className="hover:underline">{row.skill.name}</Link>
                        </th>
                        {view.columns.map((col, c) => {
                          const on = isLinked(row.skill.id, columnKey(col));
                          return (
                            <td key={columnKey(col)} role="gridcell" className={cn("p-1 text-center", c > 0 && view.columns[c - 1].kind !== col.kind && "border-l-2")}>
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={on}
                                aria-label={`${row.skill.name} × ${col.label}`}
                                data-cell={`${r}:${c}`}
                                tabIndex={r === 0 && c === 0 ? 0 : -1}
                                onClick={() => toggle(row.skill.id, col)}
                                onKeyDown={(e) => onKeyDown(e, r, c)}
                                className={cn(
                                  "size-6 rounded-full border transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:scale-90",
                                  on && !col.hidden && "border-emerald-600 bg-emerald-500",
                                  on && col.hidden && "border-2 border-amber-500 bg-transparent",
                                  !on && "border-muted-foreground/30 hover:border-foreground/60",
                                )}
                              />
                            </td>
                          );
                        })}
                        <td className="p-2 text-center tabular-nums">{total}</td>
                      </tr>
                    );
                  })}
                </GroupRows>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="sticky left-0 bg-background p-2 text-left text-xs">Số skill</th>
                {view.columns.map((col) => (
                  <td key={columnKey(col)} className="p-2 text-center text-xs tabular-nums">
                    {rows.filter((row) => isLinked(row.skill.id, columnKey(col))).length}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Chấm xanh: đã gắn. Vòng cam: gắn với mục đang ẩn (khách không thấy). Phím mũi tên để di chuyển, Space để bật/tắt.
      </p>
    </div>
  );
}

function GroupRows({ label, span, children }: { label: string; span: number; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <th colSpan={span} scope="colgroup" className="sticky left-0 bg-muted/60 px-2 py-1 text-left text-xs font-semibold tracking-wide uppercase">
          {label}
        </th>
      </tr>
      {children}
    </>
  );
}
