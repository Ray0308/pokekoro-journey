# 開発引き継ぎガイド

更新日: 2026-11-21。アプリの確認済み公開版: **0.9.3.9**。

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

2026-11-21追加承認: ユーザー「4はとりまOK」で後半マップの完成確認をひとまず承認。以前の個別確認待ちの記述より優先し、ベータで問題が見つかった箇所のみ対応する。現在の雲もデザイン上そのまま正式採用し、placeholdersというパス名だけを理由に差し替えタスクへ戻さない。

0.9.2.108: 再訪クリア後はスタート強制戻しを廃止し、次マップ/元の冒険の2択。選択待ちはrevisitClearMapIdで保存。次へ進んでもmapReturnは保持し、再訪中の最終→森でtourを増やさない。以前の再訪完了→位置0の記述より優先。サファリ中断と捕獲/仲間確認の違いを維持する。

0.9.2.109: 殿堂入りはhall-of-fame-rules.js / hall-of-fame.js / hall-of-fame.css。チャンピオン最終勝利で回数/参加編成を保存し、報酬→記念→博士祝福→依頼導入→次移動。pending段階を保存して重複付与せず再開。旧クリアから推測記録を追加しない。履歴50件と合計回数は別。再訪の行き先2択・通常/デバッグ保存を維持。ミッションマス/捕獲補正/追加の再戦強化は次段階で、今回の実装済みと混同しない。

0.9.2.110: 調査依頼はresearch-rules.js / research.js / research.css。候補は固定species CSVをscripts/build-research-data.cjsで生成（research-data.generated.jsを直接編集しない）。殿堂入り導入後のみ、通常マップ既存1マスを変更、15マス維持。受諾から5回・出目±1一度・最終回到着優先。pendingに出目と開始位置を保存し、リロードで期限や遭遇を再抽選しない。現地移動はmapReturnを維持。researchMissionIdの戦闘は野生扱い、ボス報酬/殿堂記録を付与しない。捕獲補正/再戦強化は未実装の第3段階。

0.9.3: 殿堂入りボーナスはHallOfFameRules.captureBonus / leagueBonusが定義元。ballCatchChanceへstateを渡して捕獲＋1ポイント/回（上限10）を表示/投球で共有、各ボールの上限を先に超えさせない。初心者のサイレント補助は従来通り。リーグ5ボスのみ＋2レベル/回・HP倍率＋8％/回、10回上限。シリーズ生成時に適用、交代で再加算禁止。従来再戦レベル/レベル100上限/2連敗90％救済を維持。過去の未実装記述よりこの記録を優先。

0.9.3.1: 全体地図はkanto-map.js / kanto-map.css。KANTO_PLACESで30マップを原作地理の街/施設へ紐づける。地図の道路は移動経路を強制せず攻略順はMAP_ORDER維持。再訪は既存data-revisit委譲で未クリアへ移動禁止、mapReturnを維持。地図にない未実装マップを攻略順へ追加しない。

0.9.3.2: chooseMapEncounter(mapId, rng, owned)で地域別の通常野生抽選のみ捕獲済み重みを0.6倍。全捕獲/全未捕獲なら原比率を保持。pickEncounterIdはstate.ownedを渡す。生成データの重みを直接変えず、候補の除外も禁止。サファリ通常は対象、トレーナー/各ボス/虹/依頼固定遭遇は対象外。見た履歴や手持ちではなく所持IDを参照。

0.9.3.3: 図鑑生息地はpokemon-habitats.js / pokedex.js。mapEncounterWeightsを抽選と共有し、所持補正後の1遭遇あたり割合で通常の上位3を算出。特別遭遇は別表示、ミュウツー所持後は固定ミュウツーを案内しない。未遭遇/手持ち入れ替え画面では隠す。全体地図はPokekoroKanto.focusMapで表示だけ、実移動は両dialogを閉じた後のrevisitMapで従来制限を維持する。生息地計算で抽選やセーブを書き換えない。

0.9.3.4: 技の第一弾見直しはdocs/SKILL_ROLES_AUDIT.md。編集元data/pokemon-skills.jsonに20技/8匹変更、生成コマンド必須。任意bonusは攻撃chargeLowest/防御boost・chargeAllのみ、ビルダーで範囲制限。無効時は副効果/ゲージ消費なし、自己/ひんし/満タンへ配布禁止。強化は最大値（乗算しない）、弱い強化から強い技への更新を許可。role(id)は実データからUIへ共通表示。支援1合間1回・復活1戦闘1回・連戦持ち越しを維持。以後の技差別化は今回のベータ評価を見て追加する。

0.9.3.5: diceモードの5技はdata/pokemon-skills.jsonから生成。power＋出目×diceStepで倍率。PokemonSkillRules.useでinspect成功後だけ1回抽選、結果diceFace/multiplier/damageを固定。inspect/attackDamage/damageRangeは乱数を消費しない。UIはダメージ範囲、結果ダイス表示→攻撃を順番に実行、await後はepoch確認。マップサイコロ/依頼の回数に混ぜない。

0.9.3.6: criticalは出目5/6で1.3倍、riskyは1/2で外れ0・3〜6命中。対象はdata/pokemon-skills.json、生成必須。riskyの3技はpower24。useは検査成功後1回抽選してcritical/missedを固定、外れでもコスト/usedTurnを確定。battle-turnsは外れ時に命中FX/HP適用を呼ばず待機へ戻す。無効相性は失敗扱いで消費/抽選なし。範囲プレビューは乱数なし。

0.9.3.7: 図鑑こうげき横の「わざ ⓘ」はpokemonStrengthMarkup(mon,true)のみ。手持ちカードはbutton内なので既定では子buttonを作らない。pokemon-skill-infoは現行ルール由来の説明/コストを表示。map-audioのcanPlay除外とthemeへ生息地/技説明の2dialogを登録し、図鑑曲を継続。両dialogはmap-audio初期化前に生成してopen監視対象とする。消音と読み上げ終了時の音量復帰を維持。

0.9.3.8: ユーザー指定で依頼の±1調整を廃止。新規reserveはvalue=raw、chooseRollは画面を出さず保存値で続行。既存の確定済み途中移動のみ旧valueを保持し、再抽選/巻き戻ししない。HUDはactive/offerがある場合だけ、lastの終了案内を常設しない。図鑑ownershipはall/owned/missing。名前/タイプと併用、所持・未遭遇の秘匿を維持。partyとdexは別フィルター状態、pickerでは所有切替を隠す。過去の±1仕様の記載よりこのユーザー訂正を優先。

0.9.3.9: 技説明見切れはtutorial-visuals.css末尾で修正。heroのflex-growを止め、本文の子要素はshrink不可、footerは本文外固定。長い説明/対象一覧はturn-skill-body全体をスクロール。openSkillsでscrollTop=0。大きいカードで説明を押しつぶすスタイルへ戻さない。393×852も検証基準へ追加。
