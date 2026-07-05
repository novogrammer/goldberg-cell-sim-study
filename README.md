# Goldberg多面体セルシミュレーション

Goldberg多面体上でセルシミュレーションを行うブラウザ実装です。状態変化を検証するだけでなく、眺めていられるプログラムとして育てていくことを目標にしています。

現在は icosphere 細分化から dual セルを組み立てる可変 `frequency` メッシュを使います。現在のブラウザ表示は `frequency=10` で、各 face ではなく dual 側の各セルを 1 単位として扱います。`createGoldbergMesh(frequency)` により表示解像度は今後も変更可能です。`frequency=2` なら 42 セル、`frequency=3` なら 92 セルで、そのうち 12 個は常に五角形セルです。現在のシミュレーションは `水場 + 土地 + 植生` の局所環境モデルです。

公開ページ:
https://novogrammer.github.io/goldberg-cell-sim-study/

## モデル概要

- 五角形セルは除外せず、通常セルと同じ配列に含めて扱います。
- 一部セルは固定の `water` セルとして扱います。
- `land` セルは `vegetation` スコアを持ち、水場の近接、周囲の植生、肥沃度、地質の影響で変化します。
- `isPentagon` により、後から描画やルールを分けられる構造です。

詳細は [docs/simulation-model.md](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/docs/simulation-model.md:1) を参照してください。
描画構成の前提は [docs/rendering.md](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/docs/rendering.md:1) にあります。
エージェント向けの変更ガイドは [AGENTS.md](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/AGENTS.md:1) にあります。

## 構成メモ

- `app`: アプリ全体の進行役です。state を持ち、UI と 3D 表示を結線します。
- `ui`: HUD と `viewport` などの DOM UI を扱います。`viewport` は 3D を表示するための UI 領域です。
- `editor`: セル状態の変更やペイント適用など、データ更新ロジックを扱います。
- `render`: Three.js による描画を扱います。`simulationScene` は 3D の中身、`createSimulationView` は app から見た薄い橋渡しです。

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

Vite の開発サーバーが立ち上がります。

## テスト

```bash
npm test
```

`npm test` は unit テストと E2E テストの両方を実行します。E2E のみ実行したい場合は `npm run test:e2e` を使ってください。

E2E の運用方針は [tests/README.md](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/tests/README.md:1) を参照してください。

確認している内容:

- `frequency=2` で 42 セル、`frequency=3` で 92 セルの Goldberg多面体メッシュが生成される
- 五角形セルが 12 個あり、すべて 5 近傍である
- 水場と土地の両方が生成される
- 水場近傍の土地セルが植生成長しやすい

## ビルド

```bash
npm run build
```

## 現状の制約

- 現在のアプリ表示は `frequency=10` ですが、生成器自体は `createGoldbergMesh(frequency)` で可変です。
- 水場は固定セルで、まだ移動や拡散はしません。
