export function generateCleanQuizOnlyHtml(questions, settings, theme, title) {
  const TYPE_WEIGHTS = { 'written': 1, 'mcq': 2, 'boolean': 3, 'match': 4 };
  const sortedQuestions = [...questions].sort((a, b) => {
    const wA = TYPE_WEIGHTS[a.type] || 99;
    const wB = TYPE_WEIGHTS[b.type] || 99;
    return wA - wB;
  });

  const htmlTemplate = `<!DOCTYPE html>
<html lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>__QUIZ_TITLE__</title>
  <style>
    :root {
      --bg-gradient: radial-gradient(circle at center, #f8fafc, #e2e8f0);
      --panel-bg: rgba(255, 255, 255, 0.85);
      --panel-border: rgba(15, 23, 42, 0.08);
      --text-main: #0f172a;
      --text-muted: #64748b;
      --primary: #f97316;
      --primary-glow: rgba(249, 115, 22, 0.2);
      --primary-hover: #ea580c;
      --bg-btn: rgba(255, 255, 255, 1);
      --border-btn: rgba(15, 23, 42, 0.1);
      --success: #10b981;
      --success-bg: rgba(16, 185, 129, 0.08);
      --success-border: rgba(16, 185, 129, 0.2);
      --info: #0284c7;
      --info-bg: rgba(14, 165, 233, 0.08);
      --info-border: rgba(14, 165, 233, 0.2);
      --danger: #ef4444;
      --danger-bg: rgba(239, 68, 68, 0.06);
      --danger-border: rgba(239, 68, 68, 0.15);
      --sidebar-width: 320px;
    }
    body.dark {
      --bg-gradient: radial-gradient(circle at top, #09090b, #020204);
      --panel-bg: rgba(24, 24, 27, 0.8);
      --panel-border: rgba(255, 255, 255, 0.08);
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --bg-btn: rgba(39, 39, 42, 0.8);
      --border-btn: rgba(255, 255, 255, 0.08);
      --success-bg: rgba(16, 185, 129, 0.12);
      --success-border: rgba(16, 185, 129, 0.25);
      --info: #38bdf8;
      --info-bg: rgba(56, 189, 248, 0.12);
      --info-border: rgba(56, 189, 248, 0.25);
      --danger: #f87171;
      --danger-bg: rgba(248, 113, 113, 0.12);
      --danger-border: rgba(248, 113, 113, 0.25);
    }
    * { box-sizing: border-box; }
    .option-btn, .tool-btn, .btn-nav, .map-btn, .sidebar-drawer, .explain-toggle {
      transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.12s ease, opacity 0.15s ease, box-shadow 0.15s ease;
    }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--bg-gradient);
      color: var(--text-main);
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      direction: inherit;
    }
    .quiz-container { width: 100%; max-width: 720px; z-index: 10; direction: inherit; }
    
    /* Top Toolbar */
    .top-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      width: 100%;
      gap: 12px;
      direction: inherit;
    }
    .toolbar-left, .toolbar-right {
      display: flex;
      gap: 8px;
    }
    .tool-btn {
      background: var(--bg-btn);
      border: 1.5px solid var(--border-btn);
      color: var(--text-main);
      padding: 10px 18px;
      border-radius: 12px;
      cursor: pointer;
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tool-btn:hover {
      border-color: var(--primary);
      background: rgba(249, 115, 22, 0.08);
      transform: translateY(-1px);
    }
    
    /* Main Panel */
    .glass-panel {
      background: var(--panel-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--panel-border);
      box-shadow: 0 15px 35px -10px rgba(0,0,0,0.2);
      border-radius: 24px;
      padding: 36px;
      position: relative;
      direction: inherit;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      padding-bottom: 16px;
      direction: inherit;
    }
    .badge {
      background: rgba(249, 115, 22, 0.15);
      color: var(--primary);
      padding: 6px 12px;
      border-radius: 8px;
      font-weight: 800;
      font-size: 11px;
    }
    .question-text {
      font-size: 22px;
      font-weight: 800;
      line-height: 1.6;
      margin-bottom: 28px;
      text-align: start;
    }
    .options-grid { display: flex; flex-direction: column; gap: 14px; margin-bottom: 28px; direction: inherit; }
    .option-btn {
      width: 100%;
      padding: 18px 24px;
      text-align: start;
      font-weight: 600;
      font-size: 16px;
      background: var(--bg-btn);
      border: 1.5px solid var(--border-btn);
      color: var(--text-main);
      border-radius: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      direction: inherit;
    }
    .option-btn:hover {
      border-color: var(--primary);
      background: rgba(249, 115, 22, 0.08);
      transform: translateY(-2px);
    }
    .option-btn.selected {
      border-color: var(--primary);
      background: rgba(249, 115, 22, 0.2);
      box-shadow: 0 0 15px var(--primary-glow);
      font-weight: 700;
    }
    .option-btn::after {
      content: '';
      width: 10px;
      height: 10px;
      border: 2px solid var(--text-muted);
      border-radius: 50%;
      margin-inline-start: 12px;
    }
    .option-btn.selected::after {
      background: var(--primary);
      border-color: var(--primary);
      box-shadow: 0 0 6px var(--primary);
    }
    .textarea-input {
      width: 100%;
      padding: 18px;
      min-height: 130px;
      background: var(--bg-btn);
      border: 1.5px solid var(--border-btn);
      color: var(--text-main);
      border-radius: 16px;
      outline: none;
      font-size: 16px;
      resize: vertical;
      line-height: 1.6;
      text-align: start;
    }
    .textarea-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 12px var(--primary-glow);
    }
    
    /* Reveal and Explanation Components */
    .reveal-container {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
      direction: inherit;
    }
    .reveal-buttons-row {
      display: flex;
      gap: 12px;
      margin-top: 10px;
      width: 100%;
      direction: inherit;
    }
    .explain-box {
      background: var(--success-bg);
      border: 1px solid var(--success-border);
      color: var(--text-main);
      padding: 18px;
      border-radius: 16px;
      font-size: 14px;
      display: none;
      text-align: start;
      line-height: 1.6;
      white-space: pre-line;
      direction: inherit;
    }
    .explain-toggle {
      background: transparent;
      border: 1px solid var(--border-btn);
      color: var(--text-muted);
      font-weight: 700;
      font-size: 12px;
      cursor: pointer;
      padding: 10px 16px;
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      flex: 1;
    }
    .explain-toggle:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: var(--primary);
      color: var(--text-main);
    }
    
    /* Matching Style */
    .match-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border: 1.5px solid var(--border-btn);
      border-radius: 14px;
      background: rgba(15,23,42,0.05);
      gap: 12px;
      direction: inherit;
    }
    .match-label { font-weight: 700; font-size: 15px; text-align: start; }
    .match-select {
      padding: 10px 16px;
      border: 1.5px solid var(--border-btn);
      border-radius: 10px;
      background: var(--bg-btn);
      color: var(--text-main);
      font-size: 14px;
      outline: none;
      cursor: pointer;
      max-width: 60%;
      text-align: start;
    }
    body.dark .match-select option {
      background: #18181b;
      color: #f4f4f5;
    }
    
    /* Navigation Footer */
    .nav-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.05);
      padding-top: 24px;
      margin-top: 28px;
      direction: inherit;
    }
    .btn-nav {
      padding: 12px 28px;
      font-weight: 700;
      border-radius: 12px;
      cursor: pointer;
      border: none;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-back { background: transparent; color: var(--text-muted); border: 1px solid var(--border-btn); }
    .btn-back:hover:not(:disabled) { background: rgba(255,255,255,0.05); color: var(--text-main); }
    .btn-back:disabled { opacity: 0.15; cursor: not-allowed; }
    .btn-next { background: var(--text-main); color: var(--bg-gradient); }
    .btn-next:hover { opacity: 0.9; transform: translateY(-1px); }
    .btn-finish {
      background: var(--primary);
      color: white;
      box-shadow: 0 6px 20px var(--primary-glow);
    }
    .btn-finish:hover {
      background: var(--primary-hover);
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.4);
      transform: translateY(-1px);
    }
    
    /* Sidebar Navigation Map (Sectioned Layout) */
    .sidebar-drawer {
      position: fixed;
      top: 0;
      right: calc(-1 * var(--sidebar-width));
      width: var(--sidebar-width);
      height: 100vh;
      background: var(--panel-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border-left: 1px solid var(--panel-border);
      box-shadow: -10px 0 30px rgba(0,0,0,0.2);
      z-index: 1000;
      padding: 28px;
      display: flex;
      flex-direction: column;
      transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1), left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sidebar-drawer.open {
      right: 0;
    }
    body[dir="ltr"] .sidebar-drawer {
      right: auto;
      left: calc(-1 * var(--sidebar-width));
      border-left: none;
      border-right: 1px solid var(--panel-border);
      box-shadow: 10px 0 30px rgba(0,0,0,0.2);
    }
    body[dir="ltr"] .sidebar-drawer.open {
      left: 0;
    }
    .sidebar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      padding-bottom: 14px;
    }
    .sidebar-header h3 { margin: 0; font-size: 18px; font-weight: 800; }
    .close-btn { background: transparent; border: none; color: var(--text-main); font-size: 22px; cursor: pointer; }
    
    .question-map-grid {
      flex: 1;
      overflow-y: auto;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .map-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .map-section-title {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      margin-bottom: 4px;
      text-align: start;
    }
    .map-buttons-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    
    .question-map-grid::-webkit-scrollbar {
      width: 6px;
    }
    .question-map-grid::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.05);
      border-radius: 4px;
    }
    .question-map-grid::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.3);
      border-radius: 4px;
    }
    .question-map-grid::-webkit-scrollbar-thumb:hover {
      background: var(--primary);
    }
    
    .map-btn {
      aspect-ratio: 1;
      border-radius: 10px;
      border: 1.5px solid var(--border-btn);
      background: var(--bg-btn);
      color: var(--text-main);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    .map-btn:hover {
      border-color: var(--primary);
      background: rgba(249, 115, 22, 0.05);
    }
    .map-btn.current {
      border-color: var(--primary);
      background: rgba(249, 115, 22, 0.15);
      color: var(--primary);
      box-shadow: 0 0 10px var(--primary-glow);
    }
    .map-btn.answered {
      background: var(--success-bg);
      border-color: var(--success-border);
      color: var(--success);
    }
    
    /* Score Page & Certificate-style Frame */
    .score-container { text-align: center; display: none; }
    .certificate-frame {
      border: 2px solid rgba(249, 115, 22, 0.2);
      border-radius: 20px;
      padding: 30px;
      background: rgba(15,23,42,0.03);
      margin: 24px 0;
    }
    .score-badge {
      display: inline-flex;
      background: linear-gradient(135deg, var(--primary), var(--primary-hover));
      color: white;
      border-radius: 50%;
      width: 140px;
      height: 140px;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      box-shadow: 0 10px 30px rgba(249, 115, 22, 0.4);
      margin-bottom: 20px;
    }
    .score-pct { font-size: 38px; font-weight: 900; line-height: 1; }
    .score-detail { font-size: 11px; font-weight: 800; opacity: 0.9; margin-top: 4px; }
    .feedback-text { font-size: 20px; font-weight: 800; color: var(--primary); margin-bottom: 8px; }
    .feedback-sub { font-size: 14px; color: var(--text-muted); margin-bottom: 24px; }
    
    /* Comprehensive Review Section */
    .review-container {
      margin-top: 40px;
      border-top: 1px solid rgba(255,255,255,0.08);
      padding-top: 30px;
      text-align: start;
    }
    .review-item {
      border: 1.5px solid var(--border-btn);
      border-radius: 18px;
      padding: 22px;
      margin-bottom: 20px;
      background: rgba(15,23,42,0.02);
      direction: inherit;
    }
    body.dark .review-item {
      background: rgba(15,23,42,0.25);
    }
    .review-question {
      font-size: 17px;
      font-weight: 800;
      margin-bottom: 12px;
      line-height: 1.5;
      text-align: start;
    }
    .review-status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      margin-bottom: 14px;
    }
    .status-correct {
      background: var(--success-bg);
      border: 1.5px solid var(--success-border);
      color: var(--success);
    }
    .status-incorrect {
      background: var(--danger-bg);
      border: 1.5px solid var(--danger-border);
      color: var(--danger);
    }
    .status-written {
      background: var(--info-bg);
      border: 1.5px solid var(--info-border);
      color: var(--info);
    }
    .review-answer-line {
      font-size: 15px;
      margin: 8px 0;
      line-height: 1.5;
      text-align: start;
    }
    @media print {
      .review-item, .explain-box, .pdf-question-block, .question-card, .question-item, .explanation-box, .print-question, .answer-box {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        position: relative;
      }
    }
  </style>
</head>
<body class="dark" dir="rtl">
  
  <!-- Sidebar Navigation drawer -->
  <div id="sidebar-drawer" class="sidebar-drawer">
    <div class="sidebar-header">
      <h3 id="lbl-sidebar-title">خريطة الأسئلة</h3>
      <button class="close-btn" onclick="toggleSidebar()">✕</button>
    </div>
    <div id="question-map-grid" class="question-map-grid"></div>
  </div>

  <div class="quiz-container">
    
    <!-- Upper Controls Toolbar -->
    <div class="top-toolbar">
      <div class="toolbar-left">
        <button class="tool-btn" onclick="toggleTheme()" id="btn-theme-toggle">🌙 مظهر ليلى</button>
        <button class="tool-btn" onclick="toggleDirection()" id="btn-dir-toggle">English / عربي</button>
      </div>
      <div class="toolbar-right">
        <button class="tool-btn" onclick="toggleSidebar()" id="btn-map-toggle">🗺️ خريطة التنقل</button>
      </div>
    </div>

    <!-- Active Question View -->
    <div id="quiz-view" class="glass-panel">
      <div class="header">
        <span id="progress-text">السؤال 1 من 10</span>
        <span id="type-badge" class="badge">MCQ</span>
      </div>
      <div id="question-title" class="question-text">جاري التحميل...</div>
      <div id="answers-container"></div>
      <div class="nav-footer">
        <button id="btn-prev" class="btn-nav btn-back" onclick="navigate(-1)">السابق</button>
        <button id="btn-next" class="btn-nav btn-next" onclick="navigate(1)">التالي</button>
      </div>
    </div>

    <!-- Score & Analysis View -->
    <div id="score-view" class="glass-panel score-container">
      <h2 id="lbl-quiz-finished" style="font-size: 28px; font-weight: 900; margin: 0 0 6px 0;">اكتمل الاختبار!</h2>
      <div class="certificate-frame">
        <div class="score-badge">
          <div id="final-pct" class="score-pct">0%</div>
          <div id="final-detail" class="score-detail">0 / 0 صحيحة</div>
        </div>
        <div id="feedback" class="feedback-text">عمل رائع!</div>
        <div id="feedback-desc" class="feedback-sub">لقد أتممت اختبار التقييم بنجاح.</div>
      </div>
      
      <button class="option-btn" style="text-align: center; border-color: var(--primary); color: var(--primary); font-weight: 700; justify-content: center; background: rgba(249,115,22,0.05);" onclick="resetQuiz()">إعادة محاولة الاختبار (Retake)</button>
      
      <!-- Review Panel -->
      <div id="review-container" class="review-container">
        <h3 id="lbl-review-title" style="font-size: 20px; font-weight: 800; margin-bottom: 20px;">مراجعة الإجابات التفصيلية</h3>
        <div id="review-list"></div>
      </div>
    </div>
    
  </div>

  <script>
    const MOCK_QUIZ_DATA = __EXAM_DATA_PLACEHOLDER__;
    const EXAM_DATA = MOCK_QUIZ_DATA;
    
    // فرز الأسئلة تسلسلياً حسب النوع: written -> mcq -> boolean -> match
    const TYPE_WEIGHTS = { 'written': 1, 'mcq': 2, 'boolean': 3, 'match': 4 };
    EXAM_DATA.sort((a, b) => {
      const wA = TYPE_WEIGHTS[a.type] || 99;
      const wB = TYPE_WEIGHTS[b.type] || 99;
      return wA - wB;
    });

    let currentIndex = 0; let userAnswers = {};

    // Cached DOM Nodes for High Performance
    const elProgressText = document.getElementById('progress-text');
    const elTypeBadge = document.getElementById('type-badge');
    const elQuestionTitle = document.getElementById('question-title');
    const elAnswersContainer = document.getElementById('answers-container');
    const elBtnPrev = document.getElementById('btn-prev');
    const elBtnNext = document.getElementById('btn-next');
    const elSidebarDrawer = document.getElementById('sidebar-drawer');
    const elQuizView = document.getElementById('quiz-view');
    const elScoreView = document.getElementById('score-view');

    // Theme Persistence
    const savedTheme = localStorage.getItem('qbank-standalone-theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.remove('dark');
      document.getElementById('btn-theme-toggle').innerText = '☀️ مظهر صباحي';
    }

    function toggleTheme() {
      const isDark = document.body.classList.toggle('dark');
      localStorage.setItem('qbank-standalone-theme', isDark ? 'dark' : 'light');
      document.getElementById('btn-theme-toggle').innerText = isDark ? '🌙 مظهر ليلى' : '☀️ مظهر صباحي';
    }

    function toggleDirection() {
      const currentDir = document.body.getAttribute('dir') || 'rtl';
      const isRtl = currentDir === 'rtl';
      const newDir = isRtl ? 'ltr' : 'rtl';
      document.body.setAttribute('dir', newDir);
      
      // Update dynamic UI texts
      elBtnPrev.innerText = isRtl ? 'Previous' : 'السابق';
      elBtnNext.innerText = isRtl ? 'Next' : 'التالي';
      document.getElementById('lbl-sidebar-title').innerText = isRtl ? 'Question Map' : 'خريطة الأسئلة';
      document.getElementById('btn-map-toggle').innerText = isRtl ? '🗺️ Map Navigator' : '🗺️ خريطة التنقل';
      document.getElementById('lbl-quiz-finished').innerText = isRtl ? 'Quiz Finished!' : 'اكتمل الاختبار!';
      document.getElementById('lbl-review-title').innerText = isRtl ? 'Detailed Answer Review' : 'مراجعة الإجابات التفصيلية';
      
      renderQuestion();
      if (elScoreView.style.display === 'block') {
        calculateScore();
      }
    }

    function toggleSidebar() {
      elSidebarDrawer.classList.toggle('open');
      updateQuestionMap();
    }

    function updateQuestionMap() {
      const grid = document.getElementById('question-map-grid');
      if (!grid) return;
      grid.innerHTML = '';
      
      // Group questions by type preserving sorted index
      const groups = {};
      EXAM_DATA.forEach((q, index) => {
        if (!groups[q.type]) groups[q.type] = [];
        groups[q.type].push({ q, index });
      });

      const isRtl = document.body.getAttribute('dir') !== 'ltr';
      const typeNames = isRtl ? {
        'mcq': 'أسئلة الاختيار من متعدد',
        'boolean': 'أسئلة الصواب والخطأ',
        'written': 'الأسئلة المقالية',
        'match': 'أسئلة التوصيل'
      } : {
        'mcq': 'Multiple Choice Questions',
        'boolean': 'True / False Questions',
        'written': 'Written / Essay Questions',
        'match': 'Matching Questions'
      };

      const orderedTypes = ['written', 'mcq', 'boolean', 'match'];
      
      orderedTypes.forEach(type => {
        const items = groups[type];
        if (!items || items.length === 0) return;
        
        const groupSection = document.createElement('div');
        groupSection.className = 'map-section';
        
        const groupHeader = document.createElement('div');
        groupHeader.className = 'map-section-title';
        groupHeader.innerText = (typeNames[type] || type) + ' (' + items.length + ')';
        groupSection.appendChild(groupHeader);
        
        const buttonsGrid = document.createElement('div');
        buttonsGrid.className = 'map-buttons-grid';
        
        items.forEach(item => {
          const btn = document.createElement('button');
          btn.className = 'map-btn';
          if (currentIndex === item.index) btn.className += ' current';
          
          const ans = userAnswers[item.q.id];
          const isAnswered = ans !== undefined && ans !== null && ans !== '' && (item.q.type !== 'match' || Object.keys(ans).length > 0);
          if (isAnswered) btn.className += ' answered';
          
          btn.innerText = item.index + 1;
          btn.onclick = () => {
            currentIndex = item.index;
            renderQuestion();
            updateQuestionMap();
          };
          buttonsGrid.appendChild(btn);
        });
        
        groupSection.appendChild(buttonsGrid);
        grid.appendChild(groupSection);
      });
    }

    function renderQuestion() {
      const q = EXAM_DATA[currentIndex]; if (!q) return;
      
      const isRtl = document.body.getAttribute('dir') !== 'ltr';
      const totalQs = EXAM_DATA.length;
      elProgressText.innerText = isRtl 
        ? 'السؤال ' + (currentIndex + 1) + ' من ' + totalQs
        : 'Question ' + (currentIndex + 1) + ' of ' + totalQs;
      
      const typeMap = isRtl ? {
        'mcq': 'اختيار من متعدد',
        'boolean': 'صواب / خطأ',
        'written': 'سؤال مقالي',
        'match': 'سؤال توصيل'
      } : {
        'mcq': 'Multiple Choice (MCQ)',
        'boolean': 'True / False',
        'written': 'Written Question',
        'match': 'Matching Matrix'
      };
      
      elTypeBadge.innerText = typeMap[q.type] || q.type;
      elQuestionTitle.innerText = q.question;
      
      elAnswersContainer.innerHTML = '';

      if (q.type === 'mcq') {
        const grid = document.createElement('div'); grid.className = 'options-grid';
        (q.options || []).forEach(opt => {
          const btn = document.createElement('button');
          btn.className = 'option-btn' + (userAnswers[q.id] === opt ? ' selected' : '');
          btn.innerText = opt;
          btn.onclick = () => { userAnswers[q.id] = opt; renderQuestion(); updateQuestionMap(); };
          grid.appendChild(btn);
        });
        elAnswersContainer.appendChild(grid);
      } else if (q.type === 'boolean') {
        const grid = document.createElement('div'); grid.className = 'options-grid';
        const opts = isRtl ? ['صواب (True)', 'خطأ (False)'] : ['True', 'False'];
        opts.forEach(opt => {
          const val = opt.includes('صواب') || opt.includes('True');
          const isSelected = userAnswers[q.id] === val || String(userAnswers[q.id]) === String(val);
          const btn = document.createElement('button');
          btn.className = 'option-btn' + (isSelected ? ' selected' : '');
          btn.innerText = opt;
          btn.onclick = () => { userAnswers[q.id] = val; renderQuestion(); updateQuestionMap(); };
          grid.appendChild(btn);
        });
        elAnswersContainer.appendChild(grid);
      } else if (q.type === 'written') {
        const wrapper = document.createElement('div'); wrapper.className = 'options-grid';
        const textarea = document.createElement('textarea');
        textarea.className = 'textarea-input'; 
        textarea.placeholder = isRtl ? 'اكتب إجابتك المقالية هنا للمراجعة الذاتية...' : 'Write your answer here for self-review...';
        textarea.value = userAnswers[q.id] || '';
        textarea.oninput = (e) => { userAnswers[q.id] = e.target.value; updateQuestionMap(); };
        wrapper.appendChild(textarea);
        elAnswersContainer.appendChild(wrapper);
      } else if (q.type === 'match') {
        const wrapper = document.createElement('div'); wrapper.className = 'options-grid';
        (q.pairs || []).forEach(pair => {
          const row = document.createElement('div'); row.className = 'match-row';
          const label = document.createElement('div'); label.className = 'match-label'; label.innerText = pair.left;
          const select = document.createElement('select'); select.className = 'match-select';
          const defOption = document.createElement('option'); defOption.value = ''; 
          defOption.innerText = isRtl ? 'اختر المطابقة...' : 'Choose match...';
          select.appendChild(defOption);
          
          (q.pairs || []).forEach(p => {
            const o = document.createElement('option'); o.value = p.right; o.innerText = p.right;
            if (userAnswers[q.id] && userAnswers[q.id][pair.left] === p.right) o.selected = true;
            select.appendChild(o);
          });
          select.onchange = (e) => {
            if (!userAnswers[q.id]) userAnswers[q.id] = {};
            userAnswers[q.id][pair.left] = e.target.value;
            updateQuestionMap();
          };
          row.appendChild(label); row.appendChild(select); wrapper.appendChild(row);
        });
        elAnswersContainer.appendChild(wrapper);
      }

      // Self-contained Control buttons for Answer & Explanation
      const revealContainer = document.createElement('div');
      revealContainer.className = 'reveal-container';

      const buttonsRow = document.createElement('div');
      buttonsRow.className = 'reveal-buttons-row';
      revealContainer.appendChild(buttonsRow);

      const showAnswerBtn = document.createElement('button');
      showAnswerBtn.className = 'explain-toggle';
      showAnswerBtn.innerText = isRtl ? '👁️ كشف الإجابة النموذجية' : '👁️ Show Model Answer';
      
      const answerBox = document.createElement('div');
      answerBox.className = 'explain-box';
      
      let answerText = \`\`;
      if (q.type === \`mcq\`) {
        answerText = isRtl ? \`الإجابة النموذجية هي: \${q.answer}\` : \`Model Answer: \${q.answer}\`;
      } else if (q.type === \`boolean\`) {
        const isTrue = q.answer === true || String(q.answer) === \`true\`;
        answerText = isRtl 
          ? \`الإجابة الصحيحة هي: \${isTrue ? \`صواب (True)\` : \`خطأ (False)\`}\`
          : \`Correct Answer: \${isTrue ? \`True\` : \`False\`}\`;
      } else if (q.type === \`written\`) {
        answerText = q.answer || (isRtl ? \`لا توجد إجابة نموذجية.\` : \`No model answer.\`);
      } else if (q.type === \`match\`) {
        answerText = (isRtl ? \`المطابقات الصحيحة:\\\\n\` : \`Correct pairings:\\\\n\`) + 
          (q.pairs || []).map(p => \`- \${p.left} ➔ \${p.right}\`).join(\`\\\\n\`);
      }
      answerBox.innerText = answerText;
      
      showAnswerBtn.onclick = () => {
        const isHidden = answerBox.style.display !== 'block';
        answerBox.style.display = isHidden ? 'block' : 'none';
        showAnswerBtn.innerText = isHidden 
          ? (isRtl ? '🙈 إخفاء الإجابة النموذجية' : '🙈 Hide Model Answer')
          : (isRtl ? '👁️ كشف الإجابة النموذجية' : '👁️ Show Model Answer');
      };
      
      buttonsRow.appendChild(showAnswerBtn);
      revealContainer.appendChild(answerBox);

      if (q.explain) {
        const showExplainBtn = document.createElement('button');
        showExplainBtn.className = 'explain-toggle';
        showExplainBtn.innerText = isRtl ? '💡 عرض الشرح والتفسير' : '💡 Show Explanation';
        
        const explainBox = document.createElement('div');
        explainBox.className = 'explain-box';
        explainBox.style.backgroundColor = 'var(--info-bg)';
        explainBox.style.borderColor = 'var(--info-border)';
        explainBox.innerText = q.explain;
        
        showExplainBtn.onclick = () => {
          const isHidden = explainBox.style.display !== 'block';
          explainBox.style.display = isHidden ? 'block' : 'none';
          showExplainBtn.innerText = isHidden 
            ? (isRtl ? '🙈 إخفاء الشرح والتفسير' : '🙈 Hide Explanation')
            : (isRtl ? '💡 عرض الشرح والتفسير' : '💡 Show Explanation');
        };
        buttonsRow.appendChild(showExplainBtn);
        revealContainer.appendChild(explainBox);
      }
      
      elAnswersContainer.appendChild(revealContainer);

      if (currentIndex === EXAM_DATA.length - 1) {
        elBtnNext.innerText = isRtl ? 'إنهاء الاختبار' : 'Finish Quiz';
        elBtnNext.className = 'btn-nav btn-finish';
      } else {
        elBtnNext.innerText = isRtl ? 'التالي' : 'Next';
        elBtnNext.className = 'btn-nav btn-next';
      }
      elBtnPrev.disabled = currentIndex === 0;
    }

    function navigate(step) {
      if (step === 1 && currentIndex === EXAM_DATA.length - 1) { calculateScore(); return; }
      currentIndex = Math.max(0, Math.min(EXAM_DATA.length - 1, currentIndex + step));
      renderQuestion();
      updateQuestionMap();
    }

    function calculateScore() {
      let earned = 0; let gradableCount = 0;
      const isRtl = document.body.getAttribute('dir') !== 'ltr';
      
      EXAM_DATA.forEach(q => {
        if (q.type === 'mcq' || q.type === 'boolean') {
          gradableCount++; const ans = userAnswers[q.id];
          if (q.type === 'mcq' && ans === q.answer) earned++;
          if (q.type === 'boolean' && String(ans) === String(q.answer)) earned++;
        }
      });
      
      const pct = gradableCount ? Math.round((earned / gradableCount) * 100) : 100;
      document.getElementById('final-pct').innerText = gradableCount ? pct + '%' : (isRtl ? 'اكتمل' : 'Done');
      document.getElementById('final-detail').innerText = isRtl 
        ? earned + ' / ' + gradableCount + ' إجابات صحيحة'
        : earned + ' / ' + gradableCount + ' Correct Answers';
      
      let feedback = isRtl ? 'عمل ممتاز!' : 'Well Done!';
      let desc = isRtl ? 'لقد أتممت الاختبار بكفاءة عالية، استمر في التقدم.' : 'You have completed the assessment successfully.';
      if (pct >= 85) {
        feedback = isRtl ? 'أداء متميز وجبار! 🏆' : 'Outstanding Performance! 🏆';
        desc = isRtl ? 'لقد أحرزت علامة ممتازة تدل على استيعاب فائق للمادة.' : 'Excellent job! You have demonstrated absolute mastery.';
      } else if (pct >= 50) {
        feedback = isRtl ? 'اجتياز ناجح! 👍' : 'Successful Pass! 👍';
        desc = isRtl ? 'أداء جيد جداً، مع إمكانية تحسين النتيجة في المرة القادمة.' : 'Good job. You passed successfully with room for improvement.';
      } else {
        feedback = isRtl ? 'بحاجة لمزيد من المراجعة 📚' : 'Needs Review 📚';
        desc = isRtl ? 'ننصحك بإعادة قراءة الإجابات النموذجية والشرح لرفع مستواك.' : 'We recommend reviewing the model answers and explanations.';
      }
      
      document.getElementById('feedback').innerText = feedback;
      document.getElementById('feedback-desc').innerText = desc;
      
      // Render Comprehensive Review
      const reviewList = document.getElementById('review-list');
      reviewList.innerHTML = '';
      
      EXAM_DATA.forEach((q, index) => {
        const item = document.createElement('div');
        item.className = 'review-item';
        
        const qTitle = document.createElement('div');
        qTitle.className = 'review-question';
        qTitle.innerText = (isRtl ? 'السؤال ' : 'Question ') + (index + 1) + ': ' + q.question;
        item.appendChild(qTitle);
        
        const badge = document.createElement('span');
        badge.className = 'review-status-badge ';
        
        let isCorrect = false;
        let showGrade = false;
        
        if (q.type === 'mcq' || q.type === 'boolean') {
          showGrade = true;
          const ans = userAnswers[q.id];
          if (q.type === 'mcq' && ans === q.answer) isCorrect = true;
          if (q.type === 'boolean' && String(ans) === String(q.answer)) isCorrect = true;
        }
        
        if (showGrade) {
          if (isCorrect) {
            badge.className += 'status-correct';
            badge.innerText = isRtl ? 'إجابة صحيحة ✓' : 'Correct Answer ✓';
          } else {
            badge.className += 'status-incorrect';
            badge.innerText = isRtl ? 'إجابة خاطئة ✕' : 'Incorrect Answer ✕';
          }
        } else {
          badge.className += 'status-written';
          badge.innerText = q.type === 'written' 
            ? (isRtl ? 'سؤال مقالي (تقييم ذاتي)' : 'Written (Self-Evaluation)')
            : (isRtl ? 'سؤال توصيل' : 'Matching Question');
        }
        item.appendChild(badge);
        
        // Student Answer
        const studentAns = document.createElement('div');
        studentAns.className = 'review-answer-line';
        let studentAnsVal = userAnswers[q.id];
        if (studentAnsVal === undefined || studentAnsVal === null || studentAnsVal === '') {
          studentAnsVal = isRtl ? 'لم يتم الإجابة' : 'Not Answered';
        } else if (q.type === 'boolean') {
          const isAnsTrue = studentAnsVal === true || String(studentAnsVal) === 'true';
          studentAnsVal = isAnsTrue 
            ? (isRtl ? 'صواب (True)' : 'True')
            : (isRtl ? 'خطأ (False)' : 'False');
        } else if (q.type === 'match') {
          studentAnsVal = Object.entries(studentAnsVal).map(([k, v]) => k + ' ➔ ' + v).join(', ');
        }
        studentAns.innerHTML = '<strong>' + (isRtl ? 'إجابتك:' : 'Your Answer:') + '</strong> <span style="color: ' + (showGrade ? (isCorrect ? '#10b981' : '#ef4444') : 'inherit') + '">' + studentAnsVal + '</span>';
        item.appendChild(studentAns);
        
        // Correct Model Answer
        const correctAns = document.createElement('div');
        correctAns.className = 'review-answer-line';
        let correctAnsVal = q.answer;
        if (q.type === 'boolean') {
          const isCorrTrue = correctAnsVal === true || String(correctAnsVal) === 'true';
          correctAnsVal = isCorrTrue 
            ? (isRtl ? 'صواب (True)' : 'True')
            : (isRtl ? 'خطأ (False)' : 'False');
        } else if (q.type === 'match') {
          correctAnsVal = (q.pairs || []).map(p => p.left + ' ➔ ' + p.right).join(', ');
        }
        correctAns.innerHTML = '<strong>' + (isRtl ? 'الإجابة النموذجية:' : 'Model Answer:') + '</strong> <span style="color: #10b981">' + correctAnsVal + '</span>';
        item.appendChild(correctAns);
        
        // Explanation
        if (q.explain) {
          const exp = document.createElement('div');
          exp.className = 'explain-box';
          exp.style.display = 'block';
          exp.style.backgroundColor = 'var(--info-bg)';
          exp.style.borderColor = 'var(--info-border)';
          exp.innerHTML = '<strong>' + (isRtl ? 'الشرح والتفسير:' : 'Explanation:') + '</strong> ' + q.explain;
          item.appendChild(exp);
        }
        
        reviewList.appendChild(item);
      });
      
      elQuizView.style.display = 'none';
      elScoreView.style.display = 'block';
    }

    function resetQuiz() {
      currentIndex = 0; userAnswers = {};
      elScoreView.style.display = 'none';
      elQuizView.style.display = 'block';
      renderQuestion();
      updateQuestionMap();
    }

    // Initialize Question Map & Render
    renderQuestion();
    updateQuestionMap();
  </script>
</body>
</html>`;

  const jsonSpecs = JSON.stringify(sortedQuestions).replace(/<\/script/ig, '<\\/script');

  return htmlTemplate
    .replace(/__QUIZ_TITLE__/g, title)
    .replace('__EXAM_DATA_PLACEHOLDER__', jsonSpecs);
}
