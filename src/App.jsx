import { useState, useEffect } from "react";
import jsPDF from "jspdf";

const API = "https://reklamation-backend.onrender.com";

const materialListe = [
  "kom. Restmüll",
  "Kartonage",
  "LVP",
  "Abrufleerung kom Restmüll",
];

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

  const isDispo = user === "Dispo";

  // 📦 Laden
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch((err) => console.error("Fehler beim Laden:", err));
  };

  // 🔐 Login
  const login = async () => {
    if (!loginName) return alert("Bitte auswählen");

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

  // ➕ Auftrag
  const addAuftrag = async () => {
    if (!form.fahrer) return alert("Fahrer wählen!");
    if (!form.material) return alert("Material wählen!");

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

    loadData();
  };

  // 🗑 Löschen
  const deleteAuftrag = async (id) => {
    if (!window.confirm("Auftrag wirklich löschen?")) return;

    await fetch(`${API}/auftraege/${id}`, {
      method: "DELETE",
    });

    loadData();
  };

  // ✔ Status + GPS
  const toggleStatus = (id) => {
    if (!navigator.geolocation) {
      alert("GPS nicht verfügbar");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fetch(`${API}/auftraege/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });

        loadData();
      },
      () => alert("GPS Zugriff verweigert")
    );
  };

  // 📅 Datum DE
  const formatDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 📅 Kalenderwoche
  const getKW = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  // 📄 PDF
  const createPDF = (a) => {
    try {
      const pdf = new jsPDF();

      const now = new Date();
      const year = now.getFullYear();
      const kw = getKW(now);

      let y = 20;

      pdf.setFontSize(16);
      pdf.text("AUFTRAGSBERICHT", 10, y);

      y += 15;

      pdf.setFontSize(11);
      pdf.text(`Nr: ${a.nummer}`, 10, y); y += 8;
      pdf.text(`Fahrer: ${a.fahrer}`, 10, y); y += 8;
      pdf.text(`Material: ${a.material}`, 10, y); y += 8;

      y += 5;

      pdf.text(`Adresse: ${a.strasse}`, 10, y); y += 8;
      pdf.text(`${a.plzOrt}`, 10, y); y += 10;

      pdf.text(`Status: ${a.status}`, 10, y); y += 8;

      pdf.text(`Erledigt: ${formatDate(a.zeitErledigt)}`, 10, y); y += 8;

      if (a.gps?.lat && a.gps?.lng) {
        pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y);
      }

      pdf.save(`${year}_KW${kw}_${a.nummer}.pdf`);
    } catch (err) {
      console.error("PDF Fehler:", err);
      alert("PDF konnte nicht erstellt werden");
    }
  };

  const meine = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>🚛 App</h1>

      {/* LOGIN */}
      {!user && (
        <>
          <select onChange={(e) => setLoginName(e.target.value)}>
            <option value="">Wählen</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
            <option>Dispo</option>
          </select>
          <button onClick={login}>Login</button>
        </>
      )}

      {/* DISPO */}
      {user && isDispo && (
        <>
          <button onClick={logout}>Logout</button>

          <h3>Neuer Auftrag</h3>

          <input
            placeholder="Nr"
            value={form.nummer}
            onChange={(e) => setForm({ ...form, nummer: e.target.value })}
          />
          <input
            placeholder="Straße"
            value={form.strasse}
            onChange={(e) => setForm({ ...form, strasse: e.target.value })}
          />
          <input
            placeholder="Ort"
            value={form.plzOrt}
            onChange={(e) => setForm({ ...form, plzOrt: e.target.value })}
          />

          {/* ✅ MATERIAL DROPDOWN */}
          <select
            value={form.material}
            onChange={(e) =>
              setForm({ ...form, material: e.target.value })
            }
          >
            <option value="">Material wählen</option>
            {materialListe.map((m, i) => (
              <option key={i} value={m}>
                {m}
              </option>
            ))}
          </select>

          <select
            value={form.fahrer}
            onChange={(e) =>
              setForm({ ...form, fahrer: e.target.value })
            }
          >
            <option value="">Fahrer</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>

          <button onClick={addAuftrag}>➕</button>

          <hr />

          {auftraege.map((a) => (
            <div
              key={a._id}
              style={{
                border: "1px solid #ccc",
                padding: 10,
                marginBottom: 10,
                borderRadius: 8,
              }}
            >
              <b>{a.nummer}</b> - {a.status}
              <br />

              <button onClick={() => createPDF(a)}>📄 PDF</button>

              <button
                onClick={() => deleteAuftrag(a._id)}
                style={{
                  marginLeft: 10,
                  background: "red",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: 5,
                }}
              >
                🗑 Löschen
              </button>
            </div>
          ))}
        </>
      )}

      {/* FAHRER */}
      {user && !isDispo && (
        <>
          <button onClick={logout}>Logout</button>

          {meine.map((a) => (
            <div key={a._id}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />

              <button onClick={() => toggleStatus(a._id)}>
                ✔ erledigt
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;