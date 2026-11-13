# 冒険マップの素材

`originals/player.jpg` はユーザー提供の元画像です。`player.webp` は外縁からつながる白い背景だけを透過し、余白を除いて無損失WebPで保存したものです。主人公の絵柄・色は描き直していません。

`app.js` の `MAP_ASSETS.player` が画像パスを管理します。`map.css` で全身を表示し、マスへの接地と現在地ラベルを調整しています。タイトルのキャラクター素材には影響しません。

## island.webp
タイトル素材とは独立した、新規生成の浮島背景（1080 × 1440、WebP）。正方形の map-scene に上揃えで表示し、背景と道・マスを同一座標で拡縮する。道やキャラクターは画像に含めず app.js 側に配置。背景差し替え時は草地の境界と routePoints の対応を確認する。

## forest.webp
トキワの森をイメージした新規生成の森背景。1080 × 1080 の正方形 WebP。空・崖のない地面と外周の樹木で構成し、道やマスは app.js で描画。MAP_ASSETS.forest で管理。旧 island.webp は未使用の旧素材として保持。

## viridian-trainer.webp
ユーザー提示のグリッド入り画像を画像編集ツールで整形し、細い格子を除去・外側を透過したトキワの森専用トレーナーアイコン。128×128・可逆WebP。原画像ファイルは今回未取得。MAPS.viridian.trainerIcon で指定し、未指定マップは標準SVGを使用。

## grass.webp
新規生成の共通草むらドット絵。128×128の透過可逆WebP。野生マス・凡例・遭遇時の草むらで共用。

## viridian-boss.webp / viridian-boss-icon.webp
ユーザー提示のむしとりしょうねん画像を背景透過として画像編集ツールで整形した登場素材と、顔付近を切り出したマップ用アイコン。原画像ファイルは未取得。MAPS.viridian.boss で管理。手持ちはユーザー承認済みの既存カメックス（id:9）。

## meadow.webp
仮の第2エリア用に新規生成した草原背景。正方形1080pxのWebP。正式な次マップの素材が決まったらMAPS.meadowの背景・ボスとともに差し替える。

## pokemon-center.webp
ユーザー提示の建物画像を透過背景のアイコンとして画像編集ツールで整形。160px可逆WebP。全マップ共通の出発地点に使用。

## placeholders/
カントー編の差し替え用仮背景。SVGの床・外壁・色で洞窟、船、アジト、塔、ジムなどを区別。ユーザー素材到着後は各MAPSエントリのbackgroundを差し替える。正式素材と区別するため専用ディレクトリに配置。

## pewter-gym.webp
ユーザー提供のニビジム背景。元の1280×1169を維持してWebP化。原本はoriginals/pewter-gym.jpg。MAPS["pewter-gym"]のaspectRatioで画像の比率を維持し、routeInsetで道とマスを岩壁の内側へ配置する。描き直し・トリミングは行っていない。

## mt-moon.webp
ユーザー提供のおつきみやま背景。原本はoriginals/mt-moon.jpg。元の比率・全体構図を維持してWebP化し、MAPSのaspectRatio・routeInsetで外壁の内側にルートを配置。

## cerulean-gym.webp
ユーザー提供のハナダジム背景。原本はoriginals/cerulean-gym.jpg。全体構図・縦横比を維持してWebP化。MAPSのaspectRatio・routeInsetでルートを外壁内側へ配置。

## cerulean-city.webp
ユーザー提供のハナダシティ背景。1254×1254の構図を維持してWebP化。原本はoriginals/cerulean-city.jpg。aspectRatio:1、routeInset:{x:4,y:4,scaleX:.92,scaleY:.92}で外壁内に配置。

## item-ball.png
ユーザー提供の方眼付きドット絵を元に、方眼と外側の白地を除いた透過アイコン。原本はoriginals/item-ball.jpg。アイテムマスと凡例専用。

## ss-anne.webp
ユーザー提供のサントアンヌ号背景。1254×1254を維持してWebP化。原本はoriginals/ss-anne.jpg。専用のroutePointsで桟橋からスタートし、船の外周を右回りして中央へ入る15マスの渦巻きルートを配置。

## vermilion-gym.webp
ユーザー提供のクチバジム背景。1254×1254の構図を維持してWebP化。原本はoriginals/vermilion-gym.jpg。専用routePointsで入口から巡り、奥中央のマチスへ到達する15マスを配置。

## rainbow-cloud.webp
ユーザー提供の虹の雲背景。1254×1254の全体構図を維持してWebP化。原本はoriginals/rainbow-cloud.jpg。既存のoutdoorルートを使用し、四隅の星座・バッグを残して表示。
