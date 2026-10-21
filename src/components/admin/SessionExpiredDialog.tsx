"use client";

import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  closeSessionExpired,
  useAdminActionState,
} from "@/lib/admin/action-errors";

/** Shown when a save finds the session gone: sign in again in a new tab, nothing here is lost. */
export function SessionExpiredDialog() {
  const { sessionExpired } = useAdminActionState();
  return (
    <Dialog
      open={sessionExpired}
      onOpenChange={(open) => !open && closeSessionExpired()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Phiên đăng nhập đã hết hạn</DialogTitle>
          <DialogDescription>
            Nội dung bạn đang sửa vẫn còn nguyên trên trang này. Đăng nhập lại ở
            tab mới, rồi quay lại đây bấm Lưu lần nữa.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() =>
              window.dispatchEvent(new Event("admin:verify-session"))
            }
          >
            Tôi đã đăng nhập lại
          </Button>
          <Button asChild>
            <a href="/admin/login?next=%2Fadmin" target="_blank" rel="noopener">
              <LogIn aria-hidden className="size-4" />
              Đăng nhập lại
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
