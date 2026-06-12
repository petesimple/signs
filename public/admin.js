const ADMIN_PASSWORD = "pray4kevin";
const ADMIN_SESSION_KEY = "barSignageAdminLoggedIn";

const stateEl = document.getElementById("state");
const itemCategory = document.getElementById("itemCategory");
const uploadResult = document.getElementById("uploadResult");

let currentState = null;
let draggedSlideId = null;

function isLoggedIn() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) === "yes";
}

function setLoggedIn() {
  sessionStorage.setItem(ADMIN_SESSION_KEY, "yes");
}

function logout() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
  location.reload();
}

function hideAdminUntilLogin() {
  const children = Array.from(document.body.children);

  children.forEach((child) => {
    child.style.display = "none";
  });
}

function showAdminAfterLogin() {
  const children = Array.from(document.body.children);

  children.forEach((child) => {
    child.style.display = "";
  });

  addLogoutButton();
  ensureYouTubeSlideInputs();
}

function showLoginScreen() {
  hideAdminUntilLogin();

  const login = document.createElement("div");
  login.id = "loginScreen";
  login.innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#090a10;
      color:#f5f5ff;
      font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:24px;
    ">
      <div style="
        width:min(420px, 100%);
        background:#151524;
        border:1px solid #2b2d44;
        border-radius:22px;
        padding:28px;
        box-shadow:0 20px 60px rgba(0,0,0,.35);
      ">
        <h1 style="margin:0 0 8px; font-size:32px;">Bar Signage Admin</h1>
        <p style="margin:0 0 22px; color:#b9bad6;">Kevin’s test bar deserves a tiny velvet rope.</p>

        <label for="adminPassword" style="display:block; margin-bottom:8px; font-weight:700;">Password</label>
        <input
          id="adminPassword"
          type="password"
          autocomplete="current-password"
          placeholder="Enter password"
          style="
            width:100%;
            box-sizing:border-box;
            padding:14px 16px;
            border-radius:14px;
            border:1px solid #33364f;
            background:#0d0d17;
            color:#fff;
            font-size:16px;
            margin-bottom:14px;
          "
        />

        <button
          id="adminLoginBtn"
          style="
            width:100%;
            padding:14px 18px;
            border:0;
            border-radius:14px;
            background:#263c9c;
            color:#fff;
            font-weight:800;
            font-size:16px;
            cursor:pointer;
          "
        >
          Log In
        </button>

        <div id="loginMsg" style="min-height:24px; margin-top:14px; color:#ff9a9a; font-weight:700;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(login);

  const passwordInput = document.getElementById("adminPassword");
  const loginBtn = document.getElementById("adminLoginBtn");
  const msg = document.getElementById("loginMsg");

  function attemptLogin() {
    const entered = passwordInput.value;

    if (entered === ADMIN_PASSWORD) {
      setLoggedIn();
      login.remove();
      showAdminAfterLogin();
      refresh();
      return;
    }

    msg.textContent = "Nope. The puck did not cross the line.";
    passwordInput.value = "";
    passwordInput.focus();
  }

  loginBtn.onclick = attemptLogin;

  passwordInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") attemptLogin();
  });

  setTimeout(() => passwordInput.focus(), 50);
}

function addLogoutButton() {
  if (document.getElementById("logoutBtn")) return;

  const btn = document.createElement("button");
  btn.id = "logoutBtn";
  btn.textContent = "Log Out";
  btn.style.margin = "0 0 16px";
  btn.onclick = logout;

  const h1 = document.querySelector("h1");
  if (h1) {
    h1.insertAdjacentElement("afterend", btn);
  } else {
    document.body.prepend(btn);
  }
}

function ensureYouTubeSlideInputs() {
  const slideTitle = document.getElementById("slideTitle");
  const slideImg = document.getElementById("slideImg");

  if (!slideTitle || !slideImg) return;
  if (document.getElementById("slideMediaType")) return;

  const mediaType = document.createElement("select");
  mediaType.id = "slideMediaType";
  mediaType.style.marginTop = "8px";
  mediaType.style.width = "100%";
  mediaType.style.maxWidth = "520px";
  mediaType.innerHTML = `
    <option value="image">Image Slide</option>
    <option value="youtube">YouTube Video</option>
  `;

  const youtubeInput = document.createElement("input");
  youtubeInput.id = "slideYouTube";
  youtubeInput.placeholder = "YouTube URL";
  youtubeInput.style.marginTop = "8px";
  youtubeInput.style.width = "100%";
  youtubeInput.style.maxWidth = "520px";

  slideImg.insertAdjacentElement("beforebegin", mediaType);
  slideImg.insertAdjacentElement("afterend", youtubeInput);
}

function ensureManagerPanel() {
  let panel = document.getElementById("managerPanel");

  if (!panel) {
    panel = document.createElement("section");
    panel.id = "managerPanel";
    panel.className = "card";
    panel.innerHTML = `
      <h2>Manage Content</h2>

      <h3>Event Slides</h3>
      <div id="slideManager"></div>

      <h3>Categories</h3>
      <div id="categoryManager"></div>

      <h3>Items</h3>
      <div id="itemManager"></div>
    `;

    const stateSection = stateEl.closest("section") || stateEl.parentElement;
    stateSection.parentElement.insertBefore(panel, stateSection);
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[m]));
}

async function apiJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));

  if (!r.ok || data.ok === false) {
    throw new Error(data.error || `Request failed: ${r.status}`);
  }

  return data;
}

async function refresh() {
  if (!isLoggedIn()) return;

  ensureYouTubeSlideInputs();

  const r = await fetch("/api/admin/state");
  const data = await r.json();

  currentState = {
    slides: Array.isArray(data.slides) ? data.slides : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    items: Array.isArray(data.items) ? data.items : []
  };

  stateEl.textContent = JSON.stringify(currentState, null, 2);

  itemCategory.innerHTML = currentState.categories.map(c =>
    `<option value="${c.id}">${esc(c.channel)} - ${esc(c.name)}</option>`
  ).join("");

  ensureManagerPanel();
  renderSlideManager(currentState.slides);
  renderCategoryManager(currentState.categories);
  renderItemManager(currentState.items, currentState.categories);
}

function getSortedSlides(slides) {
  return [...slides].sort((a, b) => {
    const aOrder = Number(a.sort_order ?? a.id);
    const bOrder = Number(b.sort_order ?? b.id);
    return aOrder - bOrder;
  });
}

function renderSlideManager(slides) {
  const el = document.getElementById("slideManager");

  if (!slides.length) {
    el.innerHTML = `<p class="muted">No slides yet.</p>`;
    return;
  }

  const sortedSlides = getSortedSlides(slides);

  el.innerHTML = `
    <p class="muted" style="margin:6px 0 12px;">
      Drag slides up or down to change the Event Slides order. Use the arrows on mobile if dragging acts like a greased puck.
    </p>

    <div id="slideOrderStatus" style="min-height:22px; margin:0 0 8px; color:#b9bad6; font-weight:700;"></div>

    <div id="slideDropList">
      ${sortedSlides.map((slide, index) => {
        const mediaType = slide.media_type || "image";
        const youtubeUrl = slide.youtube_url || "";

        return `
          <div
            class="manageCard slideDragCard"
            draggable="true"
            data-slide-id="${slide.id}"
            style="
              border:1px solid #2b2d44;
              border-radius:14px;
              padding:14px;
              margin:12px 0;
              cursor:grab;
              background:#151524;
            "
          >
            <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
              <div
                title="Drag to reorder"
                style="
                  width:36px;
                  min-height:100px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  border-radius:10px;
                  border:1px solid #33364f;
                  color:#b9bad6;
                  font-size:22px;
                  user-select:none;
                "
              >
                ☰
              </div>

              ${mediaType === "youtube" ? `
                <div style="
                  width:160px;
                  height:100px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  text-align:center;
                  border-radius:10px;
                  border:1px solid #333;
                  color:#fff;
                  background:#351414;
                  padding:10px;
                  box-sizing:border-box;
                  font-weight:800;
                ">
                  YouTube Video
                </div>
              ` : slide.image_url ? `
                <img src="${esc(slide.image_url)}" alt="" style="width:160px; max-height:100px; object-fit:cover; border-radius:10px; border:1px solid #333;">
              ` : `
                <div style="width:160px; height:100px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid #333; color:#999;">
                  No image
                </div>
              `}

              <div style="flex:1; min-width:260px;">
                <div>
                  <strong>Slide ${index + 1}</strong>
                  <span style="color:#8d90b5;">ID ${slide.id}</span>
                  ${slide.is_active ? "" : "<span style='color:#ffcf66;'>(hidden)</span>"}
                  <span style="color:#8d90b5;">Type: ${esc(mediaType)}</span>
                </div>

                <input id="slideTitle_${slide.id}" value="${esc(slide.title)}" placeholder="Title" style="margin-top:8px; width:100%; max-width:520px;">
                <input id="slideSub_${slide.id}" value="${esc(slide.subtitle)}" placeholder="Subtitle" style="margin-top:8px; width:100%; max-width:520px;">

                <select id="slideMediaType_${slide.id}" style="margin-top:8px; width:100%; max-width:520px;">
                  <option value="image" ${mediaType === "image" ? "selected" : ""}>Image Slide</option>
                  <option value="youtube" ${mediaType === "youtube" ? "selected" : ""}>YouTube Video</option>
                </select>

                <input id="slideImg_${slide.id}" value="${esc(slide.image_url)}" placeholder="Image URL" style="margin-top:8px; width:100%; max-width:520px;">
                <input id="slideYouTube_${slide.id}" value="${esc(youtubeUrl)}" placeholder="YouTube URL" style="margin-top:8px; width:100%; max-width:520px;">

                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                  <button onclick="moveSlide(${slide.id}, -1)">Move Up</button>
                  <button onclick="moveSlide(${slide.id}, 1)">Move Down</button>
                  <button onclick="saveSlide(${slide.id})">Save</button>
                  <button onclick="toggleSlide(${slide.id})">${slide.is_active ? "Hide" : "Show"}</button>
                  <button onclick="deleteSlide(${slide.id})">Delete</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  setupSlideDragAndDrop();
}

function setSlideOrderStatus(message) {
  const el = document.getElementById("slideOrderStatus");
  if (el) el.textContent = message;
}

function setupSlideDragAndDrop() {
  const list = document.getElementById("slideDropList");
  if (!list) return;

  const cards = Array.from(list.querySelectorAll(".slideDragCard"));

  cards.forEach(card => {
    card.addEventListener("dragstart", event => {
      draggedSlideId = card.dataset.slideId;
      card.style.opacity = "0.45";
      card.style.cursor = "grabbing";

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", draggedSlideId);
    });

    card.addEventListener("dragend", () => {
      draggedSlideId = null;
      card.style.opacity = "";
      card.style.cursor = "grab";

      Array.from(list.querySelectorAll(".slideDragCard")).forEach(c => {
        c.style.borderColor = "#2b2d44";
      });
    });

    card.addEventListener("dragover", event => {
      event.preventDefault();

      const draggingCard = list.querySelector(`[data-slide-id="${draggedSlideId}"]`);
      if (!draggingCard || draggingCard === card) return;

      card.style.borderColor = "#7c8cff";

      const rect = card.getBoundingClientRect();
      const halfway = rect.top + rect.height / 2;

      if (event.clientY < halfway) {
        list.insertBefore(draggingCard, card);
      } else {
        list.insertBefore(draggingCard, card.nextSibling);
      }
    });

    card.addEventListener("dragleave", () => {
      card.style.borderColor = "#2b2d44";
    });

    card.addEventListener("drop", async event => {
      event.preventDefault();
      await saveSlideOrderFromDom();
    });
  });
}

window.moveSlide = async function moveSlide(id, direction) {
  if (!isLoggedIn()) return;

  const list = document.getElementById("slideDropList");
  if (!list) return;

  const card = list.querySelector(`[data-slide-id="${id}"]`);
  if (!card) return;

  if (direction < 0 && card.previousElementSibling) {
    list.insertBefore(card, card.previousElementSibling);
    await saveSlideOrderFromDom();
  }

  if (direction > 0 && card.nextElementSibling) {
    list.insertBefore(card.nextElementSibling, card);
    await saveSlideOrderFromDom();
  }
};

async function saveSlideOrderFromDom() {
  if (!isLoggedIn()) return;
  if (!currentState?.slides?.length) return;

  const cards = Array.from(document.querySelectorAll("#slideDropList .slideDragCard"));
  if (!cards.length) return;

  setSlideOrderStatus("Saving slide order...");

  const updates = cards.map((card, index) => {
    const id = Number(card.dataset.slideId);
    const oldSlide = currentState.slides.find(s => Number(s.id) === id);

    return {
      id,
      payload: {
        title: document.getElementById(`slideTitle_${id}`)?.value ?? oldSlide?.title ?? "",
        subtitle: document.getElementById(`slideSub_${id}`)?.value ?? oldSlide?.subtitle ?? "",
        image_url: document.getElementById(`slideImg_${id}`)?.value ?? oldSlide?.image_url ?? "",
        media_type: document.getElementById(`slideMediaType_${id}`)?.value ?? oldSlide?.media_type ?? "image",
        youtube_url: document.getElementById(`slideYouTube_${id}`)?.value ?? oldSlide?.youtube_url ?? "",
        is_active: oldSlide?.is_active ?? 1,
        sort_order: index + 1
      }
    };
  });

  try {
    await Promise.all(updates.map(update =>
      apiJson(`/api/admin/slide/${update.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update.payload)
      })
    ));

    setSlideOrderStatus("Slide order saved.");
    await refresh();
  } catch (err) {
    setSlideOrderStatus("");
    alert(err.message);
  }
}

function renderCategoryManager(categories) {
  const el = document.getElementById("categoryManager");

  if (!categories.length) {
    el.innerHTML = `<p class="muted">No categories yet.</p>`;
    return;
  }

  el.innerHTML = categories.map(cat => `
    <div class="manageCard" style="border:1px solid #2b2d44; border-radius:14px; padding:14px; margin:12px 0;">
      <div><strong>Category ${cat.id}</strong></div>

      <select id="catChannel_${cat.id}" style="margin-top:8px;">
        <option value="main-menu" ${cat.channel === "main-menu" ? "selected" : ""}>Main Menu</option>
        <option value="drinks" ${cat.channel === "drinks" ? "selected" : ""}>Drinks</option>
        <option value="events" ${cat.channel === "events" ? "selected" : ""}>Events</option>
      </select>

      <input id="catName_${cat.id}" value="${esc(cat.name)}" placeholder="Category name" style="margin-top:8px;">

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        <button onclick="saveCategory(${cat.id})">Save</button>
        <button onclick="deleteCategory(${cat.id})">Delete Category and Items</button>
      </div>
    </div>
  `).join("");
}

function renderItemManager(items, categories) {
  const el = document.getElementById("itemManager");

  if (!items.length) {
    el.innerHTML = `<p class="muted">No items yet.</p>`;
    return;
  }

  const categoryOptions = (selectedId) => categories.map(cat =>
    `<option value="${cat.id}" ${Number(cat.id) === Number(selectedId) ? "selected" : ""}>${esc(cat.channel)} - ${esc(cat.name)}</option>`
  ).join("");

  el.innerHTML = items.map(item => `
    <div class="manageCard" style="border:1px solid #2b2d44; border-radius:14px; padding:14px; margin:12px 0;">
      <div><strong>Item ${item.id}</strong> ${item.is_active ? "" : "<span style='color:#ffcf66;'>(hidden)</span>"}</div>

      <select id="itemCat_${item.id}" style="margin-top:8px;">
        ${categoryOptions(item.category_id)}
      </select>

      <input id="itemName_${item.id}" value="${esc(item.name)}" placeholder="Item name" style="margin-top:8px;">
      <input id="itemPrice_${item.id}" value="${esc((Number(item.price_cents || 0) / 100).toFixed(2))}" placeholder="Price" style="margin-top:8px;">
      <input id="itemDesc_${item.id}" value="${esc(item.description)}" placeholder="Description" style="margin-top:8px;">
      <input id="itemImg_${item.id}" value="${esc(item.image_url)}" placeholder="Image URL" style="margin-top:8px;">

      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
        <button onclick="saveItem(${item.id})">Save</button>
        <button onclick="toggleItem(${item.id})">${item.is_active ? "Hide" : "Show"}</button>
        <button onclick="deleteItem(${item.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

document.getElementById("uploadBtn").onclick = async () => {
  if (!isLoggedIn()) return;

  const file = document.getElementById("file").files[0];

  if (!file) {
    alert("Pick a file first");
    return;
  }

  const fd = new FormData();
  fd.append("file", file);

  const r = await fetch("/api/admin/upload", {
    method: "POST",
    body: fd
  });

  const data = await r.json();

  if (!data.ok) {
    alert(data.error || "Upload failed");
    return;
  }

  uploadResult.textContent = `Uploaded: ${data.image_url}`;

  const slideMediaType = document.getElementById("slideMediaType");
  if (slideMediaType) slideMediaType.value = "image";

  const slideImg = document.getElementById("slideImg");
  if (slideImg) slideImg.value = data.image_url;

  const itemImg = document.getElementById("itemImg");
  if (itemImg && !itemImg.value) itemImg.value = data.image_url;
};

document.getElementById("addCatBtn").onclick = async () => {
  if (!isLoggedIn()) return;

  const channel = document.getElementById("catChannel").value;
  const name = document.getElementById("catName").value;

  try {
    await apiJson("/api/admin/category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, name })
    });

    document.getElementById("catName").value = "";
    refresh();
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById("addItemBtn").onclick = async () => {
  if (!isLoggedIn()) return;

  const payload = {
    category_id: Number(itemCategory.value),
    name: document.getElementById("itemName").value,
    price: document.getElementById("itemPrice").value,
    description: document.getElementById("itemDesc").value,
    image_url: document.getElementById("itemImg").value
  };

  try {
    await apiJson("/api/admin/item", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    document.getElementById("itemName").value = "";
    document.getElementById("itemPrice").value = "";
    document.getElementById("itemDesc").value = "";
    document.getElementById("itemImg").value = "";
    refresh();
  } catch (err) {
    alert(err.message);
  }
};

document.getElementById("addSlideBtn").onclick = async () => {
  if (!isLoggedIn()) return;

  const payload = {
    title: document.getElementById("slideTitle").value,
    subtitle: document.getElementById("slideSub").value,
    image_url: document.getElementById("slideImg").value,
    media_type: document.getElementById("slideMediaType")?.value || "image",
    youtube_url: document.getElementById("slideYouTube")?.value || ""
  };

  try {
    await apiJson("/api/admin/slide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    document.getElementById("slideTitle").value = "";
    document.getElementById("slideSub").value = "";
    document.getElementById("slideImg").value = "";

    const slideMediaType = document.getElementById("slideMediaType");
    if (slideMediaType) slideMediaType.value = "image";

    const slideYouTube = document.getElementById("slideYouTube");
    if (slideYouTube) slideYouTube.value = "";

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.saveSlide = async function saveSlide(id) {
  if (!isLoggedIn()) return;

  const oldSlide = currentState.slides.find(s => Number(s.id) === Number(id));

  const payload = {
    title: document.getElementById(`slideTitle_${id}`).value,
    subtitle: document.getElementById(`slideSub_${id}`).value,
    image_url: document.getElementById(`slideImg_${id}`).value,
    media_type: document.getElementById(`slideMediaType_${id}`)?.value || oldSlide?.media_type || "image",
    youtube_url: document.getElementById(`slideYouTube_${id}`)?.value || oldSlide?.youtube_url || "",
    is_active: oldSlide?.is_active ?? 1,
    sort_order: oldSlide?.sort_order ?? Date.now()
  };

  try {
    await apiJson(`/api/admin/slide/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.toggleSlide = async function toggleSlide(id) {
  if (!isLoggedIn()) return;

  try {
    await apiJson(`/api/admin/slide/${id}/toggle`, {
      method: "POST"
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.deleteSlide = async function deleteSlide(id) {
  if (!isLoggedIn()) return;
  if (!confirm(`Delete slide ${id}?`)) return;

  try {
    await apiJson(`/api/admin/slide/${id}`, {
      method: "DELETE"
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.saveCategory = async function saveCategory(id) {
  if (!isLoggedIn()) return;

  const oldCat = currentState.categories.find(c => Number(c.id) === Number(id));

  const payload = {
    channel: document.getElementById(`catChannel_${id}`).value,
    name: document.getElementById(`catName_${id}`).value,
    sort_order: oldCat?.sort_order ?? Date.now()
  };

  try {
    await apiJson(`/api/admin/category/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.deleteCategory = async function deleteCategory(id) {
  if (!isLoggedIn()) return;
  if (!confirm(`Delete category ${id} and all items inside it?`)) return;

  try {
    await apiJson(`/api/admin/category/${id}`, {
      method: "DELETE"
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.saveItem = async function saveItem(id) {
  if (!isLoggedIn()) return;

  const oldItem = currentState.items.find(i => Number(i.id) === Number(id));

  const payload = {
    category_id: Number(document.getElementById(`itemCat_${id}`).value),
    name: document.getElementById(`itemName_${id}`).value,
    price: document.getElementById(`itemPrice_${id}`).value,
    description: document.getElementById(`itemDesc_${id}`).value,
    image_url: document.getElementById(`itemImg_${id}`).value,
    is_active: oldItem?.is_active ?? 1,
    sort_order: oldItem?.sort_order ?? Date.now()
  };

  try {
    await apiJson(`/api/admin/item/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.toggleItem = async function toggleItem(id) {
  if (!isLoggedIn()) return;

  try {
    await apiJson(`/api/admin/item/${id}/toggle`, {
      method: "POST"
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.deleteItem = async function deleteItem(id) {
  if (!isLoggedIn()) return;
  if (!confirm(`Delete item ${id}?`)) return;

  try {
    await apiJson(`/api/admin/item/${id}`, {
      method: "DELETE"
    });

    refresh();
  } catch (err) {
    alert(err.message);
  }
};

if (isLoggedIn()) {
  showAdminAfterLogin();
  refresh();
} else {
  showLoginScreen();
}
