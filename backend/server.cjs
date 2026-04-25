const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");

console.log("MAIL_USER:", process.env.MAIL_USER);
console.log("MAIL_PASS:", process.env.MAIL_PASS ? "OK" : "FEHLT");

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
// Vorher: app.use(express.json());//
// NACHHER:
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
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
  gps: { lat: Number, lng: Number },
  // ✅ NEU: Speicherplatz für die Fehlanfahrt
  fehlanfahrt: {
    zeit: Date,
    gps: { lat: Number, lng: Number },
    bild: String
  },
  zweiteAnfahrt: Boolean // Markierung, ob es der 2. Versuch ist
});

const Auftrag = mongoose.model("Auftrag", AuftragSchema);

// ================= SOCKET =================
io.on("connection", async (socket) => {
  console.log("🔌 Client verbunden");
  socket.emit("auftraege", await Auftrag.find());
});

const updateClients = async () => {
  io.emit("auftraege", await Auftrag.find());
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
app.get("/auftraege", async (req, res) => {
  res.json(await Auftrag.find());
});

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

// ================= PUT =================
app.put("/auftraege/:id", async (req, res) => {
  try {
    const { lat, lng, fahrer, statusUpdate, bild } = req.body;

    const auftrag = await Auftrag.findById(req.params.id);
    if (!auftrag) return res.sendStatus(404);

    // 1. Fahrer im Dropdown ändern
    if (fahrer !== undefined) {
      auftrag.fahrer = fahrer;
      await auftrag.save();
      await updateClients();
      return res.json({ success: true });
    }

    // 2. Dispo setzt Auftrag nach Fehlanfahrt wieder auf "offen"
    if (statusUpdate === "reset") {
      auftrag.status = "offen";
      auftrag.zweiteAnfahrt = true; // ✅ Markieren für das PDF ("2. Anfahrt")
      await auftrag.save();
      await updateClients();
      return res.json({ success: true });
    }

    // 3. Status Logik (Fahrer klickt Erledigt oder Fehlanfahrt)
    const wirdErledigt = auftrag.status === "offen" && !statusUpdate;
    const wirdFehlanfahrt = statusUpdate === "fehlanfahrt";

    if (wirdErledigt) {
      auftrag.status = "erledigt";
      auftrag.zeitErledigt = new Date();
      if (lat && lng) auftrag.gps = { lat, lng };
    } 
    
    if (wirdFehlanfahrt) {
      auftrag.status = "fehlanfahrt";
      // ✅ Daten der Fehlanfahrt wegspeichern (werden nicht überschrieben!)
      auftrag.fehlanfahrt = {
        zeit: new Date(),
        gps: { lat, lng },
        bild: bild
      };
    }

    // 4. PDF Generierung
    if (wirdErledigt || wirdFehlanfahrt) {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));

      doc.on("end", async () => {
        const pdfBuffer = Buffer.concat(chunks);
        const baseDate = auftrag.zeitErledigt || auftrag.fehlanfahrt.zeit;
        const year = baseDate.getFullYear();
        const kw = Math.ceil((((baseDate - new Date(year, 0, 1)) / 86400000) + 1) / 7);
        const datum = `${String(baseDate.getDate()).padStart(2, "0")}-${String(baseDate.getMonth() + 1).padStart(2, "0")}-${year}`;
        const fileName = `${year}_KW${kw}_${datum}_${auftrag.nummer}.pdf`;

        await transporter.sendMail({
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: `${fileName} - ${auftrag.status.toUpperCase()}`,
          text: "Auftragsbericht im Anhang",
          attachments: [{ filename: fileName, content: pdfBuffer }],
        });
      });

      doc.fontSize(20).text("AUFTRAGSBERICHT", 40, 40);
      doc.moveTo(40, 87).lineTo(550, 87).stroke();

      let y = 110;
      
      // ✅ Wenn es die zweite Anfahrt ist, roten Warntext drucken!
      if (auftrag.zweiteAnfahrt) {
        doc.fontSize(16).fillColor("red").text("ACHTUNG: 2. ANFAHRT", 40, y);
        doc.fillColor("black");
        y += 25;
      }

      doc.fontSize(12).font("Helvetica-Bold").text("Auftragsdaten:", 40, y); y += 20;
      doc.font("Helvetica").text(`Nummer: ${auftrag.nummer}`, 40, y); y += 15;
      doc.text(`Fahrer: ${auftrag.fahrer}`, 40, y); y += 15;
      doc.text(`Material: ${auftrag.material}`, 40, y); y += 25;

      doc.font("Helvetica-Bold").text("Adresse:", 40, y); y += 20;
      doc.font("Helvetica").text(auftrag.strasse, 40, y); y += 15;
      doc.text(auftrag.plzOrt, 40, y); y += 25;

      // ✅ DATEN DER ERSTEN ANFAHRT (Fehlanfahrt)
      if (auftrag.fehlanfahrt && auftrag.fehlanfahrt.zeit) {
        doc.font("Helvetica-Bold").text("1. Versuch (Fehlanfahrt):", 40, y); y += 20;
        doc.font("Helvetica").text(`Datum: ${new Date(auftrag.fehlanfahrt.zeit).toLocaleString("de-DE")}`, 40, y); y += 15;
        if (auftrag.fehlanfahrt.gps?.lat) {
          doc.text(`GPS: ${auftrag.fehlanfahrt.gps.lat}, ${auftrag.fehlanfahrt.gps.lng}`, 40, y); y += 25;
        }
        if (auftrag.fehlanfahrt.bild) {
          try {
            doc.image(Buffer.from(auftrag.fehlanfahrt.bild.split(",")[1], "base64"), 40, y, { width: 200 });
            y += 160;
          } catch(e) { /* Bildfehler ignorieren */ }
        }
      }

      // ✅ DATEN DER ZWEITEN ANFAHRT (Erledigt)
      if (auftrag.status === "erledigt") {
        doc.font("Helvetica-Bold").text(auftrag.zweiteAnfahrt ? "2. Versuch (Erledigt):" : "Status (Erledigt):", 40, y); y += 20;
        doc.font("Helvetica").text(`Datum: ${new Date(auftrag.zeitErledigt).toLocaleString("de-DE")}`, 40, y); y += 15;
        if (auftrag.gps?.lat) {
          doc.fillColor("blue").text(
            `GPS Link öffnen (Klick)`, 
            40, y, { link: `https://www.google.com/maps?q=$$${auftrag.gps.lat},${auftrag.gps.lng}` }
          );
          doc.fillColor("black");
        }
      }

      doc.moveTo(40, 700).lineTo(550, 700).stroke();
      doc.fontSize(9).text("Automatisch erstellt – Reklamations App", 40, 710, { align: "center" });
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

// ================= DELETE =================
app.delete("/auftraege/:id", async (req, res) => {
  await Auftrag.findByIdAndDelete(req.params.id);
  await updateClients();
  res.json({ success: true });
});

// ================= START =================
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server läuft auf Port ${PORT}`);
});