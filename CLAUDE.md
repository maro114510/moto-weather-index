# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Moto Weather Index API — calculates motorcycle touring comfort indices (0–100) from real-time weather data. Deployed on **Cloudflare Workers** with D1 (SQLite) and KV cache.

## Commands

すべてのタスクは `Taskfile.yaml` に定義されている。`task -l` で一覧を確認できる。

よく使うコマンド:

```bash
task dev            # ローカル開発サーバー起動
task lint           # Biome によるリント
task lint:fix       # リント自動修正
task test           # テスト実行
task ci:post-check  # CI 相当のチェック（lint + test）
```

テストの一部は外部 API を利用するため `WEATHERAPI_KEY` が必要。未設定時は CI 同様スキップされる。

## Architecture

Clean Architecture の4層構成。依存の方向は外側 → 内側の一方向のみ。

- **domain** — フレームワークに依存しない純粋なビジネスロジック。スコア算出ルール、ドメインエラー、型定義を持つ。
- **usecase** — ドメイン層を組み合わせてアプリケーション固有のユースケースを実現する。単発計算・バッチ計算・レート制限など。
- **infra** — 外部サービス（天気API・DB・KV）への接続を担う。usecase 層が定義するインターフェースを実装する。
- **interface** — HTTP リクエストの受付・バリデーション・レスポンス整形を行う。ハンドラ・ミドルウェア・OpenAPI 定義で構成。

DI は `src/di/` にあるファクトリ関数で Cloudflare の環境バインディングと各層を結合する。

## Key Technical Details

- **Framework**: Hono (OpenAPIHono variant with `@hono/zod-openapi`)
- **Runtime/Package manager**: Bun
- **Linter/Formatter**: Biome 2 (config: `.biomerc.json`, indent: 2 spaces)
- **Validation**: Zod at all boundaries (request params, API responses)
- **Scheduled cron**: Daily at UTC 19:00 (JST 04:00) — batch-calculates indices for all 47 prefectures
- **Database**: Cloudflare D1 with schemas in `db/ddl.sql`, seed data in `db/init.sql`

## Conventions

- 各レイヤーの既存パターンに従う。新しいドメインロジックは `src/domain/`、外部連携は `src/infra/` に置く。
- エラーはグローバルハンドラで一貫した JSON 形式に変換される。個別ハンドラで独自のエラーレスポンスを返さない。
- テストはソースと同階層（`*.test.ts`）または `tests/` ディレクトリに配置する。
