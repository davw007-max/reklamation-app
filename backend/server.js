const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

mongoose.connect("mongodb://127.0.0.1:27017/reklamation");

// Schema
const Auftrag = mongoose.model("Auftrag", {
  nummer: String,
  strasse: String,
  plzOrt: String,
  material: String,
  fahrer: String,
  status: { type: String, default: "offen" },
  lat: Number,
  lng: Number,
  erledigtAm: Date,
});

// Login
app.post("/login", (req, res) => {
  res.json({ name: req.body.name });
});

// GET
app.get("/auftraege", async (req, res) => {
  res.json(await Auftrag.find());
});

// POST
app.post("/auftraege", async (req, res) => {
  await new Auftrag(req.body).save();
  io.emit("auftraege", await Auftrag.find());
  res.sendStatus(200);
});

// DELETE
app.delete("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndDelete(req.params.id);
  io.emit("auftraege", await Auftrag.find());
  res.sendStatus(200);
});

// 🔥 WICHTIG: GPS + ZEIT speichern
app.put("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndUpdate(req.params.id, {
    lat: req.body.lat,
    lng: req.body.lng,
    status: req.body.status,
    erledigtAm: req.body.erledigtAm,
  });

  io.emit("auftraege", await Auftrag.find());
  res.sendStatus(200);
});

server.listen(3001, () =>
  console.log("Server läuft auf Port 3001")
);