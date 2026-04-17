import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// =======================
// 🔌 MongoDB Verbindung
// =======================
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI fehlt in ENV!");
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB verbunden"))
.catch((err) => {
  console.error("❌ MongoDB Fehler:", err.message);
  process.exit(1);
});

// =======================
// 📦 Beispiel Schema
// =======================
const auftragSchema = new mongoose.Schema({
  fahrer: String,
  text: String,
  material: String,
  gps: {
    lat: Number,
    lng: Number,
  },
  erstelltAm: {
    type: Date,
    default: Date.now,
  },
});

const Auftrag = mongoose.model("Auftrag", auftragSchema);

// =======================
// 📡 API Routen
// =======================

// Alle Aufträge holen
app.get("/auftraege", async (req, res) => {
  try {
    const daten = await Auftrag.find().sort({ erstelltAm: -1 });
    res.json(daten);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Laden" });
  }
});

// Auftrag speichern (inkl. GPS)
app.post("/auftraege", async (req, res) => {
  try {
    const neuerAuftrag = new Auftrag(req.body);
    await neuerAuftrag.save();
    res.json(neuerAuftrag);
  } catch (err) {
    res.status(500).json({ error: "Fehler beim Speichern" });
  }
});

// =======================
// 🚀 Server starten
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});