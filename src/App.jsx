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

  // ✅ ROBUSTER LOGIN STATE (FIX)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("fahrer");
    if (!saved || saved === "null" || saved === "undefined") return "";
    return saved;
  });

  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [filter, setFilter] = useState("offen");

  const [form, setForm] = useState({
    nummer: "",
    strasse: "",
    plzOrt: "",
    material: "",
    fahrer: "",
  });

  const isDispo = user === "Dispo";
  const isFahrer = user && user !== "Dispo";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch((err) => console.error("Fehler beim Laden:", err));
  };

  // ✅ STABILER LOGIN
  const login = async () => {
    if (!loginName) return alert("Bitte auswählen");
    if (!password) return alert("Passwort eingeben");

    // ✅ PASSWORT LOGIK
    if (loginName === "Dispo" && password !== "987654") {
      return alert("Falsches Dispo Passwort");
    }

    if (loginName !== "Dispo" && password !== "1234") {
      return alert("Falsches Fahrer Passwort");
    }

    try {
      const res = await fetch(API + "/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: loginName }),
      });

      if (!res.ok) throw new Error("Login fehlgeschlagen");

      const data = await res.json();

      if (data?.name) {
        localStorage.setItem("fahrer", data.name);
        setUser(data.name);
        setPassword(""); // sauber zurücksetzen
      }
    } catch (err) {
      console.error(err);
      alert("Serverfehler beim Login");
    }
  };

  const logout = () => {
    localStorage.removeItem("fahrer");
    setUser("");
  };

  const addAuftrag = async () => {
    if (!form.material) return alert("Material wählen!");

    await fetch(API + "/auftraege", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        status: form.fahrer ? "offen" : "ungeplant"
      }),
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
          status: "erledigt", // ✅ FIX
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

  const createPDF = (a) => {
    const pdf = new jsPDF();
    const baseDate = a.zeitErledigt ? new Date(a.zeitErledigt) : new Date();

    const year = baseDate.getFullYear();
    const kw = getKW(baseDate);

    const tag = String(baseDate.getDate()).padStart(2, "0");
    const monat = String(baseDate.getMonth() + 1).padStart(2, "0");
    const datum = `${tag}-${monat}-${year}`;

    pdf.setFontSize(18);
    pdf.text("AUFTRAGSBERICHT", 10, 20);

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

  const gefilterteAuftraege = auftraege.filter((a) => {
    if (filter === "alle") return true;
    return a.status === filter;
  });

  return (
    <div style={{ padding: 20 }}>
      <h1>🚛 App</h1>

      {/* ✅ LOGIN */}
      {!user && (
        <>
          <select onChange={(e) => setLoginName(e.target.value)}>
            <option value="">Wählen</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
            <option>Dispo</option>
          </select>

          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginLeft: 10 }}
          />
          <button onClick={login}>Login</button>
        </>
      )}

      {/* ✅ FAHRER ANSICHT (NEU) */}
      {user && isFahrer && (
        <>
          <button onClick={logout}>🚪 Logout ({user})</button>

          <h2>🚚 Meine Aufträge</h2>

          {meine.length === 0 && <p>Keine offenen Aufträge</p>}

          {meine.map((a) => (
            <div key={a._id} style={{
              border: "2px solid #ddd",
              padding: 10,
              marginBottom: 10
            }}>
              <b>#{a.nummer}</b><br />
              📍 {a.strasse}<br />
              {a.plzOrt}<br />
              📦 {a.material}<br />

              <button onClick={() => toggleStatus(a._id)}>
                ✅ Erledigt
              </button>
            </div>
          ))}
        </>
      )}

      {/* ✅ DEIN DISPO BLOCK (UNVERÄNDERT) */}
      {user && isDispo && (
        <>
          <button onClick={logout} style={{
            width: "100%",
            padding: 12,
            marginBottom: 20,
            fontSize: 16
          }}>
            🚪 Logout
          </button>

          <h2>📋 Disposition</h2>

          {/* ================= NEUER AUFTRAG ================= */}
          <div style={{
            border: "2px solid #ccc",
            padding: 15,
            borderRadius: 10,
            marginBottom: 20,
            background: "#f9f9f9"
          }}>
            <h3>➕ Neuer Auftrag</h3>

            <input placeholder="Nr"
              value={form.nummer}
              onChange={(e) => setForm({ ...form, nummer: e.target.value })}
              style={{ width: "100%", marginBottom: 8 }}
            />

            <input placeholder="Straße"
              value={form.strasse}
              onChange={(e) => setForm({ ...form, strasse: e.target.value })}
              style={{ width: "100%", marginBottom: 8 }}
            />

            <input placeholder="Ort"
              value={form.plzOrt}
              onChange={(e) => setForm({ ...form, plzOrt: e.target.value })}
              style={{ width: "100%", marginBottom: 8 }}
            />

            <select value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}
              style={{ width: "100%", marginBottom: 8 }}>
              <option value="">Material wählen</option>
              {materialListe.map((m, i) => (
                <option key={i} value={m}>{m}</option>
              ))}
            </select>

            <select value={form.fahrer}
              onChange={(e) => setForm({ ...form, fahrer: e.target.value })}
              style={{ width: "100%", marginBottom: 10 }}>
              <option value="">Fahrer</option>
              <option>Max</option>
              <option>Tom</option>
              <option>Ali</option>
            </select>

            <button onClick={addAuftrag} style={{
              width: "100%",
              padding: 12,
              fontSize: 16
            }}>
              ➕ Auftrag erstellen
            </button>
          </div>

          {/* ================= AUFTRAGSFILTER ================= */}
          <div style={{ marginBottom: 15 }}>
            <button onClick={() => setFilter("offen")} style={{
              marginRight: 10,
              background: filter === "offen" ? "#007bff" : "#ccc",
              color: "white",
              padding: 8
            }}>
              🔴 Offen
            </button>

            <button onClick={() => setFilter("erledigt")} style={{
              marginRight: 10,
              background: filter === "erledigt" ? "green" : "#ccc",
              color: "white",
              padding: 8
            }}>
              🟢 Erledigt
            </button>

            {/* ➕ ERGÄNZUNG: ungeplant */}
            <button onClick={() => setFilter("ungeplant")} style={{
              marginRight: 10,
              background: filter === "ungeplant" ? "orange" : "#ccc",
              color: "white",
              padding: 8
            }}>
              🟡 Ungeplant
            </button>

            <button onClick={() => setFilter("alle")} style={{
              background: filter === "alle" ? "#444" : "#ccc",
              color: "white",
              padding: 8
            }}>
              📋 Alle
            </button>
          </div>

          {/* ================= AUFTRÄGE ================= */}
          <h3>🚛 Aufträge</h3>

          {gefilterteAuftraege.map((a) => (
            <div key={a._id} style={{
              border: "2px solid #ddd",
              borderRadius: 12,
              padding: 15,
              marginBottom: 15,
              background: "#fff",
              boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
            }}>
              <div style={{ fontSize: 18, fontWeight: "bold" }}>
                #{a.nummer}
              </div>

              <select
                value={a.fahrer || ""}
                onChange={(e) =>
                  fetch(`${API}/auftraege/${a._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      fahrer: e.target.value,
                      status: "offen"
                    }),
                  }).then(loadData)
                }
              >
                <option value="">-- Fahrer wählen --</option>
                <option>Max</option>
                <option>Tom</option>
                <option>Ali</option>
              </select>

              <div>👤 Fahrer: <b>{a.fahrer}</b></div>
              <div>📦 Material: {a.material}</div>

              <div style={{ marginTop: 5 }}>
                📍 {a.strasse}<br />
                {a.plzOrt}
              </div>

              <input
                value={a.strasse}
                onChange={(e) =>
                  fetch(`${API}/auftraege/${a._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ strasse: e.target.value }),
                  }).then(loadData)
                }
              />

              <div style={{
                marginTop: 8,
                fontWeight: "bold",
                color: a.status === "erledigt" ? "green" : "red"
              }}>
                {a.status.toUpperCase()}
              </div>

              {a.gps?.lat && (
                <a
                  href={`https://www.google.com/maps?q=${a.gps.lat},${a.gps.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block", marginTop: 8 }}
                >
                  📍 Standort öffnen
                </a>
              )}

              {/* BUTTONS */}
              <div style={{
                display: "flex",
                gap: 10,
                marginTop: 10
              }}>
                <button
                  onClick={() => createPDF(a)}
                  style={{ flex: 1, padding: 10 }}
                >
                  📄 PDF
                </button>

                <button
                  onClick={() => deleteAuftrag(a._id)}
                  style={{
                    flex: 1,
                    padding: 10,
                    background: "#ff4d4d",
                    color: "white"
                  }}
                >
                  🗑 Löschen
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;