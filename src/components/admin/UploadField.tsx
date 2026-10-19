"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { a11yProps, FieldError, RequiredMark } from "./FieldShell";
import { bucketFor, storagePath, UPLOAD_RULES, validateUpload, type UploadKind } from "@/lib/admin/upload";
import { createBrowserSupabase } from "@/lib/supabase/browser";

/**
 * Uploads straight from the browser to Supabase Storage with the admin's session, so large
 * files never pass through a server function (Vercel limits request bodies to 4.5 MB).
 * Storage policies only accept uploads from admins.
 */
export function UploadField({
  id,
  label,
  required,
  error,
  kind,
  value,
  onChange,
}: {
  id?: string;
  required?: boolean;
  error?: string;
  label: string;
  kind: UploadKind;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    const check = validateUpload(file, kind);
    if (!check.ok) {
      toast.error(check.reason);
      return;
    }
    setBusy(true);
    const supabase = createBrowserSupabase();
    const bucket = bucketFor(kind);
    const path = storagePath(kind, file.name, crypto.randomUUID().slice(0, 8));
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type });
    setBusy(false);
    if (error) {
      toast.error(`Tải lên thất bại: ${error.message}`);
      return;
    }
    onChange(supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl);
    toast.success("Đã tải lên");
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <RequiredMark />}
      </label>
      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {kind === "image" && (
            // Admin-only thumbnail of an uploaded file; next/image would need the storage host configured.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-16 w-auto rounded border object-cover" />
          )}
          <a href={value} target="_blank" rel="noreferrer" className="max-w-full truncate text-sm underline">
            {value}
          </a>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Gỡ
          </Button>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">Chưa có tệp</span>
      )}
      <input
        {...(id ? a11yProps(id, error) : {})}
        type="file"
        accept={UPLOAD_RULES[kind].types.join(",")}
        disabled={busy}
        aria-label={`${label}: chọn tệp`}
        className="text-sm"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
      {busy && <span className="text-xs text-muted-foreground">Đang tải lên…</span>}
      {id && <FieldError id={id} message={error} />}
    </div>
  );
}
