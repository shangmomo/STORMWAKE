"""Stable source identity for QA reports and packaged releases."""
import hashlib
from pathlib import Path
def build_fingerprint(root):
    root=Path(root)
    files=[p for folder in ('src','server','test') for p in (root/folder).rglob('*') if p.is_file() and p.suffix in ('.js','.mjs','.py')]
    files += [p for p in root.iterdir() if p.is_file() and (p.name.startswith('start_v') or p.name in ('package.json','package-lock.json'))]
    digest=hashlib.sha256()
    for p in sorted(files,key=lambda p:p.relative_to(root).as_posix()):
        digest.update(p.relative_to(root).as_posix().encode('utf-8'));digest.update(b'\0');digest.update(p.read_bytes())
    return digest.hexdigest()
