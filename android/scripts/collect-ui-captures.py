"""Collect only valid PNG screenshots from AGP's additional test output."""
from pathlib import Path
import shutil
import struct
import zlib


def valid_png(path: Path) -> bool:
    data = path.read_bytes()
    if len(data) < 1024 or not data.startswith(b"\x89PNG\r\n\x1a\n"):
        return False
    offset = 8
    has_image = False
    while offset + 12 <= len(data):
        length = struct.unpack_from(">I", data, offset)[0]
        end = offset + 12 + length
        if end > len(data):
            return False
        tag = data[offset + 4:offset + 8]
        payload = data[offset + 8:end - 4]
        crc = struct.unpack_from(">I", data, end - 4)[0]
        if zlib.crc32(tag + payload) != crc:
            return False
        if offset == 8:
            if tag != b"IHDR" or length != 13:
                return False
            width, height = struct.unpack_from(">II", payload)
            if width < 240 or height < 320:
                return False
        if tag == b"IDAT" and length:
            has_image = True
        if tag == b"IEND":
            return has_image and length == 0 and end == len(data)
        offset = end
    return False


def main() -> None:
    source = Path("app/build/outputs/connected_android_test_additional_output")
    target = Path("build/ui-captures")
    target.mkdir(parents=True, exist_ok=True)
    failures = []
    for name in ("overview", "heart", "empty"):
        filename = f"{name}.png"
        matches = sorted(source.rglob(filename))
        if len(matches) != 1 or not valid_png(matches[0]):
            failures.append(filename)
            continue
        shutil.copyfile(matches[0], target / filename)
        print(f"Validated screenshot: {filename}")
    if failures:
        raise SystemExit("Missing or invalid screenshots: " + ", ".join(failures))


if __name__ == "__main__":
    main()
