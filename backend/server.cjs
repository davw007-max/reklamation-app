const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// ================= CONFIG =================
const PORT = process.env.PORT || 3001;

// ================= APP =================
const app = express();
app.use(cors());
app.use(express.json());

// ================= SERVER =================
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB verbunden"))
  .catch((err) => console.error("❌ MongoDB Fehler:", err));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({
    status: "ok",
    message: "Reklamation Backend läuft",
  });
});

// ================= SCHEMA =================
const AuftragSchema = new mongoose.Schema({
  nummer: String,
  strasse: String,
  plzOrt: String,
  material: String,
  fahrer: String,
  status: String,
  zeit: String,
  zeitErledigt: String,
  gps: {
    lat: Number,
    lng: Number,
  },
});

const Auftrag = mongoose.model("Auftrag", AuftragSchema);

// ================= SOCKET =================
io.on("connection", async (socket) => {
  console.log("🔌 Client verbunden");

  try {
    const daten = await Auftrag.find();
    socket.emit("auftraege", daten);
  } catch (err) {
    console.error("Socket Fehler:", err);
  }
});

const updateClients = async () => {
  try {
    const daten = await Auftrag.find();
    io.emit("auftraege", daten);
  } catch (err) {
    console.error("Update Fehler:", err);
  }
};

// ================= LOGIN =================
const fahrerListe = ["Max", "Tom", "Ali", "Dispo"];

app.post("/login", (req, res) => {
  let { name } = req.body;
  if (!name) return res.status(400).json({ success: false });

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
  try {
    const daten = await Auftrag.find();
    res.json(daten);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// Auftrag erstellen
app.post("/auftraege", async (req, res) => {
  try {
    const neuerAuftrag = new Auftrag({
      ...req.body,
      status: "offen",
      zeit: new Date().toLocaleString(),
    });

    await neuerAuftrag.save();
    await updateClients();

    res.json(neuerAuftrag);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// Status + GPS
app.put("/auftraege/:id", async (req, res) => {
  try {
    const { lat, lng } = req.body;

    const auftrag = await Auftrag.findById(req.params.id);
    if (!auftrag) return res.sendStatus(404);

    // Status wechseln
    const wirdErledigt = auftrag.status === "offen";
    auftrag.status = wirdErledigt ? "erledigt" : "offen";

    // GPS speichern
    if (lat !== undefined && lng !== undefined) {
      auftrag.gps = { lat, lng };
    }

    // 👉 NUR wenn erledigt → Zeit speichern
    if (wirdErledigt) {
      auftrag.zeitErledigt = new Date().toLocaleString("de-DE");
    }

    await auftrag.save();
    await updateClients();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Update" });
  }
});

// Löschen
app.delete("/auftraege/:id", async (req, res) => {
  try {
    await Auftrag.findByIdAndDelete(req.params.id);
    await updateClients();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Löschen" });
  }
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});