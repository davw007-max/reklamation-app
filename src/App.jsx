import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import jsPDF from "jspdf";
import logo from "./logo.png"; // Logo in src ablegen

const API = "https://reklamation-backend.onrender.com";

function App() {
  const [auftraege, setAuftraege] = useState([]);
  const [user, setUser] = useState(localStorage.getItem("fahrer") || "");
  const [loginName, setLoginName] = useState("");

  const [form, setForm] = useState({
    nummer: "",
    strasse: "",
    plzOrt: "",
    material: "",
    fahrer: "",
  });

  const isDisponent = user === "Dispo";

  // 🔌 Socket
  useEffect(() => {
    const socket = io(API);

    socket.on("auftraege", (data) => {
      setAuftraege(data);
    });

    return () => socket.disconnect();
  }, []);

  // 📦 Initial laden
  useEffect(() => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch(() => alert("Server nicht erreichbar"));
  }, []);

  // 🔐 Login
  const login = async () => {
    if (!loginName) return alert("Bitte Fahrer wählen");

    const res = await fetch(API + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: loginName }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("fahrer", data.name);
      setUser(data.name);
    } else {
      alert("Login fehlgeschlagen");
    }
  };

  const logout = () => {
    localStorage.removeItem("fahrer");
    setUser("");
  };

  // 🧾 Formular
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addAuftrag = async () => {
    if (!form.fahrer) return alert("Fahrer auswählen!");

    await fetch(API + "/auftraege", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setForm({
      nummer: "",
      strasse: "",
      plzOrt: "",
      material: "",
      fahrer: "",
    });
  };

  // 📅 Kalenderwoche
  function getKalenderwoche(date = new Date()) {
    const tempDate = new Date(date);
    tempDate.setHours(0, 0, 0, 0);

    tempDate.setDate(tempDate.getDate() + 3 - ((tempDate.getDay() + 6) % 7));

    const firstThursday = new Date(tempDate.getFullYear(), 0, 4);
    const weekNumber =
      1 +
      Math.round(
        ((tempDate - firstThursday) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7
      );

    return weekNumber;
  }

  // 📄 PDF Export (pro Auftrag!)
const exportPDF = (auftrag) => {
  const doc = new jsPDF();

  const now = new Date();
  const jahr = now.getFullYear();
  const kw = getKalenderwoche(now);

  const auftragsnummer = auftrag.nummer || "0000";
  const dateiname = `${jahr}_KW${kw}_${auftragsnummer}.pdf`;

  // 🖼 Logo einfügen
  doc.addImage(logo, "PNG", 10, 8, 40, 15);

  // 🏢 Firmenkopf rechts
  doc.setFontSize(10);
  doc.text("Kühl Entsorgung & Recycling Südwest GmbH", 140, 10);
  doc.text("Dispositionssystem", 140, 15);
  doc.text(`Datum: ${now.toLocaleDateString()}`, 140, 20);

  // 📄 Titel
  doc.setFontSize(16);
  doc.text("Auftrag", 10, 35);

  // Linie
  doc.line(10, 38, 200, 38);

  // 📦 Auftragsdaten
  doc.setFontSize(12);

  let y = 50;

  const line = (label, value) => {
    doc.setFont(undefined, "bold");
    doc.text(label, 10, y);

    doc.setFont(undefined, "normal");
    doc.text(String(value || "-"), 60, y);

    y += 8;
  };

  line("Auftragsnummer:", auftrag.nummer);
  line("Fahrer:", auftrag.fahrer);
  line("Straße:", auftrag.strasse);
  line("Ort:", auftrag.plzOrt);
  line("Material:", auftrag.material);
  line("Status:", auftrag.status);

  if (auftrag.gps?.lat) {
    line("GPS:", `${auftrag.gps.lat}, ${auftrag.gps.lng}`);
  }

  // 🧾 Footer
  doc.setFontSize(10);
  doc.text(
    "Dieses Dokument wurde automatisch erstellt.",
    10,
    280
  );

  doc.save(dateiname);
};

  // 🗑 Löschen
  const deleteAuftrag = async (id) => {
    await fetch(`${API}/auftraege/${id}`, { method: "DELETE" });
  };

  // ✔ Status + GPS
  const toggleStatus = (id) => {
    if (!navigator.geolocation) {
      alert("GPS nicht verfügbar");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      });
    });
  };

  const meineAuftraege = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

  const cardStyle = {
    background: "#f4f4f4",
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
  };

  const buttonStyle = {
    width: "100%",
    padding: 10,
    marginTop: 5,
    borderRadius: 8,
    border: "none",
  };

  return (
    <div style={{ padding: 15, fontFamily: "Arial" }}>
      <h1 style={{ textAlign: "center" }}>🚛 Fahrer App</h1>

      {/* LOGIN */}
      {!user && (
        <div style={{ textAlign: "center" }}>
          <h2>Fahrer wählen</h2>

          <select
            value={loginName}
            onChange={(e) => setLoginName(e.target.value)}
            style={{ fontSize: 18, padding: 10, width: "80%" }}
          >
            <option value="">Bitte wählen</option>
            <option value="Max">Max</option>
            <option value="Tom">Tom</option>
            <option value="Ali">Ali</option>
            <option value="Dispo">Disponent</option>
          </select>

          <br /><br />

          <button onClick={login} style={{ ...buttonStyle, background: "#007bff", color: "white" }}>
            Start
          </button>
        </div>
      )}

      {/* DISPO */}
      {user && isDisponent && (
        <>
          <h2>👨‍💼 Disponent</h2>
          <button onClick={logout}>Logout</button>

          <h3>Neuer Auftrag</h3>

          <input name="nummer" placeholder="Nummer" onChange={handleChange} />
          <input name="strasse" placeholder="Straße" onChange={handleChange} />
          <input name="plzOrt" placeholder="PLZ Ort" onChange={handleChange} />
          <input name="material" placeholder="Material" onChange={handleChange} />

          <select name="fahrer" onChange={handleChange}>
            <option value="">Fahrer wählen</option>
            <option value="Max">Max</option>
            <option value="Tom">Tom</option>
            <option value="Ali">Ali</option>
          </select>

          <button style={{ ...buttonStyle, background: "green", color: "white" }} onClick={addAuftrag}>
            ➕ Auftrag erstellen
          </button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id} style={cardStyle}>
              <b>{a.nummer}</b><br />
              {a.fahrer}<br />

              <span style={{ color: a.status === "erledigt" ? "green" : "red" }}>
                {a.status}
              </span>

              {a.gps?.lat && (
                <button
                  style={{ ...buttonStyle, background: "#007bff", color: "white" }}
                  onClick={() =>
                    window.open(`https://www.google.com/maps?q=${a.gps.lat},${a.gps.lng}`)
                  }
                >
                  📍 Standort anzeigen
                </button>
              )}

              <button
                style={{ ...buttonStyle, background: "#6c757d", color: "white" }}
                onClick={() => exportPDF(a)}
              >
                📄 PDF
              </button>

              <button
                style={{ ...buttonStyle, background: "red", color: "white" }}
                onClick={() => deleteAuftrag(a._id)}
              >
                🗑 Löschen
              </button>
            </div>
          ))}
        </>
      )}

      {/* FAHRER */}
      {user && !isDisponent && (
        <>
          <h2>{user}</h2>
          <button onClick={logout}>Logout</button>

          {meineAuftraege.map((a) => (
            <div key={a._id} style={cardStyle}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />

              <button
                style={{ ...buttonStyle, background: "#007bff", color: "white" }}
                onClick={() => {
                  const query = encodeURIComponent(a.strasse + " " + a.plzOrt);
                  window.open(
                    "https://www.google.com/maps/search/?api=1&query=" + query
                  );
                }}
              >
                🗺 Navigation
              </button>

              <button
                style={{ ...buttonStyle, background: "green", color: "white" }}
                onClick={() => toggleStatus(a._id)}
              >
                ✔ Erledigt
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;