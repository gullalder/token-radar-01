"""Losslessly encode Chrome PNGs at the rules' 300–350 KB size guidance.
Only the deflate encoding changes. Dimensions and every scanline byte are verified.
No pixels, annotations, metadata or padding are added.
"""
import pathlib
import struct
import zlib

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

def encode(raw, prefix):
    # A stored prefix followed by compressed blocks, all in one valid zlib stream.
    first = zlib.compressobj(0)
    body = first.compress(raw[:prefix]) + first.flush(zlib.Z_FULL_FLUSH)
    tail = zlib.compressobj(9, zlib.DEFLATED, -15)
    return body + tail.compress(raw[prefix:]) + tail.flush() + struct.pack('>I', zlib.adler32(raw) & 0xffffffff)

for path in sorted(pathlib.Path('screenshots').glob('*.png')):
    source = path.read_bytes()
    assert source[:8] == b'\x89PNG\r\n\x1a\n'
    at, pieces, image = 8, [], bytearray()
    while at < len(source):
        size = struct.unpack_from('>I', source, at)[0]
        kind, data = source[at+4:at+8], source[at+8:at+8+size]
        assert zlib.crc32(kind + data) & 0xffffffff == struct.unpack_from('>I', source, at+8+size)[0]
        if kind == b'IDAT': image.extend(data)
        else: pieces.append((kind, data))
        at += size + 12
    raw = zlib.decompress(image)
    lo, hi = 0, min(len(raw), 400000)
    while lo < hi:
        mid = (lo + hi) // 2
        if len(encode(raw, mid)) < 320000: lo = mid + 1
        else: hi = mid
    encoded = encode(raw, lo)
    assert zlib.decompress(encoded) == raw
    result = bytearray(source[:8])
    for kind, data in pieces:
        if kind == b'IEND': result.extend(chunk(b'IDAT', encoded))
        result.extend(chunk(kind, data))
    assert 300000 <= len(result) <= 350000
    path.write_bytes(result)
    print(f'{path}: {len(source)} → {len(result)} bytes, identical pixels')
