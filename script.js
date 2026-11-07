// 1. Dark mode toggle with a circular reveal (remembers the choice)
const root = document.documentElement;
const themeBtn = document.getElementById("theme-btn");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

themeBtn.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  const apply = () => {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("theme", next); } catch (e) {}
  };
  if (!document.startViewTransition || reduceMotion) { apply(); return; }

  const r = themeBtn.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(apply).ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 750, easing: "ease-in-out", pseudoElement: "::view-transition-new(root)" }
    );
  });
});

// 2. Header gets a bottom border once you scroll
const header = document.getElementById("site-header");
const onScroll = () => header.classList.toggle("scrolled", window.scrollY > 8);
onScroll();

// 3. Skill filter and "Show more"
const articles = [...document.querySelectorAll(".article")];
const chips = [...document.querySelectorAll(".chip")];
const showMoreBtn = document.getElementById("show-more");
const emptyMsg = document.getElementById("empty-msg");
let activeFilter = null;
let expanded = false;

function render() {
  let visible = 0;
  articles.forEach((a) => {
    const matches = !activeFilter || a.dataset.tags.split(" ").includes(activeFilter);
    const isExtra = a.hasAttribute("data-extra");
    // While filtering, show every match; otherwise respect "Show more"
    const show = matches && (activeFilter || expanded || !isExtra);
    a.hidden = !show;
    if (show) visible++;
  });
  emptyMsg.hidden = visible > 0;
  showMoreBtn.hidden = !!activeFilter || expanded;
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const same = activeFilter === chip.dataset.filter;
    activeFilter = same ? null : chip.dataset.filter;
    chips.forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.filter === activeFilter)));
    render();
    if (!same) document.getElementById("journey").scrollIntoView({ behavior: "smooth" });
  });
});

showMoreBtn.addEventListener("click", () => { expanded = true; render(); });
render();

// 4. Contact form validation
// Your Formspree form address (messages are delivered to your email)
const FORM_ENDPOINT = "https://formspree.io/f/xeaawrwd";
const form = document.getElementById("contact-form");
const statusEl = document.getElementById("form-status");

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = form.name.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  statusEl.className = "form-status";
  if (!name) { statusEl.textContent = "Enter your name."; statusEl.classList.add("error"); form.name.focus(); return; }
  if (!emailOk) { statusEl.textContent = "Enter a valid email address."; statusEl.classList.add("error"); form.email.focus(); return; }
  if (!message) { statusEl.textContent = "Write a message first."; statusEl.classList.add("error"); form.message.focus(); return; }

    if (!FORM_ENDPOINT || FORM_ENDPOINT.includes("YOUR_ID")) {
      statusEl.textContent = "The form is not connected yet. Please use the email link below.";
      statusEl.classList.add("error");
      return;
    }

    const sendBtn = form.querySelector("button[type='submit']");
    sendBtn.disabled = true;
    statusEl.textContent = "Sending...";

    fetch(FORM_ENDPOINT, {
      method: "POST",
      headers: { "Accept": "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Request failed");
        statusEl.textContent = "Thanks! Your message was sent.";
        statusEl.classList.add("ok");
        form.reset();
      })
      .catch(() => {
        statusEl.textContent = "Something went wrong. Please email me directly.";
        statusEl.classList.add("error");
      })
      .finally(() => { sendBtn.disabled = false; });
});

// 5. Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// 6. Little guide creature: follows your scroll, changes mood per section
const mascot = document.getElementById("mascot");
const bubble = document.getElementById("bubble");
const pupils = mascot.querySelectorAll(".pupil");
const mouth = mascot.querySelector(".m-mouth");
const INK = "hsl(225 25% 12%)";

const MOUTHS = {
  smile: { d: "M51 72 Q60 84 69 72", fill: "none" },
  grin:  { d: "M49 71 Q60 94 71 71 Z", fill: INK },
  oh:    { d: "M56 74 Q60 70 64 74 Q64 82 60 82 Q56 82 56 74 Z", fill: INK }
};

// One step per section. Edit the text to change what the guide says.
const STEPS = [
  { el: document.querySelector(".intro"), mood: "wave",    mouth: "grin",  text: "Hi! I’m your guide. Scroll down and I’ll show you around." },
  { el: document.getElementById("about"), mood: "calm",    mouth: "smile", text: "This is the story behind the page. Meet the person." },
  { el: document.getElementById("journey"), mood: "proud", mouth: "grin",  text: "Here is the journey so far: HSC, IELTS and activities." },
  { el: document.getElementById("topics"), mood: "curious", mouth: "oh",   text: "Tap a topic and I’ll filter the journey for you." },
  { el: document.getElementById("goals"), mood: "excited", mouth: "grin",  text: "Almost there! This is what comes next." },
  { el: document.getElementById("contact"), mood: "wave",  mouth: "grin",  text: "You made it! Say hello below." }
];

mascot.setAttribute("aria-label", "Guide: take me to the next section");

let current = -1;
let hideTimer, tiltTimer, lookTimer;
let scrollLook = null;

function say(text) {
  bubble.textContent = text;
  bubble.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => bubble.classList.remove("show"), 6000);
}

function hop() {
  mascot.classList.remove("hop");
  void mascot.offsetWidth; // restart the animation
  mascot.classList.add("hop");
}

function look(x, y) {
  pupils.forEach((p) => { p.style.transform = `translate(${x}px, ${y}px)`; });
}

function setStep(i) {
  if (i === current) return;
  const first = current === -1;
  current = i;
  const step = STEPS[i];
  mascot.dataset.mood = step.mood;
  mouth.setAttribute("d", MOUTHS[step.mouth].d);
  mouth.setAttribute("fill", MOUTHS[step.mouth].fill);
  say(step.text);
  if (!first) hop();
}

function pickStep() {
  const line = window.innerHeight * 0.3;
  let index = 0;
  STEPS.forEach((s, i) => { if (s.el.getBoundingClientRect().top <= line) index = i; });
  const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  setStep(atBottom ? STEPS.length - 1 : index);
}

// Scrolling: lean with the speed, look in the scroll direction, pick the section
let lastY = window.scrollY;
function onCreatureScroll() {
  const y = window.scrollY;
  const delta = y - lastY;
  lastY = y;

  mascot.style.setProperty("--tilt", Math.max(-10, Math.min(10, delta * 0.5)));
  clearTimeout(tiltTimer);
  tiltTimer = setTimeout(() => mascot.style.setProperty("--tilt", 0), 140);

  if (Math.abs(delta) > 1) {
    scrollLook = delta > 0 ? 1 : -1;
    look(0, scrollLook * 3.5);
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => { scrollLook = null; look(0, 0); }, 600);
  }
  pickStep();
}

// Idle: the eyes follow the pointer
window.addEventListener("mousemove", (e) => {
  if (scrollLook !== null) return;
  const r = mascot.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height * 0.4);
  const dist = Math.hypot(dx, dy) || 1;
  const move = Math.min(4, dist / 40);
  look((dx / dist) * move, (dy / dist) * move);
}, { passive: true });

// Click: hop and guide to the next section
mascot.addEventListener("click", () => {
  const next = (current + 1) % STEPS.length;
  STEPS[next].el.scrollIntoView({ behavior: "smooth" });
  hop();
  say(next === 0 ? "Back to the top we go!" : "Follow me!");
});

window.addEventListener("resize", pickStep);
pickStep();

// 7. Glossy motion: scroll reveal, progress bar, card tilt, button effects
const reveals = [];
function mark(selector, step) {
  document.querySelectorAll(selector).forEach((el, i) => {
    el.classList.add("reveal");
    el.style.setProperty("--d", `${Math.min(i, 6) * step}ms`);
    reveals.push(el);
  });
}
mark(".intro-text > *, .intro-photo", 110);
mark(".section > h2", 0);
mark(".article", 90);
mark(".about-text, .facts, .chips, .chip-hint, .goals li", 90);
mark(".footer-grid > div", 120);

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("in");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
reveals.forEach((el) => revealObserver.observe(el));

const bar = document.createElement("div");
bar.className = "progress";
document.body.appendChild(bar);
function setProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  bar.style.setProperty("--p", max > 0 ? window.scrollY / max : 0);
}
setProgress();

document.querySelectorAll(".article").forEach((card) => {
  card.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = card.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    card.style.setProperty("--ry", `${(px - 0.5) * 8}deg`);
    card.style.setProperty("--rx", `${(0.5 - py) * 6}deg`);
    card.style.setProperty("--gx", `${px * 100}%`);
    card.style.setProperty("--gy", `${py * 100}%`);
  });
  card.addEventListener("pointerleave", () => {
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
});

document.querySelectorAll(".show-more, .intro-links a").forEach((btn) => {
  btn.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty("--mx", `${(e.clientX - r.left - r.width / 2) * 0.22}px`);
    btn.style.setProperty("--my", `${(e.clientY - r.top - r.height / 2) * 0.3}px`);
  });
  btn.addEventListener("pointerleave", () => {
    btn.style.setProperty("--mx", "0px");
    btn.style.setProperty("--my", "0px");
  });
  btn.addEventListener("click", (e) => {
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2;
    const x = e.detail === 0 ? r.width / 2 : e.clientX - r.left;
    const y = e.detail === 0 ? r.height / 2 : e.clientY - r.top;
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.cssText = `width:${size}px;height:${size}px;left:${x - size / 2}px;top:${y - size / 2}px`;
    btn.appendChild(dot);
    dot.addEventListener("animationend", () => dot.remove());
  });
});

// 8. One scroll handler, run at most once per frame, so scrolling stays smooth
let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    onScroll();
    onCreatureScroll();
    setProgress();
    ticking = false;
  });
}, { passive: true });