# Admin: Realtime & trải nghiệm dữ liệu — thiết kế

Ngày: 2026-10-20 · Chủ dự án: Lê Trần Cát Lâm · Trạng thái: đã duyệt hướng trong chat. Đợt này nằm giữa đợt 3 (PR #12) và đợt 4.

## 1. Ý định và lý do

Hiện tại, tạo xong một chứng chỉ rồi quay về danh sách thì không thấy mục mới; phải reload mới hiện. Có hai nguyên nhân cộng lại:

- Router phía trình duyệt dùng lại payload cũ của trang danh sách. Các server action chỉ gọi `updateTag("content")`, tức chỉ làm mới cache của trang công khai, không làm mới router admin.
- `ResourceTable` giữ `useState(initialRows)` và không nhận lại dữ liệu mới khi server render lại.

Chủ dự án muốn admin không bao giờ cần reload: mọi thao tác hiện kết quả ngay ở tab đang dùng và ở mọi tab hoặc thiết bị khác đang mở admin. Dữ liệu đang nhập không được mất vì mất mạng, hết phiên đăng nhập hay đóng tab nhầm.

## 2. Mục tiêu, không phải mục tiêu, phản mục tiêu

**Mục tiêu**
- Mọi thao tác ghi đều hiện ngay trên mọi màn hình liên quan của tab hiện tại, không cần reload. Thao tác ghi gồm: tạo, sửa, xóa, nhân bản, ẩn/hiện, đổi thứ tự, ma trận skill, "+ Thêm skill", Hồ sơ, Open to work, Vai trò, hoàn tác, khôi phục phiên bản. Màn hình liên quan gồm: danh sách, dashboard, huy hiệu sức khỏe, ⌘K, "Sửa gần nhất", ma trận, form.
- Tab hoặc thiết bị khác đang mở admin tự cập nhật trong khoảng 1–2 giây.
- Trang công khai letcal.is-a.dev phản ánh thay đổi ngay sau mỗi thao tác.
- Không mất dữ liệu đang nhập: nháp tự động, chống bấm hai lần, báo mất mạng, đăng nhập lại mà vẫn giữ form.

**Không phải mục tiêu**
- Offline-first (xếp hàng thay đổi rồi gửi khi có mạng).
- Cộng tác nhiều người cùng lúc (chỉ có một admin).
- Đồng bộ thay đổi làm trực tiếp trong Supabase SQL Editor theo thời gian thực. Có thì tốt, không bắt buộc.

**Phản mục tiêu** (kỹ thuật vẫn chạy nhưng vẫn coi là thất bại)
- Form đang sửa dở bị ghi đè bởi dữ liệu từ tab khác.
- Màn hình nhấp nháy hoặc mất vị trí cuộn mỗi lần cập nhật.
- Toast spam: mỗi thao tác của chính mình mà tab hiện tại lại hiện thêm "cập nhật từ nơi khác".
- Có thao tác lạc quan báo "đã lưu" nhưng thực ra chưa lưu.
- Tốn phí, hoặc vượt gói Free của Supabase/Vercel.

## 3. Ràng buộc

- Giữ nguyên các ràng buộc của spec admin UX: `docs/superpowers/specs/2026-10-19-admin-ux-design.md` §3.
  - Stack: Next.js 16 Cache Components, Supabase, shadcn, sonner, `motion/react`.
  - Mọi thao tác ghi qua server action có `requireAdmin()`.
  - Migration chỉ được cộng thêm; rollback ghi trong PR.
  - 0 đồng.
  - Không dòng attribution.
  - Chạy `npm run verify` trước khi push.
- Next 16: `refresh()` từ `next/cache`.
  - Làm mới router phía trình duyệt từ server action (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/refresh.md`).
  - Không làm mới dữ liệu có tag, nên vẫn giữ `updateTag("content")` cho trang công khai.
- Supabase Realtime gói Free: đủ cho một admin.
- Không thêm dependency mới. Dùng `@supabase/supabase-js` có sẵn và `createBrowserSupabase`.

## 4. Thiết kế

### R1. Tab hiện tại luôn đúng
- **Server action:** mọi action ghi gọi `refresh()` sau khi thành công, cùng với `updateTag("content")`. Việc này áp cho tất cả, kể cả `restoreVersion`, `undoDelete`, `saveSkillLinks`, `setOpenToWork`, `duplicateResource`.
- **Không dùng dữ liệu đông cứng:** component client không được dùng state khởi tạo từ props như dữ liệu cố định.
  - `ResourceTable`, `SkillMatrix` và các form singleton phải đồng bộ lại khi server gửi dữ liệu mới.
  - Ngoại lệ: phần nháp lạc quan chưa được xác nhận vẫn được giữ.
  - Builder chọn cách làm: so sánh chữ ký dữ liệu, `key`, hoặc `useOptimistic`.
- **Các màn phụ:** dashboard, huy hiệu, ⌘K và "Sửa gần nhất" nằm trong layout. Phải kiểm chứng chúng cập nhật sau `refresh()`. Hiện ⌘K không thấy mục vừa tạo (lỗi nhỏ đã ghi ở đợt 2b).
- **Lỗi đầu vào:** bỏ `window.location.reload()` sau khi khôi phục phiên bản. Thay bằng `refresh()`, và form mount lại với dữ liệu mới. Như vậy toast "Đã khôi phục" sẽ hiện được (lỗi nhỏ của đợt 3).

### R2. Phản hồi lạc quan và highlight
- **Cập nhật ngay trên màn hình:** ẩn/hiện, đổi thứ tự, xóa, ma trận và Open to work đổi ngay khi bấm.
  - Lỗi thì tự quay về trạng thái cũ, kèm toast lỗi rõ ràng có nút "Thử lại".
  - Đổi thứ tự hiện đã lạc quan; nay thống nhất cách làm cho tất cả.
- **Highlight:** mục vừa tạo, sửa hoặc khôi phục được highlight nhẹ khoảng 1,5 giây bằng nền primary nhạt rồi mờ dần.
  - Dùng `motion/react`, 150–250 ms ở đầu và cuối.
  - Tắt khi người dùng giảm chuyển động.
- **Nút đang chờ:** mọi nút ghi bị khóa trong lúc chờ (`pending`) để không gửi hai lần.

### R3. Sau khi lưu
- **Tạo mới thành công:** về danh sách, cuộn tới mục mới và highlight nó.
  - Toast có các nút "Mở lại" (về form của mục), "Tạo thêm" (mở `/new`) và "Xem trên trang".
  - "Xem trên trang" chỉ có với mục đang hiện. Nó mở `<origin hiện tại>/en#<anchor>` trong tab mới.
  - Trên production là letcal.is-a.dev; trên preview là chính preview đó.
  - Lý do: `updateTag` chỉ làm mới cache của deployment đã chạy action. **[Claude]**
- **Lưu một mục đã có:** giữ hành vi hiện tại (về danh sách), và toast có "Mở lại" cùng "Xem trên trang".
- **Anchor theo loại mục:**
  - Dùng đúng anchor mà trang công khai đang có: `#exp-<id>`, `#proj-<id>`, và các anchor của section cho loại không có anchor riêng.
  - Builder đọc anchor từ code site. Loại không có anchor riêng thì trỏ về section.

### R4. Tab và thiết bị khác (Supabase Realtime, Broadcast riêng tư)
- **Cơ chế (chủ dự án chọn):** dùng private Broadcast phát từ trigger trong database, không dùng Postgres Changes.
  - Postgres Changes cần đưa `skill_links` vào publication. Bảng này không có khóa chính, nên mọi delete trên nó sẽ lỗi trên production dùng chung database.
  - Postgres Changes cũng gửi sự kiện delete cho cả người dùng anon.
- **Migration cộng thêm:**
  - Một trigger `after insert or update or delete ... for each statement` hoặc `for each row` (builder chọn) trên 10 bảng nội dung.
  - Trigger gọi `realtime.send(...)` hoặc `realtime.broadcast_changes(...)` lên topic riêng `admin:content`. Payload chỉ gồm `{ table, op, key }`, không gửi cả dòng dữ liệu.
  - Policy RLS trên `realtime.messages` cho phép `select` (nhận) với topic này chỉ khi `private.is_admin()`.
  - Không đổi bảng nội dung nào. Phần trong `schema-sql.ts` cập nhật tương ứng.
- **Kiểm chứng trước khi merge:** builder đọc tài liệu Supabase hiện hành về Realtime Authorization và `realtime.send`, rồi xác nhận trên database:
  - anon không đăng ký được topic;
  - advisor không có WARN mới.
- **Phía client:** một provider duy nhất trong layout `(panel)`.
  - Gọi `supabase.realtime.setAuth()` bằng session admin, rồi đăng ký channel `admin:content` với `config: { private: true }`.
  - Khi có sự kiện: debounce khoảng 400 ms, rồi `router.refresh()`.
- **Không báo cho thay đổi của chính mình:**
  - Tab tự đánh dấu khoảng thời gian có thao tác của chính nó (action đang chạy hoặc vừa xong dưới 3 giây). Trong khoảng đó, sự kiện chỉ làm mới mà không toast.
  - Ngoài khoảng đó: toast nhỏ "Đã cập nhật từ nơi khác".
- **Form đang sửa dở (dirty):** không bao giờ bị ghi đè.
  - Nếu chính mục đó vừa sửa ở nơi khác, hiện thanh "Có bản mới hơn — Tải lại / Giữ bản của tôi".
  - "Giữ bản của tôi" thì lần lưu sau ghi đè; bản cũ vẫn vào lịch sử nhờ đợt 3.
- **Mục đang sửa bị xóa ở nơi khác (chủ dự án chọn):**
  - Trang sửa không gọi `notFound()` khi form đang dirty. Form giữ nguyên, kèm thanh "Mục này đã bị xóa ở nơi khác" với ba nút:
    - **"Khôi phục rồi lưu bản của tôi":** gọi `undoDelete`, tức khôi phục bản đã xóa bằng lịch sử của đợt 3 và giữ ID cũ, rồi lưu nội dung đang sửa.
    - **"Lưu thành mục mới":** lưu với `isNew`, dùng ID trống hoặc `-copy` nếu ID cũ đã bị dùng.
    - **"Về danh sách":** nội dung đang sửa vẫn nằm trong bản nháp.
  - Nếu form không dirty: về danh sách, kèm toast "Mục đã bị xóa ở nơi khác".
- **Khi kết nối Realtime rớt:** tự kết nối lại. Khi kết nối lại thành công thì `router.refresh()` một lần để bắt kịp.

### R5. Không mất dữ liệu
- **Nháp tự động:**
  - Mọi form (ResourceForm, Hồ sơ, từng Vai trò) lưu nháp vào `localStorage` sau mỗi thay đổi, debounce khoảng 1 giây.
  - Khóa là `admin.draft.<table>.<id|new>`. Mỗi bản nháp kèm thời điểm lưu và `updated_at` của dữ liệu gốc.
  - Khi mở form mà có nháp khác dữ liệu hiện tại: hiện thanh "Có bản nháp chưa lưu lúc 14:32 — Khôi phục / Bỏ".
  - Lưu thành công thì xóa nháp. Nháp quá 7 ngày tự bị dọn.
  - Không lưu file đang upload, chỉ lưu URL.
- **Mất mạng:**
  - Thanh mỏng ở đầu admin "Mất kết nối — thay đổi chưa được lưu", dựa trên `navigator.onLine` cộng lỗi fetch của action.
  - Có mạng lại thì thanh tự tắt.
  - Action lỗi mạng thì hiện toast lỗi có "Thử lại", và thao tác lạc quan quay về trạng thái cũ.
- **Hết phiên đăng nhập (chủ dự án đồng ý nới proxy):**
  - `src/proxy.ts` vẫn chuyển hướng mọi request trang `/admin/*` khi chưa đăng nhập, nhưng **cho qua request server action**, tức có header `Next-Action`.
  - Với request đó, `requireAdmin()` và RLS là hai lớp chặn.
  - `requireAdmin()` phân biệt hai trường hợp:
    - không có user: lỗi `SESSION_EXPIRED`, client mở hộp thoại đăng nhập lại;
    - có user nhưng không phải admin: lỗi `FORBIDDEN`, client báo không có quyền.
  - Thêm test cho guard: request có `Next-Action` không bị chuyển hướng; request trang thường vẫn bị chuyển hướng.
  - Khi `requireAdmin()` thất bại vì hết phiên giữa chừng (phân biệt với "không phải admin"), action trả về một mã lỗi riêng.
  - Client mở hộp thoại "Phiên đăng nhập đã hết hạn" với nút "Đăng nhập lại" mở `/admin/login?next=…` trong tab mới.
  - Form và nháp giữ nguyên. Đăng nhập xong, quay lại bấm Lưu là được.
  - Sau khi đăng nhập ở tab mới, tab cũ dùng chung cookie nên không cần làm gì thêm.

### R6. Trang công khai
- Kiểm chứng mọi action ghi đều gọi `updateTag("content")`, kể cả `restoreVersion` và `undoDelete`, để trang công khai cập nhật ngay.
- Thêm test: mỗi action ghi export từ `actions.ts` đều gọi cả `updateTag` lẫn `refresh` khi thành công. Có thể làm bằng một test bảng chạy qua từng action với Supabase giả.

## 5. Kiểm thử và hoàn thành

- **Unit, cho logic thuần:** nháp (lưu, đọc, hết hạn, so sánh khác biệt), bộ lọc "thay đổi của chính mình", ánh xạ anchor.
- **Test action:** mọi action ghi gọi `updateTag` và `refresh`. Action hết phiên trả đúng mã lỗi.
- **Test component:**
  - `ResourceTable` nhận lại `initialRows` mới, nhưng vẫn giữ thay đổi lạc quan đang chờ.
  - Thanh "Có bản mới hơn" hiện khi form dirty và mục đó đổi.
  - Thanh nháp hiện và khôi phục đúng.
  - Toast sau khi tạo mới có đủ các nút.
- **Kiểm chứng thật:**
  - Bằng trình duyệt pane: tạo mới rồi thấy ngay trong danh sách mà không reload.
  - Mở 2 tab: sửa ở tab A, tab B tự cập nhật.
- **Migration:** áp bằng MCP, hoặc chủ dự án chạy trong SQL Editor nếu công cụ bị chặn. Sau đó kiểm tra bằng truy vấn chỉ đọc và chạy advisor; không được có WARN mới.
- **Checklist preview:** dùng mục thử `test-item` vì preview chung database với production. Có bước mở 2 tab và bước tắt mạng.
- **Điều kiện xong:** CI xanh, chủ dự án duyệt preview, và merge.

## 6. Để builder tự quyết

- Cách đồng bộ props về state (signature, `key`, `useOptimistic`), cách tổ chức provider, tên file.
- Thời gian debounce chính xác, trong khoảng nêu trên.
- Giao diện cụ thể của thanh mất mạng, thanh nháp và hộp thoại hết phiên. Theo phong cách shadcn và tông admin hiện có.

## 7. Quyết định đã chốt (chủ dự án, 2026-10-20)

- Realtime: tab hiện tại cộng các tab hoặc thiết bị khác. Thay đổi từ nơi khác thì tự cập nhật kèm toast nhỏ; form đang sửa có thanh "Có bản mới hơn".
- Phản hồi lạc quan, có hoàn tác hoặc tự quay lại khi lỗi, và highlight mục vừa đổi.
- Sau khi lưu: về danh sách, mục mới nổi bật, toast có "Mở lại / Tạo thêm / Xem trên trang".
- Rà tất cả các nhóm: dữ liệu cũ, trạng thái chờ, lỗi mạng, nháp tự động, trang công khai.
- Nháp lưu trong trình duyệt, hỏi trước khi khôi phục.
- Hết phiên: đăng nhập lại trong hộp thoại, giữ nguyên form.
- Mất mạng: báo rõ và có nút thử lại (không xếp hàng offline).
- Kiểm tra: checklist preview có bước mở 2 tab, cộng test tự động.
- Thứ tự: merge #12, đợt này, đợt 4, đợt 5, rồi đợt nâng cấp UI/UX có nghiên cứu.
- Realtime dùng private Broadcast từ trigger, không dùng Postgres Changes. Lý do: không đụng `skill_links`, và người ngoài không nhận được sự kiện.
- Proxy cho server action đi qua; `requireAdmin()` và RLS chặn. Tách `SESSION_EXPIRED` khỏi `FORBIDDEN`.
- Mục đang sửa bị xóa ở nơi khác: giữ form, ba lựa chọn "Khôi phục rồi lưu / Lưu thành mục mới / Về danh sách".
- "Xem trên trang" mở origin hiện tại. **[Claude]**
