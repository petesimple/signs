import express from "express";
import http from "http";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { Server as SocketIOServer } from "socket.io";
import { db, initDb } from "./db.js";

initDb();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.use(express.json());
app.use(express.static(path.join(process.cwd(), "public")));
app.use("/uploads", express.static(path.join(process.cwd(), "server", "uploads")));

const upload = multer({ storage: multer.memoryStorage() });

function pushUpdate(channel) {
  io.to(`channel:${channel}`).emit("content:update", {
    channel,
    ts: Date.now()
  });
}

function getScreenById(screenId) {
  return db.prepare("SELECT * FROM screens WHERE id=?").get(screenId);
}

function getCategoryById(categoryId) {
  return db.prepare("SELECT * FROM categories WHERE id=?").get(categoryId);
}

function getSlideById(slideId) {
  return db.prepare("SELECT * FROM slides WHERE id=?").get(slideId);
}

io.on("connection", (socket) => {
  socket.on("screen:join", ({ screenId }) => {
    const screen = getScreenById(Number(screenId));
    if (!screen) return;

    socket.join(`channel:${screen.channel}`);
    socket.emit("screen:config", screen);
  });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "admin.html"));
});

app.get("/screen/:id", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "screen.html"));
});

app.get("/api/screen/:id", (req, res) => {
  const id = Number(req.params.id);
  const screen = getScreenById(id);

  if (!screen) {
    return res.status(404).json({ error: "screen not found" });
  }

  const payload = getChannelPayload(screen.channel);
  res.json({ screen, payload });
});

function getChannelPayload(channel) {
  if (channel === "events") {
    const slides = db.prepare(`
      SELECT *
      FROM slides
      WHERE is_active=1
      ORDER BY sort_order ASC, id ASC
    `).all();

    return { slides };
  }

  const categories = db.prepare(`
    SELECT *
    FROM categories
    WHERE channel=?
    ORDER BY sort_order ASC, id ASC
  `).all(channel);

  const itemsByCat = db.prepare(`
    SELECT *
    FROM items
    WHERE category_id=? AND is_active=1
    ORDER BY sort_order ASC, id ASC
  `);

  const hydratedCategories = categories.map((category) => ({
    ...category,
    items: itemsByCat.all(category.id).map((item) => ({
      ...item,
      price: (item.price_cents / 100).toFixed(2)
    }))
  }));

  return { categories: hydratedCategories };
}

app.get("/api/admin/state", (req, res) => {
  const screens = db.prepare(`
    SELECT *
    FROM screens
    ORDER BY id
  `).all();

  const categories = db.prepare(`
    SELECT *
    FROM categories
    ORDER BY channel, sort_order, id
  `).all();

  const items = db.prepare(`
    SELECT *
    FROM items
    ORDER BY category_id, sort_order, id
  `).all();

  const slides = db.prepare(`
    SELECT *
    FROM slides
    ORDER BY sort_order, id
  `).all();

  res.json({ screens, categories, items, slides });
});

app.post("/api/admin/category", (req, res) => {
  const { channel, name } = req.body;

  if (!["main-menu", "drinks", "events"].includes(channel)) {
    return res.status(400).json({ error: "bad channel" });
  }

  if (!name?.trim()) {
    return res.status(400).json({ error: "name required" });
  }

  const info = db.prepare(`
    INSERT INTO categories(channel, name, sort_order)
    VALUES(?, ?, ?)
  `).run(channel, name.trim(), Date.now());

  pushUpdate(channel);

  res.json({
    ok: true,
    id: info.lastInsertRowid
  });
});

app.put("/api/admin/category/:id", (req, res) => {
  const id = Number(req.params.id);
  const { channel, name, sort_order } = req.body;

  const existing = getCategoryById(id);
  if (!existing) {
    return res.status(404).json({ error: "category not found" });
  }

  const nextChannel = channel || existing.channel;
  const nextName = name?.trim() || existing.name;
  const nextSortOrder = Number(sort_order || existing.sort_order);

  if (!["main-menu", "drinks", "events"].includes(nextChannel)) {
    return res.status(400).json({ error: "bad channel" });
  }

  db.prepare(`
    UPDATE categories
    SET channel=?, name=?, sort_order=?
    WHERE id=?
  `).run(nextChannel, nextName, nextSortOrder, id);

  pushUpdate(existing.channel);
  pushUpdate(nextChannel);

  res.json({ ok: true });
});

app.delete("/api/admin/category/:id", (req, res) => {
  const id = Number(req.params.id);

  const existing = getCategoryById(id);
  if (!existing) {
    return res.status(404).json({ error: "category not found" });
  }

  db.prepare("DELETE FROM items WHERE category_id=?").run(id);
  db.prepare("DELETE FROM categories WHERE id=?").run(id);

  pushUpdate(existing.channel);

  res.json({ ok: true });
});

app.post("/api/admin/item", (req, res) => {
  const {
    category_id,
    name,
    price,
    description = "",
    image_url = ""
  } = req.body;

  if (!category_id) {
    return res.status(400).json({ error: "category_id required" });
  }

  if (!name?.trim()) {
    return res.status(400).json({ error: "name required" });
  }

  const category = getCategoryById(category_id);
  if (!category) {
    return res.status(404).json({ error: "category not found" });
  }

  const priceCents = Math.round(Number(price || 0) * 100);

  db.prepare(`
    INSERT INTO items(category_id, name, price_cents, description, image_url, sort_order)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(
    category_id,
    name.trim(),
    priceCents,
    description,
    image_url,
    Date.now()
  );

  pushUpdate(category.channel);

  res.json({ ok: true });
});

app.put("/api/admin/item/:id", (req, res) => {
  const id = Number(req.params.id);
  const {
    category_id,
    name,
    price,
    description = "",
    image_url = "",
    is_active = 1,
    sort_order
  } = req.body;

  const existing = db.prepare("SELECT * FROM items WHERE id=?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "item not found" });
  }

  const oldCategory = getCategoryById(existing.category_id);
  const nextCategoryId = Number(category_id || existing.category_id);
  const nextCategory = getCategoryById(nextCategoryId);

  if (!nextCategory) {
    return res.status(404).json({ error: "category not found" });
  }

  const nextName = name?.trim() || existing.name;
  const nextPriceCents = Math.round(Number(price || existing.price_cents / 100) * 100);
  const nextSortOrder = Number(sort_order || existing.sort_order);

  db.prepare(`
    UPDATE items
    SET category_id=?, name=?, price_cents=?, description=?, image_url=?, is_active=?, sort_order=?
    WHERE id=?
  `).run(
    nextCategoryId,
    nextName,
    nextPriceCents,
    description,
    image_url,
    Number(is_active) ? 1 : 0,
    nextSortOrder,
    id
  );

  if (oldCategory) pushUpdate(oldCategory.channel);
  pushUpdate(nextCategory.channel);

  res.json({ ok: true });
});

app.delete("/api/admin/item/:id", (req, res) => {
  const id = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM items WHERE id=?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "item not found" });
  }

  const category = getCategoryById(existing.category_id);

  db.prepare("DELETE FROM items WHERE id=?").run(id);

  if (category) pushUpdate(category.channel);

  res.json({ ok: true });
});

app.post("/api/admin/item/:id/toggle", (req, res) => {
  const id = Number(req.params.id);

  const existing = db.prepare("SELECT * FROM items WHERE id=?").get(id);
  if (!existing) {
    return res.status(404).json({ error: "item not found" });
  }

  const nextActive = existing.is_active ? 0 : 1;

  db.prepare(`
    UPDATE items
    SET is_active=?
    WHERE id=?
  `).run(nextActive, id);

  const category = getCategoryById(existing.category_id);
  if (category) pushUpdate(category.channel);

  res.json({
    ok: true,
    is_active: nextActive
  });
});

app.post("/api/admin/slide", (req, res) => {
  const {
    title,
    subtitle = "",
    image_url = "",
    media_type = "image",
    youtube_url = ""
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ error: "title required" });
  }

  const cleanMediaType = media_type === "youtube" ? "youtube" : "image";

  const info = db.prepare(`
    INSERT INTO slides(title, subtitle, image_url, media_type, youtube_url, sort_order)
    VALUES(?, ?, ?, ?, ?, ?)
  `).run(
    title.trim(),
    subtitle,
    image_url,
    cleanMediaType,
    youtube_url,
    Date.now()
  );

  pushUpdate("events");

  res.json({
    ok: true,
    id: info.lastInsertRowid
  });
});

app.put("/api/admin/slide/:id", (req, res) => {
  const id = Number(req.params.id);

  const {
    title,
    subtitle = "",
    image_url = "",
    media_type = "image",
    youtube_url = "",
    is_active = 1,
    sort_order
  } = req.body;

  const existing = getSlideById(id);
  if (!existing) {
    return res.status(404).json({ error: "slide not found" });
  }

  if (!title?.trim()) {
    return res.status(400).json({ error: "title required" });
  }

  const cleanMediaType = media_type === "youtube" ? "youtube" : "image";
  const nextSortOrder = Number(sort_order || existing.sort_order);

  db.prepare(`
    UPDATE slides
    SET title=?, subtitle=?, image_url=?, media_type=?, youtube_url=?, is_active=?, sort_order=?
    WHERE id=?
  `).run(
    title.trim(),
    subtitle,
    image_url,
    cleanMediaType,
    youtube_url,
    Number(is_active) ? 1 : 0,
    nextSortOrder,
    id
  );

  pushUpdate("events");

  res.json({ ok: true });
});

app.delete("/api/admin/slide/:id", (req, res) => {
  const id = Number(req.params.id);

  const existing = getSlideById(id);
  if (!existing) {
    return res.status(404).json({ error: "slide not found" });
  }

  db.prepare("DELETE FROM slides WHERE id=?").run(id);

  pushUpdate("events");

  res.json({ ok: true });
});

app.post("/api/admin/slide/:id/toggle", (req, res) => {
  const id = Number(req.params.id);

  const existing = getSlideById(id);
  if (!existing) {
    return res.status(404).json({ error: "slide not found" });
  }

  const nextActive = existing.is_active ? 0 : 1;

  db.prepare(`
    UPDATE slides
    SET is_active=?
    WHERE id=?
  `).run(nextActive, id);

  pushUpdate("events");

  res.json({
    ok: true,
    is_active: nextActive
  });
});

app.post("/api/admin/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "no file" });
    }

    const outDir = path.join(process.cwd(), "server", "uploads");
    const filename = `img_${Date.now()}.jpg`;
    const outPath = path.join(outDir, filename);

    await sharp(req.file.buffer)
      .resize({ width: 1200, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toFile(outPath);

    res.json({
      ok: true,
      image_url: `/uploads/${filename}`
    });
  } catch (err) {
    console.error("Upload failed:", err);
    res.status(500).json({
      error: "upload failed",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 5177;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Bar Signage running on http://localhost:${PORT}`);
  console.log(`Network access should work at http://PI_IP:${PORT}`);
});
