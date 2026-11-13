# 開発・コードの読み方

## 日常の手順

```sh
npm ci
npm run format
npm run format:check
npm run check:syntax
npm test
```

PrettierとAcornは整形・検証だけに使う開発依存。公開サイトは従来どおりHTML/CSS/JavaScriptを直接読み込む。

## 入口と読み込み順

`index.html`がCSSとスクリプトの読み込み順を定義する。現在は通常のscriptタグで同じグローバルスコープを共有しているため、順番を入れ替える前に参照元を確認する。

1. バージョン・マップ・ポケモンデータを定義する。
2. パーティー計算、描画、サファリ、音声設定、演出、属性ボールのルールを定義する。
3. `app.js`でセーブ移行、ゲーム状態、DOMイベントを初期化する。
4. 交換所・図鑑・BGM・タイトル・メニューを接続する。
5. 末尾の`debug.js`で開発専用UIを追加する。隣のコメントに従い、このscript行だけを外せる。

## 主な担当ファイル

| ファイル | 担当 |
| --- | --- |
| `app.js` | セーブ、マップ移動、パズル操作、バトル進行、報酬、捕獲 |
| `map-config.js` / `pokemon-data.js` | マップと全国図鑑番号に紐づくデータ |
| `party-rules.js` | 属性集計、編成制約、火力計算、ピース補充 |
| `puzzle-visuals.js` | ピースの描画 |
| `battle-feedback.js` / `battle-scene.js` | 演出・相手のステータスと場所別背景 |
| `type-balls.js` | 属性ボールの共通ルールとセーブ移行 |
| `kurt-house.js` / `ball-exchange.js` | ボール交換と属性ボール選択のUI |
| `safari.js` / `rainbow-config.js` | 特別ステージのルール |
| `map-audio.js` / `game-sfx.js` / `audio-settings.js` | BGM、SE、音量設定 |
| `title.js` / `title-config.js` | タイトルの素材、待機・出発演出、音声の開始 |
| `pokedex.js` / `game-menu.js` | 図鑑とメニュー |
| `debug.js` | 通常セーブと分離したデバッグ操作 |

`app.js`は、セーブ移行 → マップ描画 → パーティー → 移動・バトル → 捕獲 → 出現演出 → 一斉攻撃 → サイコロ・入力補助、の順で読む。

## 変更時に守ること

- ポケモンのIDはセーブのキー。未登録の名前・画像・属性は推測で埋めない。
- `battleEpoch`と`diceEpoch`は非同期演出を破棄する世代番号。待機後に番号が変わっていたら、その処理を進めない。
- 報酬は`rewardResolved`、投球は`capturePending`で二重実行を防ぐ。
- サファリはHP撃破を使わない。通常バトルの見た目だけを変える場合も、非戦闘処理を確認する。
- ガンテツの出現結果はマップ・周回ごとに保存する。描画のたびに抽選しない。
- 音声の切り替えは場面イベントとキャッシュで連携する。ボタン入力からBGM開始まで不要な待機を挟まない。
- デバッグのフラグ参照はオプショナル。通常セーブを変更せず、scriptを外しても本編が動くようにする。

## CSSの優先順位

読み込み順は`index.html`を参照する。`style.css`には基本形と過去の画面調整があり、`battle-feedback.css`、`battle-skin.css`などで現在の表示を上書きしている。今回の整形では順序や重複ルールを維持しているため、統合する場合はスマホの縦横画面と演出中の表示を比較する。

## コメントの方針

処理名の言い換えよりも、保存互換性・非同期処理の中断・計算の前提・ほかの画面との連携を書く。不要なコードを大量にコメントアウトして残すより、履歴とCHANGELOGで変更の理由を追えるようにする。

HTMLテンプレートの内部は、空白による表示の変化を避けるため自動整形を無効にしている。長いテンプレートのUI分離は、整形とは別の変更で画面を比較しながら進める。

整形だけの変更と、ゲーム仕様を変える変更は分けて扱う。

## ポケモン画像

全1025種の通常アートの取得元、再生成方法、透過・容量検査と権利表記は
[docs/pokemon-art.md](docs/pokemon-art.md) を参照する。
通常プレイ中にPokéAPIへの問い合わせは行わない。

## ポケモンの表示データ

名前・タイプ・説明は [docs/pokemon-data.md](docs/pokemon-data.md) を参照する。
シートを修正したらローカルJSONを更新し、`npm run data:generate`と`npm test`を実行する。
名前・タイプの照合エラーを無視して参照データを書き換えない。

## 図鑑の音と自作曲

再生成・場面切替・読み上げとの音量調整は [docs/retro-audio.md](docs/retro-audio.md) を参照する。
`npm run music:generate` はffmpegを使用する開発専用コマンド。

## トレーナー編成と連戦

編集元・再生成・セーブ移行・報酬確定の境界は [docs/trainer-battles.md](docs/trainer-battles.md) を参照する。
候補は `data/trainer-rosters.json` の全国図鑑番号で管理し、`npm run trainers:generate` と `npm test` で検査する。
連戦の途中でバッジ・報酬・マップ進行を確定しない。

## タイプ相性

出典・再生成・パズルへの適用範囲は [docs/type-effectiveness.md](docs/type-effectiveness.md) を参照する。
`npm run types:generate`で属性順を変換し、`npm test`で単体・複合・無効を検査する。
サファリのなかよし量へ戦闘用の相性を掛けない。
