# ゲームSE

game-sfx.jsでWeb Audioの音色・音量・回転ループ・同時発音数を管理。外部音源・ライブラリは不要。マスター音量0.30、サイコロ専用バス1.9倍、最大40音、連打は35〜75msの間隔制限。コンプレッサーを通して音の重なりを抑える。BGMとは別で、既存サウンド設定に連動。

サイコロ：hold中は66ms間隔の4音色循環の三角波・短い矩形波・硬いクリック、throw後は55msから徐々に間隔を増やす。着地でループ停止、着地音→出目確定3音。resetDicePresentation・キャンセル・音声OFF・画面離脱で必ず停止する。ゲーム用Math.randomは消費せず、ノイズ素材だけ独立した固定シードを使用。

ほか：マス移動、メニュー開閉/選択/決定、宝玉破砕、チャージ、溜め/発射/ヒット、ボール投球/接触/3回の揺れ/成否、バッジ獲得、マップ到着。既存tone()も同じエンジンへ統合。音声ノードは終了時に切断。

PokekoroSfx.play(name,value)、startRoll(mode)、stopRoll()、stopAll()を呼ぶ。CONFIGで調整。サファリは通常攻撃のSEを発火しない。実機の音量・音色は端末で聴いて追い込む。

## 0.9.2
BGM and SE/cry have independent persisted 0–100% sliders (default BGM 75%, SE 100%). Battle effects use a 2.6× bus before the existing compressor. Combo pitch climbs by semitones (capped at 12). A two-second layered charge rises continuously, followed by launch and impact. Attack focus lowers map BGM to 55% without pausing; impact, retreat and battle reset restore it. Reduced motion uses a shorter charge and static visual feedback.

## 0.9.2.13
Battle combo milestones (3/5/8), charge milestones (100%/160%), four attack strengths, and knockout have distinct cues. Continuous charge grows in pitch AND gain over its two-second duration. Existing independent SE/BGM controls apply. BattleFX owns and clears presentation timers and particles on battle reset/exit. No gameplay RNG is consumed by presentation.
