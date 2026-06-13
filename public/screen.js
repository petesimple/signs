const root = document.getElementById("root");
const screenId = Number(location.pathname.split("/").pop()) || 1;

const socket = io();
socket.emit("screen:join", { screenId });

let channel = null;
let slideIndex = 0;
let slideTimer = null;
let ytPlayer = null;
let ytApiReady = false;
let ytApiLoading = false;
let ytApiCallbacks = [];
let currentSlides = [];

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
  stopSlidePlayback();

  if (screen.channel === "events") {
    renderSlides(payload.slides);
    return;
  }

  renderMenu(payload.categories, screen.channel);
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

function stopSlidePlayback() {
  if (slideTimer) {
    clearTimeout(slideTimer);
    slideTimer = null;
  }

  if (ytPlayer && typeof ytPlayer.destroy === "function") {
    try {
      ytPlayer.destroy();
    } catch (err) {
      console.warn("Could not destroy YouTube player", err);
    }
  }

  ytPlayer = null;
}

function renderSlides(slides) {
  currentSlides = Array.isArray(slides) ? slides : [];

  if (!currentSlides.length) {
    root.innerHTML = `<div class="centerBig">No events yet</div>`;
    return;
  }

  stopSlidePlayback();
  showNextSlide();
}

function showNextSlide() {
  if (!currentSlides.length) return;

  stopSlidePlayback();

  const slide = currentSlides[slideIndex % currentSlides.length];
  slideIndex++;

  if (slide.media_type === "youtube" && slide.youtube_url) {
    showYouTubeSlide(slide);
    return;
  }

  showImageSlide(slide);
  slideTimer = setTimeout(showNextSlide, 8000);
}

function showImageSlide(slide) {
  root.innerHTML = `
    <div class="slide">
      ${slide.image_url ? `<img class="slideImg" src="${escapeHtml(slide.image_url)}" />` : ``}
      <div class="slideText">
        <div class="slideTitle">${escapeHtml(slide.title)}</div>
        ${slide.subtitle ? `<div class="slideSub">${escapeHtml(slide.subtitle)}</div>` : ``}
      </div>
    </div>
  `;
}

function showYouTubeSlide(slide) {
  const videoId = getYouTubeId(slide.youtube_url);

  if (!videoId) {
    showNextSlide();
    return;
  }

  root.innerHTML = `
    <div class="slide youtubeSlide" style="position:relative; width:100vw; height:100vh; overflow:hidden; background:#000;">
      <div
        id="youtubePlayer"
        style="position:absolute; inset:0; width:100%; height:100%; z-index:1;"
      ></div>

      <div
        class="slideText youtubeText"
        style="position:absolute; left:6vw; bottom:7vh; z-index:2; pointer-events:none;"
      >
        <div class="slideTitle">${escapeHtml(slide.title)}</div>
        ${slide.subtitle ? `<div class="slideSub">${escapeHtml(slide.subtitle)}</div>` : ``}
      </div>
    </div>
  `;

  ensureYouTubeApi(() => {
    try {
      ytPlayer = new YT.Player("youtubePlayer", {
        width: "100%",
        height: "100%",
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          iv_load_policy: 3,
          origin: window.location.origin
        },
        events: {
          onReady: event => {
            event.target.mute();
            event.target.playVideo();

            const iframe = document.querySelector("#youtubePlayer iframe");
            if (iframe) {
              iframe.style.width = "100%";
              iframe.style.height = "100%";
              iframe.style.position = "absolute";
              iframe.style.inset = "0";
            }
          },
          onStateChange: event => {
            if (event.data === YT.PlayerState.ENDED) {
              showNextSlide();
            }
          },
          onError: event => {
            console.warn("YouTube player error", event.data);
            slideTimer = setTimeout(showNextSlide, 5000);
          }
        }
      });

      slideTimer = setTimeout(() => {
        console.warn("YouTube fallback timer advanced the slide.");
        showNextSlide();
      }, 10 * 60 * 1000);
    } catch (err) {
      console.warn("YouTube player setup failed", err);
      showDirectYouTubeIframe(videoId, slide);
    }
  });
}

function showDirectYouTubeIframe(videoId, slide) {
  root.innerHTML = `
    <div class="slide youtubeSlide" style="position:relative; width:100vw; height:100vh; overflow:hidden; background:#000;">
      <iframe
        src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&mute=1&controls=0&playsinline=1&rel=0&modestbranding=1"
        title="${escapeHtml(slide.title)}"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowfullscreen
        style="position:absolute; inset:0; width:100%; height:100%; border:0; z-index:1;"
      ></iframe>

      <div
        class="slideText youtubeText"
        style="position:absolute; left:6vw; bottom:7vh; z-index:2; pointer-events:none;"
      >
        <div class="slideTitle">${escapeHtml(slide.title)}</div>
        ${slide.subtitle ? `<div class="slideSub">${escapeHtml(slide.subtitle)}</div>` : ``}
      </div>
    </div>
  `;

  slideTimer = setTimeout(showNextSlide, 5 * 60 * 1000);
}

function ensureYouTubeApi(callback) {
  if (ytApiReady && window.YT && window.YT.Player) {
    callback();
    return;
  }

  ytApiCallbacks.push(callback);

  if (ytApiLoading) return;

  ytApiLoading = true;

  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytApiLoading = false;

    const callbacks = [...ytApiCallbacks];
    ytApiCallbacks = [];

    callbacks.forEach(fn => fn());
  };

  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.onerror = () => {
    console.warn("YouTube API failed to load. Using direct iframe fallback.");
    ytApiLoading = false;

    const callbacks = [...ytApiCallbacks];
    ytApiCallbacks = [];

    callbacks.forEach(fn => fn());
  };

  document.head.appendChild(tag);
}

function getYouTubeId(url) {
  const value = String(url || "").trim();

  const patterns = [
    /youtu\.be\/([^?&/#]+)/,
    /youtube\.com\/watch\?v=([^?&/#]+)/,
    /youtube\.com\/embed\/([^?&/#]+)/,
    /youtube\.com\/shorts\/([^?&/#]+)/
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }

  return "";
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

load();
