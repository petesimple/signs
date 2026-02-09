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

// --- realtime helper
function pushUpdate(channel) {
  io.to(`channel:${channel}`).emit("content:update", { channel, ts: Date.now() });
}

// --- socket connections from screens
io.on("connection", (socket) => {
  socket.on("screen:join", ({ screenId }) => {
    const s = db.prepare("SELECT * FROM screens WHERE id=?").get(screenId);
    if (!s) return;
    socket.join(`channel:${s.channel}`);
    socket.emit("screen:config", s);
  });
});

// --- API: get screen config + content
app.get("/api/screen/:id", (req, res) => {
  const id = Number(req.params.id);
  const screen = db.prepare("SELECT * FROM screens WHERE id=?").get(id);
  if (!screen) return res.status(404).json({ error: "screen not found" });

  const payload = getChannelPayload(screen.channel);
  res.json({ screen, payload });
});

function getChannelPayload(channel) {
  if (channel === "events") {
    const slides = db.prepare(
      "SELECT * FROM slides WHERE is_active=1 ORDER BY sort_order ASC, id ASC"
    ).all();
    return { slides };
  }

  // main-menu or drinks
  const cats = db.prepare(
    "SELECT * FROM categories WHERE channel=? ORDER BY sort_order ASC, id ASC"
  ).all(channel);

  const itemsByCat = db.prepare(
    "SELECT * FROM items WHERE category_id=? AND is_active=1 ORDER BY sort_order ASC, id ASC"
  );

  const categories = cats.map((c) => ({
    ...c,
    items: itemsByCat.all(c.id).map((it) => ({
      ...it,
      price: (it.price_cents / 100).toFixed(2)
    }))
  }));

  return { categories };
}

// --- API: admin gets everything (simple v1)
app.get("/api/admin/state", (req, res) => {
  const screens = db.prepare("SELECT * FROM screens ORDER BY id").all();
  const categories = db.prepare("SELECT * FROM categories ORDER BY channel, sort_order, id").all();
  const items = db.prepare("SELECT * FROM items ORDER BY category_id, sort_order, id").all();
  const slides = db.prepare("SELECT * FROM slides ORDER BY sort_order, id").all();
  res.json({ screens, categories, items, slides });
});

// --- API: add category
app.post("/api/admin/category", (req, res) => {
  const { channel, name } = req.body;
  if (!["main-menu", "drinks"].includes(channel)) return res.status(400).json({ error: "bad channel" });
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  const stmt = db.prepare("INSERT INTO categories(channel,name,sort_order) VALUES(?,?,?)");
  const info = stmt.run(channel, name.trim(), Date.now());
  pushUpdate(channel);
  res.json({ ok: true, id: info.lastInsertRowid });
});

// --- API: add item
app.post("/api/admin/item", (req, res) => {
  const { category_id, name, price, description = "", image_url = "" } = req.body;
  if (!category_id) return res.status(400).json({ error: "category_id required" });
  if (!name?.trim()) return res.status(400).json({ error: "name required" });

  const cat = db.prepare("SELECT * FROM categories WHERE id=?").get(category_id);
  if (!cat) return res.status(404).json({ error: "category not found" });

  const priceCents = Math.round(Number(price || 0) * 100);
  db.prepare(
    "INSERT INTO items(category_id,name,price_cents,description,image_url,sort_order) VALUES(?,?,?,?,?,?)"
  ).run(category_id, name.trim(), priceCents, description, image_url, Date.now());

  pushUpdate(cat.channel);
  res.json({ ok: true });
});

// --- API: events slide add
app.post("/api/admin/slide", (req, res) => {
  const { title, subtitle = "", image_url = "" } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "title required" });

  db.prepare("INSERT INTO slides(title,subtitle,image_url,sort_order) VALUES(?,?,?,?)")
    .run(title.trim(), subtitle, image_url, Date.now());

  pushUpdate("events");
  res.json({ ok: true });
});

// --- API: image upload (returns image_url)
app.post("/api/admin/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });

  const outDir = path.join(process.cwd(), "server", "uploads");
  const filename = `img_${Date.now()}.jpg`;
  const outPath = path.join(outDir, filename);

  await sharp(req.file.buffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(outPath);

  res.json({ ok: true, image_url: `/uploads/${filename}` });
});

const PORT = process.env.PORT || 5177;
server.listen(PORT, () => {
  console.log(`Bar Signage running on http://localhost:${PORT}`);
});
