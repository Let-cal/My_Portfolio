# Tiếp tục: PR #15, Task 6 v2, Task 5 reviewer, trình bày repo — thiết kế bổ sung

Ngày: 2026-10-25. Chủ dự án: Lê Trần Cát Lâm. Tài liệu này bổ sung cho
`docs/superpowers/specs/2026-10-21-final-review-release-design.md` và plan
`docs/superpowers/plans/2026-10-21-final-review-release.md`. Phần nào không nhắc ở đây thì giữ nguyên
như hai tài liệu đó.

## 1. Ý định

- **Ít việc tay cho chủ dự án:** AI review và release được, nhưng mọi thay đổi nhạy cảm vẫn dừng lại chờ chủ dự án duyệt.
- **Nhà tuyển dụng thấy được năng lực:** không chỉ qua trang portfolio mà còn qua repo GitHub: kiến trúc, quy trình, PR, commit, TDD, bảo mật.
- **Admin an toàn:** tài khoản review không bao giờ ghi được dữ liệu thật.

## 2. Thứ tự và phạm vi

1. **PR #15 (thư viện media):**
   - Cập nhật nhánh theo `main`, chạy `npm run verify` và CI.
   - Review độc lập; kiểm tra phần công khai trên preview, chỉ đọc.
   - Gửi báo cáo ngắn. Chủ dự án nói "merge" thì mới merge (PR có Storage/RLS).
2. **Task 6 v2:**
   - Làm xanh các test đã viết trong `tests/scripts/review-release.test.mjs`:
     - inventory check đầy đủ;
     - chính sách gắn head/base SHA và còn hạn;
     - danh sách check/checklist tùy chọn rõ ràng;
     - ma trận cơ bản: desktop, mobile, EN/JA/VI, sáng/tối, bàn phím, giảm chuyển động.
   - Cập nhật runbook `docs/final-review-release.md` và demo bằng dữ liệu giả. Một PR thường.
3. **Task 5 (reviewer chỉ đọc):** theo plan Task 5, có các thay đổi ở mục 3. PR nhạy cảm: không áp migration, không merge khi chưa có duyệt bảo mật.
4. **Trình bày repo:** chi tiết ở mục 4.

## 3. Task 5: quyết định của chủ dự án (thay cho spec cũ ở các điểm này)

- **Mục đích:** chỉ dành cho AI review. Không phải tài khoản demo cho nhà tuyển dụng.
- **Danh tính:**
  - Bảng `private.app_reviewers(user_id uuid primary key references auth.users on delete cascade, created_at)` và hàm `private.is_reviewer()`, cùng mẫu với `private.app_admins` / `private.is_admin()`.
  - Không dựa vào email, user metadata hay header.
  - Thu hồi quyền tức thì bằng cách xóa một dòng.
  - **[Chủ dự án]** Đã chọn cách này thay vì JWT Auth hook hoặc biến `REVIEWER_EMAIL`. Lý do: thu hồi tức thì, không cấu hình Auth, test được trong CI database tạm.
- **Tài khoản:**
  - Chủ dự án tự tạo một tài khoản reviewer riêng (định danh chỉ ghi trong `.superpowers/`, không commit) trong Supabase, tự đăng nhập một lần trong trình duyệt của app, rồi thêm UID vào bảng bằng SQL đã được duyệt.
  - AI không giữ mật khẩu hay cookie, không đưa vào CI.
- **Phạm vi đọc (SELECT):**
  - 10 bảng nội dung, kể cả dòng đang ẩn;
  - metadata object trong bucket `media` / `files`;
  - **[Chủ dự án, rộng hơn spec cũ]** `private.content_versions`, đọc qua `admin_list_versions` (hàm mở cho reviewer). `admin_restore_version` vẫn chỉ dành cho admin.
  - Không đọc: `private.app_admins`, `private.app_reviewers` (trừ dòng của chính mình nếu cần), Auth admin, secret.
  - Lưu ý: bảng lịch sử chứa email người sửa (chủ dự án).
- **Ghi:** mọi INSERT/UPDATE/DELETE, Storage upload/xóa và mọi server action ghi đều bị từ chối với reviewer. Chặn ở cả hai lớp: `requireAdmin()` giữ nguyên chỉ dành cho admin, và RLS không có policy ghi nào cho reviewer.
- **Phạm vi môi trường:** **[Chủ dự án, khác spec cũ]** reviewer vào được admin ở cả preview lẫn production. Rủi ro thêm nhỏ vì quyền đọc ở database vốn đã áp dụng chung. Ghi rõ điều này trong tài liệu duyệt bảo mật.
- **Giao diện:**
  - Nhãn "Chế độ chỉ đọc" luôn hiện.
  - Lưu, xóa, nhân bản, upload, kéo thả, ẩn/hiện, khôi phục, hoàn tác, thêm skill trong ma trận đều bị khóa hoặc ẩn.
  - Form xem được nhưng không có thanh lưu.
  - Không tự lưu nháp vào trình duyệt.
  - Realtime vẫn nghe được (chỉ đọc). Policy `realtime.messages` mở thêm cho reviewer.
- **Tác dụng phụ khi chỉ duyệt xem:**
  - Route `/admin/preview` (draft mode) chỉ dành cho admin: reviewer không được bật draft mode, trang báo không có quyền.
  - Đăng nhập/đăng xuất là thao tác Auth, không phải ghi nội dung.
- **Kiểm thử:**
  - Ma trận admin / reviewer / người đăng nhập thường / khách trên CI database tạm (Task 4):
    - SELECT được đúng phạm vi;
    - mọi lệnh ghi DB/Storage bị từ chối;
    - thu hồi có hiệu lực ngay.
  - Unit test cho `getAdminAccess()`, guard và UI chỉ đọc.
  - Không thử ghi trên database thật.
- **Duyệt bảo mật:** một trang tiếng Việt gồm:
  - xem gì, không xem gì;
  - chặn ở đâu;
  - rủi ro còn lại;
  - kết quả test;
  - báo cáo của agent `ai-generated-code-auditor`;
  - SQL áp dụng / rollback / kiểm tra;
  - kết quả advisor.

## 4. Trình bày repo cho nhà tuyển dụng

- **README.md** thêm mục "Architecture & engineering process": sơ đồ hệ thống, phân quyền nhiều lớp (proxy → server action → RLS), CI/quality gate, TDD và review, các quyết định kỹ thuật, link tới spec/plan/PR tiêu biểu. Tiếng Anh. **README.ja.md** có bản tóm tắt tiếng Nhật.
- **`docs/adr/`** viết tiếng Anh theo mẫu ngắn (Context / Decision / Consequences). ADR đầu tiên ghi lại các quyết định đã thực hiện: Supabase + RLS + private schema, cache + `refresh()`, lịch sử phiên bản bằng trigger, realtime qua private Broadcast, CI tách job và database tạm, reviewer chỉ đọc.
- **Dọn repo:**
  - Dependabot #17: CI xanh thì merge.
  - Nhánh và worktree đã merge: liệt kê kèm lý do, chủ dự án duyệt một lần rồi mới xóa.
  - Không xóa gì chưa merge.
- README/ADR làm thành PR riêng, sau Task 6. **[Claude]**

## 5. Ràng buộc giữ nguyên

- **Chi phí:** 0 đồng, không dịch vụ trả phí, không cron, không agent chạy ngầm.
- **Migration:** chỉ cộng thêm, có SQL rollback. Preview dùng chung database với production.
- **Commit và PR:** không có dòng attribution. Chạy `npm run verify` trước khi push.
- **Thay đổi nhạy cảm** (Auth/RLS, CI/CD, quyền, dữ liệu thật) cần chủ dự án duyệt kết quả cụ thể trước khi áp dụng hoặc merge.

## 6. Để builder tự quyết

- Tên file, cách tách component, chi tiết UI của nhãn chỉ đọc.
- Cách khóa từng nút: ẩn hay disabled, nhưng phải có lý do hiển thị.
- Thứ tự commit trong từng PR.

## 7. Sau builder check (2026-10-25)

- **Đăng nhập reviewer trên preview (chủ dự án chọn): mỗi PR một lần.**
  - Kiểm tra có đăng nhập chạy trên URL preview cố định theo nhánh của PR.
  - Chủ dự án đăng nhập reviewer một lần cho mỗi PR, trong trình duyệt của app.
  - Ngay trước và ngay sau mỗi lượt kiểm tra, AI xác minh qua GitHub/Vercel (chỉ đọc) rằng alias đó đang phục vụ đúng deployment của SHA được review, và ghi lại deployment id.
  - Lệch SHA hoặc không xác minh được thì BLOCKED.
  - Runbook và bộ đánh giá Task 6 phải chấp nhận "alias nhánh đã xác minh gắn với SHA" như một dạng bằng chứng, bên cạnh URL bất biến.
- **Thứ tự nhánh [Claude]:**
  - Task 5 tạo nhánh từ `main` sau khi PR #15 merge, để phần khóa thư viện media và policy đọc Storage cho reviewer nằm trong cùng một lần duyệt bảo mật.
  - Nếu #15 bị chậm, xếp Task 5 chồng lên nhánh #15.
- **Áp migration (chủ dự án chọn):**
  - Sau khi chủ dự án duyệt, AI áp qua Supabase MCP, giữ đúng tên và phiên bản như file trong repo.
  - Sau đó kiểm tra chỉ đọc và chạy advisor. Nếu công cụ bị từ chối quyền thì chủ dự án chạy file trong SQL Editor.
  - Ghi chú và sửa việc lệch phiên bản migration của PR #15: trên database là `20261021141852`, trong repo là `20261021124334`.
- **Tài liệu bảo mật (chủ dự án chọn):**
  - Commit công khai bản thiết kế bảo mật đã lược bỏ thông tin nhạy cảm: mô hình phân quyền, policy, test, rủi ro. Không có email, UID hay chi tiết tài khoản.
  - Bản duyệt chi tiết tiếng Việt, có tài khoản và SQL thêm UID, chỉ nằm trên máy, trong thư mục `.superpowers/` (đã gitignore).
