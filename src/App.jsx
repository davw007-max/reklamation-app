import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const API = "http://192.168.178.23:3001";
const socket = io(API);

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

  // 🔥 Initial laden
  useEffect(() => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then((data) => setAuftraege(data));
  }, []);

  // 🔥 Live Updates
  useEffect(() => {
    socket.on("auftraege", (data) => {
      setAuftraege(data);
    });

    return () => socket.off("auftraege");
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
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
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
const getStatusStyle = (status) => {
  return {
    color: status === "erledigt" ? "green" : "red",
    fontWeight: "bold",
  };
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

        <button
          onClick={login}
          style={{
            fontSize: 18,
            padding: 12,
            width: "80%",
            background: "#007bff",
            color: "white",
            border: "none",
            borderRadius: 8,
          }}
        >
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

        <input name="nummer" placeholder="Nummer" onChange={handleChange} style={{ width: "100%", padding: 8, marginBottom: 5 }} />
        <input name="strasse" placeholder="Straße" onChange={handleChange} style={{ width: "100%", padding: 8, marginBottom: 5 }} />
        <input name="plzOrt" placeholder="PLZ Ort" onChange={handleChange} style={{ width: "100%", padding: 8, marginBottom: 5 }} />
        <input name="material" placeholder="Material" onChange={handleChange} style={{ width: "100%", padding: 8, marginBottom: 5 }} />

        <select name="fahrer" onChange={handleChange} style={{ width: "100%", padding: 8 }}>
          <option value="">Fahrer wählen</option>
          <option value="Max">Max</option>
          <option value="Tom">Tom</option>
          <option value="Ali">Ali</option>
        </select>

        <br /><br />

        <button
          onClick={addAuftrag}
          style={{ width: "100%", padding: 12, background: "green", color: "white", borderRadius: 8 }}
        >
          ➕ Auftrag erstellen
        </button>

        <hr />

        {auftraege.map((a) => (
          <div
            key={a._id}
            style={{
              background: "#f4f4f4",
              padding: 10,
              marginBottom: 10,
              borderRadius: 10,
            }}
          >
            <b>{a.nummer}</b><br />
            {a.fahrer}<br />
            <span style={{ color: a.status === "erledigt" ? "green" : "red" }}>
              {a.status}
            </span>

            <br /><br />

            <button
              onClick={() => deleteAuftrag(a._id)}
              style={{ width: "100%", padding: 10, background: "red", color: "white", borderRadius: 8 }}
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

        <h2>Meine Aufträge</h2>

        {meineAuftraege.map((a) => (
          <div
            key={a._id}
            style={{
              background: "#f4f4f4",
              padding: 15,
              marginBottom: 15,
              borderRadius: 12,
            }}
          >
            <b style={{ fontSize: 18 }}>{a.nummer}</b><br />

            {a.strasse}<br />
            {a.plzOrt}<br />

            <span style={{ fontWeight: "bold" }}>
           Material: {a.material || "-"}
          </span>

            <br /><br />

            <button
              onClick={() => {
                const query = encodeURIComponent(a.strasse + " " + a.plzOrt);
                window.open(
                  "https://www.google.com/maps/search/?api=1&query=" + query
                );
              }}
              style={{
                width: "100%",
                padding: 12,
                marginBottom: 10,
                background: "#007bff",
                color: "white",
                borderRadius: 8,
              }}
            >
              🗺 Navigation
            </button>

            <button
              onClick={() => toggleStatus(a._id)}
              style={{
                width: "100%",
                padding: 12,
                background: "green",
                color: "white",
                borderRadius: 8,
              }}
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