# TSL Surface Shading Notes

`src/render/surfaceCellMaterial.ts` の land / water 用 TSL 実装で得た注意点を残す。

## 現在の採用状況

- ここに書いている `land` の procedural normal の知見は残すが、現行実装では採用していない。
- 現在の `land` は color-only のムラ表現に戻している。
- 理由は、法線実装が必要以上に複雑になり、見た目の安定性より保守コストが上がったため。

## land の法線実装

- `material.normalNode` を組み立てる時に `normalWorld` や `normalView` をそのまま参照しない。
- `normalWorld` / `normalView` は最終的に `material.normalNode` を読む経路に入るため、自己参照になりうる。
- 自己参照が入ると、`heightScale = 0` のように見えても見た目の法線が壊れることがある。

安全な基準法線としては次を使う。

- `normalViewGeometry`
- `normalWorldGeometry`

これらは「元の geometry + instance transform」由来の法線として扱いやすい。

## InstancedMesh と法線

- 今回の `InstancedMesh` は `Matrix4.compose(position, rotation, scale)` で素直に回している。
- `visible` 時の scale は `1, 1, 1` で、非一様スケールは使っていない。
- この条件では、法線の破綻原因は `InstancedMesh` 自体より `normalNode` 側を先に疑うべき。

## procedural height から法線を作る方針

- `land` は色ムラ用ノイズと同じ `positionWorld` ベースのノイズを height としても使える。
- ただし height 値そのものではなく、height の勾配から法線を作る必要がある。
- 勾配は `positionWorld +/- tangent * delta` と `positionWorld +/- bitangent * delta` の再サンプルで取る。
- tangent / bitangent は `normalWorldGeometry` を基準に world space で組み立てる。

実装方針:

1. `baseWorldNormal = normalWorldGeometry.normalize()`
2. `baseWorldNormal` から tangent / bitangent を作る
3. world space でノイズを再サンプルして slope を求める
4. `vec3(-dH/dT, -dH/dB, 1)` を local height normal として正規化する
5. tangent / bitangent / base normal で world normal に戻す
6. 最後に弱めに blend する

## 強さ調整の指針

- まず `heightScale` を小さくする
- 次に `mix(baseWorldNormal, perturbedWorldNormal, blend)` の `blend` を小さくする
- `sampleOffset` は勾配の見え方を変える。大きいほど広い起伏、小さいほど細かい起伏になる

今回の安定寄り設定:

- `sampleOffset = 0.035`
- `heightScale = 0.05`
- `blend = 0.35`

## 見た目の切り分け手順

1. `material.normalNode = normalViewGeometry` に戻して基準状態を確認する
2. それで正常なら、法線摂動の問題だと判断する
3. そこから自己参照しない法線経路で少しずつ戻す

## water の扱い

- `water` は `positionWorld + time` ベースのノイズで色と roughness を動かす
- `land` と違って、まずは normal より色と roughness の変化を優先した方が安全
