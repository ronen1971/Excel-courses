// Mobile nav toggle
const toggle = document.querySelector('.nav-toggle');
const links = document.querySelector('.nav-links');
toggle.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  toggle.setAttribute('aria-expanded', open);
});
links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  links.classList.remove('open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();

// Reveal on scroll
const revealEls = document.querySelectorAll('.module, .course-offer, .benefit, .testimonial, .faq-list details, .about-text, .section-head');
if ('IntersectionObserver' in window) {
  revealEls.forEach(el => el.classList.add('reveal'));
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach(el => io.observe(el));
}

// Contact form: posts to FormSubmit (https://formsubmit.co) -> ronenbus@gmail.com.
// Client-side validation first; if valid, the browser submits normally.
const form = document.getElementById('contactForm');
const status = form.querySelector('.form-status');
form.addEventListener('submit', e => {
  const name = form.elements['name'].value.trim();
  const email = form.elements['email'].value.trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
    e.preventDefault();
    status.textContent = 'נא למלא שם ואימייל תקין.';
    status.classList.add('error');
    return;
  }
  status.classList.remove('error');
  status.textContent = 'שולח...';
  form.querySelector('button[type="submit"]').disabled = true;
});
