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
    socket.on("auftraege", setAuftraege);
    return () => socket.disconnect();
  }, []);

  // 📦 Laden
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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: loginName }),
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("fahrer", data.name);
      setUser(data.name);
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
    if (!form.fahrer || !form.material)
      return alert("Fahrer + Material wählen!");

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

  // ✔ Status + GPS + Zeit
  const toggleStatus = async (id) => {
    if (!navigator.geolocation) return alert("GPS nicht verfügbar");

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
          erledigtAm: new Date(),
        }),
      });
    });
  };

  // 🖼 Logo laden
  const loadImage = (url) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(img);
    });
  };

  // 📄 PDF
  const exportPDF = async (a) => {
    const doc = new jsPDF();

    const img = await loadImage("/logo.png");
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    canvas.getContext("2d").drawImage(img, 0, 0);
    const imgData = canvas.toDataURL("image/png");

    doc.addImage(imgData, "PNG", 10, 10, 60, 20);

    const heute = new Date().toLocaleDateString("de-DE");

    doc.setFontSize(10);
    doc.text(`Datum: ${heute}`, 140, 15);

    doc.setFontSize(18);
    doc.text("Auftrag", 10, 40);
    doc.line(10, 45, 200, 45);

    let y = 60;

    const line = (l, v) => {
      doc.setFont(undefined, "bold");
      doc.text(l, 10, y);
      doc.setFont(undefined, "normal");
      doc.text(v || "-", 80, y);
      y += 10;
    };

    line("Nr:", a.nummer);
    line("Fahrer:", a.fahrer);
    line("Adresse:", `${a.strasse}, ${a.plzOrt}`);
    line("Material:", a.material);
    line("Status:", a.status);

    if (a.lat && a.lng) {
      line("GPS:", `${a.lat}, ${a.lng}`);
    }

    if (a.erledigtAm) {
      const d = new Date(a.erledigtAm);
      line("Datum:", d.toLocaleDateString("de-DE"));
      line(
        "Uhrzeit:",
        d.toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }

    doc.save(`auftrag_${a.nummer}.pdf`);
  };

  const meineAuftraege = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

  return (
    <div style={{ padding: 15 }}>
      <h1>🚛 Fahrer App</h1>

      {!user && (
        <>
          <select onChange={(e) => setLoginName(e.target.value)}>
            <option value="">Wählen</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
            <option value="Dispo">Disponent</option>
          </select>
          <button onClick={login}>Start</button>
        </>
      )}

      {/* DISPO */}
      {user && isDisponent && (
        <>
          <button onClick={logout}>Logout</button>

          <h3>Neuer Auftrag</h3>

          <input name="nummer" placeholder="Nummer" onChange={handleChange} />
          <input name="strasse" placeholder="Straße" onChange={handleChange} />
          <input name="plzOrt" placeholder="Ort" onChange={handleChange} />

          <select name="material" onChange={handleChange}>
            <option value="">Material</option>
            {MATERIALIEN.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>

          <select name="fahrer" onChange={handleChange}>
            <option value="">Fahrer</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>

          <button onClick={addAuftrag}>Speichern</button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />
              {a.fahrer}<br />
              {a.material}<br />
              {a.status}<br />

              {/* 📍 GPS BUTTON */}
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
              <button onClick={() => deleteAuftrag(a._id)}>🗑</button>
            </div>
          ))}
        </>
      )}

      {/* FAHRER */}
      {user && !isDisponent && (
        <>
          <button onClick={logout}>Logout</button>

          {meineAuftraege.map((a) => (
            <div key={a._id}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />

              {/* 🧭 Navigation */}
              <button
                onClick={() =>
                  window.open(
                    "https://www.google.com/maps/search/?api=1&query=" +
                      encodeURIComponent(a.strasse + " " + a.plzOrt)
                  )
                }
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