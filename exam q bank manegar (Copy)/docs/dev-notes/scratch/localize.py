import os

app_js_path = '/home/ahmed/Documents/exam q bank manegar/app.js'
helpers_js_path = '/home/ahmed/Documents/exam q bank manegar/src/utils/helpers.js'

with open(app_js_path, 'r', encoding='utf-8') as f:
    app_js = f.read()

replacements = {
    'this.handleError(e, "فشل حفظ السؤال");': "this.handleError(e, i18n.t('err_save_q'));",
    'alert("يرجى استخدام ملفات JSON حالياً.");': "alert(i18n.t('err_only_json'));",
    '<span style="color:var(--danger-color); font-weight:bold;">⚠️ بدون تصنيف</span>': "<span style=\"color:var(--danger-color); font-weight:bold;\">${i18n.t('no_category_badge')}</span>",
    '<span style="color:var(--danger-color); font-weight:bold;">⚠️ بدون وسوم</span>': "<span style=\"color:var(--danger-color); font-weight:bold;\">${i18n.t('no_tags_badge')}</span>",
    "|| 'افتراضي';": "|| i18n.t('default_sort');",
    '📄 الصيغة: <strong>${format.toUpperCase()}</strong> |': "${i18n.t('export_format_label')} <strong>${format.toUpperCase()}</strong> |",
    '🎯 النطاق: <strong>${count} سؤال</strong> |': "${i18n.t('export_scope_label')} <strong>${count} ${i18n.t('export_q_word')}</strong> |",
    '⚙️ الترتيب: <strong>${Helpers.sanitize(sortLabel)}</strong>': "${i18n.t('export_sort_label')} <strong>${Helpers.sanitize(sortLabel)}</strong>",
    'this.showToast("اختر أسئلة أولاً.", "warning");': "this.showToast(i18n.t('err_select_q_first'), \"warning\");",
    'confirm(`هل أنت متأكد من حذف ${this.state.selectedIds.size} سؤال؟ لا يمكن التراجع!`)': "confirm(i18n.t('msg_delete_q_confirm', {count: this.state.selectedIds.size}))",
    'this.showToast(`✅ تم تطبيق الاختيار على ${pool.length} سؤال.`, \'success\');': "this.showToast(i18n.t('msg_selection_applied', {count: pool.length}), 'success');",
    'this.showToast("💾 تم حفظ التفضيلات محلياً.", "info");': "this.showToast(i18n.t('msg_prefs_saved'), \"info\");",
    'alert("الرجاء إدخال رابط صالح.");': "alert(i18n.t('err_invalid_url'));",
    'alert("خطأ: " + e.message);': "alert((i18n.t('err_read_data', {msg: e.message})).replace('حدث خطأ أثناء قراءة البيانات: ', 'Error: '));",
    'alert("الصق النص أولاً.");': "alert(i18n.t('err_paste_text'));",
    'alert(`خطأ في بناء الـ JSON (Syntax Error)!\\n\\nالسطر المتوقع للخطأ: ${lineNumber}\\nالعمود: ${columnNumber}\\nالتفاصيل: ${errorMsg}\\n\\nتم تحديد وتظليل مكان الخطأ في مربع النص لتسهيل إصلاحه.`);': "alert(i18n.t('err_json_syntax_long', {line: lineNumber, col: columnNumber, msg: errorMsg}));",
    "alert('خطأ في بناء الـ JSON:\\n' + errorMsg);": "alert(i18n.t('err_json_syntax', {msg: errorMsg}));",
    "alert('الرجاء لصق النص أولاً.');": "alert(i18n.t('err_paste_text'));",
    "confirm(`تم العثور على ${questions.length} سؤال. استيراد؟`)": "confirm(i18n.t('msg_found_qs_import', {count: questions.length}))",
    "alert('لم يتم العثور على صيغة سؤال صالحة. تأكد من أن النص يحتوي على JSON صحيح (مصفوفة أو كائن).');": "alert(i18n.t('err_no_valid_q_format'));",
    "this.showToast('تم استخراج وتعبئة بيانات السؤال بنجاح! 🚀', 'success');": "this.showToast(i18n.t('msg_smart_fill_success'), 'success');",
    "alert(`خطأ في بناء الـ JSON للسطر: ${lineNumber}\\nالتفاصيل: ${errorMsg}\\nتم تحديد مكان الخطأ لتسهيل إصلاحه.`);": "alert(i18n.t('err_json_line', {line: lineNumber, msg: errorMsg}));",
    "alert('حدث خطأ أثناء قراءة البيانات: ' + errorMsg);": "alert(i18n.t('err_read_data', {msg: errorMsg}));",
    "alert('يجب إنشاء دفتر أولاً');": "alert(i18n.t('err_create_notebook_first'));",
    'alert("اختر الدفتر.");': "alert(i18n.t('err_select_notebook'));",
    "alert('هذا الدفتر لا يحتوي على أسئلة');": "alert(i18n.t('err_notebook_empty'));",
    "this.showToast('✅ تم نسخ البرومبت بنجاح!', 'success');": "this.showToast(i18n.t('msg_prompt_copied'), 'success');",
    "this.showToast('❌ فشل النسخ.', 'error');": "this.showToast(i18n.t('msg_copy_fail'), 'error');",
    "this.showToast(state.language === 'ar' ? '✅ تم نسخ التقرير بنجاح.' : '✅ Report copied successfully.', 'success');": "this.showToast(i18n.t('msg_report_copied'), 'success');"
}

for old, new_ in replacements.items():
    app_js = app_js.replace(old, new_)

with open(app_js_path, 'w', encoding='utf-8') as f:
    f.write(app_js)

# Now helpers.js
with open(helpers_js_path, 'r', encoding='utf-8') as f:
    helpers_js = f.read()

helpers_replacements = {
    'throw new Error("فشلت جميع محاولات جلب الملف.");': 'throw new Error(i18n.t("err_fetch_fail"));',
    "line.includes('السؤال:')": "(line.includes('السؤال:') || line.includes('Question:'))",
    ".replace('السؤال:', '')": ".replace('السؤال:', '').replace('Question:', '')",
    "tags: ['استيراد_ذكي']": "tags: ['smart_import']",
    "line.includes('💡') || line.includes('الجواب:')": "(line.includes('💡') || line.includes('الجواب:') || line.includes('Answer:'))",
    "line.replace(/💡|الجواب:/g, '')": "line.replace(/💡|الجواب:|Answer:/g, '')",
    "<p>عدد الأسئلة: ${qList.length} | النوع: ${mode === 'exam' ? 'امتحان' : 'مذاكرة'}</p>": "<p>${i18n.t('print_q_count', {count: qList.length})} | ${i18n.t('print_type', {type: mode === 'exam' ? i18n.t('print_type_exam') : i18n.t('print_type_study')})}</p>",
    "<h3>السؤال ${idx + 1}: ${this.sanitize(q.question)}</h3>": "<h3 style=\"margin-bottom:15px;\">${i18n.t('print_q_prefix', {num: idx + 1})}${this.sanitize(q.question)}</h3>",
    "<p>( صح / خطأ )</p>": "<p>${i18n.t('print_boolean')}</p>",
    "<p>الجواب: ${q.answer ? 'صح' : 'خطأ'}</p>": "<p>${i18n.t('print_ans', {text: q.answer ? i18n.t('print_ans_true') : i18n.t('print_ans_false')})}</p>",
    "<p>الكلمات المفتاحية: ${this.sanitize((q.keywords || []).join(', '))}</p>": "<p>${i18n.t('print_keywords', {words: this.sanitize((q.keywords || []).join(', '))})}</p>",
    "<p>(توصيل العناصر)</p>": "<p>${i18n.t('print_match')}</p>",
    "<p style=\"font-style:italic; color:#666;\">💡 شرح: ${this.sanitize(q.explain)}</p>": "<p style=\"font-style:italic; color:#666;\">${i18n.t('print_explain', {text: this.sanitize(q.explain)})}</p>"
}

for old, new_ in helpers_replacements.items():
    helpers_js = helpers_js.replace(old, new_)

# Also need to import i18n in helpers.js if it's not imported.
if "import { i18n }" not in helpers_js:
    helpers_js = "import { i18n } from '../core/i18n.js';\n" + helpers_js

with open(helpers_js_path, 'w', encoding='utf-8') as f:
    f.write(helpers_js)

print("Localization script completed.")
