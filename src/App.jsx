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

  // ✅ SAUBERES USER OBJECT
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [form, setForm] = useState({
    nummer: "",
    strasse: "",
    plzOrt: "",
    material: "",
    fahrer: "",
  });

  const isDispo = user?.role === "dispo";

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch((err) => console.error("Fehler:", err));
  };

  // ✅ LOGIN MIT ROLLE
  const login = (name) => {
    if (!name) return;

    const role = name === "Dispo" ? "dispo" : "fahrer";

    const userData = {
      name,
      role,
    };

    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("user");
    setUser(null);
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
    if (!window.confirm("Wirklich löschen?")) return;

    await fetch(`${API}/auftraege/${id}`, {
      method: "DELETE",
    });

    loadData();
  };

  const toggleStatus = async (id) => {
    const pos = await new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);

      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { timeout: 5000 }
      );
    });

    await fetch(`${API}/auftraege/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pos?.coords?.latitude,
        lng: pos?.coords?.longitude,
      }),
    });

    loadData();
  };

  const meine = auftraege.filter(
    (a) => a.fahrer === user?.name && a.status === "offen"
  );

  // ================= UI =================
  return (
    <div style={{ padding: 20 }}>
      <h1>🚛 App</h1>

      {/* ================= LOGIN ================= */}
      {!user && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2>Login</h2>

          <button onClick={() => login("Max")}>👷 Max</button>
          <button onClick={() => login("Tom")}>👷 Tom</button>
          <button onClick={() => login("Ali")}>👷 Ali</button>

          <hr />

          <button
            onClick={() => login("Dispo")}
            style={{ background: "#333", color: "white" }}
          >
            🧠 Disposition
          </button>
        </div>
      )}

      {/* ================= DISPO ================= */}
      {user && isDispo && (
        <>
          <button onClick={logout}>🚪 Logout</button>

          <h2>📋 Disposition</h2>

          <div style={{
            border: "2px solid #ccc",
            padding: 15,
            borderRadius: 10,
            marginBottom: 20
          }}>
            <h3>➕ Neuer Auftrag</h3>

            <input placeholder="Nr"
              value={form.nummer}
              onChange={(e) => setForm({ ...form, nummer: e.target.value })}
            />

            <input placeholder="Straße"
              value={form.strasse}
              onChange={(e) => setForm({ ...form, strasse: e.target.value })}
            />

            <input placeholder="Ort"
              value={form.plzOrt}
              onChange={(e) => setForm({ ...form, plzOrt: e.target.value })}
            />

            <select value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value })}>
              <option value="">Material</option>
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

            <button onClick={addAuftrag}>➕ Erstellen</button>
          </div>

          {auftraege.map((a) => (
            <div key={a._id} style={{
              border: "1px solid #ddd",
              padding: 10,
              marginBottom: 10
            }}>
              #{a.nummer} - {a.status}

              <button onClick={() => deleteAuftrag(a._id)}>🗑</button>
            </div>
          ))}
        </>
      )}

      {/* ================= FAHRER ================= */}
      {user && !isDispo && (
        <>
          <button onClick={logout}>🚪 Logout</button>

          <h2>🚛 Meine Aufträge</h2>

          {meine.length === 0 && <p>Keine offenen Aufträge</p>}

          {meine.map((a) => (
            <div key={a._id} style={{
              border: "1px solid #ddd",
              padding: 10,
              marginBottom: 10
            }}>
              #{a.nummer}

              <button onClick={() => toggleStatus(a._id)}>
                ✅ Erledigt
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default App;