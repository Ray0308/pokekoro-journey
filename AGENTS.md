# 開発引き継ぎガイド

更新日: 2026-11-21。アプリの確認済み公開版: **0.9.2.102**。

## 最初に読む資料

最新の未対応・全マップ承認状況は [REMAINING_TASKS.md](docs/REMAINING_TASKS.md)。素材採用・公開と、完成配置へのユーザーOKを区別する。

1. [確定仕様](docs/SPECIFICATION.md)
2. [現在の実装状況・残作業](docs/DEVELOPMENT_STATUS.md)
3. [設計判断と変更理由](docs/DECISIONS.md)
4. [全変更履歴](CHANGELOG.md)
5. [チュートリアル現状調査・改修前記録](docs/TUTORIAL_AUDIT.md)（再設計時に参照）
6. [ユーザー視点の点検・修正と残候補](docs/PLAYER_EXPERIENCE_AUDIT.md)

実際の動作の根拠は現行コードとテスト。資料同士が矛盾する場合は変更時期と実装を調べ、古い案を復活させない。特に README.md / CAMPAIGN.md / POKEDEX.md と一部の機能別資料には旧仕様が残る。既知の相違は DEVELOPMENT_STATUS.md に列挙している。

## プロジェクトと作業環境

- スマートフォン中心の日本語Webゲーム。公開先: https://ray0308.github.io/pokekoro-journey/
- リポジトリ: https://github.com/Ray0308/pokekoro-journey 、既存の公開ブランチは main。
- 静的HTML/CSSと通常のscript。ES modulesやビルド用フレームワークは導入していない。index.html の読み込み順でグローバル定義を共有する。
- この引き継ぎ時のローカル配置は `/workspace/pokekoro-journey`。環境により `.git` がないミラーの場合がある。git checkout だと決めつけず確認する。
- 作業開始時に現在の変更を確認し、前の作業を破棄しない。中断された作業は未完了箇所から再開する。
- 一度に大規模改修をせず、接続・画面・動作を小さな工程で確認する。無関係なリファクタリングや難易度変更を混ぜない。
- ユーザーは子供向けの楽しさと操作性を重視する。派手さを足す場合も盤面や指の移動を隠さない。長い説明を常設しない。

## 守るべき仕様

- 現行盤面は **6列×5段・30マス**。内部描画は420×350、各ブロックは正方形。`PUZZLE_LAYOUT` が寸法の定義元。
- 通常バトルは10秒のパズル単位。固定の最大6ターン制ではない。防御・復活等で生き残れる限り継続し、全滅で敗北する。
- ひんしの仲間にしか対応しない属性も消去・補充できる。攻撃とゲージ加算だけ0になる。相性無効とひんし由来の0ダメージは区別する。
- 技は待機中に仲間をタップして任意で開く。撃破後は次の敵を先に出し、待機中の攻撃技がその敵に届くようにする。
- 各敵の最初のパズルは3・2・1・GO。同じ敵への次ターンはGO。カウントダウン中にパズル時間を減らさない。
- パズル中に大きなコンボ・相性ポップアップを重ねたり、盤面を揺らしたりしない。
- 開始前は色が透けるぼかし。白いベタ塗りに戻さない。スタートは盤面中央、タップ後に解除。
- 相手交代で技ゲージ・ひんし・防御/強化・復活権を失わない。トレーナー戦の報酬と勝利曲は最後の相手を倒したときだけ確定する。
- 既存セーブを初期化しない。初回オープニング・初回報酬は旧セーブへ強制適用しない。
- 図鑑番号をIDとして使う。名前でデータを結合しない。一般トレーナーを野生の抽選プールへ戻さない。編成内の重複は禁止。

## 編集元と生成物

| 対象                 | 編集元・担当                                                                            |
| -------------------- | --------------------------------------------------------------------------------------- |
| マップ・ルート・背景 | map-config.js、map.css、app.js のルート描画                                             |
| 名前・タイプ・説明   | data/pokemon.json、参照・訂正JSON、scripts/import-pokemon-data.cjs                      |
| 種族値               | data/reference/pokemon-stats.csv、scripts/import-pokemon-stats.cjs                      |
| トレーナー編成       | data/trainer-rosters.json、scripts/build-trainer-data.cjs                               |
| 技                   | data/pokemon-skills.json、scripts/build-pokemon-skills.cjs                              |
| 相性                 | data/type-efficacy.source.csv、data/type-names.source.csv、scripts/build-type-chart.cjs |
| 戦闘ルール / UI      | battle-turn-rules.js、pokemon-skill-rules.js / battle-turns.js                          |
| 現行戦闘レイアウト   | battle-layout.css（既存スキンの後に読み込む）                                           |
| 初回案内・台詞       | opening-rules.js、opening.js、opening-config.js                                         |
| BGM / SE             | map-music-config.js、map-audio.js / game-sfx.js、audio-settings.js                      |

`*.generated.js` を直接編集しない。元データと対応する生成コマンドを使う。取得元・固定コミット・ハッシュ・訂正履歴を失わない。

## 保存・非同期処理・タッチ操作

- 通常セーブは `pokekoro-v1`、デバッグは `pokekoro-debug-v1`。音量は `pokekoro-audio-mix-v1`、サウンド等は `pokekoro-title-v1`。
- `state.party` / `state.owned` は永続状態。戦闘のひんし・技ゲージは `battle.combat` / `series.combat`。貸与ポケモンを通常の所持品へ混ぜない。
- 非同期の待機後は `battleEpoch`、必要ならターンも照合する。遅れて届く演出で新しい戦闘やパワー表示を書き換えない。
- 座標はcanvasの表示矩形から内部420×350へ変換する。落下・補充・エフェクトも5段に合わせる。36マスの固定値を増やさない。
- スタートと技UIは盤面のtouchstart抑止から除外する。マウスclickだけで確認を終えず、tapも確認する。
- データ削除では `localStorage.clear()` を使わず対象キーだけ削除する。確認画面のキャンセル・失敗時の扱いと設定維持を保つ。

## 素材変更

2026-11-20追加承認: 承認範囲はユーザー訂正によりトキワの森〜ポケモンタワーの14マップ。サファリは修正対象。0.9.2.79で最新の一本道素材を反映、完成配置の最終OKは別途確認。出現候補等の情報設定・ベータ検証は別タスク。

- 提供画像の構図と比率を維持する。原本は `assets/map/originals/`、表示用はWebP等へ変換する。
- 背景だけでなく、15マス・曲がり角・スタート・ボス・戦闘背景・スマホでの見切れを確認する。
- `routePoints` は15個のイベント座標、`routeVia` は道を曲げる描画専用点。補助点でイベントを増やさない。
- 置き換え時に同じURLの古い画像が残り得る場合は別ファイル名を使う。タマムシジムの現行画像は `celadon-gym-v2.webp`。
- 背景の道幅・接続・入口・ラベルの収まりに問題があれば、無理にマスを置いて完了扱いせず、公開前に具体的な問題をユーザーへ報告する。背景修正が必要か、配置調整だけで可能かを区別する。
- ユーザー指定の入口・ボス位置を優先する。編成や報酬を素材差し替えに混ぜて変更しない。

## 検証と公開

```sh
npm install
npm run check:syntax
npm run format:check
npm test
```

変更に適した検査を選ぶ。文章だけの変更はリンク・参照先・内容整合性を確認し、不要なゲーム全体テストを繰り返さない。ブラウザ確認はローカルHTTPサーバーを使う。現環境ではシステムChromiumとPlaywrightが使われてきたが、次の環境でも同じ配置とは限らない。

UI変更では390×664、320×568、844×390を基準に、必要に応じて実機Safariを確認する。戦闘変更では待機→tap開始→消去→技→相手交代→勝敗、既存セーブ、サファリ、必要なら初回練習を確認する。確認していない実機の保証はしない。

公開が作業範囲に含まれる場合は、差分を検証してから既存のGitHub Pagesへ反映する。Git Data APIを使う場合も現在のmainと変更前のファイルSHAを照合し、base treeへ対象ファイルだけを加える。期待する親SHA付きでブランチを更新し、force pushしない。公開処理の成功と公開先での表示を確認する。

アプリのリリース時は version.js、index.htmlのキャッシュクエリ、package.json / package-lock.json、CHANGELOG.md を合わせる。文書のみの更新でアプリ版をむやみに増やさない。

進捗は「作成」「検証」「公開」を区別して報告する。未公開の状態を完了と呼ばない。長い処理中も、判明したことと次の確認を短く伝える。

2026-11-20: ポケモンタワーはガタつきの修正依頼により0.9.2.82で経路を変更。前の一括OKを新経路の完成承認へ引き継がず、修正版確認待ち。

セキエイ高原5戦はユーザー合意で共通背景を正式採用（0.9.2.84）。個別背景作成を未対応タスクへ戻さない。

地域別出現の編集元はdata/map-encounter-rules.json。scripts/build-map-encounters.cjsで生成し、map-encounters.generated.jsとdocs/MAP_ENCOUNTERS.mdを直接編集しない。通常931種の出現先を失わず、虹の伝説・幻を通常へ混ぜない。

ミュウツー所持後のハナダ洞窟ボスは保存した別伝説へ交代（rainbow-config.jsの洞窟ルール）。固定ミュウツーへ戻さない。

初回version 5は研究所の模擬戦（mock-practice*.js）。選択御三家＋ゴンベで博士のピカチュウを相手に、同じ編成/ゲージを維持。旧必須の比較用交代・強制ひんし・使えない技押下・初回並べ替えを新規へ戻さない。v4のchosen/borrow/practiceのみv5へ移行。

初回案内を#map直下へ挿入しない（flex横並びで進行不能になる）。#map>.layout内へ置く。サイコロの検証ではtap成功だけでなく、事前に画面内の矩形とelementFromPointを確認し、自動スクロールで画面外の操作を代行していないことを確かめる。
