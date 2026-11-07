# Koi portfolio figures: captions for the admin

Paste the Mermaid source from `runtime.mmd` into "Thêm sơ đồ", then fill the fields below. Caption <= 140 characters, note <= 100.

## 1. Runtime (`runtime.mmd`), category: Architecture 構

- Caption
  - EN: One cached read path with a seed fallback; admin writes go through server actions and refresh the content tag.
  - JA: シードへのフォールバック付きの1本のキャッシュ読み込み経路。管理画面の書き込みはサーバーアクション経由でキャッシュを更新します。
  - VI: Một đường đọc có cache và dự phòng bằng seed; admin ghi qua server action rồi làm mới tag content.
- Note
  - EN: From the repository README; the same diagram as ADR-0002.
  - JA: リポジトリのREADMEより(ADR-0002と同じ図)。
  - VI: Lấy từ README của repo; cùng sơ đồ với ADR-0002.
- Alt
  - EN: Runtime diagram: visitors reach Server Components that read through a 'use cache' layer from Supabase Postgres, falling back to seed.json; the admin goes through a proxy guard and server actions; Postgres triggers send change notes over a private Realtime topic.
  - JA: ランタイム図:訪問者はServer Componentsから'use cache'層を通じてSupabase Postgresを読み、失敗時はseed.jsonに切り替えます。管理者はプロキシのガードとサーバーアクションを通り、Postgresのトリガーがプライベートなリアルタイムトピックで変更を通知します。
  - VI: Sơ đồ runtime: khách truy cập tới Server Components, đọc dữ liệu từ Supabase Postgres qua lớp 'use cache', lỗi thì dùng seed.json; admin đi qua proxy kiểm tra quyền và server action; trigger của Postgres gửi thông báo thay đổi qua kênh Realtime riêng.
