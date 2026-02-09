const root = document.getElementById("root");
const screenId = Number(location.pathname.split("/").pop()) || 1;

const socket = io();
socket.emit("screen:join", { screenId });

let channel = null;

async function load() {
  const r = await fetch(`/api/screen/${screenId}`);
  const data = await r.json();
  channel = data.screen.channel;
  render(data.screen, data.payload);
}

socket.on("content:update", (msg) => {
  if (msg.channel === channel) load();
});

function render(screen, payload) {
  if (screen.channel === "events") return renderSlides(payload.slides);
  return renderMenu(payload.categories, screen.channel);
}

function renderMenu(categories, channel) {
  root.innerHTML = `
    <div class="header">
      <div class="title">${channel === "main-menu" ? "MAIN MENU" : "DRINKS"}</div>
    </div>
    <div class="grid">
      ${categories.map(cat => `
        <div class="panel">
          <div class="panelTitle">${escapeHtml(cat.name)}</div>
          ${cat.items.map(it => `
            <div class="row">
              <div class="name">${escapeHtml(it.name)}</div>
              <div class="price">$${it.price}</div>
            </div>
            ${it.description ? `<div class="desc">${escapeHtml(it.description)}</div>` : ``}
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

let slideIndex = 0;
let slideTimer = null;

function renderSlides(slides) {
  if (!slides?.length) {
    root.innerHTML = `<div class="centerBig">No events yet</div>`;
    return;
  }
  function show() {
    const s = slides[slideIndex % slides.length];
    root.innerHTML = `
      <div class="slide">
        ${s.image_url ? `<img class="slideImg" src="${s.image_url}" />` : ``}
        <div class="slideText">
          <div class="slideTitle">${escapeHtml(s.title)}</div>
          ${s.subtitle ? `<div class="slideSub">${escapeHtml(s.subtitle)}</div>` : ``}
        </div>
      </div>
    `;
    slideIndex++;
  }
  clearInterval(slideTimer);
  show();
  slideTimer = setInterval(show, 8000);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

load();
