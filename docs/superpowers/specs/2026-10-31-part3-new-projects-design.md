# Part 3: four more projects on the portfolio — short design

Status: draft for owner approval, 2026-10-31.

## Intent

Recruiters should find more first-hand evidence on the site than the eight projects it shows today, and the
Personal filter on `/projects` is empty. Part 3 adds the strongest public repositories that are not on the site
yet, with text taken only from each repository's README, its commit history and the CV fact bank.

## Goals, non-goals, anti-goals

- Goals: add Koi Portfolio and the course marketplace demo (personal), VNR202c and StarMate (university), each
  with EN/JA/VI text, a four-part case study, tech, links, role-switcher tags and skill evidence links. Home-page
  stars become Koi Portfolio, SitePlus, ZodiacGems (owner choice); Meet My Lecturer stays on `/projects`.
- Non-goals: no code or schema change; no new skills (Vitest, Supabase, Three.js stay out of the skill map);
  PRJ301 and japanese-learning-studio are not added (owner choice / not built yet); private, client and gift
  repositories are not added.
- Anti-goals: any figure or claim the repository cannot show; presenting teammates' work as the owner's; a
  project name that implies AI where none is used (`edu-marketplace-ai` is shown as "Course marketplace demo").

## Approaches

1. Owner pastes drafted text into the admin forms. Normal admin path, slow for 4 × 3 languages.
2. **Chosen (owner):** one reviewed SQL transaction on the hosted database, generated from one JSON source and
   checked against the repository's `projectSchema` before it runs. The transaction asserts the result (4 rows,
   21 skill links, stars in the right order) and aborts whole on any error. A matching rollback script exists.

Effects of approach 2 on existing behaviour: the `projects_broadcast` trigger notifies open admin tabs; the
three star updates are recorded in version history (undo works); inserts need no history row. The public cache
refreshes on the next admin save or a production redeploy, so a redeploy of the current production commit
follows the write.

## Calls made by Claude (owner to check)

- `end` is empty (ongoing) for Koi Portfolio; its start is 2026-10, the rebuild, not the May 2025 first version.
- Role-switcher tags: Koi Portfolio fullstack + techlead; course demo fullstack (front end only, nearest key);
  VNR202c and StarMate techlead + fullstack (Team Lead and developer in both).
- Team size left empty; the case studies say how many people committed instead of a team size the repositories
  cannot prove.
- Skill links only where the owner's own code uses the skill (VNR202c: GSAP and Framer Motion are imported in
  files the owner committed).
- IDs: `koi-portfolio`, `course-marketplace`, `vnr202c-dien-bien-phu`, `starmate`; sort indexes 8–11.

## Left to the builder

Nothing beyond running the reviewed SQL, redeploying production and checking `/en`, `/ja`, `/vi` and
`/en/projects?kind=personal`.

## Content (generated from the JSON source)

### Koi Portfolio (this site) (`koi-portfolio`)

- Loại: personal; thời gian: 2026-10 → nay; role switcher: fullstack, techlead
- Sao: 1; demo: https://letcal.is-a.dev; repo: https://github.com/Let-cal/My_Portfolio
- Tech: Next.js, React, TypeScript, Supabase, PostgreSQL, Tailwind CSS, Radix UI, Three.js, React Three Fiber, GSAP, Lenis, next-intl, Zod, Vitest, Playwright, GitHub Actions, Vercel
- Skill links: typescript, react, nextjs, tailwind-css, postgresql, gsap, playwright, github-actions, github

**VI**

- Vai trò: Tự làm một mình: thiết kế, full-stack và triển khai
- Tóm tắt: Chính trang này: portfolio ba ngôn ngữ Anh, Nhật, Việt với cảnh WebGL cá koi hóa rồng, kèm trang admin (CMS) trên Supabase để sửa mọi dự án, kinh nghiệm và kỹ năng.
- Vấn đề: Portfolio bản 2025 chưa có kinh nghiệm ở SKG, có số liệu tôi không chứng minh được, và mỗi lần sửa chữ đều phải sửa code. Tôi muốn một trang ba ngôn ngữ mà nhà tuyển dụng đọc lướt trong một phút, và tôi tự cập nhật được trên trình duyệt.
- Vai trò: Tự làm toàn bộ: spec, thiết kế, front-end, database, admin, CI và triển khai. AI coding agent viết phần lớn code, nhưng luôn theo spec, plan, test và review trước mỗi lần merge. Tôi ra các quyết định thiết kế và duyệt mọi lần merge, mọi thay đổi database.
- Quyết định: Next.js 16 với Cache Components: một đường đọc dữ liệu có cache, làm mới sau mỗi lần lưu trong admin, và dùng dữ liệu seed nếu Supabase lỗi. Supabase Postgres dùng row level security làm lớp chặn cuối, có lịch sử phiên bản kèm hoàn tác và vai trò reviewer chỉ đọc. Một Zod schema kiểm tra cả seed, dòng dữ liệu và form admin. Cảnh 3D tải sau nội dung, chuyển thành ảnh tĩnh trên mobile và khi bật giảm chuyển động. 13 quyết định được ghi lại thành ADR.
- Kết quả: Đang chạy tại letcal.is-a.dev. Mỗi pull request chạy lint, kiểm tra type, hơn 800 unit test, Playwright kèm kiểm tra accessibility bằng axe, Lighthouse, CodeQL và Gitleaks, và giữ JavaScript ban đầu trong ngân sách 200 KB gzip.

**EN**

- Vai trò: Solo developer: design, full-stack and delivery
- Tóm tắt: This site: a portfolio in English, Japanese and Vietnamese with a koi-to-dragon WebGL scene, and a private admin CMS on Supabase for editing every project, experience and skill.
- Vấn đề: My 2025 portfolio did not show my SKG work, had figures I could not back up, and every text change needed a code change. I wanted a three-language site a recruiter can scan in a minute and that I can update from a browser.
- Vai trò: Built alone: spec, design, front end, database, admin, CI and deployment. AI coding agents write much of the code, inside a written spec, a plan, tests and a review before every merge. I make the design calls and approve every merge and every database change.
- Quyết định: Next.js 16 Cache Components: one cached read path, refreshed on each admin save, with seed data if Supabase fails. Supabase Postgres with row level security as the final guard, version history with undo, and a read-only reviewer role. One Zod schema checks the seed, the database rows and the admin forms. The 3D scene loads after the content and turns into still images on mobile and with reduced motion. 13 decisions are recorded as ADRs.
- Kết quả: Live at letcal.is-a.dev. Every pull request runs lint, type checks, more than 800 unit tests, Playwright with axe accessibility checks, Lighthouse, CodeQL and Gitleaks, and keeps the initial JavaScript within a 200 KB gzip budget.

**JA**

- Vai trò: 個人開発(設計・フルスタック開発・リリース)
- Tóm tắt: このサイトです。英語・日本語・ベトナム語に対応したポートフォリオで、鯉が龍になるWebGLの演出と、プロジェクト・経歴・スキルをすべて編集できるSupabaseの管理画面(CMS)を備えています。
- Vấn đề: 2025年版のポートフォリオにはSKGでの経験がなく、根拠を示せない数値も含まれており、文言を1つ変えるにもコードの修正が必要でした。採用担当者が1分で読める3言語のサイトで、ブラウザから更新できるものを目指しました。
- Vai trò: 仕様・デザイン・フロントエンド・データベース・管理画面・CI・デプロイまで、一人で担当しました。コードの多くはAIコーディングエージェントが書きますが、仕様書・計画・テスト・マージ前のレビューという決まった手順の中で進めます。設計判断と、すべてのマージ・データベース変更の承認は私が行います。
- Quyết định: Next.js 16のCache Componentsで読み込み経路を1つにまとめ、管理画面で保存するたびにキャッシュを更新し、Supabaseに障害があればシードデータで表示します。Supabase(PostgreSQL)では行レベルセキュリティを最後の防御線とし、変更履歴と取り消し、閲覧専用のレビュアー権限を用意しました。シード・DBの行・管理画面のフォームは1つのZodスキーマで検証します。3Dシーンはコンテンツの後に読み込み、モバイルや「視差効果を減らす」設定では静止画になります。設計判断13件をADRとして記録しています。
- Kết quả: letcal.is-a.devで公開中です。プルリクエストごとに、Lint、型チェック、800件以上の単体テスト、axeによるアクセシビリティ検査を含むPlaywright、Lighthouse、CodeQL、Gitleaksを実行し、初期JavaScriptをgzipで200KBの予算内に保っています。

### Course marketplace demo (`course-marketplace`)

- Loại: personal; thời gian: 2025-07 → 2025-07; role switcher: fullstack
- Sao: không; demo: https://edu-marketplace-ai.vercel.app; repo: https://github.com/Let-cal/edu-marketplace-ai
- Tech: Next.js, React, TypeScript, Tailwind CSS, Radix UI
- Skill links: nextjs, react, typescript, tailwind-css

**VI**

- Vai trò: Tự làm một mình, front-end
- Tóm tắt: Demo front-end cho sàn khóa học online: tìm kiếm, sáu bộ lọc, yêu thích, giỏ hàng và gợi ý khóa học theo luật. Dữ liệu khóa học là JSON mẫu.
- Vấn đề: Dự án tự luyện tháng 7/2025: một catalog giúp người học lọc nhanh trong nhiều khóa học và thấy được vì sao một khóa được gợi ý.
- Vai trò: Làm một mình: thiết kế, code và deploy lên Vercel.
- Quyết định: Next.js 15 App Router với React 19, Tailwind CSS 4 và Radix UI. Một API route lấy dữ liệu mẫu từ GitHub gist; trình duyệt cache 5 phút và tự làm mọi việc tìm kiếm, lọc, chấm điểm. Gợi ý chấm điểm khóa học dựa trên những khóa bạn đã xem hoặc lưu, và hiện lý do. Chat tư vấn so khớp từ khóa: không gọi LLM hay dịch vụ AI nào.
- Kết quả: Demo đang chạy trên Vercel. README ghi rõ những gì không có thật: không có thanh toán, không có backend và không có mô hình AI.

**EN**

- Vai trò: Solo developer, front end
- Tóm tắt: Front-end demo of an online course marketplace: search, six filters, favorites, a cart and rule-based course suggestions. Course data is mock JSON.
- Vấn đề: A practice project in July 2025: a course catalog where a learner narrows many courses down quickly and can see why a course is suggested.
- Vai trò: Sole developer: design, code and deployment to Vercel.
- Quyết định: Next.js 15 App Router with React 19, Tailwind CSS 4 and Radix UI. One API route loads the mock data from a GitHub gist; the browser caches it for 5 minutes and does all searching, filtering and scoring. Suggestions score courses against what you viewed or saved and show the reasons. The advisor chat matches keywords: no LLM or AI service is called.
- Kết quả: Live demo on Vercel. The README states what is not real: no checkout, no backend and no AI model.

**JA**

- Vai trò: 個人開発(フロントエンド)
- Tóm tắt: オンライン講座マーケットプレイスのフロントエンドのデモです。検索、6種類の絞り込み、お気に入り、カート、ルールベースの講座提案があります。講座データはモックのJSONです。
- Vấn đề: 2025年7月の練習プロジェクトです。多くの講座からすばやく絞り込め、なぜその講座が提案されたのかが分かるカタログを作りました。
- Vai trò: デザイン・実装・Vercelへのデプロイまで一人で担当しました。
- Quyết định: Next.js 15(App Router)、React 19、Tailwind CSS 4、Radix UIで構成しました。APIルート1本でGitHub Gistからモックデータを取得し、ブラウザ側で5分間キャッシュして、検索・絞り込み・スコア計算をすべて行います。提案機能は閲覧・保存した講座をもとにスコアを付け、その理由も表示します。相談チャットはキーワード照合で、LLMやAIサービスは使っていません。
- Kết quả: Vercelでデモを公開しています。READMEには、決済・バックエンド・AIモデルがないことを明記しています。

### Dien Bien Phu 1954 (VNR202c) (`vnr202c-dien-bien-phu`)

- Loại: university; thời gian: 2024-12 → 2024-12; role switcher: techlead, fullstack
- Sao: không; demo: —; repo: https://github.com/Let-cal/VNR202c_Battle_DBP
- Tech: Next.js, React, TypeScript, Tailwind CSS, GSAP, Framer Motion, Lenis, Gemini API
- Skill links: nextjs, react, typescript, tailwind-css, gsap, framer-motion

**VI**

- Vai trò: Trưởng nhóm, front-end
- Tóm tắt: Dự án đại học: trang web cuộn kể về chiến dịch Điện Biên Phủ 1954, có các phần cuộn ngang và mục hỏi đáp do Gemini trả lời.
- Vấn đề: Môn VNR202c (Lịch sử Đảng Cộng sản Việt Nam) yêu cầu thuyết trình về một sự kiện lịch sử. Nhóm kể lại chiến dịch Điện Biên Phủ bằng một trang web cuộn duy nhất.
- Vai trò: Trưởng nhóm kiêm front-end; ba người có commit trong repository. Tôi dựng project, làm phần bối cảnh lịch sử, các component cuộn ngang và swipe grid dùng lại được, và hook cuộn mượt. Các bạn trong nhóm làm layout, các phần còn lại và mục hỏi đáp.
- Quyết định: Next.js 14, TypeScript và Tailwind CSS. Dùng GSAP ScrollTrigger và Framer Motion cho chuyển cảnh giữa các slide, Lenis cho cuộn mượt. Mục hỏi đáp gửi một trong bốn câu hỏi có sẵn tới Gemini rồi hiện câu trả lời.
- Kết quả: Đã trình bày trong môn học vào tháng 12/2024. Repository đã lưu trữ (archive), README tách rõ phần tôi làm và phần của các bạn trong nhóm; bản demo đã tắt.

**EN**

- Vai trò: Team Lead, front end
- Tóm tắt: University project: a scroll-based site in Vietnamese on the 1954 Battle of Dien Bien Phu, with horizontal-scroll sections and a Q&A answered by Gemini.
- Vấn đề: The VNR202c course (History of the Communist Party of Vietnam) asked for a presentation on a historical event. The team told the story of Dien Bien Phu as one scroll-driven page.
- Vai trò: Team Lead and front-end developer; three of us committed to the repository. I set up the project and built the historical context section, reusable horizontal-scroll and swipe-grid components, and the smooth-scroll hook. Teammates built the layout, the other sections and the Q&A.
- Quyết định: Next.js 14, TypeScript and Tailwind CSS. GSAP ScrollTrigger and Framer Motion for the slide transitions, Lenis for smooth scrolling. The Q&A sends one of four preset questions to Gemini and shows the answer.
- Kết quả: Presented for the course in December 2024. The repository is archived with a README that separates my part from my teammates'; the demo is offline.

**JA**

- Vai trò: チームリーダー(フロントエンド)
- Tóm tắt: 大学のプロジェクトです。1954年のディエンビエンフーの戦いを、ベトナム語のスクロール型サイトで紹介します。横スクロールのセクションと、Geminiが答えるQ&Aがあります。
- Vấn đề: VNR202c(ベトナム共産党史)の授業で、歴史上の出来事についての発表が課題でした。チームはディエンビエンフーの戦いを、スクロールで進む1ページのサイトとして表現しました。
- Vai trò: チームリーダー兼フロントエンド開発を担当しました。リポジトリには3名がコミットしています。私はプロジェクトの立ち上げ、歴史的背景のセクション、再利用できる横スクロールとスワイプグリッドのコンポーネント、スムーズスクロールのフックを作りました。レイアウト、その他のセクション、Q&Aはチームメンバーが担当しました。
- Quyết định: Next.js 14、TypeScript、Tailwind CSSで構成しました。スライドの切り替えにはGSAP ScrollTriggerとFramer Motion、スムーズスクロールにはLenisを使いました。Q&Aは4つの定型質問から1つをGeminiに送り、回答を表示します。
- Kết quả: 2024年12月に授業で発表しました。リポジトリはアーカイブ済みで、READMEには私の担当部分とチームメンバーの担当部分を分けて記載しています。デモは公開を終了しています。

### StarMate (`starmate`)

- Loại: university; thời gian: 2024-10 → 2024-11; role switcher: techlead, fullstack
- Sao: không; demo: —; repo: https://github.com/Let-cal/star_mate_PRM
- Tech: Flutter, Dart, Provider
- Skill links: flutter, dart

**VI**

- Vai trò: Trưởng nhóm, mobile
- Tóm tắt: Dự án đại học: app Flutter kết bạn theo cung hoàng đạo, có bộ lọc, lời mời kết bạn và thông báo.
- Vấn đề: Môn lập trình mobile PRM392 yêu cầu một app chạy được trên backend thật. StarMate cho phép xem người khác, lọc theo cung hoàng đạo và giới tính, và gửi lời mời kết bạn.
- Vai trò: Trưởng nhóm kiêm lập trình mobile; hai người có commit trong repository. Tôi làm danh sách bạn bè và phần gọi API, lời mời kết bạn và thông báo, hộp thoại chi tiết người dùng, trang hồ sơ có chuyển sáng/tối và đăng xuất, và luồng đặt lại mật khẩu bằng OTP.
- Quyết định: Flutter, dùng Provider quản lý state, gói http gọi REST tới backend của nhóm, và shared_preferences giữ phiên đăng nhập trên máy.
- Kết quả: Đã nộp trong môn học vào tháng 11/2024. Backend sau đó đã tắt nên app dừng ở màn hình đăng nhập; repository đã lưu trữ và README vẫn còn.

**EN**

- Vai trò: Team Lead, mobile
- Tóm tắt: University project: a Flutter app for meeting new friends by zodiac sign, with filters, friend requests and notifications.
- Vấn đề: The PRM392 mobile course asked for a working app on a real backend. StarMate lets people browse others, filter by zodiac sign and gender, and send friend requests.
- Vai trò: Team Lead and mobile developer; two of us committed to the repository. I built the friend list and its API calls, friend requests and notifications, the person detail dialog, the profile page with the light/dark switch and logout, and the password reset flow with OTP.
- Quyết định: Flutter with Provider for state, the http package for REST calls to the team's backend, and shared_preferences to keep the session on the device.
- Kết quả: Delivered for the course in November 2024. The backend has since been shut down, so the app stops at sign-in; the archived repository and its README remain.

**JA**

- Vai trò: チームリーダー(モバイル)
- Tóm tắt: 大学のプロジェクトです。星座で新しい友達と出会えるFlutterアプリで、絞り込み、友達申請、通知の機能があります。
- Vấn đề: モバイル開発の授業PRM392で、実際のバックエンドにつながるアプリの開発が課題でした。StarMateでは、ほかのユーザーを閲覧し、星座と性別で絞り込み、友達申請を送れます。
- Vai trò: チームリーダー兼モバイル開発を担当しました。リポジトリには2名がコミットしています。私は友達一覧とそのAPI連携、友達申請と通知、ユーザー詳細のダイアログ、ライト/ダーク切り替えとログアウトのあるプロフィール画面、OTPによるパスワード再設定を作りました。
- Quyết định: Flutterで、状態管理にProvider、チームのバックエンドへのREST通信にhttpパッケージ、端末でのセッション保持にshared_preferencesを使いました。
- Kết quả: 2024年11月に授業で提出しました。その後バックエンドは停止したため、現在アプリはサインイン画面から先に進めません。アーカイブ済みのリポジトリとREADMEは残しています。
