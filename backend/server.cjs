const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "OK" : "FEHLT");

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

// ================= MAIL =================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});

// ================= ROOT =================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Backend läuft" });
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
  zeitErledigt: Date,
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
  const daten = await Auftrag.find();
  res.json(daten);
});

// Auftrag erstellen
app.post("/auftraege", async (req, res) => {
  const neuerAuftrag = new Auftrag({
    ...req.body,
    status: "offen",
    zeit: new Date().toLocaleString("de-DE"),
  });

  await neuerAuftrag.save();
  await updateClients();

  res.json(neuerAuftrag);
});

// Status + GPS + PDF + MAIL
app.put("/auftraege/:id", async (req, res) => {
  try {
    const { lat, lng } = req.body;

    const auftrag = await Auftrag.findById(req.params.id);
    if (!auftrag) return res.sendStatus(404);

    const wirdErledigt = auftrag.status === "offen";
    auftrag.status = wirdErledigt ? "erledigt" : "offen";

    if (lat && lng) {
      auftrag.gps = { lat, lng };
    }

    if (wirdErledigt) {
      auftrag.zeitErledigt = new Date();

      // ================= PDF =================
      const doc = new PDFDocument();
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));

      doc.on("end", async () => {
        const pdfBuffer = Buffer.concat(chunks);

        // ================= MAIL =================
        await transporter.sendMail({
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: `Auftrag ${auftrag.nummer} erledigt`,
          text: `
Auftrag erledigt:

Nr: ${auftrag.nummer}
Fahrer: ${auftrag.fahrer}
Material: ${auftrag.material}
Adresse: ${auftrag.strasse}, ${auftrag.plzOrt}
Zeit: ${auftrag.zeitErledigt}

GPS:
https://www.google.com/maps?q=${auftrag.gps?.lat},${auftrag.gps?.lng}
          `,
          attachments: [
            {
              filename: `auftrag_${auftrag.nummer}.pdf`,
              content: pdfBuffer,
            },
          ],
        });

        console.log("📧 Mail versendet");
      });

      // Inhalt PDF
      doc.fontSize(18).text("AUFTRAGSBERICHT");
      doc.moveDown();

      doc.fontSize(12).text(`Nummer: ${auftrag.nummer}`);
      doc.text(`Fahrer: ${auftrag.fahrer}`);
      doc.text(`Material: ${auftrag.material}`);
      doc.moveDown();

      doc.text(`Adresse: ${auftrag.strasse}`);
      doc.text(`${auftrag.plzOrt}`);
      doc.moveDown();

      doc.text(`Erledigt: ${auftrag.zeitErledigt}`);

      if (auftrag.gps?.lat) {
        doc.text(`GPS: ${auftrag.gps.lat}, ${auftrag.gps.lng}`);
      }

      doc.end();
    }

    await auftrag.save();
    await updateClients();

    res.json({ success: true });

  } catch (err) {
    console.error("❌ Fehler:", err);
    res.status(500).json({ error: "Server Fehler" });
  }
});

// Löschen
app.delete("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndDelete(req.params.id);
  await updateClients();
  res.json({ success: true });
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});