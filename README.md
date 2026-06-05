# Goldberg Cell Sim Study

Goldberg polyhedron 上でセルシミュレーションを行う最小構成のブラウザ実装です。

初期実装では固定の `frequency=2` メッシュを使い、各 face ではなく dual 側の各セルを 1 単位として扱います。セル総数は 42 で、そのうち 12 個は五角形セルです。

## モデル概要

- 五角形セルは除外しません。
- 各セルは `neighbors`, `neighborCount`, `isPentagon`, `state`, `nextState` を持ちます。
- 五角形セルは `isPentagon === true` かつ `neighborCount === 5` です。
- 非五角形セルは `neighborCount === 6` です。
- 更新ルールでは近傍の合計ではなく近傍平均を使います。

詳細は [docs/simulation-model.md](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/docs/simulation-model.md:1) を参照してください。

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

確認している内容:

- 42 セルの Goldberg メッシュが生成される
- 五角形セルが 12 個あり、すべて 5 近傍である
- 非五角形セルが 6 近傍である
- 隣接関係が双方向である
- 更新ルールが近傍平均ベースで動く

## ビルド

```bash
npm run build
```

## 現状の制約

- Goldberg polyhedron は固定の `frequency=2` のみです。
- pentagon 専用の更新ルールはまだ持たせていません。
- `isPentagon` は描画や将来のルール分岐のために保持しています。
