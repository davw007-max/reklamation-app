import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import jsPDF from "jspdf";

const API = "https://reklamation-backend.onrender.com";
const socket = io(API);

const MATERIALIEN = ["kom. Restmüll", "Kartonage", "LVP"];

function App() {
  const [auftraege, setAuftraege] = useState([]);
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [material, setMaterial] = useState("");

  // 📡 Daten laden
  useEffect(() => {
    fetch(`${API}/auftraege`)
      .then((res) => res.json())
      .then((data) => setAuftraege(data));

    socket.on("update", (data) => {
      setAuftraege(data);
    });

    return () => socket.off("update");
  }, []);

  // ➕ Auftrag speichern
  const addAuftrag = async () => {
    if (!name || !adresse || !material) {
      alert("Bitte alle Pflichtfelder ausfüllen");
      return;
    }

    const neuerAuftrag = {
      name,
      adresse,
      beschreibung,
      material,
    };

    await fetch(`${API}/auftrag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(neuerAuftrag),
    });

    setName("");
    setAdresse("");
    setBeschreibung("");
    setMaterial("");
  };

  // 📄 PDF Export
  const exportPDF = (auftrag) => {
    const doc = new jsPDF();

    const text = [
      `Name: ${auftrag.name}`,
      `Adresse: ${auftrag.adresse}`,
      `Material: ${auftrag.material}`,
      "Beschreibung:",
      ...(auftrag.beschreibung
        ? doc.splitTextToSize(auftrag.beschreibung, 180)
        : ["-"])
    ];

    doc.text(text, 10, 10);
    doc.save(`auftrag_${auftrag.name}.pdf`);
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h2>Auftrag anlegen</h2>

      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <br /><br />

      <input
        placeholder="Adresse"
        value={adresse}
        onChange={(e) => setAdresse(e.target.value)}
      />
      <br /><br />

      <label>Material:</label>
      <br />
      <select
        value={material}
        onChange={(e) => setMaterial(e.target.value)}
      >
        <option value="">Bitte auswählen</option>
        {MATERIALIEN.map((mat) => (
          <option key={mat} value={mat}>
            {mat}
          </option>
        ))}
      </select>

      <br /><br />

      <textarea
        placeholder="Beschreibung"
        value={beschreibung}
        onChange={(e) => setBeschreibung(e.target.value)}
      />

      <br /><br />

      <button onClick={addAuftrag}>Speichern</button>

      <hr />

      <h2>Aufträge</h2>

      {auftraege.map((a, i) => (
        <div
          key={i}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
            borderRadius: "5px"
          }}
        >
          <strong>{a.name}</strong>
          <br />
          {a.adresse}
          <br />
          <b>Material:</b> {a.material}
          <br />
          <b>Beschreibung:</b> {a.beschreibung || "-"}
          <br /><br />

          <button onClick={() => exportPDF(a)}>
            PDF erstellen
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;