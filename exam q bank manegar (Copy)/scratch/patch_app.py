import sys

file_path = '/home/ahmed/Documents/exam q bank manegar/app.js'
with open(file_path, 'r') as f:
    lines = f.readlines()

# Find the gap
# The gap is after "Feature 2: Custom Theme Maker" and before "if (!saved) return;"
target_start = "// ── Feature 2: Custom Theme Maker ─────────────────────────────────────────"
target_end = "if (!saved) return;"

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if target_start in line:
        start_idx = i
    if target_end in line:
        end_idx = i
        break

if start_idx != -1 and end_idx != -1:
    new_content = [
        "    applyCustomTheme() {\n",
        "        const primary  = document.getElementById('theme-primary')?.value  || '#4361ee';\n",
        "        const bgMain   = document.getElementById('theme-bg-main')?.value   || '#f5f7fb';\n",
        "        const cardBg   = document.getElementById('theme-card-bg')?.value   || '#ffffff';\n",
        "        const textTitle = document.getElementById('theme-text-title')?.value || '#1a202c';\n",
        "\n",
        "        const root = document.documentElement;\n",
        "        root.style.setProperty('--primary', primary);\n",
        "        root.style.setProperty('--primary-hover', primary);\n",
        "        root.style.setProperty('--bg-main', bgMain);\n",
        "        root.style.setProperty('--card-bg', cardBg);\n",
        "        root.style.setProperty('--sidebar-bg', cardBg);\n",
        "        root.style.setProperty('--text-title', textTitle);\n",
        "\n",
        "        // Persist as a \"custom\" theme\n",
        "        const customVars = { primary, bgMain, cardBg, textTitle };\n",
        "        localStorage.setItem('qbank_custom_theme', JSON.stringify(customVars));\n",
        "        this.showToast(i18n.t('msg_theme_applied'), 'success');\n",
        "    },\n",
        "\n",
        "    initCustomTheme() {\n",
        "        const saved = localStorage.getItem('qbank_custom_theme');\n"
    ]
    # Replace the range (start_idx+1 to end_idx)
    # Lines between start_idx and end_idx should be replaced
    lines[start_idx+1:end_idx+1] = new_content
    
    with open(file_path, 'w') as f:
        f.writelines(lines)
    print("Patch applied successfully.")
else:
    print(f"Failed to find indices: start={start_idx}, end={end_idx}")
    sys.exit(1)
