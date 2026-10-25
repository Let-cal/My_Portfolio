# Letcal — 鯉が龍へと成長するポートフォリオ

[English](README.md) · 日本語

**Lê Trần Cát Lâm** の経験と制作実績を紹介する個人ポートフォリオです。**Developer・Tech Lead・Technical PM** の3つの視点から、担当業務と関連する実績を確認できます。鯉の泳ぐ池から龍の昇る場面まで、ひとつながりの日本庭園を背景に構成しています。

[Webサイト](https://letcal.is-a.dev) · [設計仕様](docs/superpowers/specs/2026-10-13-portfolio-koi-redesign-design.md) · [CIとリリース手順](docs/ci-release.md)

> **フロントエンド v1** は [letcal.is-a.dev](https://letcal.is-a.dev) で公開中です。コンテンツはSupabaseに保存し、非公開の管理画面 `/admin` から編集します。

## プレビュー

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/images/portfolio-dark.webp">
  <img src="docs/images/portfolio-light.webp" alt="円形の役割セレクターと鯉の背景を表示したポートフォリオのデスクトップ画面">
</picture>

Motionオフで撮影したデスクトップ画面です。[ダーク](docs/images/portfolio-dark.webp) · [ライト](docs/images/portfolio-light.webp)。

## 主な機能

- **役割別の表示：** 円形のセレクターで役割を切り替えると、紹介文、配色、ダウンロード対象のCV、職務経歴やスキルの表示順が変わります。
- **3言語対応：** `/en`・`/ja`・`/vi` に英語・日本語・ベトナム語のページとメタデータを用意しています。
- **実績の確認：** 職務経歴、プロジェクトの詳細、スキルに関連する実績、資格、連絡先を掲載しています。
- **連続する3Dシーン：** デスクトップでは、鯉と龍、蓮池、滝、灯籠、昼夜の照明を表示します。モバイル、動きを抑える設定、WebGLが利用できない環境では静止画を使用します。
- **閲覧を補助する操作：** キーボード操作、Motion切替、コマンドパレット、印刷用の簡易表示（`/ja/quick`）に対応しています。

## 技術構成

| 領域 | 使用技術・構成 |
| --- | --- |
| ページ・描画 | Next.js **16.4**、React **19.3**、TypeScript、App Router、Cache Components |
| コンテンツ | 行レベルセキュリティ付きのSupabase Postgres、Zodによる検証、サーバー側キャッシュ、seedへのフォールバック |
| 管理画面 | Supabase Auth、プロキシでのルート保護、Server Actions、設定駆動のフォーム、ストレージへの直接アップロード |
| 多言語対応 | next-intl、ビルド時のメッセージ事前コンパイル |
| UI | Tailwind CSS、Radix UI、リポジトリ内のコンポーネント、同梱のshadcn CSS |
| アニメーション | Motion、GSAP/ScrollTrigger、Lenis |
| 3D | Three.js、React Three Fiber、Drei、段階的な読み込みと静止画への切替 |
| 検証 | Vitest、Testing Library、Playwright/axe、成果物のサイズ検査、Lighthouse |
| CI・ホスティング | GitHub Actions、Vercelのリポジトリ連携 |

Server Componentsは `src/lib/data/get-content.ts` を通してコンテンツを読み込み、`content` タグでキャッシュします。管理画面で保存すると `updateTag('content')` が呼ばれ、次の閲覧者には変更後の内容が表示されます。SupabaseのURLが未設定の場合は `src/content/seed.json` を使用し、Supabaseの応答に問題がある場合もseedに切り替えます（キャッシュ期間は短くなります）。

閲覧者は公開用キーで読み込み、行レベルセキュリティにより公開中の行だけが返ります。書き込みには `private.app_admins` に登録されたメールアドレスが必要で、このスキーマはData APIに公開していません。さらにプロキシが `/admin` へのアクセスを確認し、`ADMIN_EMAIL` と `private.app_reviewers` に登録された閲覧専用レビュアー以外はログイン画面へ移動させます。レビュアーは管理画面のすべてを閲覧できますが、変更はできません（[docs/security/reviewer-access.md](docs/security/reviewer-access.md)）。各テーブルの定義は `src/lib/data/columns.ts` に一か所でまとめ、テストでマッパーと照合し、`supabase/schema.sql` もここから生成します。

3Dシーンはページ本文とは別に読み込みます。モバイルは静止画を使用し、対応するデスクトップ環境ではページの読み込み後にライブシーンを開始します。本番ビルドでは、コミット済みのポートレート画像、背景画像、アイコン、SVGスプライトを検査して使用し、ビルド環境ごとの再エンコードを避けます。元データを変更した場合は `npm run generate:assets` を実行し、生成差分を確認してコミットしてください。依存パッケージの正確なバージョンは `package-lock.json` を参照してください。

## アーキテクチャと開発プロセス

システムの構成と、変更が本番環境に反映されるまでの流れの要約です。図と根拠へのリンクは[英語版README](README.md#architecture--engineering-process)に掲載しています。

### 実行時の構成

- 閲覧者のリクエストはVercel上のNext.js 16（Server Components）が処理し、`content` タグ付きのキャッシュから表示します。Supabaseが未設定、または応答が不正な場合は [`seed.json`](src/content/seed.json) を使用します（[`get-content.ts`](src/lib/data/get-content.ts)）。
- 管理画面の操作は、プロキシ → Server Actions（`requireAdmin()`）→ Supabaseの行レベルセキュリティの順に確認します。保存時には `updateTag('content')` で公開ページのキャッシュを更新します。
- Supabaseでは、Postgres（行レベルセキュリティ）、Storage（`media`・`files`）、Realtime（非公開トピック `admin:content`）を使用します。

### セキュリティモデル

- 最終的な防御はデータベースの行レベルセキュリティです。プロキシとServer Actionsでの確認は、多層防御として位置付けています。
- 管理者の許可リストと変更履歴は、Data APIに公開していない `private` スキーマに置いています（[マイグレーション](supabase/migrations)）。
- 拒否されることの確認は、本番データではなく、CI上の使い捨てSupabase環境で実施しています。
- プレビューの確認には読み取り専用のレビュー用アカウントを使います。UIDの許可リストとSELECTのみのポリシーで制御し、書き込みはすべて `requireAdmin()` で拒否します（[セキュリティ資料](docs/security/reviewer-access.md)）。

### 変更から本番反映まで

1. 規模の大きい作業では、仕様と計画（[docs/superpowers/](docs/superpowers)）を先にコミットします。
2. ブランチ上でテストと合わせて小さな単位でコミットします。push前に `npm run verify:quick` が実行されます。
3. [PRテンプレート](.github/pull_request_template.md)に沿って、課題、実際に実行したコマンド、残る確認事項を記載します。
4. CIのチェック（下表）とVercelのプレビューを確認します。
5. オーナーが開始するレビューで証跡を収集し、[`review-release.mjs`](.github/scripts/review-release.mjs) で判定します（[手順書](docs/final-review-release.md)）。Auth/RLS、CI/CD、権限、マイグレーションの変更には、オーナーの承認が必要です。
6. レビューしたhead SHAに限定してマージし、Vercelが `main` を本番環境へ反映します。「マージ済み」「デプロイ済み」「確認済み」は分けて報告します。

| チェック | 扱い |
| --- | --- |
| Lint、型、ユニットテスト、予算 | 必須。失敗するとマージをブロック |
| Playwright Chromium on Linux | 必須。欠落・スキップ・flakyな結果もブロック |
| Lighthouse mobile | 必須。Accessibility・SEO・CLSはブロック、Performance・LCP・TBTは警告のみ |
| 使い捨てSupabaseでの管理画面テスト | 失敗するとCIは失敗しますが、必須チェックではありません |
| Gitleaks、npm audit、CodeQL | 必須。失敗するとマージをブロック |
| Vercel | 必須 |

「必須」は、2026-10-25時点でGitHub APIから確認した `main` のブランチ保護設定に基づきます。

### 設計判断の記録（ADR）

[ADR一覧](docs/adr/README.md)に、各判断の背景・トレードオフ・根拠を英語で記録しています。

- データと表示：[0001 3言語と単一のコンテンツモデル](docs/adr/0001-three-locales-one-content-model.md)、[0002 キャッシュとseedフォールバック](docs/adr/0002-cached-content-loader-with-seed-fallback.md)、[0003 3Dシーンが本文を妨げない構成](docs/adr/0003-3d-scene-never-blocks-content.md)、[0009 下書きプレビューと公開キャッシュの分離](docs/adr/0009-draft-preview-outside-the-public-cache.md)
- セキュリティ：[0004 RLSを最終防御とする構成](docs/adr/0004-rls-as-the-final-guard.md)、[0008 メディアライブラリ](docs/adr/0008-media-library-on-supabase-storage.md)、[0013 読み取り専用のレビュー用ロール（提案中）](docs/adr/0013-read-only-reviewer-role.md)
- 管理画面：[0006 トリガーによる変更履歴](docs/adr/0006-content-history-with-triggers.md)、[0007 非公開のRealtime Broadcast](docs/adr/0007-private-realtime-broadcast.md)
- 品質とリリース：[0005 CIのブロック基準](docs/adr/0005-pragmatic-ci-gates.md)、[0010 使い捨てSupabaseでの結合テスト](docs/adr/0010-disposable-supabase-integration-tests.md)、[0011 リリース証跡の判定](docs/adr/0011-fail-closed-release-evaluator.md)、[0012 レビュー済みSQLによるマイグレーション](docs/adr/0012-hosted-migrations-through-reviewed-sql.md)

## ローカルで起動する

**Node.js 22.xの22.19以降**とnpmを使用します。Lighthouse 13.5.0の実行にはNode.js 22.19以上が必要です。

```sh
npm ci
npm run dev
```

[http://localhost:3000/ja](http://localhost:3000/ja) を開いてください。**seedを利用するフロントエンドの起動に、環境変数ファイル、データベース、外部サービスのアカウントは不要です。** 本番ビルドは次の手順で確認できます。

```sh
npm run build
npm run start
```

### データベースと管理画面（任意）

1. Supabaseのプロジェクトを作成し、`supabase/migrations/` を順番に適用します（SQLエディターまたは `supabase db push`）。
   ファイル名は本番プロジェクトのマイグレーション履歴と一致しており、`supabase migration list` でも差分は出ません。本番へ適用するマイグレーションは、事前にオーナーが具体的なSQLを承認します（[ADR-0012](docs/adr/0012-hosted-migrations-through-reviewed-sql.md)）。
2. [.env.example](.env.example) を `.env.local` にコピーし、プロジェクトURL、公開用キー、シークレットキー、`ADMIN_EMAIL` を設定します。このファイルはコミットせず、`SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` で始まる変数に入れないでください。
3. `npm run db:seed` で `seed.json` を投入し、`npm run db:verify` で公開用キーから読み戻して全セクションを照合します。
4. Supabase Authで管理者ユーザーを作成し、`insert into private.app_admins (email) values ('<email>');` を実行します。
5. `/admin/login` からログインします。

`columns.ts` を変更したら `npm run db:schema` を実行し、本番データベース用のマイグレーションを追加してください。`Supabase keep-alive` ワークフローは週2回1行を読み込み、無料プロジェクトの一時停止を防ぎます。リポジトリ変数 `SUPABASE_URL` と `SUPABASE_PUBLISHABLE_KEY` を使用します。

`@swc/core` のバージョン固定は、既存のWindows環境向けの対処です。変更時はWindowsとLinuxの両方で確認してください。また、本番ビルドでは `next/font/google` によるフォント取得のため、ネットワーク接続が必要です。

管理画面の `/admin/media` では、Storageの画像・動画・PDFと使用先を確認でき、各フォームで既存のファイルを選択できます。利用前に管理者用のSELECTポリシーを適用してください。削除したファイルは内容の履歴からも復元できません。適用手順・制約・確認項目は [運用ガイド（英語）](docs/admin-media-library.md) を参照してください。

## 検証手順

フォント成果物の検証には、[uv](https://docs.astral.sh/uv/getting-started/installation/)とPython 3.11以降も必要です。FontToolsとBrotliのバージョンはスクリプト内で固定し、分離した環境で実行します。通常の開発・本番ビルドはNode.jsとnpmのみで実行できます。CIではuvを明示的に準備します。

リポジトリのルートで実行します。型チェックと成果物の検査には、ビルドで生成したファイルを使用します。

```sh
npm run lint
npm test
npm run build
npx --no-install tsc --noEmit
npm run check:bundle
npm run test:budgets
npm audit --omit=dev --audit-level=high
```

ブラウザテストの前にChromiumをインストールします。Linuxでは、システム依存関係も導入するため `npx --no-install playwright install --with-deps chromium` を使用してください。

```sh
npx --no-install playwright install chromium
npm run test:e2e -- --workers=1
```

Playwrightは本番ビルドを作成し、**ポート3100**で起動します。CI以外では、同じポートで稼働中のサーバーを再利用できます。再利用する場合は、対象のコードとサーバーのリビジョンが一致していることを確認してください。開発用のポート3000とは分けています。WindowsではD3D11、LinuxではSwiftShaderを使用します。CIではソフトウェア描画の負荷を考慮し、1ワーカーと上限付きの待機時間を設定しています。動作確認が必要なテストでは、アニメーションを明示的に有効にしています。

モバイル性能を測定する際は、競合するブラウザやテスト処理を停止し、本番サーバーを起動します。

```sh
npm run start -- -p 3100
```

別のターミナルで次を実行します。Chromeをインストールするか、対応する実行ファイルを `CHROME_PATH` で指定してください。

```sh
npm run check:performance
```

各言語で**3回**測定し、指標ごとの中央値を判定します。測定先は `PERF_ORIGIN` で変更できます。`PERF_TRACE=1` を指定すると、各言語の初回測定で診断用ファイルも保存します。出力先は `.lighthouseci/` です。

| チェック | 基準 | 扱い |
| --- | ---: | --- |
| 初期JavaScript | gzip圧縮後200 KB以下 | マージをブロック |
| Lighthouse Accessibility | 95以上 | マージをブロック |
| Lighthouse SEO | 90以上 | マージをブロック |
| CLS | 0.1以下 | マージをブロック |
| Lighthouse Performance | 85以上 | 警告のみ |
| LCP / TBT | 2500 ms / 200 ms以下 | 警告のみ |

共有CIマシンでのラボ測定値は実行ごとにばらつくため、読み込み指標はPRごとに報告しますがマージはブロックしません。実ユーザーのCore Web VitalsはVercel Speed Insightsで本番計測します。詳細は[CIとリリース手順](docs/ci-release.md)をご覧ください。

## ディレクトリ構成

```text
src/app/[locale]/   言語別ルート、レイアウト、メタデータ、簡易表示
src/components/    セクション、操作UI、表示効果
src/content/       公開用seed、スキーマ、生成した画像属性
src/lib/data/      リポジトリ層、テーブル定義、データ変換、キャッシュ
src/app/admin/     管理画面のログイン、ダッシュボード、編集画面
src/lib/admin/     ルート保護、リソース設定、サーバー側データ
supabase/          マイグレーションと生成済みの現行スキーマ
src/scene/         鯉・龍、背景、入力処理、端末別の描画設定
public/            公開CV、加工済みポートレート、モデル、静止画
scripts/           アセット生成、リリース測定
tests/             ユニット、ブラウザ、スクリプト・アセット検査
docs/              設計判断、リリースの確認記録
```

## デザインの背景

鯉が龍へと成長する物語を、ひとつの庭園で表現しています。役割ごとのアクセントカラー、読みやすさを支える背景面、逆方向にも自然につながる場面遷移により、実績を確認しながら庭園を巡る構成にしています。

- [本文の背景とスクロールの安定性](docs/superpowers/reports/content-surfaces-review.md)
- [昼夜を通した庭園の連続性](docs/superpowers/reports/garden-day-night-review.md)
- [夜景の配色](docs/superpowers/reports/garden-night-palette.md)
- [滝のアセットと出典](docs/superpowers/reports/waterfall-environment-review.md)
- [ドメイン設定](docs/domain-is-a-dev.md)

## 変更提案・セキュリティ・利用条件

メンテナーはLê Trần Cát Lâmです。変更提案と検証の進め方は [CONTRIBUTING.md](CONTRIBUTING.md)、脆弱性の非公開報告は [SECURITY.md](SECURITY.md)、確認済みのリポジトリ設定は [運用記録](docs/repository-maintenance.md) を参照してください。Issueは英語・日本語のどちらでも受け付けます。

ソースコードは[MITライセンス](LICENSE)で公開しています。個人のコンテンツ（ポートフォリオの文章とデータ、CV、写真、スクリーンショット、LETCALブランド）は © Lê Trần Cát Lâm, all rights reserved とし、再利用は許諾していません。詳しくは [CONTENT-LICENSE.md](CONTENT-LICENSE.md) をご覧ください。第三者のコンポーネントやアセットには、それぞれの利用条件が適用されます。[shadcnのライセンス表記](src/app/vendor/SHADCN-LICENSE.txt)、[アイコンの表記](src/components/site/icons.tsx)、上記の滝の出典を確認してください。
フォントの出典とSIL Open Font Licenseの表記は、[フォント管理資料](src/app/fonts/README.md)に記載しています。
