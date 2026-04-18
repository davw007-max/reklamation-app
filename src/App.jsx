import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import jsPDF from "jspdf";

const API = "https://reklamation-backend.onrender.com";

function App() {
  const [auftraege, setAuftraege] = useState([]);

  useEffect(() => {
    const socket = io(API);
    socket.on("auftraege", setAuftraege);
    return () => socket.disconnect();
  }, []);

  // 📄 PDF pro Auftrag
  const createPDF = (a) => {
    const pdf = new jsPDF();

    // 📅 Datum + KW
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

    // 🖼 Logo (Base64 einfügen!)
    const logo = ""; // 👉 hier später dein Base64 Logo

    if (logo) {
      pdf.addImage(logo, "PNG", 10, 10, 50, 20);
    }

    pdf.setFontSize(18);
    pdf.text("Auftragsbericht", 10, 40);

    pdf.setFontSize(12);

    let y = 60;

    pdf.text(`Auftragsnummer: ${a.nummer}`, 10, y); y += 8;
    pdf.text(`Adresse: ${a.strasse}`, 10, y); y += 8;
    pdf.text(`${a.plzOrt}`, 10, y); y += 8;
    pdf.text(`Material: ${a.material}`, 10, y); y += 8;
    pdf.text(`Fahrer: ${a.fahrer}`, 10, y); y += 8;
    pdf.text(`Status: ${a.status}`, 10, y); y += 8;

    if (a.gps) {
      pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y); y += 8;
    }

    pdf.text(`Datum: ${new Date().toLocaleString()}`, 10, y);

    // 📄 Dateiname
    const filename = `${year}_KW${kw}_${a.nummer}.pdf`;

    pdf.save(filename);
  };

  return (
    <div>
      <h2>Dispo</h2>

      {auftraege.map((a) => (
        <div key={a._id}>
          <b>{a.nummer}</b><br />

          <button onClick={() => createPDF(a)}>
            📄 PDF erstellen
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;