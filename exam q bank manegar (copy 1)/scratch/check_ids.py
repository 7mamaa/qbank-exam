import os
import re

js_ids = """
active
ai-count-boolean
ai-count-match
ai-count-mcq
ai-count-written
ai-difficulty
ai-lang
ai-level
ai-prompt-text
ai-topic
bool_answer
btn-add-question
btn-create-notebook
btn-dir-ltr
btn-dir-rtl
btn-force-save
btn-next-page
btn-prev-page
btn-redo
btn-remove-image
btn-show-report
btn-toggle-sound
btn-undo
btn-zen-mode
bulk-notebook-move
change
chart-types
click
count-scope-all
count-scope-custom
count-scope-selected
current-page-title
duplicate-modal
duplicate-msg
dynamic-fields-container
export-notebook-filter
filter-category
filter-difficulty
filter-notebook
filter-search
filter-tag
filter-type
global-search
import-auto-distribute
import-file
import-notebook
import-paste-area
import-url
input
mcq
mcq_opt_0
mcq_opt_1
mcq_opt_2
mcq_opt_3
medium
menu-toggle
modal
nav
notebook-color
notebook-desc
notebook-form
notebook-id
notebook-name
notebooks-container
notebooks-empty-state
page-info
pagination-controls
pdf-custom-header
pdf-direction
pdf-layout
pdf-show-images
pdf-two-columns
print-container
print-direction
print-mode
print-notebook
project-report-modal
question-category
question-difficulty
question-explain
question-form
question-id
question-image-base64
question-image-preview
question-image-upload
question-notebook
question-tags
question-text
question-type
questions-container
questions-empty-state
questions-only
quiz
quiz-current-idx
quiz-limit
quiz-notebook
quiz-progress-bar
quiz-question-container
quiz-result-percent
quiz-result-score
quiz-timer
quiz-total
rtl
selection-hub-content
sidebar
sidebar-overlay
submit
tags-list
true
word-bold-question
word-custom-header
word-direction
word-include-explain
word-layout
written_keywords
zen-mode
""".strip().split('\n')

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

missing = []
for id in js_ids:
    if f'id="{id}"' not in html and f"id='{id}'" not in html:
        # Some might be values or event names picked up by my broad grep
        if id not in ['active', 'change', 'click', 'input', 'mcq', 'medium', 'modal', 'nav', 'rtl', 'submit', 'true', 'zen-mode', 'questions-only']:
            missing.append(id)

print("Missing IDs in index.html:")
for m in missing:
    print(f"- {m}")
