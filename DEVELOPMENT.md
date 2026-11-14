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
| `pokedex.js` / `pokedex-filters.js` / `game-menu.js` | 図鑑・入れ替え候補、50音/タイプ検索、メニュー |
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

## 図鑑・パーティーの検索

`pokedex-filters.js`は名前の正規化・前方一致・主副タイプ・所持/遭遇の条件を扱う純粋な処理。
`pokedex.js`は50音パネルとタイプパネル、件数とページ、選択操作を扱う。
名前・タイプはAND条件。濁点・半濁点・小文字は対応する清音・通常文字と同じ検索扱いにし、
入力表示の文字自体は保持する。長音「ー」は別の文字として残す。
図鑑は条件なしの場合に未遭遇の番号欄を保持し、条件ありでは遭遇済みだけを検索する。
パーティー候補は常に所持種のみ。検索結果から未所持の名前・タイプを漏らさない。
図鑑/入れ替えの条件は別のメモリに持ち、セーブ形式には追加しない。
`tests/pokedex-filters.cjs`で名前・副属性・未遭遇・所持限定の境界を検証する。

## トレーナー連戦の見せ方

`trainer-battle.js`の`TRAINER_PRESENTATION`は撃破後の待ち・交代台詞・送球だけの時間設定。
HP・レベル・パズルの制限時間は従来の`data/trainer-rosters.json`から取得し、混同しない。
同じ`trainerRosterMarkup`を戦闘・登場・全員撃破の結果へ使用する。
HPが0になった現在の相手もグレーにし、進行は`series.index`で別途管理する。
継続戦の開始は送球後の明示ボタンから既存カウントダウンへ入る。
途中の撃破は勝利BGM・報酬を発生させず、最後だけ従来の勝利イベントを送る。
非同期待機の後は`battleEpoch`を確認し、撤退・デバッグ操作後の古い演出を破棄する。

## 10秒ターンとゲージ技

`battle-turn-rules.js`はDOMを使わない戦闘ルール、`battle-turns.js`は画面と非同期進行、
`battle-turns.css`は戦闘中の仲間と合間の技メニューを担当する。
詳しくは[ターン戦闘](docs/battle-turns.md)を参照。

## 種族値の取り込みと計算

`npm run stats:generate`と`npm run stats:check`で固定版CSVから6項目を生成・検証する。
`pokemon-stats.generated.js`を`pokemon-data.js`より前に読み込む。
`pokemon-battle-stats.js`が通常攻撃・技・相手HP・ゲージ速度の変換を共有する。
仕様・出典・計算式は[種族値の反映](docs/pokemon-battle-stats.md)を参照。

## 個別技

`data/pokemon-skills.json`が代表技割当と能力の編集元。`npm run skills:generate`と
`npm run skills:check`で検査・生成し、`pokemon-skill-rules.js`が判定と発動を共有する。
仕様とテスト範囲は[個別技](docs/pokemon-skills.md)を参照。
