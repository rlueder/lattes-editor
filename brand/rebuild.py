from pathlib import Path
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parent
construction = root / 'construction'
subprocess.run([sys.executable, str(construction / 'build-grid.py')], check=True)
for source, target in [
    ('symbol.svg', 'symbol-original.svg'),
    ('logo.svg', 'logo-variation-a.svg'),
    ('construction-grid.svg', 'construction-grid.svg'),
    ('proportions.json', 'proportions.json'),
]:
    shutil.copy2(construction / source, root / 'source' / target)
subprocess.run(['node', str(construction / 'render-previews.cjs')], check=True)
subprocess.run(['node', str(root / 'build-icons.cjs')], check=True)
print('Grade, marca, prévias e ícones regenerados.')
