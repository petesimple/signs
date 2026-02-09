const stateEl = document.getElementById("state");
const itemCategory = document.getElementById("itemCategory");
const uploadResult = document.getElementById("uploadResult");

async function refresh() {
  const r = await fetch("/api/admin/state");
  const data = await r.json();
  stateEl.textContent = JSON.stringify(data, null, 2);

  // populate categories for items
  itemCategory.innerHTML = data.categories.map(c =>
    `<option value="${c.id}">${c.channel} - ${c.name}</option>`
  ).join("");
}

document.getElementById("uploadBtn").onclick = async () => {
  const file = document.getElementById("file").files[0];
  if (!file) return alert("Pick a file first");
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch("/api/admin/upload", { method: "POST", body: fd });
  const data = await r.json();
  if (!data.ok) return alert("Upload failed");
  uploadResult.textContent = `Uploaded: ${data.image_url}`;
};

document.getElementById("addCatBtn").onclick = async () => {
  const channel = document.getElementById("catChannel").value;
  const name = document.getElementById("catName").value;
  const r = await fetch("/api/admin/category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel, name })
  });
  const data = await r.json();
  if (!data.ok) return alert(data.error || "Failed");
  document.getElementById("catName").value = "";
  refresh();
};

document.getElementById("addItemBtn").onclick = async () => {
  const payload = {
    category_id: Number(itemCategory.value),
    name: document.getElementById("itemName").value,
    price: document.getElementById("itemPrice").value,
    description: document.getElementById("itemDesc").value,
    image_url: document.getElementById("itemImg").value
  };
  const r = await fetch("/api/admin/item", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) return alert(data.error || "Failed");
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemDesc").value = "";
  document.getElementById("itemImg").value = "";
  refresh();
};

document.getElementById("addSlideBtn").onclick = async () => {
  const payload = {
    title: document.getElementById("slideTitle").value,
    subtitle: document.getElementById("slideSub").value,
    image_url: document.getElementById("slideImg").value
  };
  const r = await fetch("/api/admin/slide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!data.ok) return alert(data.error || "Failed");
  document.getElementById("slideTitle").value = "";
  document.getElementById("slideSub").value = "";
  document.getElementById("slideImg").value = "";
  refresh();
};

refresh();
