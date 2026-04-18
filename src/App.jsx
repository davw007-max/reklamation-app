import { useState, useEffect } from "react";
import jsPDF from "jspdf";

const API = "https://reklamation-backend.onrender.com";

function App() {
  const [auftraege, setAuftraege] = useState([]);

  // 📦 Daten laden (WICHTIG!)
  useEffect(() => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then((data) => {
        console.log("Daten:", data);
        setAuftraege(data);
      })
      .catch((err) => {
        console.error("Fehler:", err);
        alert("Backend nicht erreichbar");
      });
  }, []);

  // 📄 PDF pro Auftrag
  const createPDF = (a) => {
    const pdf = new jsPDF();

    const now = new Date();
    const year = now.getFullYear();

    const getKW = (d) => {
      const date = new Date(d.getTime());
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + 4 - (date.getDay() || 7));
      const yearStart = new Date(date.getFullYear(), 0, 1);
      return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    };

    const kw = getKW(now);

    // 👉 LOGO (optional später)
    const logo = "";

    if (logo) {
      pdf.addImage(logo, "PNG", 140, 10, 50, 20);
    }

    pdf.setFontSize(18);
    pdf.text("AUFTRAGSBERICHT", 10, 20);

    pdf.setFontSize(11);

    let y = 40;

    pdf.text(`Auftragsnummer: ${a.nummer}`, 10, y); y += 8;
    pdf.text(`Fahrer: ${a.fahrer}`, 10, y); y += 8;
    pdf.text(`Material: ${a.material}`, 10, y); y += 8;

    y += 5;

    pdf.text("Adresse:", 10, y); y += 8;
    pdf.text(a.strasse || "-", 10, y); y += 8;
    pdf.text(a.plzOrt || "-", 10, y); y += 10;

    pdf.text(`Status: ${a.status}`, 10, y); y += 8;

    if (a.zeitErledigt) {
      pdf.text(`Erledigt am: ${a.zeitErledigt}`, 10, y); y += 8;
    }

    if (a.gps) {
      pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y); y += 8;
    }

    pdf.text(`Erstellt am: ${now.toLocaleString()}`, 10, y);

    const filename = `${year}_KW${kw}_${a.nummer}.pdf`;
    pdf.save(filename);
  };

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <h1>📋 Dispo Übersicht</h1>

      {auftraege.length === 0 && <p>Keine Aufträge vorhanden</p>}

      {auftraege.map((a) => (
        <div
          key={a._id}
          style={{
            border: "1px solid #ccc",
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <b>{a.nummer}</b><br />
          {a.strasse}<br />
          {a.plzOrt}<br />
          <b>{a.status}</b><br />

          {a.gps && (
            <div>
              📍 {a.gps.lat}, {a.gps.lng}
            </div>
          )}

          <button onClick={() => createPDF(a)}>
            📄 PDF erstellen
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;