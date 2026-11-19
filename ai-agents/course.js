// Per-viewer progress is a convenience only: storage may be unavailable, so every access is guarded.
const STORE_KEY = 'ai-agents-course-progress';
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
function save(data) { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* ignore */ } }
let progress = load();

// Build TOC from modules and lessons
const tocList = document.getElementById('tocList');
document.querySelectorAll('.module').forEach(mod => {
  const li = document.createElement('li');
  const title = mod.querySelector('.module-head h2').textContent;
  const tag = mod.querySelector('.module-head .tag').textContent;
  li.innerHTML = `<a class="mod-link" href="#${mod.id}">${tag}: ${title.split(':')[0]}</a>`;
  const sub = document.createElement('ol');
  mod.querySelectorAll('.lesson').forEach(lesson => {
    const h = lesson.querySelector('h3');
    const num = h.querySelector('.ln').textContent;
    const text = h.textContent.replace(num, '').trim();
    const a = document.createElement('a');
    a.href = `#${lesson.id}`;
    a.dataset.lesson = lesson.id;
    a.textContent = `${num} ${text}`;
    const sli = document.createElement('li');
    sli.appendChild(a);
    sub.appendChild(sli);
  });
  li.appendChild(sub);
  tocList.appendChild(li);
});

// Lesson completion checkboxes
const boxes = document.querySelectorAll('.lesson-done input');
function render() {
  let done = 0;
  boxes.forEach(b => {
    b.checked = !!progress[b.dataset.lesson];
    if (b.checked) done++;
    const link = tocList.querySelector(`a[data-lesson="${b.dataset.lesson}"]`);
    if (link) link.classList.toggle('done', b.checked);
  });
  const pct = Math.round((done / boxes.length) * 100);
  document.getElementById('progressPill').textContent = `התקדמות: ${pct}%`;
  document.getElementById('overallBar').style.width = pct + '%';
  document.querySelectorAll('.syl-card').forEach(card => {
    const mod = document.getElementById(card.dataset.mod);
    const lessons = mod.querySelectorAll('.lesson-done input');
    const d = [...lessons].filter(x => x.checked).length;
    card.querySelector('.syl-bar span').style.width = (lessons.length ? (d / lessons.length) * 100 : 0) + '%';
  });
}
boxes.forEach(b => b.addEventListener('change', () => {
  if (b.checked) progress[b.dataset.lesson] = true; else delete progress[b.dataset.lesson];
  save(progress);
  render();
}));
render();

// Quizzes
document.querySelectorAll('.quiz').forEach(quiz => {
  quiz.querySelector('.check-quiz').addEventListener('click', () => {
    let right = 0;
    const qs = quiz.querySelectorAll('.q');
    qs.forEach(q => {
      q.classList.add('answered');
      q.querySelectorAll('label').forEach(l => l.classList.remove('right', 'wrong'));
      const chosen = q.querySelector('input:checked');
      const correct = q.querySelector(`input[value="${q.dataset.answer}"]`);
      correct.closest('label').classList.add('right');
      if (chosen && chosen.value === q.dataset.answer) right++;
      else if (chosen) chosen.closest('label').classList.add('wrong');
    });
    quiz.querySelector('.quiz-result').textContent = `${right} מתוך ${qs.length} ${right === qs.length ? '🎉' : ''}`;
  });
});

// Copy buttons on code blocks
document.querySelectorAll('pre').forEach(pre => {
  const btn = document.createElement('button');
  btn.className = 'copy-btn';
  btn.type = 'button';
  btn.textContent = 'העתקה';
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(pre.querySelector('code').innerText);
      btn.textContent = 'הועתק ✓';
    } catch { btn.textContent = 'לא הצליח'; }
    setTimeout(() => (btn.textContent = 'העתקה'), 1500);
  });
  pre.appendChild(btn);
});

// Highlight current lesson in the TOC
if ('IntersectionObserver' in window) {
  const links = tocList.querySelectorAll('a[data-lesson]');
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        links.forEach(l => l.classList.toggle('active', l.dataset.lesson === e.target.id));
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px' });
  document.querySelectorAll('.lesson').forEach(l => io.observe(l));
}

document.getElementById('year').textContent = new Date().getFullYear();
