# Spec: Portfolio "Koi hóa Rồng": làm lại toàn bộ + Backend/Admin

- Ngày: 2026-10-13
- Chủ sở hữu: Lê Trần Cát Lâm (Let-cal)
- Repo: `github.com/Let-cal/My_Portfolio` (local: `03_Projects/Web/Portfolio/my-project`), deploy Vercel `my-portfolio-mauve-psi-28.vercel.app`
- Trạng thái: Chờ duyệt (đã qua builder check ngày 2026-10-13)
- Prototype tham khảo (không phải code production): `../.superpowers/brainstorm/1371-1791824812/content/koi-tech-styles-v2.html`, `research-board.html`

Ký hiệu: **[Chủ dự án]** là quyết định do chủ dự án đưa ra. **[Claude]** là lựa chọn của Claude, chủ dự án có thể đổi khi duyệt spec.

---

## 1. Ý định và lý do

Portfolio hiện tại được build khoảng 1 năm trước (5/2025), trước khi Lâm đi làm ở SKG. Trang có 3 vấn đề:

1. **Nội dung cũ và có số liệu không kiểm chứng được.** Ví dụ "+25% conversion", "95% satisfaction", "3 years". Trang cũng thiếu toàn bộ 14 tháng ở SKG.
2. **Không tự cập nhật được.** Dữ liệu viết cứng trong `App.jsx`, không có DB, không có trang admin. Mỗi lần có dự án hoặc chứng chỉ mới là phải sửa code.
3. **UI/UX và animation chưa đủ nổi bật.** Chủ dự án hài lòng với section Why Hire Me. Các section Hero/Personal Info, Experience, Core Skills cần làm lại nhiều hơn.

**Điều chủ dự án muốn nhà tuyển dụng nhớ sau 30 giây:** kỹ năng design, UI/UX, animation hiện đại và chuyên nghiệp, tư duy mới mẻ, cùng đầy đủ thông tin công việc và kinh nghiệm. **[Chủ dự án]**

**Câu chuyện xuyên suốt [Chủ dự án]: Cá Koi hóa Rồng (登竜門, Đăng Long Môn).** Cá koi bơi ngược dòng, vượt thác và hóa rồng. Câu chuyện này tương ứng với hành trình từ sinh viên mới tốt nghiệp đến kỹ sư kiêm acting PM/Tech Lead trên các dự án khách hàng Nhật.

## 2. Mục tiêu, không phải mục tiêu, phản mục tiêu

**Mục tiêu**
- Trang công khai một trang (single page) gồm 7 section theo storyboard ở mục 5, có cảnh 3D cá koi/rồng xuyên suốt.
- Backend + DB + trang admin để CRUD toàn bộ nội dung, không cần sửa code.
- 3 ngôn ngữ EN / JA / VI **[Chủ dự án]**. EN là mặc định.
- Đa vai trò có nút chuyển: Full-stack Developer / Tech Lead / Technical PM **[Chủ dự án]**.
- 9 nâng cấp chủ dự án đã chọn đủ cả 9 (mục 6).
- Hiệu năng đạt Core Web Vitals "Good" trên trang công khai: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, đo bằng Lighthouse mobile.

**Không phải mục tiêu**
- Blog, CMS bài viết, comment.
- Nhiều người quản trị. Chỉ có một admin là Lâm.
- Model 3D trả phí hoặc tạo bằng AI trong bản đầu (xem 7.4).
- Analytics nâng cao. Có thể bật Vercel Analytics, chỉ vậy thôi.

**Phản mục tiêu (dù chạy được vẫn coi là thất bại)**
- Nội dung bị chặn sau màn chờ, màn chơi hoặc animation. Chữ phải đọc được ngay, 3D chỉ là lớp nền.
- Trang trông như game hoặc "trang trình diễn WebGL" mà nhà tuyển dụng phải đi tìm thông tin.
- Có bất kỳ số liệu nào không có trong Kho sự thật (mục 8), hoặc ghi "3+ years" / "AI Engineer".
- Thay con trỏ chuột bằng con trỏ tùy biến (research cho thấy dễ gây rối). Cá bơi theo con trỏ thật, không thay con trỏ.
- Mobile hoặc máy yếu bị giật, nóng máy.

## 3. Ràng buộc

- **Không tốn chi phí [Chủ dự án, 2026-10-13]:** mọi dịch vụ, thư viện, tên miền và asset đều phải miễn phí. Deploy trên Vercel Hobby, DB trên Supabase Free, tên miền is-a.dev, chỉ dùng font và asset có license miễn phí. Supabase Free tự tạm dừng project sau khoảng 7 ngày không có request, khi đó lớp data tự rơi về seed để trang không chết, và README hướng dẫn cách bật lại.
- Máy dev là Windows, Node 22, không có Docker, nên không chạy được Supabase local.
- Claude không được tạo tài khoản hay nhập mật khẩu. Việc tạo project Supabase, tạo user admin và cấu hình env trên Vercel là do chủ dự án làm, theo hướng dẫn trong README.
- Giữ tông màu cam chủ đạo hiện tại (`#fb923c` / `#f97316`) **[Chủ dự án]**, nền tối là chủ đạo.
- Trung thực theo quy tắc của bộ CV (`01_Personal/02_CV_Ung_tuyen/CV_English/docs/specs/2026-10-05-english-cv-design.md` §3, §5).

## 4. Công nghệ

| Lớp | Lựa chọn | Ai quyết |
|---|---|---|
| Framework | Next.js (App Router, bản stable mới nhất lúc cài), TypeScript strict | [Chủ dự án] chọn Next.js + Supabase |
| DB / Auth / Storage | Supabase (Postgres + Auth email/password + Storage) | [Chủ dự án] |
| UI | Tailwind CSS v4 + shadcn/ui (Radix). **Bỏ Chakra + MUI** | [Claude] |
| Animation UI | Motion (framer-motion) cho micro-interaction; GSAP + ScrollTrigger cho timeline cuộn; Lenis cho smooth scroll | [Claude] |
| 3D | three + @react-three/fiber + @react-three/drei + @react-three/postprocessing (Bloom) | [Claude] |
| i18n | next-intl, route `/[locale]` (`/en`, `/ja`, `/vi`) | [Claude] |
| Form / validate | react-hook-form + zod (dùng chung schema cho admin và server action) | [Claude] |
| Command palette | cmdk | [Claude] |
| Test | Vitest (unit cho data layer, schema), Playwright (smoke e2e trang công khai + login admin) | [Claude] |

Cách làm repo **[Claude]**: làm trên nhánh mới `redesign/koi` trong cùng repo, thay Vite bằng Next.js ở gốc repo. Code cũ còn trong lịch sử git. Không giữ song song hai app.

## 5. Trang công khai: storyboard 7 section [Chủ dự án duyệt, giữ nguyên]

Cảnh 3D là **một canvas cố định phía sau toàn trang** (`position: fixed`, `pointer-events` chỉ bật ở vùng mặt nước của Hero). Tiến độ cuộn (0→1) điều khiển "chương" của cá. Nội dung HTML nằm phía trên canvas.

| # | Section | Môi trường 3D | Nội dung và tương tác |
|---|---|---|---|
| 0 | **Hero / Ao nước** | Ao nước tối, gợn sóng theo con trỏ. Cyber Koi bơi theo con trỏ. Bấm vào mặt nước thì thả mồi (nâng cấp 9) | Tên, dòng chức danh theo vai trò, tóm tắt 2–3 câu, badge "Open to work", CTA: Tải CV, Liên hệ, Xem nhanh 60s. Nút chuyển vai trò (nâng cấp 2). Ảnh chân dung là tùy chọn (mặc định hiện ảnh `profile-portrait.png` có sẵn) **[Claude]** |
| 1 | **Experience / Dòng sông** | Camera hạ xuống, cá bơi ngược dòng theo cuộn | Timeline dọc theo kiểu Brittany Chiang: cột mốc thời gian · vai trò · công ty · tóm tắt · chip công nghệ. Rê chuột vào một mục thì các mục khác mờ đi. Bấm vào thì mở **ngăn kéo case study** (Vấn đề → Vai trò → Quyết định → Kết quả). Thứ tự mục theo vai trò đang chọn (mục 6.2) |
| 2 | **Projects / Hồ sen** | Lá sen trôi, cá lượn chậm | Lưới bento. Rê chuột vào card thì phát video demo nếu có, không có thì hiện ảnh poster. Bấm vào thì mở case study giống Experience. Có link demo/code |
| 3 | **Skills / Thác nước** | Thác nước, cá bơi lên | Bản đồ kỹ năng theo nhóm (Languages, Frameworks, Cloud & DevOps, AI/LLM, Databases, Delivery, Testing, Design). Bấm vào skill thì các Experience/Project dùng skill đó sáng lên, kèm danh sách liên kết. **Không** có thanh phần trăm |
| 4 | **Certificates / Đèn lồng** | Đèn lồng hai bên bờ | Lọc theo chủ đề (Language, PM, UX/Design, Engineering, Other). Mỗi chứng chỉ có tổ chức, ngày cấp, link xác thực, nút xem file. Có tab Activities (giữ dữ liệu cũ) |
| 5 | **Why Hire Me / Hóa rồng** | Cá nhảy qua cổng, tan thành điểm dữ liệu rồi ghép lại thành **rồng Cyber** | **Giữ phong cách carousel hiện tại** (card gradient sóng, nghiêng 3D theo chuột, kéo có quán tính) **[Chủ dự án]**. Mỗi card thêm 1 dòng "bằng chứng" link tới Experience/Project tương ứng |
| 6 | **Contact / Rồng hộ vệ** | Rồng bay vòng quanh khối CTA | Email (copy 1 chạm), LinkedIn, GitHub, nút đặt lịch (nếu có URL), tải CV theo vai trò, trạng thái Open to work |

Header cố định: logo LETCAL, menu các section, nút ngôn ngữ, nút sáng/tối, gợi ý ⌘K. Footer: bản quyền, link mạng xã hội.

### 5.1 Phong cách hình ảnh 3D [Chủ dự án chọn phương án kết hợp 1 + 2]
- **Cyber Koi** trong suốt hành trình: thân PBR trắng ngà với các vệt màu theo giống koi, lớp emissive là mạch điện cam phát sáng, dữ liệu chạy dọc thân. Mặt nước tối dạng gương có lưới mờ. Bloom có chọn lọc, chỉ phần emissive mới phát sáng.
- **Khoảnh khắc hóa rồng** (vào section 5): cá tan thành point-cloud, các điểm phân tán rồi hội tụ thành rồng Cyber. Rồng có thân vàng kim loại, gai và sừng, mắt phát sáng cam, râu.
- Sau section 5, rồng giữ dạng rồng ở section 6. Cuộn ngược lên thì đảo ngược toàn bộ.

## 6. Chín nâng cấp [Chủ dự án chọn đủ cả 9]

1. **Chế độ nhà tuyển dụng ("Xem nhanh 60s"):** nút ở Hero và trong ⌘K. Mở một view gọn (route `/[locale]/quick`): tắt 3D, hiện một trang tóm tắt gồm vai trò, 3–4 kinh nghiệm chính, kỹ năng chính, chứng chỉ, liên hệ, tải CV. In ra được (`@media print`).
2. **Mỗi vai trò là một giống koi:** Full-stack Developer = **Kohaku** (trắng-đỏ); Tech Lead = **Showa** (đen-đỏ-trắng); Technical PM = **Ogon** (vàng kim) **[Claude]**. Chuyển vai trò sẽ đổi: dòng chức danh, tóm tắt, thứ tự Experience, thứ tự nhóm Skills, file CV, hoa văn cá (đổi texture có chuyển tiếp mượt). Vai trò lưu vào URL `?role=` để chia sẻ link đúng vai trò.
3. **Experience dạng dòng sông + case study** (mục 5, section 1).
4. **Bản đồ kỹ năng có bằng chứng** (mục 5, section 3). Quan hệ skill ↔ experience/project lưu trong DB.
5. **Bảng lệnh ⌘K / Ctrl+K:** đi tới section, đổi ngôn ngữ, đổi vai trò, đổi giao diện, tải CV, copy email, mở chế độ xem nhanh.
6. **"Open to work" + đặt lịch:** badge bật/tắt trong admin, kèm dòng mô tả ngắn có thể sửa (ví dụ "Available from Oct 2026"). Nút đặt lịch chỉ hiện khi admin điền URL đặt lịch.
7. **Ao ngày / ao đêm:** giao diện sáng thì nước trong, ánh sáng ban ngày, mạch điện mờ. Giao diện tối thì ao đêm, đèn lồng sáng, mạch điện rõ. **Mặc định là giao diện tối (ao đêm)** vì đó là giao diện chủ đạo. Người xem tự đổi bằng nút hoặc ⌘K, lựa chọn được lưu ở localStorage **[Claude]**. Ao ngày chỉ đổi ánh sáng, màu nước và độ sáng emissive trên cùng một scene, không dựng scene riêng.
8. **Video demo khi rê chuột:** chỉ phát khi rê chuột hoặc khi card vào giữa màn hình trên mobile, `muted`, `playsinline`, `preload="none"`. Upload qua admin (giới hạn 8MB, mp4/webm). Không có video thì dùng ảnh poster.
9. **Thả mồi cho cá:** bấm hoặc chạm vào mặt nước ở Hero thì thả 1–3 viên mồi, cá đổi hướng tới đớp, có gợn sóng. Tối đa 5 viên cùng lúc.

### 6.2 Thứ tự nội dung theo vai trò (mặc định, admin sửa được)
| | Full-stack Developer | Tech Lead | Technical PM |
|---|---|---|---|
| Dòng chức danh | Full-stack Software Engineer | Software Engineer · Tech Lead | Software Engineer · Technical Project Manager |
| Experience (SKG) | FlexyBox P1, COA, FlexyBox P2, AI Agent, Intern | FlexyBox P1, COA, FlexyBox P2, AI Agent, Intern | AI Agent, FlexyBox P2, COA, FlexyBox P1, Intern |
| Skills đầu tiên | Languages → Frameworks → Cloud | Languages → Frameworks → Cloud → DB | Delivery → Cloud → Languages |
| CV tải về | `LeTranCatLam_CV_TechLead.pdf` | `LeTranCatLam_CV_TechLead.pdf` | `LeTranCatLam_CV_TechnicalPM.pdf` |

(Lấy từ bảng biến thể của bộ CV §6. Bản Full-stack dùng chung CV Tech Lead vì bộ CV chưa có biến thể riêng.)

## 7. Backend, dữ liệu, admin

### 7.1 Mô hình dữ liệu (Postgres trên Supabase)
Mọi trường văn bản hiển thị đều có 3 ngôn ngữ, lưu dạng `jsonb` `{ "en": "...", "ja": "...", "vi": "..." }` **[Claude]**. Thiếu bản dịch thì hiển thị EN.

- `profile` (1 dòng): name, location, email, linkedin, github, avatar_url, open_to_work (bool), availability_note (i18n), booking_url (nullable), summary theo vai trò (i18n × 3).
- `roles`: key (`fullstack`|`techlead`|`pm`), title (i18n), koi_variety, cv_file_url, experience_order (uuid[]), skill_group_order (text[]).
- `experiences`: company, location, position (i18n), start/end (date, end có thể null), employment_type, summary (i18n), case_study {problem, role, decisions, result} (i18n), team_size (text), tech (text[]), links (jsonb[]), published, sort_index. Mỗi dự án con ở SKG là **một experience riêng có `parent_company`**, nhóm hiển thị dưới SKG Software.
- `projects` (đại học/cá nhân): title, role (i18n), period, summary/case_study (i18n), tech[], demo_url, repo_urls[], poster_url, video_url, published, sort_index.
- `skills`: name, group, sort_index. `skill_links`: skill_id ↔ (experience_id | project_id).
- `certificates`: name, organization, issue_date, credential_id, credential_url, file_url, topic, skills[], description (i18n), published.
- `activities`: name, date, skills[], description (i18n).
- `education`: school, degree (i18n), major (i18n), start/end, gpa, notes (i18n), sort_index. Hiển thị là mục cuối của timeline Experience (nhãn "Education") và trong chế độ xem nhanh; có màn CRUD trong admin **[Claude]**.
- `why_cards`: title (i18n), subtitle (i18n), tag (i18n), body (i18n), colors [from,to], evidence_link (text: `#exp-<id>` hoặc `#proj-<id>`), sort_index.
- Storage buckets: `media` (ảnh, video), `files` (CV, PDF chứng chỉ). Public read.

**RLS:** `anon` chỉ đọc được các dòng `published = true`. Ghi chỉ cho phép user đã đăng nhập có email trùng `ADMIN_EMAIL` (kiểm tra bằng policy dùng `auth.jwt() ->> 'email'`).

### 7.2 Đọc dữ liệu ở trang công khai
- Server Components đọc qua lớp `lib/data` (một interface, hai cài đặt): **Supabase** khi có env `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY`, ngược lại dùng **seed JSON** đóng gói sẵn (`content/seed.json`). Nhờ vậy trang vẫn build và chạy được trước khi chủ dự án tạo Supabase **[Claude]**.
- Render tĩnh với ISR. Mỗi lần admin lưu thì gọi `revalidateTag('content')`.
- Script `npm run seed` đẩy `content/seed.json` lên Supabase (dùng `SUPABASE_SERVICE_ROLE_KEY`, chỉ chạy ở máy local).

### 7.3 Trang admin (`/admin`, không i18n, giao diện tiếng Việt)
- Đăng nhập Supabase email/password. Middleware chặn mọi route `/admin/*` nếu chưa đăng nhập hoặc email không phải `ADMIN_EMAIL`.
- Dashboard: số lượng từng loại nội dung, toggle Open to work, link "Xem trang".
- CRUD cho: Profile, Roles, Experiences, Projects, Skills (kèm gán liên kết), Certificates, Activities, Why cards.
- Form có tab EN / JA / VI cho trường i18n. Validate bằng zod. Upload file vào Storage, xem trước ảnh/video.
- Sắp xếp bằng kéo thả (cập nhật `sort_index`), có toggle Published, xóa có hộp xác nhận.
- Không có tính năng "AI dịch tự động" trong bản đầu.

### 7.4 Nhân vật 3D
- **Bản đầu dựng bằng code (procedural) [Chủ dự án, 2026-10-13]**, chau chuốt hơn nhiều so với prototype: thân dạng ống theo xương sống, vây, đuôi, gai, sừng, râu, morph cá ↔ rồng bằng một tham số. Texture hoa văn 3 giống koi, texture mạch điện, shader point-cloud cho khoảnh khắc biến hình.
- Kiến trúc tách `Creature` thành interface để sau này **thay bằng model glTF** (mua hoặc tạo bằng Tripo) mà không sửa phần scroll và scene. Nếu cần model mua thì báo chủ dự án trước.

### 7.5 Hiệu năng, khả năng truy cập, fallback
- LCP là chữ HTML ở Hero. Canvas 3D tải lười sau khi trang đã hiển thị (dynamic import, `ssr:false`), fade-in khi sẵn sàng. Không có màn chờ toàn trang.
- Giới hạn DPR ở 1.5 (mobile 1.25). Tạm dừng render khi tab ẩn. Bloom chỉ bật trên desktop.
- **Tier thiết bị:** `high` = full scene; `low` (mobile, `hardwareConcurrency ≤ 4`, hoặc FPS đo được < 40 trong 2s đầu) = ít điểm hơn, không bloom, không phản chiếu; `off` khi có `prefers-reduced-motion` hoặc không có WebGL = ảnh tĩnh cá/rồng thay cho canvas, không animation cuộn.
- Bàn phím: mọi tương tác đều có tương đương (⌘K, focus ring, ngăn kéo case study đóng bằng Esc). Tương phản chữ đạt WCAG AA trên cả nền sáng và nền tối.
- Bundle 3D tách chunk riêng; JS ban đầu của trang (trước khi tải 3D) mục tiêu ≤ 200KB gzip.
- **Thời điểm tải 3D [Claude]:** desktop tải sau `requestIdleCallback` khi trang đã hiển thị. Mobile chỉ tải sau tương tác đầu tiên (chạm, cuộn) hoặc sau 3 giây idle, trước đó hiện ảnh tĩnh cá. Như vậy Lighthouse đo lúc tải trang không tính chi phí three.js. Nếu tier `low` vẫn làm Lighthouse mobile < 85 thì mobile dùng ảnh/video tĩnh thay cho canvas; mục tiêu hiệu năng không được hạ.
- **Một scene liên tục [Claude]:** toàn trang là một scene ao/sông duy nhất. Mỗi chương chỉ đổi camera, ánh sáng, đạo cụ (lá sen, dải thác dạng shader, đèn lồng, cổng) và trạng thái cá. Không dựng 7 scene riêng.

## 8. Nội dung (Kho sự thật)

Nguồn duy nhất: spec bộ CV §3 (`01_Personal/02_CV_Ung_tuyen/CV_English/docs/specs/2026-10-05-english-cv-design.md`). Seed gồm:
- SKG Software: Intern Aug–Oct 2025; Software Engineer, acting PM/Tech Lead Oct 2025 – Sep 2026 (đã nghỉ 30/09/2026, không ghi "Present"). 5 mục con: AI Agent, FlexyBox P2, COA, FlexyBox P1, Intern (TONGUE-AI + Driver MS), đúng số liệu ở §3.2.
- FPT Japan, Tokyo: BA Intern / UI-UX Designer, Mar 2024.
- Projects: SitePlus (Jan–May 2025, Team Lead, có repo), ZodiacGems, Meet My Lecturer (giữ link từ dữ liệu cũ, **bỏ toàn bộ số liệu %**). Mô tả viết lại bám theo sự thật đã biết; chỗ nào không chắc thì viết ngắn, không bịa thêm.
- Education: FPT University, B.IT Software Engineering 2021–2025, GPA 7.66/10, học bổng 50%.
- Certificates: danh sách hiện có trong `App.jsx`, sửa SDLC thành May 2023.
- Why Hire Me: viết lại 3–5 card theo sự thật (ví dụ: làm việc trực tiếp với khách Nhật bằng tiếng Nhật; tự build trọn FlexyBox P1; điều phối 2 dự án song song; UI/UX + animation), giữ hình thức card hiện tại.
- Bản dịch JA và VI do Claude soạn, **đánh dấu cần chủ dự án duyệt** (JA ở mức N3). Văn phong tuân theo danh sách từ cấm ở §5 của bộ CV. Cả 3 ngôn ngữ được build ngay. Việc duyệt bản dịch diễn ra trước khi merge vào `main` (tức trước khi lên production) **[Claude]**.
- Why Hire Me được **viết lại trên stack mới** (Motion + Tailwind, không dùng MUI/react-slick) nhưng giữ đúng hình thức: card gradient có sóng SVG, nghiêng theo chuột, kéo carousel có quán tính, nút prev/next tròn viền cam **[Claude]**.
- Không hiện số điện thoại trên trang. Email công khai `letcal2003@gmail.com` **[Claude]**.
- File CV tải về **dùng nguyên bản PDF hiện có, giữ số điện thoại [Chủ dự án, 2026-10-13]**: copy `LeTranCatLam_CV_TechLead.pdf` và `LeTranCatLam_CV_TechnicalPM.pdf` vào `public/cv/` để dùng khi chưa có Supabase (repo GitHub đang private). Khi có Supabase, admin có thể upload bản mới vào bucket `files` để thay. Xóa `public/My_CV.pdf` cũ.

## 9. Kiểm tra (verification)

1. `npm run build` không lỗi, không có lỗi TypeScript hay ESLint.
2. Vitest: lớp data (fallback seed ↔ Supabase mapper), schema zod, hàm chọn thứ tự theo vai trò, hàm fallback i18n.
3. Playwright smoke: trang `/en`, `/ja`, `/vi` hiển thị đủ 7 section; chuyển vai trò đổi được chức danh; ⌘K mở được; trang `/quick` không có canvas; `/admin` chuyển hướng về trang đăng nhập khi chưa đăng nhập.
4. Lighthouse mobile trên bản build production: Performance ≥ 85, Accessibility ≥ 95, đạt ngưỡng CWV ở mục 2.
5. Thử thủ công trên trình duyệt: cá bơi theo chuột, thả mồi, biến hình khi cuộn tới Why Hire Me, đảo ngược khi cuộn lên, ao ngày/đêm, `prefers-reduced-motion` ra ảnh tĩnh.
6. Grep nội dung seed: không có "3+ years", "%" lạ, các từ cấm.
7. Khi chủ dự án đã tạo Supabase: chạy seed, đăng nhập admin, tạo/sửa/xóa 1 certificate và thấy trang công khai cập nhật.

## 10. Việc của chủ dự án (Claude không làm thay được)
- Gửi pull request đăng ký `letcal.is-a.dev` (file do Claude soạn sẵn), đổi tên project Vercel thành `letcal`.
- Tạo project Supabase (free), lấy URL, anon key, service role key; tạo user admin bằng email của mình.
- Thêm env vào Vercel. Đồng ý trước khi Claude push nhánh hoặc merge vào `main` (merge vào `main` sẽ deploy production).
- Duyệt bản dịch JA/VI và các mô tả dự án.

## 11. Tên miền và nhận diện [Chủ dự án, 2026-10-13]

- **Tên miền chính: `letcal.is-a.dev`.** Miễn phí vĩnh viễn, đã kiểm tra còn trống ngày 2026-10-13, trùng username GitHub/LinkedIn và logo LETCAL STUDIO. Không thêm chữ "portfolio" vào tên miền, giống cách các portfolio tham khảo đặt tên (brittanychiang.com, rauno.me, elliott.mangham.dev).
- Đăng ký bằng pull request vào `github.com/is-a-dev/register`. Claude soạn sẵn file `domains/letcal.json` theo docs mới nhất của is-a.dev (CNAME tới Vercel, tắt redirect `www`). **Chủ dự án tự gửi PR** từ tài khoản GitHub của mình. Sau khi PR được duyệt thì thêm domain trong Vercel → Settings → Domains.
- Đổi tên project Vercel thành `letcal` để có địa chỉ dự phòng `letcal.vercel.app` (chủ dự án thao tác, hoặc Claude hướng dẫn).
- **Nhận diện "đây là portfolio" mà không cần chữ portfolio trong URL:**
  - `<title>`: `Le Tran Cat Lam · Software Engineer Portfolio` (theo từng ngôn ngữ).
  - Ảnh Open Graph và Twitter card (1200×630, tạo bằng `next/og`): tên, vai trò đang chọn, chữ "Portfolio", hình cá koi. Khi dán link vào LinkedIn, email hay Slack sẽ hiện thẻ xem trước.
  - Meta description, favicon cá koi, `manifest`, `robots.txt`, `sitemap.xml`, JSON-LD `Person` để Google hiểu đây là trang cá nhân.
  - Trong CV và LinkedIn ghi rõ nhãn "Portfolio: letcal.is-a.dev".
- Phương án sau này (tốn phí): `letcal.dev` khoảng 12 USD/năm; hoặc `.id.vn` miễn phí 2 năm nếu còn đủ điều kiện tuổi. Không nằm trong phạm vi bản này.

## 12. Để lại cho người build
- Cấu trúc thư mục, tên component, chi tiết shader, đường cong easing, thông số camera theo từng chương.
- Bố cục chi tiết từng section trong khuôn khổ storyboard và quy tắc ở trên.
- Thư viện nhỏ (icon: lucide; toast: sonner…).
