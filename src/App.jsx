import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import jsPDF from "jspdf";

const API = "https://reklamation-backend.onrender.com";
const MATERIALIEN = ["kom. Restmüll", "Kartonage", "LVP"];

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
      .then((data) => setAuftraege(data))
      .catch(() => alert("Server nicht erreichbar"));
  }, []);

  // 🔐 Login
  const login = async () => {
    if (!loginName) return alert("Bitte Fahrer wählen");

    const res = await fetch(API + "/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    if (!form.fahrer || !form.material) {
      return alert("Bitte Fahrer und Material wählen!");
    }

    await fetch(API + "/auftraege", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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

  // 🗑 Löschen
  const deleteAuftrag = async (id) => {
    await fetch(`${API}/auftraege/${id}`, {
      method: "DELETE",
    });
  };

  // ✔ Status + GPS
  const toggleStatus = async (id) => {
    if (!navigator.geolocation) {
      alert("GPS nicht verfügbar");
      return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          status: "erledigt",
        }),
      });
    });
  };

  // 📄 PDF Export
  const exportPDF = (a) => {
    const doc = new jsPDF();

    const beschreibung = a.beschreibung || "-";
    const beschreibungLines = doc.splitTextToSize(beschreibung, 180);

    const text = [
      `Auftrag: ${a.nummer}`,
      `Adresse: ${a.strasse}, ${a.plzOrt}`,
      `Fahrer: ${a.fahrer}`,
      `Material: ${a.material}`,
      `Status: ${a.status}`,
      "",
      "Beschreibung:",
      ...beschreibungLines,
    ];

    doc.text(text, 10, 10);
    doc.save(`auftrag_${a.nummer}.pdf`);
  };

  const meineAuftraege = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

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

          <button onClick={login} style={{ width: "80%", padding: 12 }}>
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

          <input name="nummer" placeholder="Nummer" value={form.nummer} onChange={handleChange} />
          <input name="strasse" placeholder="Straße" value={form.strasse} onChange={handleChange} />
          <input name="plzOrt" placeholder="PLZ Ort" value={form.plzOrt} onChange={handleChange} />

          <select name="material" value={form.material} onChange={handleChange}>
            <option value="">Material wählen</option>
            {MATERIALIEN.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select name="fahrer" value={form.fahrer} onChange={handleChange}>
            <option value="">Fahrer wählen</option>
            <option value="Max">Max</option>
            <option value="Tom">Tom</option>
            <option value="Ali">Ali</option>
          </select>

          <button onClick={addAuftrag}>➕ Auftrag erstellen</button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id} style={{ borderBottom: "1px solid #ccc", marginBottom: 10 }}>
              <b>{a.nummer}</b><br />
              {a.strasse} - {a.plzOrt}<br />
              Fahrer: {a.fahrer}<br />
              Material: <b>{a.material}</b><br />
              Status: {a.status}<br />

              {a.lat && a.lng && (
                <button
                  onClick={() =>
                    window.open(`https://www.google.com/maps?q=${a.lat},${a.lng}`)
                  }
                >
                  📍 Standort anzeigen
                </button>
              )}

              <br />

              <button onClick={() => exportPDF(a)}>📄 PDF</button>
              <button onClick={() => deleteAuftrag(a._id)}>🗑 Löschen</button>
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
            <div key={a._id} style={{ borderBottom: "1px solid #ccc", marginBottom: 10 }}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />
              Material: <b>{a.material}</b><br /><br />

              <button
                onClick={() => {
                  const query = encodeURIComponent(a.strasse + " " + a.plzOrt);
                  window.open(
                    "https://www.google.com/maps/search/?api=1&query=" + query
                  );
                }}
              >
                Navigation
              </button>

              <button onClick={() => toggleStatus(a._id)}>
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