# Rà soát admin toàn diện (2026-10-19)

Cách làm:
- Dùng thật bản dev và production trên máy, đăng nhập bằng tài khoản admin.
- Mở đủ 22 route: danh sách, sửa và thêm mới của 7 loại nội dung, cùng Hồ sơ, Vai trò, Tổng quan.
- Xem ở 1280×800 và 375×812.
- Đọc log server và console.
- Đối chiếu với các mẫu của Payload, Sanity, Notion, Linear, Airtable.

Ký hiệu ưu tiên:
- **P0**: lỗi chức năng.
- **P1**: tốn thời gian rõ rệt mỗi lần sửa.
- **P2**: nâng chất lượng, giúp thao tác nhanh hơn.
- **P3**: có thì tốt.

## 0. Lỗi đã sửa trong lần rà soát này (PR #8)

| Lỗi | Nguyên nhân | Trạng thái |
|---|---|---|
| "Thêm mới" sập ở **mọi** loại nội dung | `emptyItem()` nằm trong module client nhưng trang server gọi (có từ PR #6) | Đã sửa, có test |
| Lỗi React #441 ở "Vai trò & CV" | Client Supabase kiểm tra hạn token bằng `Date.now()` khi Next prerender khung admin | Đã sửa: `connection()` trong `createServerSupabase` |
| Hydration lệch ở các danh sách kéo thả | dnd-kit sinh `aria-describedby` khác nhau giữa server và trình duyệt | Đã sửa: `DndContext id` cố định, có test |
| Ma trận: skill biến mất khỏi bộ lọc khi chưa sửa xong | Lưu ngay mỗi lần bấm | Đã đổi sang "sửa rồi bấm Lưu" |
| Màn lỗi hiện mã React khó hiểu | Thông báo bị minify | Hiện thông điệp tiếng Việt và mã lỗi |

## 1. Khung chung (mọi màn)

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 1.1 | Sidebar chỉ có chữ, không icon, **không đánh dấu trang đang mở** | Icon cho từng mục, tô sáng mục đang mở, nhóm "Nội dung / Cấu hình", thu gọn được trên desktop | P1 |
| 1.2 | Trên mobile, menu là dãy link xuống dòng chiếm nửa màn hình | Thanh trên cùng có nút ☰ mở ngăn menu; "Đăng xuất" vào menu tài khoản | P1 |
| 1.3 | Nội dung dồn sang trái, chữ nhỏ, khoảng trắng lớn bên phải ở 1280px | Lưới nội dung rộng hơn; tiêu đề trang có mô tả ngắn và nút hành động chính bên phải | P2 |
| 1.4 | Admin luôn tối; không có nút sáng/tối | Theo chế độ hệ thống, có nút đổi, dùng token màu và font của site | P2 |
| 1.5 | Chỉ có chữ "Đang tải…" khi chờ | Skeleton theo đúng hình của bảng/form | P2 |
| 1.6 | Không có tìm kiếm toàn cục | ⌘K: nhảy tới mọi mục, "Tạo dự án mới", "Mở trang công khai", "Đi tới ma trận (lọc chưa có bằng chứng)" | P1 |
| 1.7 | Không có breadcrumb | Breadcrumb `Dự án / SitePlus` có menu nhảy nhanh sang mục khác | P3 |
| 1.8 | Toast nhỏ, nằm góc | Toast gắn ngữ cảnh: "Đã lưu SitePlus · Xem trên trang ↗ · Hoàn tác" | P2 |

## 2. Tổng quan (`/admin`)

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 2.1 | "Sửa gần nhất" chỉ hiện tên ("draw.io"), không biết là loại gì, không bấm được; kéo thả cũng tính là "sửa" | Loại + tên + link ("Skill · draw.io · 4 giờ trước"); bỏ qua thay đổi chỉ do sắp xếp | P1 |
| 2.2 | "Cần chú ý" chỉ là danh sách | Mỗi dòng có nút sửa nhanh tại chỗ khi được (ví dụ "Bỏ ẩn", "Mở ma trận") | P2 |
| 2.3 | Không có lối tắt tạo mới | Hàng "Tạo nhanh": Dự án · Kinh nghiệm · Chứng chỉ · Skill | P2 |
| 2.4 | Không thấy trang công khai đang thế nào | Thẻ "Trang công khai": lần làm mới cache gần nhất, link mở /en /ja /vi | P3 |
| 2.5 | Không có nhật ký thay đổi | Dòng thời gian 10 thay đổi gần nhất (cần bảng phiên bản ở đợt 3) | P2 (đợt 3) |

## 3. Danh sách (Kinh nghiệm, Dự án, Chứng chỉ, Hoạt động, Học vấn, Why cards)

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 3.1 | Cột là ngày thô ("2026-04"), tiêu đề cắt chữ | Cột có ý nghĩa: tên, thời gian dạng "04/2026 – nay", số skill, trạng thái dịch, hiện/ẩn | P1 |
| 3.2 | Không tìm, không lọc | Ô tìm + lọc theo trạng thái (Ẩn, Thiếu bản dịch, Chưa có skill) | P1 |
| 3.3 | Phải mở trang riêng để sửa, rồi quay lại | Sửa trong ngăn bên phải (`?edit=id`), J/K chuyển mục | P1 |
| 3.4 | Không biết thứ tự trên danh sách khớp gì ở trang công khai | Ghi chú "Thứ tự này = thứ tự trên trang (vai trò nào dùng thứ tự riêng thì báo)" | P2 |
| 3.5 | Xóa không thể hoàn tác, không báo ảnh hưởng | Hộp xác nhận nêu ảnh hưởng (số skill link, why card trỏ tới) + Hoàn tác 10 giây | P1 (đợt 3) |
| 3.6 | Không có nhân bản | "Nhân bản" tạo bản ẩn `-copy` | P2 |
| 3.7 | Chọn nhiều không có | Chọn nhiều để Ẩn/Hiện/Xóa cùng lúc | P3 |
| 3.8 | Chứng chỉ: 10 mục, không nhóm | Nhóm theo chủ đề, có ảnh/biểu tượng tổ chức | P3 |

## 4. Form sửa / thêm

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 4.1 | Form rất dài (case study 4 phần × 3 ngôn ngữ), không có mục lục | Chia tab hoặc mục có neo: Thông tin · Nội dung · Case study · Skills · Hiển thị; thanh mục lục dính bên trái | P1 |
| 4.2 | 3 ngôn ngữ luôn đặt cạnh nhau nên ô hẹp và chữ dài bị bóp | Chế độ "Một ngôn ngữ" (EN/JA/VI) hoặc "So sánh", nhớ lựa chọn; ô tự giãn theo nội dung | P1 |
| 4.3 | Thanh Lưu dính dưới form nhưng trông như nằm giữa trang | Thanh lưu cố định ở đáy màn hình, hiện "Có thay đổi chưa lưu"; ⌘S | P1 |
| 4.4 | Rời trang mất dữ liệu không báo | Cảnh báo chưa lưu (đã làm cho ma trận; áp cho mọi form) | P1 |
| 4.5 | ID phải tự gõ kebab-case | Tự sinh từ tên, kiểm tra trùng ngay khi gõ | P2 |
| 4.6 | "Công nghệ", "Link repo" là ô nhiều dòng | Ô chip có gợi ý (công nghệ gợi ý từ tên skill) | P2 |
| 4.7 | Ngày dùng ô `month`/`date` mặc định của trình duyệt | Bộ chọn tháng gọn, có nút "Hiện tại" cho ngày kết thúc | P3 |
| 4.8 | Không thấy kết quả trên trang thật | "Xem trên trang ↗" tới đúng mục (`/en#proj-siteplus`); xem trước mục ẩn (đợt 4) | P2 |
| 4.9 | Lỗi validate hiện ở cuối, khó tìm | Cuộn tới và tô đỏ trường lỗi đầu tiên, tóm tắt lỗi ở thanh lưu | P2 |
| 4.10 | Why card: `evidenceLink` phải gõ `#exp-…` | Chọn từ danh sách kinh nghiệm/dự án | P1 |
| 4.11 | Why card: màu gradient là 2 ô màu thô | Bảng màu gợi ý theo màu vai trò + xem trước thẻ thật | P3 |
| 4.12 | Upload chỉ hiện URL | Thumbnail ảnh/video, trang đầu PDF, kéo thả file vào ô | P2 (đợt 5) |

## 5. Ma trận Skills

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 5.1 | Đã có: sửa rồi Lưu, lọc, phím tắt | Giữ | — |
| 5.2 | Không tạo skill mới ngay trong ma trận | Hàng cuối "+ Thêm skill" vào nhóm đang xem | P2 |
| 5.3 | Không sửa tên hoặc nhóm tại chỗ | Bấm tên skill → menu: đổi tên, đổi nhóm, xóa | P3 |
| 5.4 | Cột dài, tên cột bị cắt | Tên cột xoay 45° hoặc rút gọn kèm tooltip; cố định độ rộng cột | P2 |
| 5.5 | Không có thao tác hàng/cột | Bấm tiêu đề cột: "Gắn tất cả skill đang lọc" / "Bỏ tất cả" (có xác nhận) | P3 |
| 5.6 | Số đếm trên thanh lọc chưa theo thay đổi chưa lưu | Đếm theo trạng thái nháp | P3 |

## 6. Hồ sơ & Vai trò

| # | Hiện trạng | Đề xuất | Ưu tiên |
|---|---|---|---|
| 6.1 | 3 vai trò xếp dọc, mỗi vai trò một form dài, 3 nút Lưu riêng | Tab theo vai trò (Developer / Tech Lead / PM), một thanh lưu | P1 |
| 6.2 | Thứ tự kinh nghiệm mỗi vai trò khác thứ tự chung của danh sách nhưng không giải thích | Ghi rõ "Thứ tự riêng cho vai trò này"; nút "Dùng thứ tự chung" | P2 |
| 6.3 | Giống cá koi chỉ là tên | Xem trước màu cá | P3 |
| 6.4 | CV đang trỏ tới file trong `/public` (không đổi được qua admin nếu không upload) | Upload CV mới thay thế, hiển thị ngày cập nhật CV | P2 |
| 6.5 | Hồ sơ: các đoạn giới thiệu theo vai trò dài | Đếm ký tự, gợi ý độ dài | P3 |

## 7. Học từ các hệ thống khác

- **Payload / Sanity:** thanh lưu cố định, nháp/xuất bản, lịch sử phiên bản có diff, xem trước trực tiếp.
- **Notion / Airtable:** bảng có lọc lưu được, sửa nhanh ngay trên ô, nhân bản.
- **Linear:** ⌘K điều hướng mọi nơi, phím tắt J/K/E, thông báo ngắn kèm hoàn tác.
- **Ma trận quan hệ:** lưới checkbox cho quan hệ nhiều–nhiều. Đây là mẫu hiếm thấy trong CMS phổ thông và chính là điểm mạnh riêng của admin này.

## 8. Đề xuất sắp xếp các đợt (cập nhật plan)

- **Đợt 2 (sửa nhanh + giao diện):**
  - Toàn bộ mục 1 và mục 3.1–3.4, 3.6.
  - Mục 4.1–4.6 và 4.9–4.10.
  - Mục 6.1–6.2.
  - Mục 2.1–2.3.
  - Mục 5.2 và 5.4.
- **Đợt 3 (an toàn):** 3.5, 2.5, lịch sử và diff.
- **Đợt 4 (xem trước + bản dịch):** 4.8, chế độ một ngôn ngữ nâng cao, "Chép từ EN".
- **Đợt 5 (thư viện file):** 4.12, 6.4.
- **P3 còn lại:** gom thành issue để làm sau.
