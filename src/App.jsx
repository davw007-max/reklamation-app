import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import SignatureCanvas from "react-signature-canvas";

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

  const sigRef = useRef(); // ✅ fehlte

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

  // ✔ Status + GPS + ✍️ Unterschrift
  const toggleStatus = async (id) => {
  try {
    let signature = null;

    // ✅ SAFE CHECK (wichtig!)
    if (
      sigRef.current &&
      typeof sigRef.current.getTrimmedCanvas === "function" &&
      !sigRef.current.isEmpty()
    ) {
      signature = sigRef.current
        .getTrimmedCanvas()
        .toDataURL("image/png");
    }

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

    const payload = {
      lat: pos?.coords?.latitude,
      lng: pos?.coords?.longitude,
      unterschrift: signature,
    };

    console.log("SEND:", payload);

    await fetch(`${API}/auftraege/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (sigRef.current) sigRef.current.clear();

    loadData();
  } catch (err) {
    console.error("Fehler beim Erledigen:", err);
    alert("Fehler beim Erledigen");
  }
};

  // 📅 Datum
  const formatDate = (d) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("de-DE");
  };

  // 📅 KW
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

      const baseDate = a.zeitErledigt
        ? new Date(a.zeitErledigt)
        : new Date();

      const year = baseDate.getFullYear();
      const kw = getKW(baseDate);

      const tag = String(baseDate.getDate()).padStart(2, "0");
      const monat = String(baseDate.getMonth() + 1).padStart(2, "0");
      const datum = `${tag}-${monat}-${year}`;

      let y = 20;

      pdf.setFontSize(18);
      pdf.text("AUFTRAGSBERICHT", 10, y);

      y += 10;

      pdf.setFontSize(11);
      pdf.text(`Nr: ${a.nummer}`, 10, y); y += 6;
      pdf.text(`Fahrer: ${a.fahrer}`, 10, y); y += 6;
      pdf.text(`Material: ${a.material}`, 10, y); y += 10;

      pdf.text(`Adresse: ${a.strasse}`, 10, y); y += 6;
      pdf.text(`${a.plzOrt}`, 10, y); y += 10;

      pdf.text(`Status: ${a.status}`, 10, y); y += 6;
      pdf.text(`Erledigt: ${formatDate(a.zeitErledigt)}`, 10, y); y += 10;

      if (a.gps?.lat) {
        pdf.text(`GPS: ${a.gps.lat}, ${a.gps.lng}`, 10, y);
        y += 10;
      }

      if (a.unterschrift) {
        pdf.text("Unterschrift:", 10, y);
        y += 5;
        pdf.addImage(a.unterschrift, "PNG", 10, y, 80, 40);
      }

      pdf.save(`${year}_KW${kw}_${datum}_${a.nummer}.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF Fehler");
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
              <option key={i}>{m}</option>
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

      {/* FAHRER */}
      {user && !isDispo && (
        <>
          <button onClick={logout}>Logout</button>

          {meine.map((a, index) => (
  <div key={a._id}>
    <SignatureCanvas
      ref={index === 0 ? sigRef : null}  // 👈 nur EIN Canvas nutzt ref
      penColor="black"
      canvasProps={{
        width: 300,
        height: 150,
        style: { border: "1px solid black" },
      }}
    />

              <button onClick={() => sigRef.current.clear()}>
                ❌ Löschen
              </button>

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