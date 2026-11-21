import os
import re

PROJECT_DIR = "."
SRC_DIR = os.path.join(PROJECT_DIR, "src")
ASSETS_DIR = os.path.join(PROJECT_DIR, "public", "assets")

# 1. Recolectar todas las rutas de assets mencionadas en src/ e index.html
referenced_files = set()
pattern = re.compile(r'assets/[a-zA-Z0-9_./-]+')

for root_dir in [SRC_DIR]:
    for root, _, files in os.walk(root_dir):
        for fname in files:
            if fname.endswith((".ts", ".tsx", ".js", ".jsx", ".css", ".html")):
                fpath = os.path.join(root, fname)
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    for match in pattern.findall(content):
                        # Guardar solo el nombre base del archivo
                        referenced_files.add(os.path.basename(match))

if os.path.exists("index.html"):
    with open("index.html", "r", encoding="utf-8", errors="ignore") as f:
        for match in pattern.findall(f.read()):
            referenced_files.add(os.path.basename(match))

print(f"Archivos de assets referenciados en el código: {len(referenced_files)}")

# 2. Revisar public/assets/ y borrar lo que no está en uso
deleted_count = 0
freed_bytes = 0
kept_count = 0

for root, _, files in os.walk(ASSETS_DIR):
    for fname in files:
        fpath = os.path.join(root, fname)
        if fname in referenced_files:
            kept_count += 1
        else:
            size = os.path.getsize(fpath)
            os.remove(fpath)
            deleted_count += 1
            freed_bytes += size

print(f"Conservados (en uso): {kept_count}")
print(f"Eliminados (basura/huérfanos): {deleted_count}")
print(f"Espacio liberado: {freed_bytes / (1024 * 1024):.2f} MB")