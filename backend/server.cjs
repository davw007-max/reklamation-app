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

    // 1. Fahrer-Zuweisung (Dispo)
    if (fahrer !== undefined) {
      auftrag.fahrer = fahrer;
      await auftrag.save();
      await updateClients();
      return res.json({ success: true });
    }

    // 2. Reset-Logik (Dispo schickt Fahrer erneut los)
    if (statusUpdate === "reset") {
      auftrag.status = "offen";
      auftrag.zweiteAnfahrt = true;
      await auftrag.save();
      await updateClients();
      return res.json({ success: true });
    }

    // 3. Status-Update (Fahrer-Aktion)
    const wirdErledigt = auftrag.status === "offen" && !statusUpdate;
    const wirdFehlanfahrt = statusUpdate === "fehlanfahrt";

    if (wirdErledigt) {
      auftrag.status = "erledigt";
      auftrag.zeitErledigt = new Date();
      if (lat && lng) auftrag.gps = { lat, lng };
    } 
    
    if (wirdFehlanfahrt) {
      auftrag.status = "fehlanfahrt";
      auftrag.fehlanfahrt = {
        zeit: new Date(),
        gps: { lat, lng },
        bild: bild
      };
    }

    // 4. PDF GENERIERUNG (Einheitliches Layout für beide Fälle)
    if (wirdErledigt || wirdFehlanfahrt) {
      const doc = new PDFDocument({ margin: 40 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));

      doc.on("end", async () => {
        const pdfBuffer = Buffer.concat(chunks);
        const currentStatus = auftrag.status.toUpperCase();
        const fileName = `Bericht_${auftrag.nummer}_${currentStatus}.pdf`;

        await transporter.sendMail({
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: `Auftrag ${auftrag.nummer}: ${currentStatus}`,
          text: `Anbei der detaillierte Bericht für Auftrag Nr. ${auftrag.nummer}.`,
          attachments: [{ filename: fileName, content: pdfBuffer }],
        });
      });

      // --- PDF LAYOUT ---
      // Header & Logo
      doc.fontSize(20).text("AUFTRAGSBERICHT", 40, 40);
      
      // ✅ DEIN FIRMENLOGO (Oben Rechts)
      // WICHTIG: Füge hier deinen echten, langen Base64-String ein!
      const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAX0AAAC1CAYAAACztS88..."; 
      
      try {
        // x: 400 (schiebt es nach rechts), y: 25 (schiebt es nach oben), width: 140 (Größe)
        doc.image(Buffer.from(logoBase64.split(",")[1], "base64"), 400, 25, { width: 140 });
      } catch(e) {
        console.log("Fehler beim Logo-Druck im Backend", e);
      }
      
      doc.moveTo(40, 85).lineTo(550, 85).stroke();

      let y = 110;

      // Sektion 1: Stammdaten
      doc.fontSize(12).font("Helvetica-Bold").text("Auftragsdetails:", 40, y); y += 20;
      doc.font("Helvetica").fontSize(10);
      doc.text(`Auftragsnummer: ${auftrag.nummer}`, 40, y); y += 15;
      doc.text(`Kunde / Adresse: ${auftrag.strasse}, ${auftrag.plzOrt}`, 40, y); y += 15;
      doc.text(`Material: ${auftrag.material}`, 40, y); y += 15;
      doc.text(`Fahrer: ${auftrag.fahrer}`, 40, y); y += 30;

      // Hilfsfunktion für einheitliche Anfahrts-Blöcke
      const drawVisitBlock = (title, time, gps, imageBase64, isAlert = false) => {
        if (isAlert) doc.fillColor("red").font("Helvetica-Bold");
        else doc.fillColor("black").font("Helvetica-Bold");
        
        doc.fontSize(12).text(title, 40, y); y += 20;
        doc.fillColor("black").font("Helvetica").fontSize(10);
        
        doc.text(`Zeitpunkt: ${new Date(time).toLocaleString("de-DE")}`, 40, y); y += 15;
        
        if (gps && gps.lat) {
          doc.text(`GPS-Standort: ${gps.lat}, ${gps.lng}`, 40, y); y += 15;
          doc.fillColor("blue").text("In Google Maps öffnen", 40, y, {
            link: `https://www.google.com/maps?q=${gps.lat},${gps.lng}`,
            underline: true
          });
          doc.fillColor("black"); y += 20;
        }

        if (imageBase64) {
          try {
            doc.image(Buffer.from(imageBase64.split(",")[1], "base64"), 40, y, { width: 220 });
            y += 180;
          } catch(e) {
            doc.text("[Bild konnte nicht geladen werden]", 40, y); y += 20;
          }
        }
        y += 10;
        doc.moveTo(40, y).lineTo(300, y).dash(5, {space: 10}).stroke().undash();
        y += 25;
      };

      // --- ANFAHRTEN DARSTELLEN ---
      
      // 1. ANFAHRT (Falls jemals eine Fehlanfahrt stattfand)
      if (auftrag.fehlanfahrt && auftrag.fehlanfahrt.zeit) {
        drawVisitBlock(
          "1. ANFAHRT (Fehlanfahrt)", 
          auftrag.fehlanfahrt.zeit, 
          auftrag.fehlanfahrt.gps, 
          auftrag.fehlanfahrt.bild,
          true // Rot markieren, da Fehler
        );
      }

      // 2. ANFAHRT / AKTUELLES ERGEBNIS
      if (auftrag.status === "erledigt") {
        const titel = auftrag.zweiteAnfahrt ? "2. ANFAHRT (Erfolgreich erledigt)" : "ANFAHRT (Erfolgreich erledigt)";
        drawVisitBlock(titel, auftrag.zeitErledigt, auftrag.gps, null, false);
      } else if (auftrag.status === "fehlanfahrt" && !auftrag.zweiteAnfahrt) {
          // Falls wir gerade erst die erste Fehlanfahrt melden und noch kein Reset war
          // (Der Block wurde oben bereits durch die Prüfung 'auftrag.fehlanfahrt' gezeichnet)
      }

      // Footer
      doc.fontSize(8).fillColor("gray").text("Dieser Bericht wurde automatisch erstellt.", 40, 720, { align: "center" });
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