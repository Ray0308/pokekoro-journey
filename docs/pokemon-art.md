# ポケモンの公式アート

全国図鑑No.1〜1025の通常アートを `assets/pokemon/official-artwork/{id}.svg` に保存する。
図鑑・パーティー・遭遇・バトル・捕獲は `pokemonImage` / `pokemonPortrait` 経由で同じ画像を使う。
元の余白と透過を保って384×384のWebPへ変換し、自己完結したSVGに内包する。
SVGは追加の通信を行わず、必要な画面でだけ読み込む。テキストとしてGitへ一括登録できる形式を使う。
画像の通信エラー時は番号付きSVGへ戻す。名前が未登録でも画像があればシルエット演出を行う。

## 取得元と再生成

- リポジトリ: https://github.com/PokeAPI/sprites
- 固定コミット: `c0542f7c51215d9672439012838c99f520596cbd`
- 系列: `sprites/pokemon/other/official-artwork/{id}.png`（通常色）
- 取得日: 2026-11-13
- 変換依存: `scripts/requirements-assets.txt`

```sh
python -m pip install -r scripts/requirements-assets.txt
python scripts/import-pokemon-art.py
npm test
```

取得したPNGはGit管理外の `.cache/pokemon-art/` へ保存する。4並列で取得し、失敗は一覧にして終了する。
再実行はキャッシュから再開できる。元PNGの形式・寸法・透過を検査してから変換する。
各画像の取得URL・元PNGのSHA-256・出力SVGのSHA-256・寸法・容量は `manifest.json` に記録する。
更新時は固定コミットを明示的に変更し、全件の検査と画面確認を行う。

名前・属性・独自の攻撃力・HP・捕獲率・セーブ形式は、この画像追加では変更しない。
従来の画像ファイルは別画面からの参照を壊さないよう残す。

## 権利表記

配布元の全文を [pokeapi-sprites.txt](licenses/pokeapi-sprites.txt) に保存している。
その冒頭は「All image contents within are Copyright The Pokémon Company.」と記載されている。
同ファイルのCC0表記は、ポケモンの商標・キャラクターなど第三者の権利を包括的に許諾する意味ではない。
