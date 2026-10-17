# Đăng ký letcal.is-a.dev (bạn tự làm, khoảng 5 phút)

Điều khoản của is-a.dev (mục 6) không cho dùng AI để tạo pull request. Vì vậy bạn tự tạo PR từ tài khoản GitHub `Let-cal`. Phía Vercel đã xong (ngày 2026-10-13): project đã đổi tên thành `letcal` và domain `letcal.is-a.dev` đã được thêm, đang ở trạng thái chờ xác minh.

## Giá trị DNS lấy từ Vercel

| Type | Name | Value |
|---|---|---|
| A | @ (`letcal.is-a.dev`) | `216.198.79.1` |
| TXT | `_vercel` (`_vercel.letcal.is-a.dev`) | `vc-domain-verify=letcal.is-a.dev,bde6a67ff0f1b556c740` |

## Các bước

1. Mở https://github.com/is-a-dev/register và bấm **Fork**.
2. Trong bản fork, vào thư mục `domains/` và tạo file **`letcal.json`**:
   ```json
   {
       "owner": {
           "username": "Let-cal",
           "email": "letcal2003@gmail.com"
       },
       "records": {
           "A": ["216.198.79.1"]
       }
   }
   ```
3. Tạo thêm file **`_vercel.letcal.json`** trong cùng thư mục `domains/`:
   ```json
   {
       "owner": {
           "username": "Let-cal",
           "email": "letcal2003@gmail.com"
       },
       "records": {
           "TXT": "vc-domain-verify=letcal.is-a.dev,bde6a67ff0f1b556c740"
       }
   }
   ```
4. Mở Pull Request vào `is-a-dev/register`. **Giữ nguyên template**, không xóa comment trong đó.
   - Tự đọc Terms (https://is-a.dev/terms) rồi tick đủ 7 ô `[x]`.
   - **Website Preview:** điền `https://letcal.vercel.app`, đặt giữa 2 dòng `WEBSITE_PREVIEW_START` và `WEBSITE_PREVIEW_END`.
   - **Website Purpose:** tự viết 1–2 câu bằng lời của bạn. Ví dụ ý chính: đây là portfolio cá nhân của một software engineer, giới thiệu kinh nghiệm và dự án.
5. Chờ maintainer review. Nếu họ yêu cầu sửa thì sửa sớm, vì để lâu không sửa thì PR sẽ bị đóng.
6. Sau khi PR được merge (DNS áp dụng trong vài phút): vào Vercel → project `letcal` → Domains → bấm **Refresh** ở dòng `letcal.is-a.dev`. Khi trạng thái chuyển sang "Valid Configuration" là xong.

Ghi chú: mã TXT ở trên là của project `letcal`. Nếu bạn xóa rồi thêm lại domain trong Vercel thì mã sẽ đổi.
