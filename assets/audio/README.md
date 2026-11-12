title-opening.mp3：ユーザー提供「初代ポケモンBGM～オープニング～-cut-1794420381340.mp3」を原音のまま配置。105.768秒。パス・音量はtitle-config.jsのaudio、再生制御はtitle.jsで管理。

munchlax-cry.mp3：ユーザー提供「ゴンベ鳴き声 - 鳴き声channel.mp3」を原音のまま配置。2.088秒。冒険スタート時に歩行演出と同時再生する。

map-adventure.mp3：本作用のオリジナル16小節ループ曲「A Little Adventure」。116 BPM、G major、約33秒。パルス風メロディ、アルペジオ、三角波風ベースと軽いノイズ打楽器。既存ゲーム曲の旋律は使用していない。生成スクリプトは scripts/compose-map-music.cjs。

## マップ別BGM（0.9.1.27）
既存曲の旋律を使用しないオリジナル16小節ループ。scripts/compose-map-themes.cjsで再生成可能。
- map-gym.mp3：144BPM、短調・細かいリズム。8ジム。
- map-cave.mp3：72BPM、低音・間を置く旋律。おつきみやま、ディグダのあな、イワヤマトンネル、ふたごじま、ハナダの洞窟。
- map-hideout.mp3：120BPM、短調の反復。アジト、シルフ、タワー、やしき。
- map-league.mp3：152BPM、緊張感のある明るい旋律。チャンピオンロード・四天王。
- map-water.mp3：88BPM、打楽器なしの穏やかな旋律。サントアンヌ号・虹の雲。
- その他は従来のmap-adventure.mp3。サファリもこちら。
割り当てはmap-music-config.js、音量はMAP_AUDIO.volume、制御はmap-audio.js。単一audio要素を再利用し、同じテーマ内のマップ移動では先頭に戻さない。曲変更時に音量を下げ、再生開始時に0.25秒で戻す。読み込み失敗時は既存曲へフォールバック。
