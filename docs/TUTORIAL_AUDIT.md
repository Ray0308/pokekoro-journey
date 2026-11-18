---
title: ポケコロジャーニー チュートリアル現状調査
tags: [ポケコロジャーニー, チュートリアル, 現状調査, 引き継ぎ]
date: 2026-11-18
source_version: 0.9.2.51
status: 改修前の調査記録
---

# チュートリアル現状調査・大改造前の記録

調査日: 2026-11-18 / 対象ソース: **0.9.2.51**。

ユーザーは、この調査をもとにチュートリアルを大きく再設計する予定。本書は**改修前の現状記録**であり、新仕様・実装指示の確定稿ではない。今回行うのは調査結果の文書化のみ。ゲーム本体・セリフ・バランス・保存形式は変更しない。

- 確認済み: 現行コード・HTML・CSSの読み取りで確認した内容。
- 評価・改善案: 実装から考えられる課題や候補。実装済みではなく、プレイヤーテストの結果でもない。
- 未確認: PC・スマホ実機での通し操作、実機Safariの表示・音声・見切れ。
- 通常仕様は [SPECIFICATION.md](SPECIFICATION.md)、残作業は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)、判断履歴は [DECISIONS.md](DECISIONS.md) を参照。

## この調査以降の実装

2026-11-18、改訂指示に基づく体験型練習を新規初回経路version 3へローカル実装。詳細は [PRACTICAL_TUTORIAL.md](PRACTICAL_TUTORIAL.md)。以下は改修前の調査・行番号の記録であり、新しい実装の仕様書ではない。通常戦の汎用pause/resumeが実装された意味でもない。

## この記録以降の変更

2026-11-18、承認されたオーキド博士の会話・主人公名決定をローカル実装。詳細は [opening.md](opening.md) と [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)。以下の①〜⑦は**改修前の記録**として保持し、現行仕様と混同しない。博士の自己紹介・名前入力が「ない」とする記述は、この調査時点の状態を示す。

## ① ゲーム開始からの実際の進行フロー

| 順序 | 場面・処理 | 説明・操作 |
| --- | --- | --- |
| 1 | 起動演出→タイトル | 「タップしてね」 |
| 2 | タイトルをタップ／クリック | メニュー有効化・音声開始処理 |
| 3 | 「ぼうけんスタート」 | 鳴き声・サイコロ・出発演出後、本編へ |
| 4 | 初回判定 | 未完了なら保存された初回イベント段階から再開 |
| 5 | ゴンベとの出会い | おやつにつられて来たゴンベがなつく |
| 6 | オーキド研究所 | 会話と背景切り替え。研究所内の歩行操作なし |
| 7 | 御三家選択 | フシギダネ・ヒトカゲ・ゼニガメから選択→確定 |
| 8 | ニドラン♂貸与 | 同じマークを3個以上なぞって離す説明 |
| 9 | ピカチュウとの練習 | 遭遇→「バトルへ」→中央スタート→カウントダウン→10秒パズル |
| 10 | 練習判定 | パワー獲得で捕獲へ。獲得できなければ再練習 |
| 11 | 練習用ボール | ボタンで投球。100%捕獲成功 |
| 12 | 返却・図鑑授与 | 専用の会話・3匹登録演出 |
| 13 | 冒険開始確定 | ゴンベ・御三家・ピカチュウを編成し、通常ボール8個・スーパー2個を付与 |
| 14 | トキワの森 | サイコロ操作→自動移動→到着マスのイベント |

主人公の名前・性別・見た目設定、ライバル名設定、研究所でのライバルイベント・初戦はない。マップの自由歩行・移動先のマス選択もない。ニューゲームとロードは別ボタンではなく、同じ開始ボタンの後に保存状態で分岐する。

根拠: [title.js](../title.js) の `activateTitle()`・開始ボタン処理、[app.js](../app.js) の初期化・`title:start`・`rollDice()`・`drawRoute()`、[opening.js](../opening.js) の `show()`・開始リスナー、[opening-rules.js](../opening-rules.js) の `stages`。

## ② 現在のチュートリアル一覧

| 機能 | 実装状況・説明内容 | 表示タイミング／根拠 |
| --- | --- | --- |
| 基本操作 | 専用練習あり。同じマーク3個以上をなぞって離す | 初回。`opening.js: practice(), resolvePractice()` |
| 全体ルール | 任意の「旅のしおり」。旧仕様の説明が残る | タイトルのルール。`index.html: #guide` |
| マップ移動 | 「おして はなして ころがそう！」。出目で自動移動 | `app.js: render(), rollDice()` |
| マス選択 | 該当操作なし | `app.js: rollDice(), drawRoute()` |
| 野生との遭遇 | 草むら・シルエット・名前・「バトルへ」 | 遭遇時。`app.js: showEncounter()` |
| 戦闘 | 初回消去練習のみ。通常戦の複数ターン練習なし | `opening.js: practice()`、`battle-turns.js` |
| 技 | 仲間を押すと効果・ゲージ・条件・対象を表示。専用練習なし | 待機中。`battle-turns.js: openSkills(), render()` |
| 相性 | 敵タイプ・主副タイプ・消去結果を表示。案内の一部はCSS非表示 | `type-effectiveness.js`、`battle-turns.css` |
| 捕獲 | 初回100%。通常は成功率・残数付きボール選択 | `opening.js: capture()`、`app.js: endBattle(), catchMon()` |
| 手持ち | 入れ替え・空き枠・編成エラー・属性数・倍率の表示 | `app.js: renderDex(), togglePokemonParty()`、`pokedex.js: openPicker()` |
| HP | 相手HP・レベル表示のみ。専用説明なし | `app.js: updateHP()` |
| ひんし・回復 | 「この戦闘では おやすみ」、敗北時の復帰説明。専用練習なし | `battle-turns.js: next()`、`app.js: endBattle()` |
| 状態異常 | 毒・まひ等の継続状態異常の処理・専用案内は調査範囲で確認できない | `battle-turn-rules.js`、`pokemon-skill-rules.js` |
| レベルアップ・進化 | 相手レベルは表示。経験値・所持個体のレベルアップ・進化処理は確認できない | `app.js`、`pokedex.js`、戦闘ルール |
| 交換所 | 所持数・交換比率・個数・不足・結果の説明 | `ball-exchange.js: renderRows(), update()` |
| ガンテツ | 属性ボール・タイプ一致で捕獲率上昇の案内 | `kurt-house.js: update(), openPicker()` |
| トレーナー | 手持ち数・順次登場・全員撃破後の勝利と報酬。専用練習なし | `trainer-battle.js`、`app.js: showBossEncounter(), endBattle()` |
| ジム・バッジ | ボス戦・獲得演出・次マップ。専用説明なし | `app.js: endBattle(), renderJourney()` |
| セーブ・ロード | 自動保存・起動時読込。専用説明なし | `app.js: 初期化, save()` |
| セーブ削除 | 確認・キャンセル・失敗メッセージ | `game-menu.js: 削除処理` |
| 図鑑 | 名前・タイプ検索、未遭遇表示、説明・技・種族値・読み上げ | `pokedex.js: showFilterPanel(), renderEntry(), read()` |
| リフレッシュ | 操作中のみ盤面再生成。時間停止なし。初回練習では非表示 | `app.js: syncPuzzleRefresh(), #puzzle-refresh.onclick` |
| サファリ | なかよしゲージ、倒さず仲良くなる案内。専用練習なし | `safari.js: configureSafariUI()` |

### 「旅のしおり」原文と相違

> ① サイコロで双六を進みます。  
> ② 30秒のパズルで攻撃パワーをためよう。  
> ③ 同じ属性を3個以上なぞって離すとパワーアップ。  
> ④ 2秒以内に次を消すとコンボ倍率アップ。  
> ⑤ 時間が終わったら一斉攻撃！ 倒すと捕獲チャンス。  
> ⑥ 交換所では、ボール5個を上のボール1個に交換できるよ。
>
> 弱点はダメージ2倍。編成していない属性でも小さなダメージを与えられます。ダブり捕獲は通常ボール2個に交換。トレーナー勝利でスーパーボールを獲得します。

確認済みの相違: 通常戦は10秒（サファリ30秒）。対応する生存仲間がいない属性は攻撃0。複合タイプの相性は掛け合わせるため常に2倍ではない。反撃・ひんし・技の説明もない。「冒険へ」は説明画面を閉じるだけで開始処理を呼ばない。

根拠: [index.html](../index.html) の `#guide`、[battle-turn-rules.js](../battle-turn-rules.js) の `config`、[party-rules.js](../party-rules.js) の `pokemonTypePower(), partyTypePower()`、[type-effectiveness.js](../type-effectiveness.js) の `pokemonTypeMultiplier()`。

## ③ オーキド博士イベントの詳細

### セリフ全文（改修前の原文）

ゴンベとの2場面の後、`lab` からオーキド登場。研究所は初回ダイアログの場面切り替えで、歩いて入るマップではない。下表は [opening-config.js](../opening-config.js) の `OPENING_STORY` から保存した原文。元ファイル上では暫定稿として扱われる。

| 段階 | 話者 | セリフ全文 |
| --- | --- | --- |
| `meet` | ゴンベ | あっ！ おやつの においに つられて、ゴンベが やってきた！ |
| `friend` | ゴンベ | もぐもぐ……。すっかり なついたみたい！ いっしょに オーキドけんきゅうじょへ いこう。 |
| `lab` | オーキド | よく きたのう！ ゴンベも きみと ぼうけんに でかけたいようじゃ。 |
| `world` | オーキド | ポケモンと ちからを あわせて、サイコロで すすむ ぼうけんじゃ！ まずは もうひとり なかまを えらぼう。 |
| `choose` | オーキド | この 3びきから、いっしょに ぼうけんする ポケモンを えらぶんじゃ。 |
| `chosen` | オーキド | いい パートナーが きまったのう！ つぎは ポケモンの つかまえかたを れんしゅうしよう。 |
| `borrow` | オーキド | れんしゅうには わしの ニドラン♂を かそう。おなじ マークを 3ついじょう なぞって、はなすんじゃ。 |
| `practice` | オーキド | やせいの ピカチュウじゃ！ 10びょうの パズルで ちからを ためよう。なんどでも れんしゅうできるぞ。 |
| `throw` | オーキド | よし！ つぎは れんしゅうようボールを なげよう。こんかいは かならず つかまるぞ！ |
| `caught` | オーキド | やった！ ピカチュウが なかまに なった！ じょうずに できたのう。 |
| `return` | オーキド | ニドラン♂と れんしゅうどうぐは あずかるぞ。ぼうけんようの ボールも わたしておこう。 |
| `dex` | オーキド | そして これが ポケモンずかん！ であった ポケモンを しらべられる きかいじゃ。きみに たくそう！ |
| `register` | ポケモンずかん | ピッ！ 3びきの なかまを とうろくしました！ |
| `depart` | オーキド | モンスターボール 8こ、スーパーボール 2こも もったな！ なかまと トキワのもりへ しゅっぱつじゃ！ |

練習でパワーを獲得できなかった場合の追加セリフ（`opening.js: resolvePractice()`）:

> だいじょうぶ！ おなじ マークを 3ついじょう なぞって、ゆびを はなしてみよう。もういちど れんしゅうじゃ！

成功時の演出表示（会話設定とは別）:

> ニドラン♂の アタック！  
> じょうずに つなげたね！

### 発火・終了・御三家・練習

- 開始: `title:start` 時に `opening.stage !== 'complete'`、かつデバッグではない。`opening.js: pending(), show()`。
- イベント中: `busy = true` とモーダル表示で本編操作を制限。
- 選択: 図鑑No.1・4・7。名前・画像・タイプを表示。カード選択時に `starterId` を保存し、確定前は選び直せる。この時点では通常の所持・編成に加えない。
- 練習: `openBattle(false, false, null, true)` を使用。相手25（ピカチュウ）・HP1、貸与32（ニドラン♂）のどく1属性盤面。`damage > 0` で成功。通常の反撃・技ゲージ処理を使わない。
- 捕獲: `capture()` から共通 `playCaptureThrow()` を呼ぶ。通常の抽選・ボール消費を通さず成功として進行する。
- 終了: `depart` の「ぼうけん スタート！」→`finish()`→`OpeningRules.complete()`。有効な御三家が必要。
- 実データ確定: 終了時に `[446, starterId, 25]` を編成し、所持・遭遇登録、通常8個・スーパー2個付与、`stage='complete'`・`pokedexReceived=true`。図鑑授与・捕獲・登録の会話より後に一括確定する。
- 完了済みへの再付与は `complete()` のガードで防ぐ。貸与ニドラン♂は通常所持品に混ぜない。
- 図鑑授与は専用演出であり、実際の図鑑検索・編成操作の練習ではない。

根拠: [opening.js](../opening.js) の `show(), practice(), resolvePractice(), capture(), finish()`、[opening-rules.js](../opening-rules.js) の `complete()`、[app.js](../app.js) の `openBattle()`、[battle-turns.js](../battle-turns.js) の `init()`。

### ライバル・再開・スキップ

研究所にライバルの会話・初戦はない。通常進行にはサントアンヌ号・チャンピオン戦のライバル編成がある。ライバル御三家は `normalizeTrainerState()` でランダムに確定・保存し、初回に選ぶ御三家の有利不利とは連動しない。

| 保存・操作状態 | 動作 |
| --- | --- |
| 新規 | `meet` から |
| 途中再読込 | 保存済み段階から。盤面・残り秒数・演出途中は復元しない |
| 練習中の再読込／撤退 | `practice` 会話へ戻り再練習 |
| 完了済み | 初回イベントなし |
| 有効な旧セーブで初回情報なし | 完了扱い。イベント・初回報酬を強制適用しない |
| デバッグ | 初回イベントを開始しない |
| スキップ・イベントだけ再受講 | 専用機能なし |
| セーブ削除 | 通常・デバッグ冒険データを削除し再読込。音設定は維持 |

根拠: [trainer-rules.js](../trainer-rules.js) の `normalizeTrainerState(), createTrainerEncounter()`、[data/trainer-rosters.json](../data/trainer-rosters.json) の `rival`、`opening-rules.js: normalize()`、`opening.js: cancelPractice()`、[game-menu.js](../game-menu.js) の削除処理。

## ④ PC・スマホの操作方法

| 操作 | PC | スマホ |
| --- | --- | --- |
| タイトル・通常ボタン・会話送り | クリック | タップ |
| 御三家 | カード→確定 | 同じ |
| サイコロ | 押して離す | 押して離す |
| パズル | 同属性をドラッグして離す | 指でなぞって離す |
| 技 | 待機中の仲間→説明・対象→使用 | 同じ |
| 捕獲・編成・検索 | 各ボタン・カード・パネル | 同じ |

- 盤面は上下左右・斜めに接続可能。直前に戻ると経路を1個戻せる。同じマスの再使用は不可。根拠: `app.js: cell(), canvas.onpointerdown/onpointermove/onpointerup`。
- 標準ボタンのキーボード操作は使えるが、キーボードだけでパズルを操作する専用処理はない。メニューには上下矢印・Home・End操作がある。根拠: `app.js: rollButton.onclick`、`game-menu.js: keydown`。
- 会話は話者・本文を一括表示。文字送り演出、本文タップで次へ進む機能はない。専用ボタンで送る。根拠: `opening.js: show()`。
- 初回会話・戦闘・結果はモーダル。Escapeによる閉鎖を禁止する。根拠: `opening.js` の `cancel`、`app.js` の `#battle/#result` の `cancel`。
- 練習終了はタイマー・入力・演出を停止して会話へ戻る。技説明を閉じると待機へ戻る。初回完了はマップ再描画・サイコロへフォーカス。根拠: `opening.js: stopPractice(), finish()`、`battle-turns.js: closeSkills()`。
- ルールを閉じると元画面へ。ゲーム内メニューにはルール入口がない。根拠: `index.html: #guide`、`game-menu.js`。

### コードにあるが表示されない説明

`opening.js: practice()` や `app.js` は以下を設定するが、`battle-turns.css` の `.puzzle-instruction / .weakness-tip / #charge-hint { display: none; }` により非表示。

- 「かりた ニドラン♂と れんしゅうしよう！」
- 「どくのマークを 3ついじょう なぞって、はなそう！」
- なぞり中の「あと○つ」「はなして チャージ！」
- 相性のおすすめ案内

スタート待機中は `#ready-overlay > strong / span` も非表示になり、「3つつないで」「○秒後にまとめてアタック」も見えない。これらを表示済みチュートリアルとして数えない。根拠: [battle-turns.css](../battle-turns.css) の説明非表示・`:has(#start:not([hidden]))` 指定。

PC・スマホ実機の表示、Safariの音声開始・見切れ・操作感は今回未確認。

## ⑤ チュートリアルの制御構造

```js
opening: {
  version: 1,
  stage: 'meet',
  starterId: null
}
// 完了時に pokedexReceived: true を追加
```

- 通常保存キー `pokekoro-v1`、デバッグは別の `pokekoro-debug-v1`。段階移行・御三家選択・完了・通常再描画等で保存。
- `normalize(state, existing)` が旧セーブを補正。不正な御三家なら `null` とし、途中段階では選択へ戻す。
- `pokedexReceived` は保存されるが、調査範囲では図鑑利用制限への参照を確認できない。
- 戦闘の盤面・残り時間、機能別の「学習済み」は保存しない。

| 役割 | 関数・データ |
| --- | --- |
| 台詞 | `OPENING_STORY` |
| 段階・初期化・完了 | `OpeningRules.stages, fresh(), normalize(), complete()` |
| 会話・進行 | `opening.js: show(), move(), next()`（内部関数） |
| 練習 | 共通 `openBattle()` と `PokekoroOpening.resolvePractice()/cancelPractice()` |
| 捕獲演出 | 共通 `playCaptureThrow()` |
| 本編復帰 | `finish() → save() → render()` |
| 場面連携 | `title:start`, `opening:scene`, `battle:audiofocus` |

公開APIは `PokekoroOpening.pending(), canPractice(), resolvePractice(), cancelPractice()`。汎用の会話呼び出しAPIではない。通常戦の分岐・報酬・描画・音声と接続しているため、セリフ追加だけでは操作練習の条件制御にならない。

根拠: [opening-rules.js](../opening-rules.js)、[opening.js](../opening.js)、[app.js](../app.js) の保存読込・`save()`・`openBattle()`。

## ⑥ 現状の問題点・不足している説明

次表の事実はコード確認済み。影響は再設計のための評価で、実測結果ではない。

| 事実 | 影響の評価 |
| --- | --- |
| しおりが30秒・未編成でも攻撃と説明 | 現行挙動を誤解するおそれ |
| 練習中の操作案内がCSSで非表示 | 直前の会話を覚えていないと助けが少ない |
| 練習は1属性・HP1・反撃なし | 通常戦との間で学習内容に差がある |
| 技の入口・ゲージ条件の専用練習なし | 仲間が技ボタンであることや蓄積条件に気づきにくい |
| 反撃・ひんしは発生時の表示中心 | 失敗前にルールを知る場面がない |
| 3属性以上の編成条件 | 条件違反時に初めて説明される |
| 主副タイプ記号の配置説明なし | 左上・右下の意味が分かりにくい可能性 |
| 捕獲後に編成できる旨は表示、操作練習なし | 新しい仲間を使う導線が弱い |
| 図鑑授与は専用演出のみ | 実際の検索・技確認を学ばない |
| リフレッシュは初回練習非表示 | 詰み対処・時間停止しない仕様を学ばない |
| 自動保存・再開の説明なし | 保存方法を探す可能性 |
| ルール入口はタイトル、再受講なし | 冒険中の説明再確認がしにくい |

根拠は②〜⑤の対応ファイル・関数。レベル・難易度・バランス調整は対象外。

### 既存構造を使える改善候補（未実装・未確定）

しおりの訂正、初回会話の段階追加、既存の技・図鑑・編成・交換画面への案内、自動保存の説明、盤面を隠さない説明位置の検討。会話・パズル・投球の既存部品を使うことは可能。

### 新しい仕組みが必要な候補（未実装・未確定）

機能別の初回発火・既読管理、特定操作の完了待ち、対象強調・操作制限、スキップ・再受講・説明履歴、複数タイプ・技・反撃を段階的に体験する練習条件。

### 次の作業への引き継ぎ

1. 本書を改修前の比較資料として残し、ChatGPT側で新しい体験順序・セリフ・到達条件を設計する。
2. 再設計案の確定後に、変更対象と保存状態の移行方針を整理する。現時点で新しい段階・報酬・強制操作は決まっていない。
3. 実装は小さな工程に分け、通常戦・途中再開・旧セーブ・貸与品分離・二重報酬防止を確認する。
4. PCクリックとスマホtap、開始前ぼかし、カウントダウン、説明が盤面を隠さないことを確認する。

## ⑦ 関連ファイル・関数一覧

| ファイル | 関数・定義／役割 |
| --- | --- |
| [index.html](../index.html) | `#guide`・タイトル・各モーダル |
| [title.js](../title.js) | `activateTitle(), reset()`・開始ボタン |
| [opening-config.js](../opening-config.js) | `OPENING_STORY`・原文 |
| [opening-rules.js](../opening-rules.js) | `fresh(), normalize(), complete(), stages` |
| [opening.js](../opening.js) | `show(), practice(), resolvePractice(), capture(), finish()` |
| [app.js](../app.js) | 保存読込・`save(), render(), rollDice(), openBattle(), updateHP(), showEncounter(), showBossEncounter(), endBattle(), playCaptureThrow(), catchMon(), done(), syncPuzzleRefresh()`・Pointer Events |
| [battle-turns.js](../battle-turns.js) | `init(), render(), prepare(), openSkills(), closeSkills(), resolve(), next()` |
| [battle-turn-rules.js](../battle-turn-rules.js) | `create(), charge(), retaliate(), canContinue()` |
| [pokemon-skill-rules.js](../pokemon-skill-rules.js) | `inspect(), use(), description()` |
| [party-rules.js](../party-rules.js) | `partyTypeError(), partyTypePower(), refreshedPuzzle()` |
| [type-effectiveness.js](../type-effectiveness.js) | `pokemonTypeMultiplier(), bestTypeMatchup()` |
| [pokedex.js](../pokedex.js) | `showFilterPanel(), renderEntry(), openPicker(), replaceWith(), read()` |
| [game-menu.js](../game-menu.js) | メニュー・`showBag()`・削除処理 |
| [ball-exchange.js](../ball-exchange.js) | `update(), renderRows()` |
| [kurt-house.js](../kurt-house.js) | `update(), openPicker()` |
| [safari.js](../safari.js) | `configureSafariUI(), resolveSafari()` |
| [trainer-rules.js](../trainer-rules.js) | `normalizeTrainerState(), createTrainerEncounter()` |
| [trainer-battle.js](../trainer-battle.js) | 連戦・次の相手への進行 |
| [data/trainer-rosters.json](../data/trainer-rosters.json) | `rival` 設定 |
| [battle-turns.css](../battle-turns.css) | 説明文・待機中テキストの非表示 |
| [battle-layout.css](../battle-layout.css) | 待機ぼかし・中央スタート・タイプ配置 |

## 文書化の検証

- セリフ14段階を `opening-config.js` の原文と照合。
- 相対リンクの参照先を検査。
- 今回は文書のみ更新。ゲーム本体・データ・画像・版番号・公開先は変更しない。
- 実機操作テストは未実施。過去の機能検証記録を今回実施した検証として扱わない。


## 0.9.2.53公開の追記

2026-11-18、博士会話・主人公名決定・体験型練習を公開。過去の調査・設計判断本文は当時の記録として残す。現行の進捗は [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md)、実践課題は [PRACTICAL_TUTORIAL.md](PRACTICAL_TUTORIAL.md) を参照する。
