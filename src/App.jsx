import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
// ✅ NEU: Socket.io importieren
import { io } from "socket.io-client"; 

const API = "https://reklamation-backend.onrender.com";

// ✅ NEU: Verbindung zum Backend herstellen
const socket = io(API);

const materialListe = [
  "kom. Restmüll",
  "Kartonage",
  "LVP",
  "Abrufleerung kom Restmüll",
];

function App() {
  const [auftraege, setAuftraege] = useState([]);

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

  // ==========================================
  // ✅ NEU: Der Echtzeit-Listener
  // ==========================================
  useEffect(() => {
    // Falls die Socket-Verbindung kurz braucht, laden wir einmalig klassisch
    loadData(); 

    // Lauscht auf das Event "auftraege" aus deinem server.cjs
    socket.on("auftraege", (neueDaten) => {
      setAuftraege(neueDaten);
    });

    // WICHTIG: Aufräumen, wenn die App geschlossen wird
    return () => {
      socket.off("auftraege");
    };
  }, []);
  // ==========================================

  const loadData = () => {
    fetch(API + "/auftraege")
      .then((res) => res.json())
      .then(setAuftraege)
      .catch((err) => console.error("Fehler beim Laden:", err));
  };

// ... AB HIER BLEIBT ALLES GENAU WIE VORHER ...

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
    if (!form.fahrer) return alert("Fahrer wählen!");
    //if (!form.material) return alert("Material wählen!");//

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

  const resetAuftrag = async (id) => {
    try {
      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusUpdate: "reset" }),
      });
      loadData();
    } catch (err) {
      console.error("Fehler beim Zurücksetzen:", err);
    }
  };

  const updateFahrer = async (id, neuerFahrer) => {
    try {
      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fahrer: neuerFahrer }),
      });
      loadData(); // Liste neu laden, um Änderung zu sehen
    } catch (err) {
      console.error("Fehler beim Zuweisen:", err);
    }
  };

const handleFehlanfahrt = async (id, file) => { // ✅ NEU: async hinzugefügt
    if (!file) return;

    // ==========================================
    // ✅ NEU: 1. GPS Standort abfragen
    // ==========================================
    const getPosition = () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          () => resolve(null),
          { timeout: 5000 }
        );
      });

    // Warten, bis das Handy den Standort gefunden hat
    const pos = await getPosition(); 

    // ==========================================
    // 2. Bild umwandeln und ALLES an Server senden
    // ==========================================
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const base64Bild = reader.result;

      try {
        await fetch(`${API}/auftraege/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            statusUpdate: "fehlanfahrt", 
            bild: base64Bild,
            lat: pos?.coords?.latitude,  // ✅ NEU: GPS Breitengrad senden
            lng: pos?.coords?.longitude  // ✅ NEU: GPS Längengrad senden
          }),
        });
        loadData();
      } catch (err) {
        console.error("Fehler beim Senden des Bildes:", err);
        alert("Bild konnte nicht gesendet werden.");
      }
    };
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
    
    // --- 1. Datum & Dateinamen vorbereiten ---
    const baseDate = a.zeitErledigt ? new Date(a.zeitErledigt) : (a.fehlanfahrt?.zeit ? new Date(a.fehlanfahrt.zeit) : new Date());
    const year = baseDate.getFullYear();
    const kw = getKW(baseDate);
    const tag = String(baseDate.getDate()).padStart(2, "0");
    const monat = String(baseDate.getMonth() + 1).padStart(2, "0");
    const datum = `${tag}-${monat}-${year}`;

    // --- 2. Kopfzeile ---
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text("AUFTRAGSBERICHT", 15, 20);

    // ✅ DEIN FIRMENLOGO (Oben Rechts)
    // WICHTIG: Füge hier exakt denselben Base64-String ein wie im Backend!
    const logoBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAX0AAAC1CAYAAACztS88..."; 
    
    try {
      // x: 140mm (rechts), y: 10mm (oben), Breite: 55mm, Höhe: 15mm
      // Achte darauf, dass "PNG" oder "JPEG" dem Format deines Base64-Strings entspricht
      pdf.addImage(logoBase64, "PNG", 140, 10, 55, 15);
    } catch(e) {
      console.error("Fehler beim Logo-Druck im Frontend", e);
    }

    pdf.setLineWidth(0.5);
    pdf.line(15, 28, 195, 28); // Trennlinie leicht nach unten verschoben, damit sie unters Logo passt

    let y = 38; // Startwert für den Text leicht nach unten angepasst

    // --- 3. Auftragsdetails ---
    pdf.setFontSize(12);
    pdf.text("Auftragsdetails:", 15, y); y += 7;
    
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(`Auftragsnummer: ${a.nummer}`, 15, y); y += 5;
    pdf.text(`Kunde / Adresse: ${a.strasse}, ${a.plzOrt}`, 15, y); y += 5;
    pdf.text(`Material: ${a.material}`, 15, y); y += 5;
    pdf.text(`Fahrer: ${a.fahrer}`, 15, y); y += 10;

    // --- Hilfsfunktion für einheitliche Anfahrts-Blöcke ---
    const drawVisitBlock = (title, time, gps, imageBase64, isAlert) => {
      // Neuer Seitenumbruch, wenn der Platz für das Bild zu knapp wird
      if (y > 230) { 
        pdf.addPage();
        y = 20;
      }

      // Titel (Rot bei Fehlanfahrt, Schwarz bei Erfolg)
      pdf.setTextColor(isAlert ? 220 : 0, 0, 0); 
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.text(title, 15, y); y += 6;

      // Daten
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Zeitpunkt: ${new Date(time).toLocaleString("de-DE")}`, 15, y); y += 5;

      // GPS Link für die Dispo-PDF
      if (gps && gps.lat) {
        pdf.text(`GPS-Standort: ${gps.lat}, ${gps.lng}`, 15, y); y += 5;
        pdf.setTextColor(0, 0, 255); // Blau für den Link
        pdf.textWithLink("In Google Maps öffnen", 15, y, { url: `https://www.google.com/maps?q=$${gps.lat},${gps.lng}` });
        pdf.setTextColor(0, 0, 0);
        y += 7;
      }

      // Beweisfoto einfügen, falls vorhanden
      if (imageBase64) {
        try {
          // ✅ NEU: Original-Proportionen aus dem Bild auslesen
          const imgProps = pdf.getImageProperties(imageBase64);
          const maxWidth = 80;  // Maximale Breite in mm
          const maxHeight = 80; // Maximale Höhe in mm
          
          // Skalierungsfaktor berechnen (nimmt den kleineren Wert, damit beides passt)
          const ratio = Math.min(maxWidth / imgProps.width, maxHeight / imgProps.height);
          const imgWidth = imgProps.width * ratio;
          const imgHeight = imgProps.height * ratio;

          // Bild mit den dynamisch berechneten Werten drucken
          pdf.addImage(imageBase64, "JPEG", 15, y, imgWidth, imgHeight); 
          y += imgHeight + 5; // Dynamischen Abstand addieren, je nachdem wie hoch das Bild wurde

        } catch(e) {
          pdf.text("[Bild konnte nicht geladen werden]", 15, y); y += 7;
        }
      }
      
      y += 3;
      // Gestrichelte Trennlinie zeichnen
      pdf.setLineDashPattern([2, 2], 0);
      pdf.line(15, y, 100, y);
      pdf.setLineDashPattern([], 0); // Strichmuster wieder zurücksetzen
      y += 10;
    };

    // --- 4. Anfahrten chronologisch zeichnen ---
    if (a.fehlanfahrt && a.fehlanfahrt.zeit) {
      drawVisitBlock(
        "1. ANFAHRT (Fehlanfahrt)", 
        a.fehlanfahrt.zeit, 
        a.fehlanfahrt.gps, 
        a.fehlanfahrt.bild, 
        true
      );
    }

    if (a.status === "erledigt") {
      const titel = a.zweiteAnfahrt ? "2. ANFAHRT (Erfolgreich erledigt)" : "ANFAHRT (Erfolgreich erledigt)";
      drawVisitBlock(titel, a.zeitErledigt, a.gps, null, false);
    }

    // --- 5. Footer ---
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Dieser Bericht wurde automatisch erstellt.", 105, 290, { align: "center" });

    // ✅ NEU: Status auslesen und Datei mit Status im Namen speichern
    const currentStatus = a.status.toUpperCase();
    pdf.save(`${year}_KW${kw}_${datum}_${a.nummer}_${currentStatus}.pdf`);
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

// ==========================================
  // ✅ NEU: NOTIFICATION SYSTEM FÜR FAHRER (FIX)
  // ==========================================
  
  // Speichert die vorherige Anzahl der Aufträge
  const prevMeineLength = useRef(meine.length);

  // Globaler Audio-Kontext (muss außerhalb der Funktion leben, um entsperrt zu werden)
  const audioCtxRef = useRef(null);

  // Diese Funktion entsperrt das Audio-System beim ersten Klick auf den Bildschirm
  const unlockAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtxRef.current = new AudioContext();
      }
    }
    // Weckt das System auf, falls das Handy es schlafen geschickt hat
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
  };

  const playNotification = () => {
    // 1. VIBRATION (Android)
    if (navigator.vibrate) {
      navigator.vibrate([300, 100, 300, 100, 500]); 
    }

    // 2. TON
    try {
      unlockAudio(); // Sicherstellen, dass das System wach ist
      const ctx = audioCtxRef.current;
      
      if (ctx) {
        const now = ctx.currentTime;

        const createBeep = (startTime, duration, frequency) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = "square"; 
          osc.frequency.setValueAtTime(frequency, startTime);

          gain.gain.setValueAtTime(1, startTime);
          gain.gain.setValueAtTime(0, startTime + duration);

          osc.start(startTime);
          osc.stop(startTime + duration);
        };

        createBeep(now, 0.15, 1200);        
        createBeep(now + 0.25, 0.15, 1200); 
        createBeep(now + 0.5, 0.4, 1200);   
      }
    } catch (error) {
      console.error("Audio blockiert:", error);
    }
  };

  
  const gefilterteAuftraege = auftraege.filter((a) => {
    if (filter === "alle") return true;
    return a.status === filter;
  });

  return (
    <div 
      style={{ padding: 20, minHeight: "100vh" }} 
      onClick={unlockAudio} 
      onTouchStart={unlockAudio}
    >
      <h1>🚛 Reklamations App</h1>

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

              {/* ========================================= */}
              {/* ✅ NEU: GOOGLE MAPS ROUTEN-BUTTON       */}
              {/* ========================================= */}
                <a 
                 href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a.strasse + ", " + a.plzOrt)}`}
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  background: "#4285F4",
                  color: "white",
                  padding: "8px 12px",
                  textDecoration: "none",
                  borderRadius: "5px",
                  marginTop: "10px",
                  marginBottom: "10px",
                  marginRight: "10px",
                  fontWeight: "bold"
                }}
              >
                🗺️ Route starten
              </a>
              {/* ========================================= */}

              {/* BUTTONS FÜR DEN FAHRER */}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                
                {/* 1. Verstecktes Datei-Feld für die Kamera */}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment" /* Öffnet direkt die Kamera auf dem Handy */
                  id={`kamera-${a._id}`}
                  style={{ display: "none" }}
                  onChange={(e) => handleFehlanfahrt(a._id, e.target.files[0])}
                />

                {/* 2. Fehlanfahrt-Button (Löst das versteckte Datei-Feld aus) */}
                <button 
                  onClick={() => document.getElementById(`kamera-${a._id}`).click()}
                  style={{ 
                    padding: "8px 12px", 
                    background: "orange", 
                    color: "white", 
                    flex: 1 
                  }}
                >
                  📷 Keine Tonne
                </button>

                {/* 3. Normaler Erledigt-Button */}
                <button 
                  onClick={() => toggleStatus(a._id)}
                  style={{ 
                    padding: "8px 12px", 
                    background: "green", 
                    color: "white", 
                    flex: 1 
                  }}
                >
                  ✅ Erledigt
                </button>
              </div>

              
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
        padding: 8,
        border: "none",
        borderRadius: 5
      }}>
        🔴 Offen
      </button>

      <button onClick={() => setFilter("erledigt")} style={{
        marginRight: 10,
        background: filter === "erledigt" ? "green" : "#ccc",
        color: "white",
        padding: 8,
        border: "none",
        borderRadius: 5
      }}>
        🟢 Erledigt
      </button>

      {/* ✅ NEU: Fehlanfahrt Filter-Button */}
      <button onClick={() => setFilter("fehlanfahrt")} style={{
        marginRight: 10,
        background: filter === "fehlanfahrt" ? "orange" : "#ccc",
        color: "white",
        padding: 8,
        border: "none",
        borderRadius: 5
      }}>
        ⚠️ Fehlanfahrten
      </button>

      <button onClick={() => setFilter("alle")} style={{
        background: filter === "alle" ? "#444" : "#ccc",
        color: "white",
        padding: 8,
        border: "none",
        borderRadius: 5
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

        {/* Fahrer-Auswahl statt nur Text */}
        <div style={{ marginTop: 5, marginBottom: 5 }}>
          👤 Fahrer: 
          <select 
            value={a.fahrer || ""} 
            onChange={(e) => updateFahrer(a._id, e.target.value)}
            style={{ marginLeft: 10, padding: "4px", borderRadius: "5px" }}
          >
            <option value="">-- Nicht zugewiesen --</option>
            <option>Max</option>
            <option>Tom</option>
            <option>Ali</option>
          </select>
        </div>

        <div>📦 Material: {a.material}</div>

        <div style={{ marginTop: 5 }}>
          📍 {a.strasse}<br />
          {a.plzOrt}
        </div>

        <div style={{
          marginTop: 8,
          fontWeight: "bold",
          color: a.status === "erledigt" ? "green" : "red"
        }}>
          {a.status.toUpperCase()}
        </div>

        {a.gps?.lat && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${a.gps.lat},${a.gps.lng}`}
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

        {/* ========================================= */}
        {/* ✅ NEU: ANZEIGE BEI FEHLANFAHRT (DISPO)   */}
        {/* ========================================= */}
        {a.status === "fehlanfahrt" && (
          <div style={{ 
            marginTop: 15, 
            padding: 10, 
            background: "#fff3f3", 
            border: "1px solid red", 
            borderRadius: 8 
          }}>
            <strong style={{ color: "red", fontSize: 16 }}>⚠️ Fehlanfahrt gemeldet</strong>
            
            {/* Beweisfoto in der Dispo-Ansicht mit automatischer Anpassung */}
            {a.fehlanfahrt?.bild && (
             <div style={{ 
              width: "100%", 
              height: "350px", // Feste Rahmenhöhe für die Dispo-Liste
              background: "#f0f0f0", // Grauer Hintergrund für die Ränder bei Hochformat
              marginTop: 10,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
          }}>

    <img 
      src={a.fehlanfahrt.bild} 
      alt="Beweis" 
      style={{ 
        maxWidth: "100%", 
        maxHeight: "100%", 
        objectFit: "contain", // ✅ DAS WICHTIGSTE: Bild behält Form und wird eingepasst
        display: "block"
      }} 
    />
  </div>
)}

            {/* Button um den Auftrag wieder zum Fahrer zu schicken */}
            <button 
              onClick={() => resetAuftrag(a._id)}
              style={{ 
                width: "100%", 
                padding: "10px", 
                marginTop: 10, 
                background: "orange", 
                color: "white", 
                fontWeight: "bold",
                border: "none",
                borderRadius: 5
              }}
            >
              🔄 Erneut anfahren lassen (Status auf Offen)
            </button>
          </div>
        )}
        {/* ========================================= */}

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