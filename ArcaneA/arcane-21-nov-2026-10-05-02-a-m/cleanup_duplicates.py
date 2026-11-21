import os

root_dir = '/app/applet'

removed_count = 0
for dirpath, _, filenames in os.walk(root_dir):
    if 'node_modules' in dirpath or '.git' in dirpath or 'dist' in dirpath:
        continue
    for filename in filenames:
        if '-1.' in filename or filename.endswith('-1.tsx') or filename.endswith('-1.ts') or filename.endswith('-1.css'):
            path = os.path.join(dirpath, filename)
            base_name = filename.replace('-1.', '.')
            base_path = os.path.join(dirpath, base_name)
            if os.path.exists(base_path):
                os.remove(path)
                print(f"Removed duplicate: {path}")
                removed_count += 1

print(f"Removed {removed_count} duplicate files.")
