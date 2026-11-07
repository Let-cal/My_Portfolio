# SitePlus figures: captions for the admin

Paste each diagram's Mermaid source from the `.mmd` file next to this one into "Thêm sơ đồ", then fill the fields below. Caption <= 140 characters, note <= 100.

## 1. Architecture (`architecture.mmd`), category: Architecture 構

- Caption
  - EN: Three clients call one ASP.NET Core (.NET 8) API in four Clean Architecture layers, backed by SQL Server, Qdrant and Cohere.
  - JA: 3つのクライアントが、Clean Architecture 4層のASP.NET Core(.NET 8)APIを呼び出し、SQL Server・Qdrant・Cohereを利用します。
  - VI: Ba nhóm client gọi một API ASP.NET Core (.NET 8) chia 4 tầng Clean Architecture, dùng SQL Server, Qdrant và Cohere.
- Note
  - EN: Redrawn from the code. I designed the architecture; teammates built the back end.
  - JA: コードから再作成。アーキテクチャは私が設計し、バックエンドはチームが実装しました。
  - VI: Vẽ lại từ code. Tôi thiết kế kiến trúc, các bạn trong nhóm làm backend.
- Alt
  - EN: Architecture diagram: brand pages, the React web app and the Flutter app call a .NET 8 Web API (WebApi, Application, Infrastructure, Domain). The API uses SQL Server, Cohere embeddings, Qdrant, Cloudinary, Gmail SMTP and QuestPDF; a SignalR hub pushes task notifications to the mobile app.
  - JA: アーキテクチャ図:ブランド向けページ、ReactのWebアプリ、Flutterアプリが.NET 8 Web API(WebApi・Application・Infrastructure・Domain)を呼び出します。APIはSQL Server、Cohereのエンベディング、Qdrant、Cloudinary、Gmail SMTP、QuestPDFを使い、SignalRハブがモバイルアプリにタスク通知を送ります。
  - VI: Sơ đồ kiến trúc: trang cho thương hiệu, web React và app Flutter gọi Web API .NET 8 (WebApi, Application, Infrastructure, Domain). API dùng SQL Server, embedding Cohere, Qdrant, Cloudinary, Gmail SMTP và QuestPDF; SignalR đẩy thông báo task xuống app mobile.

## 2. Data model (`erd.mmd`), category: Data model 表

- Caption
  - EN: Core tables of the 29: brands and their requests, sites and deals, survey tasks, and the matches scored by similarity.
  - JA: 29テーブルのうち主要なもの:ブランドと依頼、物件と条件、調査タスク、類似度で採点したマッチング。
  - VI: Các bảng chính trong 29 bảng: thương hiệu và yêu cầu, mặt bằng và điều kiện thuê, task khảo sát, kết quả ghép theo độ tương đồng.
- Note
  - EN: Database design is mine; redrawn from the EF Core models.
  - JA: データベース設計は私が担当。EF Coreのモデルから再作成しました。
  - VI: Thiết kế database do tôi làm; vẽ lại từ model EF Core.
- Alt
  - EN: Entity relationship diagram: City, District and Area hold buildings and sites; brands send requests and define store profiles with min/max criteria; sites have images, survey values and deals; tasks are assigned to users per area; matching links a request to candidate sites with a compatibility score.
  - JA: ER図:City・District・Areaが建物と物件を持ちます。ブランドは依頼を送り、最小・最大の条件を持つ店舗プロファイルを定義します。物件には画像・調査値・条件があり、タスクはエリアごとにユーザーへ割り当てられます。マッチングは依頼と候補物件を適合スコアで結びます。
  - VI: Sơ đồ quan hệ thực thể: City, District, Area chứa tòa nhà và mặt bằng; thương hiệu gửi yêu cầu và định nghĩa hồ sơ cửa hàng với tiêu chí min/max; mặt bằng có ảnh, giá trị khảo sát và điều kiện thuê; task được giao cho người dùng theo khu vực; bảng Matching nối yêu cầu với mặt bằng ứng viên kèm điểm phù hợp.

## 3. Flow (`flow.mmd`), category: Flow 流

- Caption
  - EN: From a brand's request to a closed deal: review, field survey on mobile, area review, AI matching and the PDF report.
  - JA: ブランドの依頼から成約まで:確認、モバイルでの現地調査、エリア確認、AIマッチング、PDFレポート。
  - VI: Từ yêu cầu của thương hiệu đến khi chốt: duyệt, khảo sát trên mobile, area manager duyệt, ghép bằng AI và báo cáo PDF.
- Note
  - EN: Business flow I specified in the SRS and design documents.
  - JA: SRSと設計書で私が定義した業務フローです。
  - VI: Luồng nghiệp vụ tôi đặc tả trong SRS và tài liệu thiết kế.
- Alt
  - EN: Flowchart: a brand sends a 4-step request; the manager accepts or denies it by email; accepted criteria are embedded; a survey task is assigned; field staff record the site, photos and deal; the area manager accepts, refuses or asks for edits; the manager runs AI matching, shortlists sites, exports the PDF and closes the request.
  - JA: フローチャート:ブランドが4ステップの依頼を送り、マネージャーがメールで承認または却下します。承認された条件はエンベディングされ、調査タスクが割り当てられます。現地スタッフが物件・写真・条件を記録し、エリアマネージャーが承認・却下・修正依頼を行います。マネージャーがAIマッチングを実行し、候補を絞ってPDFを出力し、依頼を完了します。
  - VI: Lưu đồ: thương hiệu gửi yêu cầu 4 bước; quản lý duyệt hoặc từ chối qua email; tiêu chí được duyệt được chuyển thành embedding; task khảo sát được giao; nhân viên ghi mặt bằng, ảnh và điều kiện thuê; area manager duyệt, từ chối hoặc yêu cầu sửa; quản lý chạy ghép bằng AI, chọn mặt bằng, xuất PDF và đóng yêu cầu.
