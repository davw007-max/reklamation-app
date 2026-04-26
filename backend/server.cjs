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

// ================= DEMO DATEN =================
app.post("/demo-daten", async (req, res) => {
  try {
    // 1. Mülleimer leeren: Alle bisherigen Test-Aufträge löschen
    await Auftrag.deleteMany({});

    // 2. Perfekte Präsentations-Daten vorbereiten
    const jetzt = new Date();
    const vorEinerStunde = new Date(jetzt.getTime() - 60 * 60 * 1000);
    const vorZweiStunden = new Date(jetzt.getTime() - 2 * 60 * 60 * 1000);

    const demoAuftraege = [
      {
        nummer: "R-8001", strasse: "Hauptstraße 45", plzOrt: "80331 München",
        material: "kom. Restmüll", fahrer: "Max", status: "offen",
        zeit: jetzt.toLocaleString("de-DE")
      },
      {
        nummer: "R-8002", strasse: "Gewerbepark Nord 12", plzOrt: "85748 Garching",
        material: "Kartonage", fahrer: "", status: "offen", // Ohne Fahrer (zum Zuweisen)
        zeit: jetzt.toLocaleString("de-DE")
      },
      {
        nummer: "R-8003", strasse: "Schulweg 7", plzOrt: "81541 München",
        material: "LVP", fahrer: "Tom", status: "erledigt",
        zeit: vorZweiStunden.toLocaleString("de-DE"),
        zeitErledigt: vorEinerStunde,
        gps: { lat: 48.1351, lng: 11.5820 }
      },
      {
        nummer: "R-8004", strasse: "Industrieallee 99", plzOrt: "85716 Unterschleißheim",
        material: "Abrufleerung kom Restmüll", fahrer: "Ali", status: "fehlanfahrt",
        zeit: vorZweiStunden.toLocaleString("de-DE"),
        fehlanfahrt: {
          zeit: vorEinerStunde,
          gps: { lat: 48.2788, lng: 11.5714 },
          // Ein winziges graues Dummy-Bild, damit der Bild-Container bei der Dispo nicht leer ist
          bild: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" 
        }
      },
      {
        nummer: "R-8005", strasse: "Am Stadion 1", plzOrt: "80939 München",
        material: "kom. Restmüll", fahrer: "Max", status: "offen",
        zeit: jetzt.toLocaleString("de-DE")
      }
    ];

    // 3. In die Datenbank speichern und alle Handys/PCs updaten
    await Auftrag.insertMany(demoAuftraege);
    await updateClients();
    
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Fehler beim Laden der Demo-Daten:", err);
    res.status(500).json({ error: "Fehler beim Laden" });
  }
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

        // --- NEUE DATEINAMEN-LOGIK (IDENTISCH ZUM FRONTEND) ---
        const baseDate = auftrag.zeitErledigt || (auftrag.fehlanfahrt ? auftrag.fehlanfahrt.zeit : new Date());
        const year = baseDate.getFullYear();
        
        // Präzise KW-Berechnung (ISO-Standard Logik wie im Frontend)
        const getKW = (date) => {
          const d = new Date(date);
          d.setDate(d.getDate() + 4 - (d.getDay() || 7));
          const yearStart = new Date(d.getFullYear(), 0, 1);
          return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
        };
        const kw = getKW(baseDate);

        const tag = String(baseDate.getDate()).padStart(2, "0");
        const monat = String(baseDate.getMonth() + 1).padStart(2, "0");
        const datum = `${tag}-${monat}-${year}`;

        // ✅ NEU: Status auslesen und in den Dateinamen einbauen
        const currentStatus = auftrag.status.toUpperCase();
        const fileName = `${year}_KW${kw}_${datum}_${auftrag.nummer}_${currentStatus}.pdf`;

        await transporter.sendMail({
          from: process.env.MAIL_USER,
          to: process.env.MAIL_TO,
          subject: `${currentStatus}: Auftrag ${auftrag.nummer} (${datum})`,
          text: `Anbei der Auftragsbericht für Nr. ${auftrag.nummer}.`,
          attachments: [
            {
              filename: fileName, // Hier wird der neue Name verwendet
              content: pdfBuffer,
            },
          ],
        });

        console.log(`📧 Mail versendet: ${fileName}`);
      });

      // --- PDF LAYOUT ---
      // Header & Logo
      doc.fontSize(20).text("AUFTRAGSBERICHT", 40, 40);
      
      // ✅ DEIN FIRMENLOGO (Oben Rechts)
      // WICHTIG: Füge hier deinen echten, langen Base64-String ein!
      const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAX0AAAC1CAYAAACztS88AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCREY5Mzc2NTVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCREY5Mzc2NjVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkJERjkzNzYzNUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkJERjkzNzY0NUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+cs9D8gAAE0tJREFUeNrsne1x2zgagJmM/686WG0DF6WCyAXcxK7A0lwBtn9nZ2LNbH7bLuBGdAWW5wqwXEG010C0HWgruAPslxbM6AMkAQIUnmdG612vBZAg8OAFCJBZBgDgm8/TkfpMk8l3nf/0+Rgi4j21ESAN/vWffwyCCT/LtHjbFXCofE3h67z1MUQkfqQPkIbwtYC+q5/tymct3oJ2BBwq35+FXxCN+N/RHACSEL4pnPG///nfPIB4TfLsYTw+qHy3C99krPLPQ9YHpA+QlvDbEf9u8foTcKh87YQfhfiRPkB6wvcrfjvxuhdwqHyrCT+4+JE+QJrC9yP+auJ1J+BQ+dYTflDxcyMXIF3ha6at39z9mVDLKsMu5wx0c5dIHyBd4fuJ+OtF3c0j71D5Nov2W4/4kT4Awkf8CYmf6R0AhP863eBsqudFYHUk2mzKJVS+6/x13pM6Zd/WVA+RPgDCJ+J3H/HXzd97xI/0ARA+4k9I/EgfAOEj/oTEj/QBED7iT0j8SB8A4SP+hMSP9AEQPuJPSPxIHwDhI/6ExI/0ARA+4k9I/EgfAOGHFP+JCLCH+NsRP9IHQPihxa9f4/gYQPxh8g0sfqQPgPARf0LiR/oACB/xJyR+pA+A8BF/QuJH+gAIH/EnJH6kD4DwEX9C4kf6AAgf8SckfqQPgPARf0Li581ZAAjfNfoNXBdOUnoYL9Q/j9VnVfGbTd/AFSbfdf55Vu8NYHvfwEWkD4DwfZGriH/sJCUifmcRP9IHQPiIPyHxI30AhI/4ExI/0gdA+Ig/IfEjfQCEj/gTEj/SB0D4iD8h8bNkEwDht8lIygMCgfQB/Ap/hPA3ir9ZmRDl14rykT6AZ2Rnak5JvBVgox27CL+28DXM6QO0E/EzxbMWfvfEy5JNAED8CL9rwkf6AIgf4SckfKQPgPgRfkLCR/oAiB/hJyR8pA+A+BF+QsJH+gCIH+EnJHykD4D4EX5Cwkf6AIgf4SckfKQPgPgRfkLCR/oAiB/hhxW+zv97W8LX8OwdgIgQceYdO2yE3yz/1oRPpA9AxI/wwwq/av6NhI/0ARA/wk9I+BqmdwAiRYR6g/ARvivhE+kDdCPi19F+TG+bQvgdFT7SB0D8bQtfC0+vVum3LPy+5Ju08DVM7wB0AHnT1DjwYbgQ/mMA4et87xE+kT4AEX/7wh8EEH77+UYqfKQPgPgRfkLCR/oAiB/hJyR8pB8Zv3/50qtRSQuWf3z7ttyQ5qBGxXtGpTfnqiQtfoR/YMLXHNF0oqLutmzNRH2uNvz+Wn2GBAWHh765q8SfeRI/wj9A4WtYvQPQcfFn7lf1IPwDFT7SB0D8CD8h4SN9AMTvTvgvjAKJN1S+BWddED7SB0D8LoWfKYndZNUeDe1GvKHyXed/WTH/IMJH+gCI353w1wK0fSeAa/GGybd6/sGEj/QBEL9b4b8V4CSQeG9az9de/EGFj/QB0ha/H+GvBXi15Rh8i/cySL77xR9c+EgfIF3x+xX+WoDlY2hLvGHy3S7+KISP9AHSFH87wv9ZwG2LN0y+P4s/GuFr2JELkID4jZ277Qr/rYDzZPJ9K/6oQPpxsVCf45rfXW75vZ7f7FG0iF+Jf6F+LigNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAbbzT//j9y5erpgn98e3bVcgTUedwkfl73MBMnd/C4hg6X47GufSzl1fQNWGpziePMT/KL+7yA38Uz9756iCtq4ANbOqgwm8jtxH+IZRjib6D85ln9g+7ajs/yi/u8gPP0u8snoU/JvIBAKQfh+z1VM69+gwRPgDAAUtfhP+oPgMPya/U51QJf071AACkf/jCP64whw8A0Ck69bpEz8JfIHwAINKPR/j97GUO36fwV1QJACDSDy98LfrvnoQ/R/gAQKQfl/D1lI6PjVd6Df6YagAARPoIHwAA6R+I8C8RPgAg/XiEP/IofL3p6oZLDwApEt2cvgh/6iHplQh/xmUHAKR/+MJnDT4AJE800zsehb9E+AAAEUlfnoXvQ/ha9B8RPgDAC8Gndzw+GpldtgAAMUnfo/BZgw8AEJP0ET54oKfq1TCSYxlwOQDp+xf+JJZ3zEIw0T5SDACRSN/zo5F50xUAwB5aW73jUfgrhA8AEFGk71n4rMEHAIgl0kf4AACJSN94UqZr4WvR/4bwAQCq4W16x+Ojkdl0BQAQU6Qv77P19WjkBcIHAIhI+tnLfPvSU9oj1ancy70CAAAILX0diavPR/WvuafjPtEjCRlRAABA4Ei/kL9+HMLEU/L6nsF3uXcAAAChpS/iv1I/fD0LpycR/4hLCQAQgfRF/Ln6cZy9zPX7EP9Uif+KywkAEIH0RfxzEf/SUxZf9YPcuMELALCdVh+4pjdTKSnrG7y+Hro20umqPFjHnyY6oLiL5Fh+zfw8SRagO9IX8a+0lNW/XntqFMUN3tMu7tjVz4OXUVFohl2UfiyP1pbn+iN9iI4g78iVJZ365u6Npyz62csN3pMOXpNYViN9oHkAIH3X8r/M/K7sue/gyp7zCKJU3Wme0DwAkL4P8eeZv5U9mqm8qasr9NXxXgQ+hmuaBgDS9yn+eeZ3ZY9+dMNjCyt7XN1DuA41QpEO8iSy8gAARxzFciAtrOwZZi/z/PoGr6/OxeVoRY9QPqmft23ckJb7H+eZ2xu4f9PEOkVML5Z/EzywGu8ApS/ib2tlj6+Xrzw5luZIRikriZoXjkWqlxX2M38rdeY0sU4R64vlj6lLByr9Qvzqx1iJLvMk/p6I38d7dX1F5D0R87Bj9YvpHYDIeB/rgcmSzrHHLPT0iesblkQjDMkBkH4D8etI/DTzt7LnwuWjG0RyM6rVM3cUAQDSryNSLVGfSzpH2csNXlcrex6oVs/Q+QEg/drif34ReuZvjljfwPrh4tn8MjpZJl6vco8rpADg0KUvMl1JxO8rgiyeze9ijfplwnVKX6cJTQsA6TsRv/roOf7co/jvm+6IlSmpVKc3JkT5AEjftfx9r+y5dvDoBn18qS1Z1NM6NzQrAKTvQ/w62ve5sqfRoxuM6ahUxJ9LZwwASN+b+H2v7BlmL/P8g5rH5/s+RCxMED4A0m9L/G2s7Hms+0wS4z7E2GPnFApd5sexvLgEABKQfksRdbGyZ9TgGHPpnPTKnmXHi3yuOzF1Th8jecsXAFhydCgnIuI/lRuwI0/Z6N27H+TlL3WPUd/ovJEpI708VD9Jcxh58a5E9PqBcjNW5wB0l3cUQRxIJ9DP1o+V/iUL8+rEp1JEv0TyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwIvRAQ6U3798GagfPeNXiz++fVs5SLevfvSNX61UugtKvCPSVxdwqH4+yn8fq4s3t7zw/5N/navvHO/4O532UP7zRv3tpWX6xfc2pm/kXwcXaW49b5XOlfrxddd31WepPk8qjdyiLMxrpBvtR/W9ZZXvqb9/Z3k9XZ67VX0qnd9EfefKsj5pTtXfzyoK64f5u11lUzo2G7Yev4O2sLNsjPPT5X9SEn7BUurfnW1bl3RH6sdnOY7elj9bSNq3u+rnhmtospJ09OfBsv681rl99bxmndvVNhZFW1af3KZTtUzvQX1m+9KrUz/ft9zJXMhBpo4uA92Ipqo8vktEZotucNcU4StnFf9+FMlxX1S87raR/Xc5x21i7sv/P7dNU9dRXVd3dCQFOv+LPQGPTf0eSjqPKu979elFXP8GUi66Tf6QztFFelNJz7kvjwIUkhbdRwfDzMmW338yoggdRf+1JdrJ9kTiT3v+Zml5nJuO4YNc2OIi31cskxP19ydVItwK6PO6c3TubaDLoleh7M4a5GVTL+ZV2oIetTkSvhbjvSHl54hbImdTKJ+k7j1YRvfTUhSeSxmsSh1JUaf7FvVnXzs223DRTk4jqGs6Cr80Oiddnr8Y590Tv60s22ZulFVfPr8anWtPOr6PltNnVvUzhPT70otfNUlkxxD6yqgwlYawBk/7htEV2HgMMgy/l4rTlwudVxGGSmPuYo62LHSH5+6TZbaeV9ZyurEc0vc3fD9EvXiWsK6vjtI8Mc5HTwucbpHCjU3kLKOGaUlQl3vq26X+XpX5/R3teCDTFj3p2AcR3DdYldryzDjvqTGKvDb+3y7+2uKGS0nDTO/YVf1sc3pnbkQHX10PbbuGzHmac7qfLb96Y0Qa04SLcGmMOM4tv3O24bshyD20BbMDu91T91YWwcIb4au/H9sEGK7ELOlMSp1azO15bIzy+k2uqZTzpVFHnU7xtD2nP95SqVIVv9nL285bPsgw83WaJ+EivLNtZBLdjkrfC0Xfc1toNPqTaZ2iPOcitFDTKV3iqUZ73iX+eWmU2j3pyzzXzBzaZlAHc4QwjfxGl++IObOM9k+2fC9Uhz8zGrWLtlCeu2+COeqc0NyC8ZePRN8HOJFxxjRP0Xv360RnMkIwp3m+plh+MkU2M0Y9uzq/olOY2Sx3DdAWzkv1oSrmHPJ1w8iw6CBXNe+JuRwRORm9tMQvjtP74GPUcxSgoa7kRsXUGNp+jOzi/WrRaFxsdDGXXj5U/O4kW9+808v/Hhw10J7Dc9cRrE2eTTr+h2y92mHjzXAJLAY1y7lSvahyDXTno9KbSD0o7tEc12xXOi0dCFxk61UfuiyqrsfvxzC9Ih34+ZZOLcYArlcaTS4aptc30ltatjer+hli9Y7OOFcHp2+qDUUMF+p3NxFdw1G2fz33cVZteZ5ZOYZSoYsLNLfZpLWh89SRYrExw9VS2EG2f7OH7blft1SXCmmebZm6OTci19xzvXhX8fj1appi09OwSVvQm71K9y6ej1f9To9s9M1dm81DpvSf9tTjgYvOb4PshjJ6LY7lJqLR2bZjvi8d76pBesNS25m4rJ9HActKC+t7MT2hTnQW84VtwOOeaHeWvb2pV6WRz43ori8N5TJLj5lUdi3N/oZ6VERMeaTH76wt6Juu6vt3UheGhsivJe3bplKyDA5sd8bu2wluvXO5jemm0r2XD1K2g1KEbyvpTxvSG5Q63rxhoBJ+esfH0NYDz8PifVMcDfPQje7UwZTMJFvvwHQxzbOw6Dhsz/3S8m8HDUcFt0aEc24ev6xEKeb671qoF8Hbglz/uUxrnRn1o7j/81n9v2MPezxcspD2EVMgWARWWzuo7OWRDrblOsx2P47ituIeDqv6GTLSdzq0dcxfDm9glcVXRGC9rOGyrtI0z30xzaM+vxkyrdwZOTz3heWzU5qWwUKlscjWW9jNTuvMOJZFRPViU1s4k3PQbWHUNMKT833uxKXzKzqVgdSX4y2yeY1E90i5/P2zrPpjLsppTDdEz7Gw2hDE6P/+M7N4Ts4GltnP+0WapGdVP48iKEgtrOIBWIc4zfNGfDK/WpzvtYtdtXr5ny43EV7f2OWZ0pMP74qhcfGICmN+uBgNxE4xzVPUjZmraFzufcyNaaSNU2HSgZqR7dZgIyvd16mzYqgsKVnkYQYwbYz+VxXassvjuQux+/39huFLnWFYo6Fttp4DO/hdpqXz1eV94VAYKS+FzTdE9yOjUc86UDcWPttCqe7tau+FiPttPyCxtH9hWHXzYYU9Kz1XDusa70u93AfLgjUvxN8OLrQZlQ4T2GV641rQEnklu+NZzr8Qf7Fmv5D/LPL5621twceO64WF9M1lrSH2gJjTc9cWIjevrW0n9alGpH8Y0pfoohjijSx7Sh/rZ8vCOthdpsazNV4rtsMo6XXHc5bepi1TVuYSuruOnYfPtmBKcblj1LQygrCLltvHIltvPrQZDc+3uGnXaOB1FJjaC2DelxpFsamjt6PArrO368t9PGBp5xrgAxF/XhrGjhxGSauKUc+hlOks+/khVcvAu0qbSs+qLdiMFuVvzo3odmE5atTR9nXLj/uY2I6GpbzMtjTdI/xHoyO9zRLjqBhSyiqaYufiD9nNZ0ZOxfKvgVFpLh1XdvM4QvLJ4lkoSwfrZyeGnJzcuCst/6tDv6Vz98WsFBnetlwv5o46GXPHtQ3XIkad95+l6FcL7nP29iUot7vqmtwInxijxQuZCdDl+1QaJRQd02eHLliV6vG+xwtfGjIfyb2I21LH9jl7+4KZRUceI+60fpqrd46l0Ir3al7sGFbpC37qaVhUXLyQDC2i5HnWcLOPbK7KjYroZHNVaSlsZelbTAs1PneP3Jbq7azlelGebmgivXHFtlA8CuBkzzW8sZGdBGHLbL3Us5gWGbVxIassY5VVR8eG+Pt7Ah99jU6zw8Kqfh6VhnQfZZrhbMuXFzIVlFeISBelnzYi1D38pyrfK3VIc2M0UoUqjXXh6BgujWhusOUtUKsa56SFMY383Ded37JJfZKRTi5lutix/HdR49hs65+vtrDc09mtsp93dJrnoTvAu4rPB8oluh9l63fkbiunhYwC5g3qz6b28dWI1PNd0zzqWH+TTn/bjIE+l4eKI9V5TRftS2/pIK3K9XPfy7KLYduiK6sfAOC1/WpBe7lR6TNtx8epO8B+1+7r+OT/AgwA19F+HzctvPwAAAAASUVORK5CYII=/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCREY5Mzc2NTVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCREY5Mzc2NjVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkJERjkzNzYzNUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkJERjkzNzY0NUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+cs9D8gAAE0tJREFUeNrsne1x2zgagJmM/686WG0DF6WCyAXcxK7A0lwBtn9nZ2LNbH7bLuBGdAWW5wqwXEG010C0HWgruAPslxbM6AMkAQIUnmdG612vBZAg8OAFCJBZBgDgm8/TkfpMk8l3nf/0+Rgi4j21ESA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"; 
      
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
            // ✅ NEU: 'fit' sorgt dafür, dass das Bild proportional in eine 220x180 Box eingepasst wird
            doc.image(Buffer.from(imageBase64.split(",")[1], "base64"), 40, y, { fit: [220, 180] });
            y += 190; // Fixen Abstand nach unten lassen, damit nichts überschrieben wird
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