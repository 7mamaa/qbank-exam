import sys

file_path = '/home/ahmed/Documents/exam q bank manegar/src/modules/export.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

target_start = "const layout = document.getElementById('word-layout')?.value || 'questions-only';"
target_end = "const includeExplain = document.getElementById('word-include-explain')?.checked;"

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if target_start in line:
        start_idx = i
        break

for i in range(start_idx, len(lines)):
    if target_end in lines[i]:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = [
        "        const layout = document.getElementById('word-layout')?.value || 'questions-only';\n",
        "        const customHeader = document.getElementById('word-custom-header')?.value || i18n.t('default_word_header');\n",
        "        const direction = document.getElementById('word-direction')?.value || 'rtl';\n",
        "        const includeExplain = document.getElementById('word-include-explain')?.checked;\n"
    ]
    lines[start_idx:end_idx+1] = new_content
    
    with open(file_path, 'w') as f:
        f.writelines(lines)
    print("Export patch applied successfully.")
else:
    print(f"Failed to find indices: start={start_idx}, end={end_idx}")
    sys.exit(1)
