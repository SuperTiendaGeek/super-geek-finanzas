from pathlib import Path
try:
    from PyPDF2 import PdfReader
except Exception as e:
    print('PyPDF2 not available', e)
    raise SystemExit(1)
path = Path(r"c:\Users\Admin\Downloads\estructura completa de la base de datos.pdf")
if not path.exists():
    print('file missing')
    raise SystemExit(1)
reader = PdfReader(str(path))
print('pages', len(reader.pages))
for i, page in enumerate(reader.pages):
    text = page.extract_text() or ''
    print('\n--- page', i+1, '---')
    print(text)
