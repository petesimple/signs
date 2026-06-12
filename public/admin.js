const stateEl = document.getElementById("state");
const itemCategory = document.getElementById("itemCategory");
const uploadResult = document.getElementById("uploadResult");

let currentState = null;

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
  const r = await fetch("/api/admin/state");
  const data = await r.json();
  currentState = data;

  stateEl.textContent = JSON.stringify(data, null, 2);

  itemCategory.innerHTML = data.categories.map(c =>
    `<option value="${c.id}">${esc(c.channel)} - ${esc(c.name)}</option>`
  ).join("");

  ensureManagerPanel();
  renderSlideManager(data.slides);
  renderCategoryManager(data.categories);
  renderItemManager(data.items, data.categories);
}

function renderSlideManager(slides) {
  const el = document.getElementById("slideManager");

  if (!slides.length) {
    el.innerHTML = `<p class="muted">No slides yet.</p>`;
    return;
  }

  el.innerHTML = slides.map(slide => `
    <div class="manageCard" style="border:1px solid #2b2d44; border-radius:14px; padding:14px; margin:12px 0;">
      <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
        ${slide.image_url ? `
          <img src="${esc(slide.image_url)}" alt="" style="width:160px; max-height:100px; object-fit:cover; border-radius:10px; border:1px solid #333;">
        ` : `
          <div style="width:160px; height:100px; display:flex; align-items:center; justify-content:center; border-radius:10px; border:1px solid #333; color:#999;">
            No image
          </div>
        `}

        <div style="flex:1; min-width:260px;">
          <div><strong>Slide ${slide.id}</strong> ${slide.is_active ? "" : "<span style='color:#ffcf66;'>(hidden)</span>"}</div>

          <input id="slideTitle_${slide.id}" value="${esc(slide.title)}" placeholder="Title" style="margin-top:8px; width:100%; max-width:520px;">
          <input id="slideSub_${slide.id}" value="${esc(slide.subtitle)}" placeholder="Subtitle" style="margin-top:8px; width:100%; max-width:520px;">
          <input id="slideImg_${slide.id}" value="${esc(slide.image_url)}" placeholder="Image URL" style="margin-top:8px; width:100%; max-width:520px;">

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
            <button onclick="saveSlide(${slide.id})">Save</button>
            <button onclick="toggleSlide(${slide.id})">${slide.is_active ? "Hide" : "Show"}</button>
            <button onclick="deleteSlide(${slide.id})">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
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
      <input id="itemPrice_${item.id}" value="${esc((item.price_cents / 100).toFixed(2))}" placeholder="Price" style="margin-top:8px;">
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

  const slideImg = document.getElementById("slideImg");
  if (slideImg) slideImg.value = data.image_url;

  const itemImg = document.getElementById("itemImg");
  if (itemImg && !itemImg.value) itemImg.value = data.image_url;
};

document.getElementById("addCatBtn").onclick = async () => {
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
  const payload = {
    title: document.getElementById("slideTitle").value,
    subtitle: document.getElementById("slideSub").value,
    image_url: document.getElementById("slideImg").value
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
    refresh();
  } catch (err) {
    alert(err.message);
  }
};

window.saveSlide = async function saveSlide(id) {
  const oldSlide = currentState.slides.find(s => Number(s.id) === Number(id));

  const payload = {
    title: document.getElementById(`slideTitle_${id}`).value,
    subtitle: document.getElementById(`slideSub_${id}`).value,
    image_url: document.getElementById(`slideImg_${id}`).value,
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

refresh();
