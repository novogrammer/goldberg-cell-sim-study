# 描画構成メモ

このドキュメントは、現在の描画実装の前提を短く共有するためのものです。将来の方針や相談メモではなく、現時点の実装事実だけを記載します。

## 概要

- 描画は Three.js の `WebGPURenderer` を前提にしています。
- メインの 3D 実装は [src/render/simulationScene.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/simulationScene.ts:1) にあります。
- `app` からは [src/render/createSimulationView.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/createSimulationView.ts:1) の `SimulationView` として扱います。
- HUD や mode 切り替えなどの DOM UI は `ui` 層で扱い、描画ロジックとは分離しています。

## 地表セル

- 地表は「セルごとの個別メッシュ」ではなく、共通の半球ジオメトリを使った `InstancedMesh` で描画しています。
- 地表は land 用と water 用の 2 本に分かれています。
- land / water の 2 本に分けている理由は、roughness を材質単位で分けるためです。
- 各セルの表示・非表示は instance の scale を `1` または `0` にして切り替えています。
- 色は `setColorAt` を使って instance ごとに設定しています。

関連コード:

- [src/render/surfaceCellInstances.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/surfaceCellInstances.ts:1)
- [src/render/cellVisualAppearance.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/cellVisualAppearance.ts:1)

## 地表形状

- 現在の地表セルは、六角形や五角形そのものの押し出しメッシュではありません。
- 各セルの face center と法線を基準に、小さな半球を表面へ敷き詰める表現を使っています。
- 半球の半径は、face center 間の平均距離から求めた packed sphere 半径を基準にしています。
- instance の向きは各 face の法線方向に揃えています。
- 現在の主描画は [src/render/surfaceCellInstances.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/surfaceCellInstances.ts:1) 側の方式です。

## 植生オブジェクト

- 植生は木と雑草の 2 系統です。
- どちらも `InstancedMesh` を使い、全セル共通の geometry を最大数ぶん確保しています。
- 木は `ConeGeometry`、雑草は `BoxGeometry` をベースにしています。
- 各セルは固定レイアウトの instance slot を持ち、表示しない slot は scale `0` で隠します。
- 木は `TREE_VEGETATION_THRESHOLD` 以上で表示されます。
- 雑草は低い vegetation でも表示されます。
- 各 instance の位置、傾き、scale、色はセルごとに更新されます。

関連コード:

- [src/render/cellVegetationAppearance.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/cellVegetationAppearance.ts:1)

## 選択表示

- hover と selected は `InstancedMesh` ではありません。
- どちらも単体の `Mesh` で、地表半球の少し外側に置くリング状の `SphereGeometry` を使っています。
- visible なセルだけ位置と回転を差し替えて表示します。
- 透明材ではなく、分割した球ジオメトリを使う方針です。

関連コード:

- [src/render/surfaceSelectionOverlay.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/surfaceSelectionOverlay.ts:1)

## ピッキング

- ピッキングは raycast ベースです。
- 地表セルの pick は land / water の `InstancedMesh` に対して行います。
- `instanceId` から `cellId` へ戻す対応表は [src/render/surfaceCellInstances.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/render/surfaceCellInstances.ts:1) が持っています。
- overlay は見た目用であり、セル本体の pick source ではありません。

## Test Hook

- E2E テスト用に `window.__goldbergTestState` を公開しています。
- これは本番機能ではなく、Playwright から不安定な canvas UI 操作を直接再現しないための補助です。
- 現在は次のような用途を持ちます。
- カメラ位置の取得
- テスト用のカメラ回転とズーム
- interactive な canvas point の取得
- paint mode の切り替え
- brush の切り替え
- 複数 point への paint stroke 適用
- selected cell summary / cell terrain の取得

定義箇所:

- [src/app.ts](/Users/novo/Documents/aptanastudio3workspace/goldberg-cell-sim-study/src/app.ts:1)

## WebGPU 依存

- renderer は `three/webgpu` から import しています。
- Inspector addon は通常時のみ有効化し、`navigator.webdriver` 環境では無効にしています。
- これは E2E 実行時の不安定化を避けるためです。

## 現在の draw call 構成の概略

- 地表: land / water の 2 draw call
- 植生: 木 / 雑草の 2 draw call
- overlay: hover / selected の 2 draw call

つまり、セル数が増えても draw call 数をセル数に比例させない構成を優先しています。
