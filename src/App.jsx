import { useState, useEffect } from "react";
import jsPDF from "jspdf";

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

  const isDispo = user === "Dispo";

  // 📦 Laden
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege);
  };

  // 🔐 Login
  const login = async () => {
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

  // ➕ Auftrag
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

    loadData();
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

      loadData();
    });
  };

  // 📄 PDF
  const createPDF = (a) => {
    const pdf = new jsPDF();

    const now = new Date();
    const year = now.getFullYear();

    const getKW = (d) => {
      const date = new Date(d);
      date.setDate(date.getDate() + 4 - (date.getDay() || 7));
      const yearStart = new Date(date.getFullYear(), 0, 1);
      return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
    };

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

    if (a.zeitErledigt) {
      pdf.text(`Erledigt: ${a.zeitErledigt}`, 10, y); y += 8;
    }

    if (a.gps) {
      pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y);
    }

    pdf.save(`${year}_KW${kw}_${a.nummer}.pdf`);
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

          <input placeholder="Nr" onChange={(e) => setForm({...form, nummer: e.target.value})} />
          <input placeholder="Straße" onChange={(e) => setForm({...form, strasse: e.target.value})} />
          <input placeholder="Ort" onChange={(e) => setForm({...form, plzOrt: e.target.value})} />
          <input placeholder="Material" onChange={(e) => setForm({...form, material: e.target.value})} />

          <select onChange={(e) => setForm({...form, fahrer: e.target.value})}>
            <option>Fahrer</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>

          <button onClick={addAuftrag}>➕</button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id}>
              {a.nummer} - {a.status}
              <button onClick={() => createPDF(a)}>PDF</button>
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