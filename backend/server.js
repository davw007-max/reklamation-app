const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const webpush = require("web-push");

// ================= APP =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= SERVER =================
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// ================= PORT =================
const PORT = process.env.PORT || 3001;

// ================= DATABASE =================
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch(err => console.error("❌ MongoDB Fehler:", err));

// ================= SCHEMA =================
const AuftragSchema = new mongoose.Schema({
  nummer: String,
  strasse: String,
  plzOrt: String,
  material: String,
  fahrer: String,
  status: String,
  zeit: String,
  gps: {
    lat: Number,
    lng: Number,
  },
});

const Auftrag = mongoose.model("Auftrag", AuftragSchema);

// ================= SOCKET =================
io.on("connection", async (socket) => {
  console.log("🔌 Client verbunden");

  const daten = await Auftrag.find();
  socket.emit("auftraege", daten);
});

const updateClients = async () => {
  const daten = await Auftrag.find();
  io.emit("auftraege", daten);
};

// ================= LOGIN =================
const fahrerListe = ["Max", "Tom", "Ali", "Dispo"];

app.post("/login", (req, res) => {
  let { name } = req.body;
  name = name.trim();

  const gefunden = fahrerListe.find(
    (f) => f.toLowerCase() === name.toLowerCase()
  );

  if (gefunden) return res.json({ success: true, name: gefunden });

  res.status(401).json({ success: false });
});

// ================= ROUTEN =================

// Alle Aufträge
app.get("/auftraege", async (req, res) => {
  const daten = await Auftrag.find();
  res.json(daten);
});

// Auftrag erstellen
app.post("/auftraege", async (req, res) => {
  const neuerAuftrag = new Auftrag({
    ...req.body,
    status: "offen",
    zeit: new Date().toLocaleString(),
  });

  await neuerAuftrag.save();
  updateClients();

  res.json(neuerAuftrag);
});

// Status + GPS
app.put("/auftraege/:id", async (req, res) => {
  const { lat, lng } = req.body;

  const auftrag = await Auftrag.findById(req.params.id);
  if (!auftrag) return res.sendStatus(404);

  auftrag.status =
    auftrag.status === "offen" ? "erledigt" : "offen";

  if (lat !== undefined && lng !== undefined) {
    auftrag.gps = { lat, lng };
  }

  await auftrag.save();
  updateClients();

  res.json({ success: true });
});

// Löschen
app.delete("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndDelete(req.params.id);
  updateClients();

  res.json({ success: true });
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});