import base64
import json
from pathlib import Path
import time


def main() -> None:
    data_dir = Path("Data")
    if not data_dir.exists():
        raise SystemExit(f"未找到目录：{data_dir.resolve()}")

    items = []
    for f in sorted(data_dir.iterdir()):
        if not f.is_file():
            continue

        name = f.name  # 这里保留“磁盘真实文件名”
        name_b64 = base64.b64encode(name.encode("utf-8")).decode("ascii")
        items.append(
            {
                "nameB64": name_b64,
                "ext": f.suffix.lower(),
                "size": f.stat().st_size,
                "lastWriteTime": int(f.stat().st_mtime * 1000),
            }
        )

    manifest = {"generatedAt": int(time.time() * 1000), "items": items}
    (Path(__file__).parent / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"已生成：{(Path(__file__).parent / 'manifest.json').resolve()}")


if __name__ == "__main__":
    main()

