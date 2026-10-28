"""Build a deployable source archive without local secrets or runtime data."""
from pathlib import Path
import tarfile

root = Path(__file__).resolve().parents[1]
target = root.parent / 'artifacts' / 'tvceb-synology-2.82.0.tar.gz'
target.parent.mkdir(exist_ok=True)
excluded = {'.git', '.env', 'node_modules', 'docs', 'data', 'backups',
            'documents', '.codex', '.agents', '.claude', '.github',
            '.worktrees', 'coverage', 'test'}
with tarfile.open(target, 'w:gz') as archive:
    for file in sorted(root.rglob('*')):
        relative = file.relative_to(root)
        if any(part in excluded for part in relative.parts):
            continue
        if file.is_file():
            archive.add(file, arcname=str(Path('tvceb') / relative), recursive=False)
with tarfile.open(target, 'r:gz') as archive:
    names = set(archive.getnames())
    assert 'tvceb/.env' not in names
    assert {'tvceb/Dockerfile', 'tvceb/compose.synology.yaml',
            'tvceb/.env.synology.example', 'tvceb/entrypoint.sh',
            'tvceb/package-lock.json', 'tvceb/scripts/check-runtime-deps.mjs'} <= names
print(f'Created {target} ({target.stat().st_size:,} bytes); no .env or live data.')
