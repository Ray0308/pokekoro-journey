"""公式アートを取得・検査し、ゲーム用の透過画像と取得元一覧を生成する。

実行: python scripts/import-pokemon-art.py
Pillowは scripts/requirements-assets.txt から導入する。通常の起動・ビルドには不要。
取得元はコミットで固定し、再実行では検査済みのPNGキャッシュを再利用する。
"""

import base64
import concurrent.futures
import hashlib
import io
import json
from pathlib import Path
import time
import urllib.error
import urllib.request

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "c0542f7c51215d9672439012838c99f520596cbd"
SOURCE_BASE = (
    "https://raw.githubusercontent.com/PokeAPI/sprites/"
    + SOURCE_COMMIT
    + "/sprites/pokemon/other/official-artwork/"
)
CACHE = ROOT / ".cache" / "pokemon-art" / SOURCE_COMMIT
OUTPUT = ROOT / "assets" / "pokemon" / "official-artwork"
SIZE = 384
COUNT = 1025


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def decode(data):
    with Image.open(io.BytesIO(data)) as image:
        if image.format != "PNG" or image.size != (475, 475):
            raise ValueError(f"Unexpected artwork: {image.format} {image.size}")
        result = image.convert("RGBA")
        if result.getchannel("A").getextrema() == (255, 255):
            raise ValueError("Artwork must have a transparent background")
        return result


def download(url):
    for attempt in range(4):
        try:
            request = urllib.request.Request(
                url, headers={"User-Agent": "PokekoroJourney-asset-import/1.0"}
            )
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise
        time.sleep(2**attempt)


def import_art(pokemon_id):
    source = SOURCE_BASE + f"{pokemon_id}.png"
    cached = CACHE / f"{pokemon_id}.png"
    data = cached.read_bytes() if cached.exists() else download(source)
    image = decode(data)
    if not cached.exists():
        cached.write_bytes(data)
    # 白背景への合成や輪郭の切り抜きは行わず、元の余白・透過を全種で統一する。
    image.thumbnail((SIZE, SIZE), Image.Resampling.LANCZOS)
    encoded = io.BytesIO()
    image.save(encoded, "WEBP", quality=85, method=4)
    output = OUTPUT / f"{pokemon_id}.svg"
    # 自己完結したSVGに内包すると、外部画像への依存なしでGitの一括登録にも対応できる。
    payload = base64.b64encode(encoded.getvalue()).decode("ascii")
    output.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SIZE}" height="{SIZE}" '
        f'viewBox="0 0 {SIZE} {SIZE}"><image width="{SIZE}" height="{SIZE}" '
        f'href="data:image/webp;base64,{payload}"/></svg>\n',
        encoding="utf-8",
    )
    optimized = output.read_bytes()
    return {
        "id": pokemon_id,
        "source": source,
        "sourceSha256": sha256(data),
        "path": output.relative_to(ROOT).as_posix(),
        "sha256": sha256(optimized),
        "width": image.width,
        "height": image.height,
        "bytes": len(optimized),
    }


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    entries, failures = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        jobs = {executor.submit(import_art, id): id for id in range(1, COUNT + 1)}
        for completed, job in enumerate(concurrent.futures.as_completed(jobs), 1):
            try:
                entries.append(job.result())
            except Exception as error:
                failures.append({"id": jobs[job], "error": str(error)})
            if completed % 100 == 0 or completed == COUNT:
                print(f"Artwork: {completed}/{COUNT}; failures: {len(failures)}", flush=True)
    if failures:
        print(json.dumps(failures, ensure_ascii=False, indent=2))
        raise SystemExit("Import incomplete; cache retained for retry")
    entries.sort(key=lambda item: item["id"])
    manifest = {
        "schemaVersion": 1,
        "sourceRepository": "https://github.com/PokeAPI/sprites",
        "sourceCommit": SOURCE_COMMIT,
        "variant": "other/official-artwork/front_default",
        "copyright": "All image contents within are Copyright The Pokémon Company.",
        "licenseFile": "../../../docs/licenses/pokeapi-sprites.txt",
        "processing": {
            "format": "svg",
            "embeddedFormat": "webp",
            "maxSize": SIZE,
            "quality": 85,
            "method": 4,
        },
        "count": len(entries),
        "totalBytes": sum(item["bytes"] for item in entries),
        "images": entries,
    }
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Complete: {len(entries)} images, {manifest['totalBytes']:,} bytes", flush=True)


if __name__ == "__main__":
    main()
