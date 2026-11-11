(function () {
  'use strict';
  const { evaluate, XlError, numToCol, parseRef } = Engine;

  /* ---------- Exercises ---------- */
  // rows: sheet data starting at A1 (null = empty). targets: cells the student fills.
  const EXERCISES = [
    { level: 'מתחילים', title: 'סכום עמודה',
      task: 'חשבו את סך המחירים. בתא B7 הקלידו נוסחה שמסכמת את B2:B6.',
      hint: 'פונקציית SUM מקבלת טווח: SUM(התחלה:סוף).',
      rows: [['מוצר', 'מחיר'], ['לחם', 12], ['חלב', 7], ['גבינה', 25], ['ביצים', 18], ['שמן', 22], ['סה״כ', null]],
      targets: { B7: '=SUM(B2:B6)' },
      note: 'SUM מסכמת טווח שלם בבת אחת, ולכן אין צורך לחבר תא אחרי תא.' },
    { level: 'מתחילים', title: 'ממוצע ציונים',
      task: 'חשבו את ממוצע הציונים בתא B7.',
      hint: 'AVERAGE(B2:B6)',
      rows: [['תלמיד', 'ציון'], ['דנה', 90], ['יוסי', 75], ['מיכל', 88], ['אבי', 60], ['נועה', 97], ['ממוצע', null]],
      targets: { B7: '=AVERAGE(B2:B6)' },
      note: 'AVERAGE מתעלמת מתאים ריקים וטקסט, מה שמבדיל אותה מחילוק ידני.' },
    { level: 'מתחילים', title: 'הגבוה והנמוך',
      task: 'מצאו את המכירות הגבוהות ביותר בתא B7 ואת הנמוכות ביותר בתא B8.',
      hint: 'MAX מחזירה את הגדול ביותר ו-MIN את הקטן ביותר.',
      rows: [['חודש', 'מכירות'], ['ינואר', 1200], ['פברואר', 950], ['מרץ', 1800], ['אפריל', 1425], ['מאי', 1100], ['הגבוה ביותר', null], ['הנמוך ביותר', null]],
      targets: { B7: '=MAX(B2:B6)', B8: '=MIN(B2:B6)' },
      note: 'MAX ו-MIN שימושיות מאוד לדוחות: שיא, שפל והפער ביניהם.' },
    { level: 'בינוניים', title: 'כמות כפול מחיר',
      task: 'בעמודה D חשבו לכל מוצר את הסכום: כמות כפול מחיר ליחידה (D2 עד D4).',
      hint: 'הקלידו =B2*C2 ב-D2. בנוסחאות אפשר להשתמש בכוכבית לכפל.',
      rows: [['מוצר', 'כמות', 'מחיר ליחידה', 'סה״כ'], ['עט', 10, 3, null], ['מחברת', 5, 12, null], ['תיק', 2, 89, null]],
      targets: { D2: '=B2*C2', D3: '=B3*C3', D4: '=B4*C4' },
      note: 'באקסל אפשר לגרור נוסחה למטה והיא מתעדכנת לבד (הפניה יחסית).' },
    { level: 'בינוניים', title: 'עבר או נכשל',
      task: 'בעמודה C כתבו "עבר" אם הציון 60 ומעלה, ו"נכשל" אחרת (C2 עד C5).',
      hint: 'IF(תנאי, ערך אם נכון, ערך אם לא). טקסט כותבים בין גרשיים: "עבר".',
      rows: [['תלמיד', 'ציון', 'תוצאה'], ['דנה', 90, null], ['יוסי', 45, null], ['מיכל', 60, null], ['אבי', 58, null]],
      targets: { C2: '=IF(B2>=60,"עבר","נכשל")', C3: '=IF(B3>=60,"עבר","נכשל")', C4: '=IF(B4>=60,"עבר","נכשל")', C5: '=IF(B5>=60,"עבר","נכשל")' },
      note: 'שימו לב לסימן >= כדי ש-60 בדיוק ייחשב כעובר.' },
    { level: 'בינוניים', title: 'ספירה לפי תנאי',
      task: 'בתא B8 ספרו כמה פעמים מופיעה העיר "תל אביב" ברשימה.',
      hint: 'COUNTIF(טווח, "ערך לספירה")',
      rows: [['עיר'], ['תל אביב'], ['חיפה'], ['תל אביב'], ['ירושלים'], ['תל אביב'], ['חיפה'], ['כמות בתל אביב', null]],
      targets: { B8: '=COUNTIF(A2:A7,"תל אביב")' },
      note: 'COUNTIF מקבלת גם תנאים כמו ">100" או "<>חיפה".' },
    { level: 'בינוניים', title: 'סכום לפי קטגוריה',
      task: 'בתא B7 סכמו רק את ההוצאות בקטגוריה "מזון".',
      hint: 'SUMIF(טווח הקטגוריות, "מזון", טווח הסכומים)',
      rows: [['קטגוריה', 'סכום'], ['מזון', 120], ['ביגוד', 300], ['מזון', 80], ['בילויים', 150], ['מזון', 45], ['סה״כ מזון', null]],
      targets: { B7: '=SUMIF(A2:A6,"מזון",B2:B6)' },
      note: 'SUMIF היא הבסיס לדוחות סיכום, ובהמשך הקורס נראה איך טבלת ציר עושה זאת בלחיצה.' },
    { level: 'מתקדמים', title: 'חיפוש מחיר לפי קוד',
      task: 'ב-B7 מופיע קוד מוצר. בתא B8 שלפו את המחיר שלו מהטבלה (A2:C5).',
      hint: 'VLOOKUP(מה מחפשים, הטבלה, מספר העמודה, FALSE). המחיר נמצא בעמודה השלישית, ו-FALSE פירושו התאמה מדויקת.',
      rows: [['קוד', 'מוצר', 'מחיר'], [101, 'מקלדת', 150], [102, 'עכבר', 80], [103, 'מסך', 900], [104, 'אוזניות', 220], [], ['קוד לחיפוש', 103], ['מחיר', null]],
      targets: { B8: '=VLOOKUP(B7,A2:C5,3,FALSE)' },
      note: 'VLOOKUP מחפשת תמיד בעמודה הראשונה של הטבלה. שנו את הקוד וראו את התוצאה מתעדכנת.' },
    { level: 'מתקדמים', title: 'מע״מ ועיגול',
      task: 'בעמודה C חשבו מחיר כולל מע״מ (18%) מעוגל לספרה אחת אחרי הנקודה.',
      hint: 'ROUND(מספר, ספרות). המחיר כולל מע״מ הוא B2*1.18.',
      rows: [['מוצר', 'לפני מע״מ', 'כולל מע״מ'], ['כיסא', 200, null], ['שולחן', 550, null], ['מנורה', 70, null]],
      targets: { C2: '=ROUND(B2*1.18,1)', C3: '=ROUND(B3*1.18,1)', C4: '=ROUND(B4*1.18,1)' },
      note: 'עיגול בפועל (ROUND) שונה מעיצוב תצוגה: הוא משנה את הערך עצמו.' },
    { level: 'מתקדמים', title: 'חיבור טקסטים',
      task: 'בעמודה C חברו שם פרטי ושם משפחה עם רווח ביניהם (C2 עד C4).',
      hint: 'האמפרסנד & מחבר טקסטים: =A2&" "&B2',
      rows: [['שם פרטי', 'שם משפחה', 'שם מלא'], ['דנה', 'כהן', null], ['יוסי', 'לוי', null], ['מיכל', 'אברהם', null]],
      targets: { C2: '=A2&" "&B2', C3: '=A3&" "&B3', C4: '=A4&" "&B4' },
      note: 'הרווח בין גרשיים הוא טקסט לכל דבר, בלעדיו השמות היו נדבקים.' }
  ];

  /* ---------- State ---------- */
  const KEY = 'excelLab.v1';
  let state = { done: {}, inputs: {}, current: 0 };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } };

  /* ---------- Sheet model ---------- */
  const ex = () => EXERCISES[state.current];
  const userInputs = () => (state.inputs[state.current] = state.inputs[state.current] || {});
  const dataAt = (e, ref) => {
    const p = parseRef(ref);
    const row = e.rows[p.row - 1];
    const v = row ? row[p.col - 1] : undefined;
    return v === undefined ? null : v;
  };

  // Evaluate a cell's raw content, given a source of raw values.
  function makeGetter(e, rawOf) {
    const visiting = new Set();
    const get = (col, row) => {
      const ref = numToCol(col) + row;
      const raw = rawOf(ref);
      if (raw === null || raw === undefined || raw === '') return null;
      if (typeof raw === 'string' && raw.trim().startsWith('=')) {
        if (visiting.has(ref)) throw new XlError('#REF!');
        visiting.add(ref);
        try { return evaluate(raw, get); } finally { visiting.delete(ref); }
      }
      if (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw)) && e.targets[ref] !== undefined) return Number(raw);
      return raw;
    };
    return get;
  }
  const userRaw = ref => {
    const e = ex();
    return e.targets[ref] !== undefined ? (userInputs()[ref] || '') : dataAt(e, ref);
  };
  const solutionRaw = ref => {
    const e = ex();
    return e.targets[ref] !== undefined ? e.targets[ref] : dataAt(e, ref);
  };
  const calc = (rawOf, ref) => {
    const p = parseRef(ref);
    try { return { v: makeGetter(ex(), rawOf)(p.col, p.row) }; }
    catch (err) { return { err: err instanceof XlError ? err.code : '#ERR' }; }
  };
  const fmt = v => v === null ? '' : typeof v === 'number' ? String(Number(v.toPrecision(12))) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  const show = r => r.err ? r.err : fmt(r.v);
  const same = (a, b) => (typeof a === 'number' && typeof b === 'number') ? Math.abs(a - b) < 1e-9 : a === b;

  /* ---------- Rendering ---------- */
  const $ = id => document.getElementById(id);
  let selected = null;

  function renderList() {
    const ol = $('list'); ol.innerHTML = '';
    EXERCISES.forEach((e, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = (i === state.current ? 'active ' : '') + (state.done[i] ? 'done' : '');
      b.innerHTML = '<span class="num">' + (state.done[i] ? '✓' : i + 1) + '</span><span></span>';
      b.lastChild.textContent = e.title;
      b.addEventListener('click', () => go(i));
      li.appendChild(b); ol.appendChild(li);
    });
    const n = Object.keys(state.done).length;
    $('progressText').textContent = n + ' / ' + EXERCISES.length;
    $('progressFill').style.width = (n / EXERCISES.length * 100) + '%';
  }

  function renderSheet() {
    const e = ex();
    const nRows = e.rows.length;
    const nCols = Math.max(...e.rows.map(r => r.length), 3);
    const t = $('sheet'); t.innerHTML = '';
    const head = t.insertRow();
    head.appendChild(document.createElement('th'));
    for (let c = 1; c <= nCols; c++) { const th = document.createElement('th'); th.textContent = numToCol(c); head.appendChild(th); }
    for (let r = 1; r <= nRows; r++) {
      const tr = t.insertRow();
      const rh = document.createElement('th'); rh.className = 'rh'; rh.textContent = r; tr.appendChild(rh);
      for (let c = 1; c <= nCols; c++) {
        const ref = numToCol(c) + r;
        const td = tr.insertCell(); td.dataset.ref = ref;
        if (e.targets[ref] !== undefined) {
          td.className = 'target';
          const inp = document.createElement('input');
          inp.setAttribute('aria-label', 'תא ' + ref);
          inp.autocomplete = 'off'; inp.spellcheck = false;
          inp.value = userInputs()[ref] ? show(calc(userRaw, ref)) : '';
          inp.addEventListener('focus', () => { select(ref); inp.value = userInputs()[ref] || ''; });
          inp.addEventListener('input', () => { userInputs()[ref] = inp.value; save(); updateBar(ref); clearMarks(); });
          inp.addEventListener('blur', () => { inp.value = userInputs()[ref] ? show(calc(userRaw, ref)) : ''; });
          inp.addEventListener('keydown', ev => {
            if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); moveNext(ref); }
          });
          td.appendChild(inp);
        } else {
          const v = dataAt(e, ref);
          const span = document.createElement('span'); span.className = 'v'; span.textContent = fmt(v);
          td.appendChild(span);
          if (typeof v === 'number') td.classList.add('num');
          if (r === 1 && typeof v === 'string') td.classList.add('head');
          td.addEventListener('click', () => select(ref));
        }
      }
    }
  }

  function select(ref) {
    selected = ref;
    document.querySelectorAll('#sheet td.sel').forEach(td => td.classList.remove('sel'));
    const td = document.querySelector('#sheet td[data-ref="' + ref + '"]');
    if (td) td.classList.add('sel');
    updateBar(ref);
  }
  function updateBar(ref) {
    $('cellName').textContent = ref;
    const e = ex();
    if (e.targets[ref] !== undefined) {
      const raw = userInputs()[ref] || '';
      $('formulaText').textContent = raw;
      $('liveResult').textContent = raw.trim().startsWith('=') ? '→ ' + show(calc(userRaw, ref)) : '';
    } else { $('formulaText').textContent = fmt(dataAt(e, ref)); $('liveResult').textContent = ''; }
  }
  function moveNext(ref) {
    const keys = Object.keys(ex().targets);
    const i = keys.indexOf(ref);
    if (i >= 0 && i < keys.length - 1) {
      const inp = document.querySelector('#sheet td[data-ref="' + keys[i + 1] + '"] input');
      if (inp) inp.focus();
    }
  }
  function clearMarks() {
    document.querySelectorAll('#sheet td').forEach(td => td.classList.remove('ok', 'bad', 'err'));
  }
  function feedback(kind, html) { const f = $('feedback'); f.className = 'feedback ' + kind; f.innerHTML = html; }
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  function renderExercise() {
    const e = ex();
    $('level').textContent = e.level;
    $('counter').textContent = 'תרגיל ' + (state.current + 1) + ' מתוך ' + EXERCISES.length;
    $('title').textContent = e.title;
    $('task').textContent = e.task;
    $('next').hidden = !state.done[state.current] || state.current === EXERCISES.length - 1;
    feedback('', '');
    $('cellName').textContent = '—'; $('formulaText').textContent = ''; $('liveResult').textContent = '';
    renderSheet(); renderList();
  }
  function go(i) { state.current = i; save(); renderExercise(); }

  /* ---------- Actions ---------- */
  function check() {
    const e = ex(); clearMarks();
    let allOk = true, firstMsg = '';
    Object.keys(e.targets).forEach(ref => {
      const td = document.querySelector('#sheet td[data-ref="' + ref + '"]');
      const raw = (userInputs()[ref] || '').trim();
      let msg = '';
      if (!raw) msg = 'תא ' + ref + ' עדיין ריק.';
      else if (!raw.startsWith('=')) msg = 'בתא ' + ref + ' צריך נוסחה: התחילו ב-= ולא הקלידו תשובה ישירה.';
      else if (!/[A-Za-z]+\$?\d+|[A-Za-z]+\(/.test(raw)) msg = 'בתא ' + ref + ' הנוסחה צריכה להתבסס על תאים או פונקציה, לא על מספר קבוע.';
      else {
        const got = calc(userRaw, ref), want = calc(solutionRaw, ref);
        if (got.err) { td.classList.add('err'); msg = 'בתא ' + ref + ' התקבלה שגיאה ' + esc(got.err) + '.'; }
        else if (!same(got.v, want.v)) msg = 'בתא ' + ref + ' התוצאה היא ' + esc(show(got)) + ', וזה לא התוצאה הנכונה.';
      }
      td.classList.add(msg ? 'bad' : 'ok');
      if (msg) { allOk = false; firstMsg = firstMsg || msg; }
    });
    if (allOk) {
      state.done[state.current] = true; save(); renderList();
      const last = state.current === EXERCISES.length - 1;
      feedback('good', '🎉 נכון! ' + esc(e.note) + (Object.keys(state.done).length === EXERCISES.length ? ' סיימתם את כל התרגילים!' : ''));
      $('next').hidden = last;
    } else feedback('warn', firstMsg + ' נסו שוב, ואפשר ללחוץ על "רמז".');
  }
  function fillSolution() {
    const e = ex();
    Object.keys(e.targets).forEach(ref => { userInputs()[ref] = e.targets[ref]; });
    save(); renderSheet(); clearMarks();
    feedback('info', 'הפתרון: ' + Object.keys(e.targets).map(r => esc(r) + ' <code>' + esc(e.targets[r]) + '</code>').join(' · ') + '. לחצו "בדיקה" כדי לסמן את התרגיל כהושלם.');
  }

  $('check').addEventListener('click', check);
  $('hint').addEventListener('click', () => feedback('info', '💡 ' + esc(ex().hint)));
  $('solution').addEventListener('click', fillSolution);
  $('next').addEventListener('click', () => go(Math.min(state.current + 1, EXERCISES.length - 1)));
  $('reset').addEventListener('click', () => {
    if (confirm('לאפס את כל ההתקדמות?')) { state = { done: {}, inputs: {}, current: 0 }; save(); renderExercise(); }
  });

  if (!(state.current >= 0 && state.current < EXERCISES.length)) state.current = 0;
  renderExercise();
})();
