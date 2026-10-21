"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  Film,
  File,
  RefreshCw,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { listMedia, deleteMedia } from "@/app/admin/media-actions";
import { runAction } from "@/lib/admin/action-errors";
import {
  canSelectMedia,
  formatMediaBytes,
  FREE_STORAGE_REFERENCE,
  type MediaFile,
  type MediaLibrarySnapshot,
} from "@/lib/admin/media";
import { UPLOAD_RULES, type UploadKind } from "@/lib/admin/upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const TYPE_LABELS = { image: "Ảnh", video: "Video", pdf: "PDF", other: "Khác" };
type Props =
  | { kind?: undefined; onSelect?: undefined }
  | { kind: UploadKind; onSelect: (url: string) => void };

/** One inventory for the library and picker. No autoplay, previews load only images on demand. */
export function MediaBrowser({ kind, onSelect }: Props) {
  const [library, setLibrary] = useState<MediaLibrarySnapshot | null>(null);
  const [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const [query, setQuery] = useState(""),
    [type, setType] = useState("all"),
    [unused, setUnused] = useState(false);
  const [deleting, setDeleting] = useState<MediaFile | null>(null),
    [pending, setPending] = useState(false),
    [deleteError, setDeleteError] = useState("");
  const deleteLock = useRef(false);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  function reload() {
    setLibrary(null);
    setError("");
    setRevision((v) => v + 1);
  }
  useEffect(() => {
    let active = true;
    void runAction(() => listMedia(), { write: false, silent: true }).then(
      (result) => {
        if (!active) return;
        if (result.ok && "library" in result) setLibrary(result.library);
        else if (!result.ok)
          setError(
            "error" in result ? result.error : "Không đọc được thư viện.",
          );
      },
    );
    return () => {
      active = false;
    };
  }, [revision]);
  async function confirmDelete() {
    if (!deleting || deleteLock.current) return;
    deleteLock.current = true;
    setPending(true);
    setDeleteError("");
    try {
      const result = await runAction(
        () => deleteMedia(deleting.bucket, deleting.path),
        { silent: true },
      );
      if (result.ok) {
        toast.success("Đã xóa tệp vĩnh viễn");
        deleteTrigger.current = null;
        setDeleting(null);
        reload();
      } else
        setDeleteError(
          "error" in result ? result.error : "Không xóa được tệp.",
        );
    } finally {
      deleteLock.current = false;
      setPending(false);
    }
  }
  const search = query.trim().toLocaleLowerCase("vi");
  const visible =
    library?.files.filter(
      (file) =>
        (!kind || file.kind === kind) &&
        (type === "all" || file.kind === type) &&
        (!unused || !file.uses.length) &&
        `${file.name} ${file.path} ${file.bucket}`
          .toLocaleLowerCase("vi")
          .includes(search),
    ) ?? [];
  return (
    <div className="space-y-5">
      {library && (
        <section
          aria-label="Dung lượng thư viện"
          className="rounded-xl border bg-card p-4 text-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium">
              {library.files.length} tệp ·{" "}
              {formatMediaBytes(library.knownBytes)} đã xác định
            </p>
            <span className="text-muted-foreground">
              Mốc tham khảo miễn phí: 1 GB
            </span>
          </div>
          <progress
            aria-label="Dung lượng đã xác định so với 1 GB"
            value={Math.min(library.knownBytes, FREE_STORAGE_REFERENCE)}
            max={FREE_STORAGE_REFERENCE}
            className="my-2 h-2 w-full accent-primary"
          />
          <p className="text-muted-foreground">
            Chỉ tính hai bucket media và files; không phải tổng dung lượng dự
            án.{" "}
            {library.unknownSizes > 0
              ? `${library.unknownSizes} tệp chưa rõ dung lượng, chưa được tính vào tổng.`
              : "Không bao gồm các bucket khác."}
          </p>
        </section>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-44 flex-1 space-y-1 text-sm">
          <span className="font-medium">Tìm tệp</span>
          <input
            ref={searchInput}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên tệp hoặc đường dẫn…"
            className="h-10 w-full rounded-md border bg-background px-3"
          />
        </label>
        {!kind && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">Loại tệp</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="block h-10 rounded-md border bg-background px-3"
            >
              <option value="all">Tất cả</option>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        {!kind && (
          <label className="flex min-h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={unused}
              onChange={(e) => setUnused(e.target.checked)}
            />
            Chỉ tệp chưa dùng
          </label>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={!library && !error}
          onClick={reload}
        >
          <RefreshCw aria-hidden className="size-4" />
          Tải lại
        </Button>
      </div>
      {kind && (
        <p className="text-sm text-muted-foreground">
          Chọn {TYPE_LABELS[kind].toLowerCase()} có sẵn, tối đa{" "}
          {formatMediaBytes(UPLOAD_RULES[kind].maxBytes)}. Chỉ thay đổi form;
          bấm Lưu trong form để áp dụng.
        </p>
      )}
      {error ? (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-destructive/40 p-4"
        >
          <p>{error}</p>
          <Button type="button" variant="outline" onClick={reload}>
            Thử lại
          </Button>
        </div>
      ) : !library ? (
        <p role="status" className="py-12 text-center text-muted-foreground">
          Đang tải thư viện…
        </p>
      ) : (
        <>
          <p role="status" className="text-sm text-muted-foreground">
            {visible.length} tệp hiển thị
          </p>
          {!visible.length ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
              {!library.files.length
                ? "Chưa có tệp trong thư viện."
                : "Không có tệp phù hợp. Thử đổi bộ lọc."}
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((file) => (
                <li
                  key={`${file.bucket}/${file.path}`}
                  className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card"
                >
                  <MediaPreview file={file} />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <div>
                      <h2 className="break-all text-sm font-semibold">
                        {file.name}
                      </h2>
                      <p className="break-all text-xs text-muted-foreground">
                        {file.bucket}/{file.path}
                      </p>
                    </div>
                    <dl className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">
                          Loại · dung lượng
                        </dt>
                        <dd>
                          {TYPE_LABELS[file.kind]} ·{" "}
                          {formatMediaBytes(file.size)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Ngày tải lên</dt>
                        <dd>
                          {file.createdAt &&
                          !Number.isNaN(Date.parse(file.createdAt))
                            ? new Intl.DateTimeFormat("vi-VN", {
                                timeZone: "Asia/Ho_Chi_Minh",
                              }).format(new Date(file.createdAt))
                            : "Chưa rõ"}
                        </dd>
                      </div>
                    </dl>
                    {file.uses.length ? (
                      <div className="space-y-1 text-xs">
                        <p className="font-medium">Đang dùng ở</p>
                        <ul className="space-y-1">
                          {file.uses.map((use) => (
                            <li key={use.href + use.label}>
                              {kind ? (
                                <span>{use.label}</span>
                              ) : (
                                <Link
                                  className="underline underline-offset-4"
                                  href={use.href}
                                >
                                  {use.label}
                                </Link>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Chưa dùng trong nội dung hiện tại
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      {kind && onSelect ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full"
                            disabled={!canSelectMedia(file, kind)}
                            aria-label={`Chọn ${file.name}`}
                            onClick={() => onSelect(file.url)}
                          >
                            Chọn tệp này
                          </Button>
                          {!canSelectMedia(file, kind) && (
                            <p className="text-xs text-muted-foreground">
                              Không thể chọn: chưa rõ dung lượng hoặc không đúng
                              giới hạn tải lên.
                            </p>
                          )}
                        </>
                      ) : (
                        <>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm underline underline-offset-4"
                            aria-label={`Mở ${file.name} (tab mới)`}
                          >
                            Mở tệp
                          </a>
                          {!file.uses.length && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              aria-label={`Xóa ${file.name}`}
                              onClick={(event) => {
                                deleteTrigger.current = event.currentTarget;
                                setDeleteError("");
                                setDeleting(file);
                              }}
                            >
                              <Trash2 aria-hidden className="size-4" />
                              Xóa
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !deleteLock.current) setDeleting(null);
        }}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (deleteTrigger.current?.isConnected
              ? deleteTrigger.current
              : searchInput.current
            )?.focus();
          }}
          showCloseButton={!pending}
          onEscapeKeyDown={(e) => {
            if (deleteLock.current) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (deleteLock.current) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Xóa tệp vĩnh viễn?</DialogTitle>
            <DialogDescription>
              Tệp không thể khôi phục sau khi xóa, kể cả qua lịch sử nội dung.
              Bản nháp và phiên bản cũ có thể còn tham chiếu đến tệp này. Kiểm
              tra các tab đang chỉnh sửa trước khi xóa.
            </DialogDescription>
          </DialogHeader>
          <p className="break-all text-sm font-medium">
            {deleting?.bucket}/{deleting?.path}
          </p>
          {deleteError && (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleting(null)}
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirmDelete()}
            >
              {pending ? "Đang xóa…" : "Xóa vĩnh viễn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MediaPreview({ file }: { file: MediaFile }) {
  const [failed, setFailed] = useState(false);
  const Icon =
    file.kind === "pdf"
      ? FileText
      : file.kind === "video"
        ? Film
        : file.kind === "image"
          ? ImageIcon
          : File;
  return (
    <div className="flex aspect-video items-center justify-center border-b bg-muted/40">
      {file.kind === "image" && !failed ? (
        // Storage thumbnails in the authenticated admin; allow the configured Storage host without optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={file.url}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <Icon aria-hidden className="size-10 text-muted-foreground" />
      )}
    </div>
  );
}
