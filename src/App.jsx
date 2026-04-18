import { useState, useEffect } from "react";
import { io } from "socket.io-client";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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
    socket.on("auftraege", setAuftraege);
    return () => socket.disconnect();
  }, []);

  // 📦 Initial laden
  useEffect(() => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege);
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
    }
  };

  const logout = () => {
    localStorage.removeItem("fahrer");
    setUser("");
  };

  // 🧾 Auftrag erstellen
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addAuftrag = async () => {
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
    await fetch(`${API}/auftraege/${id}`, { method: "DELETE" });
  };

  // ✔ Status + GPS
  const toggleStatus = (id) => {
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

  // 📄 PDF EXPORT
  const exportPDF = async () => {
    const element = document.getElementById("pdf-content");
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF();
    pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
    pdf.save("auftraege.pdf");
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
            <option value="">Fahrer wählen</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
            <option>Dispo</option>
          </select>
          <button onClick={login}>Start</button>
        </>
      )}

      {/* DISPO */}
      {user === "Dispo" && (
        <>
          <button onClick={logout}>Logout</button>

          <h3>Neuer Auftrag</h3>
          <input name="nummer" placeholder="Nummer" onChange={handleChange} />
          <input name="strasse" placeholder="Straße" onChange={handleChange} />
          <input name="plzOrt" placeholder="Ort" onChange={handleChange} />
          <input name="material" placeholder="Material" onChange={handleChange} />

          <select name="fahrer" onChange={handleChange}>
            <option value="">Fahrer wählen</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>

          <button onClick={addAuftrag}>➕ Auftrag</button>

          <br /><br />

          {/* 👉 PDF BUTTON EINMAL */}
          <button onClick={exportPDF}>📄 PDF exportieren</button>

          <hr />

          {/* 👉 PDF CONTENT EINMAL */}
          <div id="pdf-content">
            {auftraege.map((a) => (
              <div key={a._id} style={{ border: "1px solid #ccc", marginBottom: 10, padding: 10 }}>
                <b>{a.nummer}</b><br />
                {a.strasse}<br />
                {a.plzOrt}<br />
                {a.material}<br />
                Status: {a.status}<br />

                {a.gps && (
                  <div>
                    📍 {a.gps.lat}, {a.gps.lng}
                  </div>
                )}

                {a.gps && (
                  <button
                    onClick={() =>
                      window.open(`https://www.google.com/maps?q=${a.gps.lat},${a.gps.lng}`)
                    }
                  >
                    Standort anzeigen
                  </button>
                )}

                <br />
                <button onClick={() => deleteAuftrag(a._id)}>🗑 Löschen</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FAHRER */}
      {user && user !== "Dispo" && (
        <>
          <button onClick={logout}>Logout</button>

          {meineAuftraege.map((a) => (
            <div key={a._id}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />

              <button
                onClick={() => {
                  const query = encodeURIComponent(a.strasse + " " + a.plzOrt);
                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`);
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