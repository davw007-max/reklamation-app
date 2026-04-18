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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch((err) => console.error("Fehler beim Laden:", err));
  };

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
    }
  };

  const logout = () => {
    localStorage.removeItem("fahrer");
    setUser("");
  };

  const addAuftrag = async () => {
    if (!form.fahrer) return alert("Fahrer wählen!");
    if (!form.material) return alert("Material wählen!");

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

    loadData();
  };

  const deleteAuftrag = async (id) => {
    if (!window.confirm("Auftrag wirklich löschen?")) return;

    await fetch(`${API}/auftraege/${id}`, {
      method: "DELETE",
    });

    loadData();
  };

  // ✅ OHNE UNTERSCHRIFT – NUR GPS + STATUS
  const toggleStatus = async (id) => {
    try {
      const getPosition = () =>
        new Promise((resolve) => {
          if (!navigator.geolocation) return resolve(null);

          navigator.geolocation.getCurrentPosition(
            (pos) => resolve(pos),
            () => resolve(null),
            { timeout: 5000 }
          );
        });

      const pos = await getPosition();

      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos?.coords?.latitude,
          lng: pos?.coords?.longitude,
        }),
      });

      loadData();
    } catch (err) {
      console.error("Fehler beim Erledigen:", err);
      alert("Fehler beim Erledigen");
    }
  };

  // 📄 PDF (unverändert gelassen inkl. Logo)
  const createPDF = (a) => {
    const pdf = new jsPDF();
    const baseDate = a.zeitErledigt ? new Date(a.zeitErledigt) : new Date();

    const year = baseDate.getFullYear();
    const kw = getKW(baseDate);

    const tag = String(baseDate.getDate()).padStart(2, "0");
    const monat = String(baseDate.getMonth() + 1).padStart(2, "0");
    const datum = `${tag}-${monat}-${year}`;

    const logo = "DEIN_BASE64_LOGO"; // bleibt wie gehabt

    if (logo) {
      pdf.addImage(logo, "PNG", 140, 10, 50, 20);
    }

    let y = 20;

    pdf.setFontSize(18);
    pdf.text("AUFTRAGSBERICHT", 10, y);

    y += 5;
    pdf.line(10, y, 200, y);

    y += 10;

    pdf.setFontSize(11);
    pdf.text(`Nr: ${a.nummer}`, 10, y); y += 6;
    pdf.text(`Fahrer: ${a.fahrer}`, 10, y); y += 6;
    pdf.text(`Material: ${a.material}`, 10, y); y += 10;

    pdf.text(`Adresse: ${a.strasse}`, 10, y); y += 6;
    pdf.text(`${a.plzOrt}`, 10, y); y += 10;

    pdf.text(`Status: ${a.status}`, 10, y); y += 6;

    if (a.zeitErledigt) {
      pdf.text(
        `Erledigt: ${new Date(a.zeitErledigt).toLocaleString("de-DE")}`,
        10,
        y
      );
      y += 10;
    }

    if (a.gps?.lat) {
      pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y);
      y += 10;
    }

    pdf.save(`${year}_KW${kw}_${datum}_${a.nummer}.pdf`);
  };

  const getKW = (date) => {
    const d = new Date(date);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  };

  const meine = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

  return (
    <div style={{ padding: 20 }}>
      <h1>🚛 App</h1>

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

      {user && isDispo && (
        <>
          <button onClick={logout}>Logout</button>

          <h3>Neuer Auftrag</h3>

          <input placeholder="Nr" value={form.nummer}
            onChange={(e) => setForm({ ...form, nummer: e.target.value })} />

          <input placeholder="Straße" value={form.strasse}
            onChange={(e) => setForm({ ...form, strasse: e.target.value })} />

          <input placeholder="Ort" value={form.plzOrt}
            onChange={(e) => setForm({ ...form, plzOrt: e.target.value })} />

          <select value={form.material}
            onChange={(e) => setForm({ ...form, material: e.target.value })}>
            <option value="">Material wählen</option>
            {materialListe.map((m, i) => (
              <option key={i} value={m}>{m}</option>
            ))}
          </select>

          <select value={form.fahrer}
            onChange={(e) => setForm({ ...form, fahrer: e.target.value })}>
            <option value="">Fahrer</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>

          <button onClick={addAuftrag}>➕</button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id}>
              <b>{a.nummer}</b> - {a.status}
              <button onClick={() => createPDF(a)}>📄 PDF</button>
              <button onClick={() => deleteAuftrag(a._id)}>🗑</button>
            </div>
          ))}
        </>
      )}

      {user && !isDispo && (
        <>
          <button
            onClick={logout}
            style={{ width: "100%", padding: 15, fontSize: 18 }}
          >
            🚪 Logout
          </button>

          {meine.map((a) => (
            <div
              key={a._id}
              style={{
                marginBottom: 25,
                padding: 15,
                borderRadius: 10,
                background: "#f4f4f4",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: "bold" }}>
                {a.nummer}
              </div>

              <div>📍 {a.strasse}</div>
              <div>{a.plzOrt}</div>

              <div style={{ fontWeight: "bold", marginTop: 5 }}>
                ♻️ {a.material}
              </div>

              <button
                onClick={() => {
                  const query = encodeURIComponent(
                    a.strasse + " " + a.plzOrt
                  );
                  window.open(
                    "https://www.google.com/maps/search/?api=1&query=" + query
                  );
                }}
                style={{
                  width: "100%",
                  padding: 15,
                  fontSize: 18,
                  marginTop: 10,
                  background: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                }}
              >
                🗺 Navigation starten
              </button>

              <button
                onClick={() => toggleStatus(a._id)}
                style={{
                  width: "100%",
                  padding: 18,
                  fontSize: 20,
                  marginTop: 10,
                  background: "green",
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                }}
              >
                ✔ Auftrag erledigt
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;