const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// 🔗 MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/reklamation");

// 📦 Schema
const AuftragSchema = new mongoose.Schema({
  nummer: String,
  strasse: String,
  plzOrt: String,
  material: String,
  fahrer: String,
  status: { type: String, default: "offen" },

  // 🔥 WICHTIG
  lat: Number,
  lng: Number,
  erledigtAm: Date,
});

const Auftrag = mongoose.model("Auftrag", AuftragSchema);

// 🔐 Login (einfach)
app.post("/login", (req, res) => {
  res.json({ name: req.body.name });
});

// 📥 Alle Aufträge
app.get("/auftraege", async (req, res) => {
  const data = await Auftrag.find().sort({ createdAt: -1 });
  res.json(data);
});

// ➕ Auftrag erstellen
app.post("/auftraege", async (req, res) => {
  const neu = new Auftrag(req.body);
  await neu.save();

  const alle = await Auftrag.find();
  io.emit("auftraege", alle);

  res.sendStatus(200);
});

// 🗑 Löschen
app.delete("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndDelete(req.params.id);

  const alle = await Auftrag.find();
  io.emit("auftraege", alle);

  res.sendStatus(200);
});

// 🔥 ✔ STATUS + GPS + ZEIT (DAS IST DER WICHTIGE TEIL)
app.put("/auftraege/:id", async (req, res) => {
  const { lat, lng, status, erledigtAm } = req.body;

  await Auftrag.findByIdAndUpdate(req.params.id, {
    lat,
    lng,
    status,
    erledigtAm,
  });

  const alle = await Auftrag.find();
  io.emit("auftraege", alle);

  res.sendStatus(200);
});

// 🚀 Server starten
server.listen(3001, () => {
  console.log("Server läuft auf Port 3001");
});