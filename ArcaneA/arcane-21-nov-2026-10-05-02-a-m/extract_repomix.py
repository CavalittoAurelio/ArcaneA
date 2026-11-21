import os
import re

xml_path = '/app/applet/repomix-output-1.xml'
output_base = '/app/applet'

print("Reading repomix-output-1.xml...")
with open(xml_path, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
clean_lines = []
for line in lines:
    match = re.match(r'^\s*(\d+):\s?(.*)$', line)
    if match:
        clean_lines.append(match.group(2))
    else:
        clean_lines.append(line)

clean_content = '\n'.join(clean_lines)

file_matches = re.finditer(r'<file path="([^"]+)">\n(.*?)\n</file>', clean_content, re.DOTALL)

extracted_count = 0
for m in file_matches:
    file_path = m.group(1)
    file_content = m.group(2)
    
    rel_path = file_path
    for prefix in ['Arcane/arcane-19-nov-2026-7-49-50-p-m/', 'Arcane/', 'arcane/']:
        if rel_path.startswith(prefix):
            rel_path = rel_path[len(prefix):]
            break
            
    dest_path = os.path.join(output_base, rel_path)
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    
    with open(dest_path, 'w', encoding='utf-8') as out_f:
        out_f.write(file_content)
        
    print(f"Extracted: {rel_path}")
    extracted_count += 1

print(f"Successfully extracted {extracted_count} files from repomix-output-1.xml!")
