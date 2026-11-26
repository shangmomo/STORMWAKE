"""Retain a CC BY artist's source attribution in a derived binary glTF.

    python scripts/stamp_licensed_glb.py original.glb derived.glb

This preserves binary mesh and texture bytes exactly; only the small JSON
`asset.extras` field and the outer GLB length are changed.
"""

import json
from pathlib import Path
import struct
import sys


GLB_HEADER = struct.Struct('<4sII')
CHUNK_HEADER = struct.Struct('<II')
JSON_CHUNK = 0x4E4F534A


def chunks(path):
    data = Path(path).read_bytes()
    magic, version, length = GLB_HEADER.unpack_from(data, 0)
    if magic != b'glTF' or version != 2 or length != len(data):
        raise ValueError(f'Invalid complete GLB: {path}')
    result = []
    offset = GLB_HEADER.size
    while offset < length:
        size, chunk_type = CHUNK_HEADER.unpack_from(data, offset)
        offset += CHUNK_HEADER.size
        result.append((chunk_type, data[offset:offset + size]))
        offset += size
    if offset != len(data):
        raise ValueError('Invalid GLB chunks')
    return result


def main(source, derived):
    origin = chunks(source)
    target = chunks(derived)
    src_json = json.loads(next(c for t, c in origin if t == JSON_CHUNK))
    dst_json = json.loads(next(c for t, c in target if t == JSON_CHUNK))
    credits = src_json.get('asset', {}).get('extras', {})
    if not {'author', 'source', 'license'} <= credits.keys():
        raise ValueError('Original artist source attribution is incomplete')
    dst_json.setdefault('asset', {}).setdefault('extras', {}).update({
        'author': credits['author'], 'source': credits['source'],
        'license': credits['license'],
        'modifications': 'Only original monster sculpt and eyes; removed showroom terrain and prop particles; 66 actual joint weights with 3 new swim/charge/attack animations.',
    })
    body = bytearray()
    for typ, raw in target:
        if typ == JSON_CHUNK:
            raw = json.dumps(dst_json, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            raw += b' ' * ((-len(raw)) % 4)
        body.extend(CHUNK_HEADER.pack(len(raw), typ))
        body.extend(raw)
    temp = Path(derived).with_suffix('.credited.glb')
    temp.write_bytes(GLB_HEADER.pack(b'glTF', 2, GLB_HEADER.size + len(body)) + body)
    temp.replace(derived)
    print('Artist credit embedded in', derived)


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python scripts/stamp_licensed_glb.py original.glb derived.glb')
    main(*sys.argv[1:])
