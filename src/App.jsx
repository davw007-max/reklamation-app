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
  erledigtAm: new Date()
}),
      });
    });
  };

  // 📄 PDF Export
const exportPDF = async (a) => {
  const doc = new jsPDF();

  const heute = new Date().toLocaleDateString("de-DE");

  // 🖼 Logo laden
  const img = await loadImage("/logo.png");

  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);

  const imgData = canvas.toDataURL("image/png");

  // Logo
  doc.addImage(imgData, "PNG", 10, 10, 60, 20);

  // Kopf rechts
  doc.setFontSize(10);
  doc.text("Kühl Entsorgung & Recycling", 140, 10);
  doc.text("Südwest GmbH", 140, 15);
  doc.text("Dispositionssystem", 140, 20);
  doc.text(`Datum: ${heute}`, 140, 25);

  // Titel
  doc.setFontSize(18);
  doc.text("Auftrag", 10, 40);

  doc.line(10, 45, 200, 45);

  doc.setFontSize(12);

  let y = 60;

  const line = (label, value) => {
    doc.setFont(undefined, "bold");
    doc.text(label, 10, y);

    doc.setFont(undefined, "normal");
    doc.text(value || "-", 80, y);

    y += 10;
  };

  line("Auftragsnummer:", a.nummer);
  line("Fahrer:", a.fahrer);
  line("Straße:", a.strasse);
  line("Ort:", a.plzOrt);
  line("Material:", a.material);
  line("Status:", a.status);

  // 📍 GPS
  if (a.lat && a.lng) {
    line("GPS:", `${a.lat}, ${a.lng}`);
  }

  // 📅 Datum + Uhrzeit erledigt
  if (a.erledigtAm) {
    const d = new Date(a.erledigtAm);

    const datum = d.toLocaleDateString("de-DE");
    const uhrzeit = d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
    });

    line("Erledigt am:", datum);
    line("Uhrzeit:", uhrzeit);
  }

  doc.save(`auftrag_${a.nummer}.pdf`);
};

  line("Auftragsnummer:", a.nummer);
  line("Fahrer:", a.fahrer);
  line("Straße:", a.strasse);
  line("Ort:", a.plzOrt);
  line("Material:", a.material);
  line("Status:", a.status);

  if (a.lat && a.lng) {
    line("GPS:", `${a.lat}, ${a.lng}`);
  }

  doc.save(`auftrag_${a.nummer}.pdf`);
};

  line("Auftragsnummer:", a.nummer);
  line("Fahrer:", a.fahrer);
  line("Straße:", a.strasse);
  line("Ort:", a.plzOrt);
  line("Material:", a.material);
  line("Status:", a.status);

  if (a.lat && a.lng) {
    line("GPS:", `${a.lat}, ${a.lng}`);
  }

  // 💾 Speichern
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