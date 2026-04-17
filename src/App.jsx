import { useState, useEffect } from "react";
import { io } from "socket.io-client";

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

    socket.on("auftraege", (data) => {
      setAuftraege(data);
    });

    return () => socket.disconnect();
  }, []);

  // 📦 Initial laden
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

  // 🧾 Formular
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addAuftrag = async () => {
    if (!form.fahrer) return alert("Fahrer auswählen!");

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
  };

  // 🗑 Löschen
  const deleteAuftrag = async (id) => {
    await fetch(`${API}/auftraege/${id}`, { method: "DELETE" });
  };

  // ✔ Status + GPS
  const toggleStatus = (id) => {
    if (!navigator.geolocation) {
      alert("GPS nicht verfügbar");
      return;
    }

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

  const meineAuftraege = auftraege.filter(
    (a) => a.fahrer === user && a.status === "offen"
  );

  const cardStyle = {
    background: "#f4f4f4",
    padding: 15,
    marginBottom: 15,
    borderRadius: 10,
  };

  const buttonStyle = {
    width: "100%",
    padding: 10,
    marginTop: 5,
    borderRadius: 8,
    border: "none",
  };

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

          <button onClick={login} style={{ ...buttonStyle, background: "#007bff", color: "white" }}>
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

          <input name="nummer" placeholder="Nummer" onChange={handleChange} />
          <input name="strasse" placeholder="Straße" onChange={handleChange} />
          <input name="plzOrt" placeholder="PLZ Ort" onChange={handleChange} />
          <input name="material" placeholder="Material" onChange={handleChange} />

          <select name="fahrer" onChange={handleChange}>
            <option value="">Fahrer wählen</option>
            <option value="Max">Max</option>
            <option value="Tom">Tom</option>
            <option value="Ali">Ali</option>
          </select>

          <button style={{ ...buttonStyle, background: "green", color: "white" }} onClick={addAuftrag}>
            ➕ Auftrag erstellen
          </button>

          <hr />

          {auftraege.map((a) => (
            <div key={a._id} style={cardStyle}>
              <b>{a.nummer}</b><br />
              {a.fahrer}<br />
              <span style={{ color: a.status === "erledigt" ? "green" : "red" }}>
                {a.status}
              </span>

              {a.gps && a.gps.lat && (
                <button
                  style={{ ...buttonStyle, background: "#007bff", color: "white" }}
                  onClick={() =>
                    window.open(`https://www.google.com/maps?q=${a.gps.lat},${a.gps.lng}`)
                  }
                >
                  📍 Standort anzeigen
                </button>
              )}

              <button
                style={{ ...buttonStyle, background: "red", color: "white" }}
                onClick={() => deleteAuftrag(a._id)}
              >
                🗑 Löschen
              </button>
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
            <div key={a._id} style={cardStyle}>
              <b>{a.nummer}</b><br />
              {a.strasse}<br />
              {a.plzOrt}<br />

              <button
                style={{ ...buttonStyle, background: "#007bff", color: "white" }}
                onClick={() => {
                  const query = encodeURIComponent(a.strasse + " " + a.plzOrt);
                  window.open(
                    "https://www.google.com/maps/search/?api=1&query=" + query
                  );
                }}
              >
                🗺 Navigation
              </button>

              <button
                style={{ ...buttonStyle, background: "green", color: "white" }}
                onClick={() => toggleStatus(a._id)}
              >
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