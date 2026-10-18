# Letcal — 鯉が龍へと成長するポートフォリオ

[English](README.md) · 日本語

**Lê Trần Cát Lâm** の経験と制作実績を紹介する個人ポートフォリオです。**Developer・Tech Lead・Technical PM** の3つの視点から、担当業務と関連する実績を確認できます。鯉の泳ぐ池から龍の昇る場面まで、ひとつながりの日本庭園を背景に構成しています。

[Webサイト](https://letcal.is-a.dev) · [設計仕様](docs/superpowers/specs/2026-10-13-portfolio-koi-redesign-design.md) · [リリース確認記録](docs/fe-release-checkpoint.md)

> **フロントエンド v1：** リリース条件と、承認済みの期限付きモバイル読み込み基準は[確認記録](docs/fe-release-checkpoint.md)に記載しています。本番で確認したリビジョンは[GitHub Releases](https://github.com/Let-cal/My_Portfolio/releases)をご覧ください。Supabaseの環境構築、管理者認証、コンテンツ管理機能は今後の実装予定です。

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
| コンテンツ | Zodによる検証、seedデータ、リポジトリ層、サーバー側キャッシュ、任意のSupabase接続 |
| 多言語対応 | next-intl、ビルド時のメッセージ事前コンパイル |
| UI | Tailwind CSS、Radix UI、リポジトリ内のコンポーネント、同梱のshadcn CSS |
| アニメーション | Motion、GSAP/ScrollTrigger、Lenis |
| 3D | Three.js、React Three Fiber、Drei、段階的な読み込みと静止画への切替 |
| 検証 | Vitest、Testing Library、Playwright/axe、成果物のサイズ検査、Lighthouse |
| CI・ホスティング | GitHub Actions、Vercelのリポジトリ連携 |

Server Componentsは `src/lib/data/get-content.ts` を通してコンテンツを読み込みます。SupabaseのURLが未設定の場合は、`src/content/seed.json` を検証して使用します。Supabaseの応答に問題がある場合もseedに切り替え、その際はキャッシュの有効期間を短くします。接続用アダプターはありますが、データベースのアクセス制御や管理画面が完成していることを意味するものではありません。

3Dシーンはページ本文とは別に読み込みます。モバイルは静止画を使用し、対応するデスクトップ環境ではページの読み込み後にライブシーンを開始します。本番ビルドでは、コミット済みのポートレート画像、背景画像、アイコン、SVGスプライトを検査して使用し、ビルド環境ごとの再エンコードを避けます。元データを変更した場合は `npm run generate:assets` を実行し、生成差分を確認してコミットしてください。依存パッケージの正確なバージョンは `package-lock.json` を参照してください。

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

外部サービスを設定する場合の変数は [.env.example](.env.example) に記載しています。認証情報はコミットせず、`SUPABASE_SERVICE_ROLE_KEY` を `NEXT_PUBLIC_` で始まる変数に入れないでください。データベースのマイグレーションと初期データ投入用のコマンドは、バックエンド実装時に追加します。

`@swc/core` のバージョン固定は、既存のWindows環境向けの対処です。変更時はWindowsとLinuxの両方で確認してください。また、本番ビルドでは `next/font/google` によるフォント取得のため、ネットワーク接続が必要です。

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

| リリース基準 | 必須値 |
| --- | ---: |
| 初期JavaScript | gzip圧縮後200 KB以下 |
| モバイルLighthouse Performance | 85以上 |
| Accessibility | 95以上 |
| LCP | 2500 ms以下 |
| TBT | 200 ms以下 |
| CLS | 0.1以下 |

上記は目標値であり、達成済みのスコアではありません。ラボ測定のTBTだけでは、実環境のINPは評価できません。[確認記録](docs/fe-release-checkpoint.md) は記録日時点の結果です。候補リビジョンの最新状況はPRのチェック結果で確認してください。[リリース手順](docs/ci-release.md) に従い、必須チェックの合格後にマージと本番確認を行います。

## ディレクトリ構成

```text
src/app/[locale]/   言語別ルート、レイアウト、メタデータ、簡易表示
src/components/    セクション、操作UI、表示効果
src/content/       公開用seed、スキーマ、生成した画像属性
src/lib/data/      リポジトリ層、データ変換、キャッシュ
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

現時点では、リポジトリ全体に適用するライセンスを設けていません。この文書によって追加の利用許諾を与えるものではありません。第三者のコンポーネントやアセットには、それぞれの利用条件が適用されます。[shadcnのライセンス表記](src/app/vendor/SHADCN-LICENSE.txt)、[アイコンの表記](src/components/site/icons.tsx)、上記の滝の出典を確認してください。個人の写真、CV、ブランド素材は、再利用可能なテンプレート素材として提供していません。
フォントの出典とSIL Open Font Licenseの表記は、[フォント管理資料](src/app/fonts/README.md)に記載しています。
