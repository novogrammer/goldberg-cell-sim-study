# 描画構成メモ

このドキュメントは、現在の描画実装の前提を短く共有するためのものです。将来の方針や相談メモではなく、現時点の実装事実だけを記載します。

## 概要

- 描画は Three.js の `WebGPURenderer` を前提にしています。
- メインの 3D 実装は [src/render/simulationScene.ts](../src/render/simulationScene.ts) にあります。
- `app` からは [src/render/createSimulationView.ts](../src/render/createSimulationView.ts) の `SimulationView` として扱います。
- HUD や mode 切り替えなどの DOM UI は `ui` 層で扱い、描画ロジックとは分離しています。

## 地表セル

- 地表は「セルごとの個別メッシュ」ではなく、共通の半球ジオメトリを使った `InstancedMesh` で描画しています。
- 地表は land 用と water 用の 2 本に分かれています。
- land / water の 2 本に分けている理由は、roughness を材質単位で分けるためです。
- land / water の各 `InstancedMesh` は、対応する terrain のセルだけを packed instance として保持しています。
- 色は `setColorAt` を使って instance ごとに設定しています。

関連コード:

- [src/render/SurfaceCellInstances.ts](../src/render/SurfaceCellInstances.ts)
- [src/render/cellVisualAppearance.ts](../src/render/cellVisualAppearance.ts)

## 地表形状

- 現在の地表セルは、六角形や五角形そのものの押し出しメッシュではありません。
- 各セルの face center と法線を基準に、小さな半球を表面へ敷き詰める表現を使っています。
- 半球の半径は、face center 間の平均距離から求めた packed sphere 半径を基準にしています。
- instance の向きは各 face の法線方向に揃えています。
- 現在の主描画は [src/render/SurfaceCellInstances.ts](../src/render/SurfaceCellInstances.ts) 側の方式です。

## 植生オブジェクト

- 植生は木と雑草の 2 系統です。
- どちらも `InstancedMesh` を使い、全セル共通の geometry を最大数ぶん確保しています。
- 木は `ConeGeometry`、雑草は `BoxGeometry` をベースにしています。
- tree / weed の各 `InstancedMesh` は、表示する植生だけを packed instance として保持します。
- 木は `TREE_VEGETATION_THRESHOLD` 以上で表示されます。
- 雑草は低い vegetation でも表示されます。
- 各 instance の位置、傾き、scale、色はセルごとに更新されます。
- mesh、geometry、material、同期、破棄は `VegetationInstances` が所有します。
- weed は TSL の `time` と固定の `weedPhase` instanced attribute を使い、根元を固定したまま個体ごとに位相をずらして頂点を揺らします。
- weed geometry は生成時にY方向へ移動して根元を原点、先端をY=1とし、傾斜とTSL変位の基準を根元に揃えます。
- `weedPhase` は `cell.id` とセル内の weed index から決めるため、packed instance の slot が変わっても同じ weed の位相は変わりません。
- 揺れは GPU の頂点変位で行うため、アニメーション中に CPU 側の instance matrix は更新しません。

関連コード:

- [src/render/cellVegetationAppearance.ts](../src/render/cellVegetationAppearance.ts)
- [src/render/vegetationMaterial.ts](../src/render/vegetationMaterial.ts)
- [src/render/VegetationInstances.ts](../src/render/VegetationInstances.ts)

## 選択表示

- hover と selected は `InstancedMesh` ではありません。
- どちらも単体の `Mesh` で、地表半球の少し外側に置くリング状の `SphereGeometry` を使っています。
- visible なセルだけ位置と回転を差し替えて表示します。
- 透明材ではなく、分割した球ジオメトリを使う方針です。

関連コード:

- [src/render/SurfaceSelectionOverlay.ts](../src/render/SurfaceSelectionOverlay.ts)

## ピッキング

- ピッキングは raycast ベースです。
- 地表セルの pick は表示用の land / water mesh ではなく、専用の `pickMesh` に対して行います。
- `pickMesh` の instance slot は `cellId` と一致するため、raycast の `instanceId` をそのまま `cellId` として使います。
- overlay は見た目用であり、セル本体の pick source ではありません。

### 表示形状と pick 形状の差

- land / water の表示材質は TSL で小さな頂点変位を加えています。
- `pickMesh` は変位前の共通半球ジオメトリを使います。raycast は CPU 側で行うため、表示材質の頂点変位は反映されません。
- 現在の変位量は小さいため、見た目と選択位置の差は許容範囲です。
- 将来、地表や水面の変位量を大きくする場合は、pick 形状も対応させるか、この差をUX上許容できるか確認します。

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

- [src/app.ts](../src/app.ts)

## WebGPU 依存

- renderer は `three/webgpu` から import しています。
- Inspector addon は通常時のみ有効化し、`navigator.webdriver` 環境では無効にしています。
- これは E2E 実行時の不安定化を避けるためです。

## 現在の draw call 構成の概略

- 地表: land / water の 2 draw call
- 植生: 木 / 雑草の 2 draw call
- overlay: hover / selected の 2 draw call

つまり、セル数が増えても draw call 数をセル数に比例させない構成を優先しています。
