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

  const sigRef = useRef(); // bleibt drin (nicht gelöscht)
  const sigRefs = useRef({}); // ✅ NEU (pro Auftrag)

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

  // ✅ FIXED SIGNATURE HANDLING
  const toggleStatus = async (id) => {
    try {
      let signature = null;

      const sig = sigRefs.current[id];

      if (
        sig &&
        typeof sig.getTrimmedCanvas === "function" &&
        !sig.isEmpty()
      ) {
        signature = sig.getTrimmedCanvas().toDataURL("image/png");
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

      await fetch(`${API}/auftraege/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: pos?.coords?.latitude,
          lng: pos?.coords?.longitude,
          unterschrift: signature,
        }),
      });

      if (sig) sig.clear();

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

  // 🖼 LOGO
  const logo = "iVBORw0KGgoAAAANSUhEUgAAAX0AAAC1CAYAAACztS88AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYxIDY0LjE0MDk0OSwgMjAxMC8xMi8wNy0xMDo1NzowMSAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNS4xIE1hY2ludG9zaCIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDpCREY5Mzc2NTVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDpCREY5Mzc2NjVFOTYxMUU1ODc4NTk1ODkwREM5MjUyQyI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOkJERjkzNzYzNUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOkJERjkzNzY0NUU5NjExRTU4Nzg1OTU4OTBEQzkyNTJDIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+cs9D8gAAE0tJREFUeNrsne1x2zgagJmM/686WG0DF6WCyAXcxK7A0lwBtn9nZ2LNbH7bLuBGdAWW5wqwXEG010C0HWgruAPslxbM6AMkAQIUnmdG612vBZAg8OAFCJBZBgDgm8/TkfpMk8l3nf/0+Rgi4j21ESAN/vWffwyCCT/LtHjbFXCofE3h67z1MUQkfqQPkIbwtYC+q5/tymct3oJ2BBwq35+FXxCN+N/RHACSEL4pnPG///nfPIB4TfLsYTw+qHy3C99krPLPQ9YHpA+QlvDbEf9u8foTcKh87YQfhfiRPkB6wvcrfjvxuhdwqHyrCT+4+JE+QJrC9yP+auJ1J+BQ+dYTflDxcyMXIF3ha6at39z9mVDLKsMu5wx0c5dIHyBd4fuJ+OtF3c0j71D5Nov2W4/4kT4Awkf8CYmf6R0AhP863eBsqudFYHUk2mzKJVS+6/x13pM6Zd/WVA+RPgDCJ+J3H/HXzd97xI/0ARA+4k9I/EgfAOEj/oTEj/QBED7iT0j8SB8A4SP+hMSP9AEQPuJPSPxIHwDhI/6ExI/0ARA+4k9I/EgfAOGHFP+JCLCH+NsRP9IHQPihxa9f4/gYQPxh8g0sfqQPgPARf0LiR/oACB/xJyR+pA+A8BF/QuJH+gAIH/EnJH6kD4DwEX9C4kf6AAgf8SckfqQPgPARf0Li581ZAAjfNfoNXBdOUnoYL9Q/j9VnVfGbTd/AFSbfdf55Vu8NYHvfwEWkD4DwfZGriH/sJCUifmcRP9IHQPiIPyHxI30AhI/4ExI/0gdA+Ig/IfEjfQCEj/gTEj/SB0D4iD8h8bNkEwDht8lIygMCgfQB/Ap/hPA3ir9ZmRDl14rykT6AZ2Rnak5JvBVgox27CL+28DXM6QO0E/EzxbMWfvfEy5JNAED8CL9rwkf6AIgf4SckfKQPgPgRfkLCR/oAiB/hJyR8pA+A+BF+QsJH+gCIH+EnJHykD4D4EX5Cwkf6AIgf4SckfKQPgPgRfkLCR/oAiB/hhxW+zv97W8LX8OwdgIgQceYdO2yE3yz/1oRPpA9AxI/wwwq/av6NhI/0ARA/wk9I+BqmdwAiRYR6g/ARvivhE+kDdCPi19F+TG+bQvgdFT7SB0D8bQtfC0+vVum3LPy+5Ju08DVM7wB0AHnT1DjwYbgQ/mMA4et87xE+kT4AEX/7wh8EEH77+UYqfKQPgPgRfkLCR/oAiB/hJyR8pB8Zv3/50qtRSQuWf3z7ttyQ5qBGxXtGpTfnqiQtfoR/YMLXHNF0oqLutmzNRH2uNvz+Wn2GBAWHh765q8SfeRI/wj9A4WtYvQPQcfFn7lf1IPwDFT7SB0D8CD8h4SN9AMTvTvgvjAKJN1S+BWddED7SB0D8LoWfKYndZNUeDe1GvKHyXed/WTH/IMJH+gCI353w1wK0fSeAa/GGybd6/sGEj/QBEL9b4b8V4CSQeG9az9de/EGFj/QB0ha/H+GvBXi15Rh8i/cySL77xR9c+EgfIF3x+xX+WoDlY2hLvGHy3S7+KISP9AHSFH87wv9ZwG2LN0y+P4s/GuFr2JELkID4jZ277Qr/rYDzZPJ9K/6oQPpxsVCf45rfXW75vZ7f7FG0iF+Jf6F+LigNAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAbbzT//j9y5erpgn98e3bVcgTUedwkfl73MBMnd/C4hg6X47GufSzl1fQNWGpziePMT/KL+7yA38Uz9756iCtq4ANbOqgwm8jtxH+IZRjib6D85ln9g+7ajs/yi/u8gPP0u8snoU/JvIBAKQfh+z1VM69+gwRPgDAAUtfhP+oPgMPya/U51QJf071AACkf/jCP64whw8A0Ck69bpEz8JfIHwAINKPR/j97GUO36fwV1QJACDSDy98LfrvnoQ/R/gAQKQfl/D1lI6PjVd6Df6YagAARPoIHwAA6R+I8C8RPgAg/XiEP/IofL3p6oZLDwApEt2cvgh/6iHplQh/xmUHAKR/+MJnDT4AJE800zsehb9E+AAAEUlfnoXvQ/ha9B8RPgDAC8Gndzw+GpldtgAAMUnfo/BZgw8AEJP0ET54oKfq1TCSYxlwOQDp+xf+JJZ3zEIw0T5SDACRSN/zo5F50xUAwB5aW73jUfgrhA8AEFGk71n4rMEHAIgl0kf4AACJSN94UqZr4WvR/4bwAQCq4W16x+Ojkdl0BQAQU6Qv77P19WjkBcIHAIhI+tnLfPvSU9oj1ancy70CAAAILX0diavPR/WvuafjPtEjCRlRAABA4Ei/kL9+HMLEU/L6nsF3uXcAAAChpS/iv1I/fD0LpycR/4hLCQAQgfRF/Ln6cZy9zPX7EP9Uif+KywkAEIH0RfxzEf/SUxZf9YPcuMELALCdVh+4pjdTKSnrG7y+Hro20umqPFjHnyY6oLiL5Fh+zfw8SRagO9IX8a+0lNW/XntqFMUN3tMu7tjVz4OXUVFohl2UfiyP1pbn+iN9iI4g78iVJZ365u6Npyz62csN3pMOXpNYViN9oHkAIH3X8r/M/K7sue/gyp7zCKJU3Wme0DwAkL4P8eeZv5U9mqm8qasr9NXxXgQ+hmuaBgDS9yn+eeZ3ZY9+dMNjCyt7XN1DuA41QpEO8iSy8gAARxzFciAtrOwZZi/z/PoGr6/OxeVoRY9QPqmft23ckJb7H+eZ2xu4f9PEOkVML5Z/EzywGu8ApS/ib2tlj6+Xrzw5luZIRikriZoXjkWqlxX2M38rdeY0sU4R64vlj6lLByr9Qvzqx1iJLvMk/p6I38d7dX1F5D0R87Bj9YvpHYDIeB/rgcmSzrHHLPT0iesblkQjDMkBkH4D8etI/DTzt7LnwuWjG0RyM6rVM3cUAQDSryNSLVGfSzpH2csNXlcrex6oVs/Q+QEg/drif34ReuZvjljfwPrh4tn8MjpZJl6vco8rpADg0KUvMl1JxO8rgiyeze9ijfplwnVKX6cJTQsA6TsRv/roOf7co/jvm+6IlSmpVKc3JkT5AEjftfx9r+y5dvDoBn18qS1Z1NM6NzQrAKTvQ/w62ve5sqfRoxuM6ahUxJ9LZwwASN+b+H2v7BlmL/P8g5rH5/s+RCxMED4A0m9L/G2s7Hms+0wS4z7E2GPnFApd5sexvLgEABKQfksRdbGyZ9TgGHPpnPTKnmXHi3yuOzF1Th8jecsXAFhydCgnIuI/lRuwI0/Z6N27H+TlL3WPUd/ovJEpI708VD9Jcxh58a5E9PqBcjNW5wB0l3cUQRxIJ9DP1o+V/iUL8+rEp1JEv0TyAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwIvRAQ6U3798GagfPeNXiz++fVs5SLevfvSNX61UugtKvCPSVxdwqH4+yn8fq4s3t7zw/5N/navvHO/4O532UP7zRv3tpWX6xfc2pm/kXwcXaW49b5XOlfrxddd31WepPk8qjdyiLMxrpBvtR/W9ZZXvqb9/Z3k9XZ67VX0qnd9EfefKsj5pTtXfzyoK64f5u11lUzo2G7Yev4O2sLNsjPPT5X9SEn7BUurfnW1bl3RH6sdnOY7elj9bSNq3u+rnhmtospJ09OfBsv681rl99bxmndvVNhZFW1af3KZTtUzvQX1m+9KrUz/ft9zJXMhBpo4uA92Ipqo8vktEZotucNcU4StnFf9+FMlxX1S87raR/Xc5x21i7sv/P7dNU9dRXVd3dCQFOv+LPQGPTf0eSjqPKu979elFXP8GUi66Tf6QztFFelNJz7kvjwIUkhbdRwfDzMmW338yoggdRf+1JdrJ9kTiT3v+Zml5nJuO4YNc2OIi31cskxP19ydVItwK6PO6c3TubaDLoleh7M4a5GVTL+ZV2oIetTkSvhbjvSHl54hbImdTKJ+k7j1YRvfTUhSeSxmsSh1JUaf7FvVnXzs223DRTk4jqGs6Cr80Oiddnr8Y590Tv60s22ZulFVfPr8anWtPOr6PltNnVvUzhPT70otfNUlkxxD6yqgwlYawBk/7htEV2HgMMgy/l4rTlwudVxGGSmPuYo62LHSH5+6TZbaeV9ZyurEc0vc3fD9EvXiWsK6vjtI8Mc5HTwucbpHCjU3kLKOGaUlQl3vq26X+XpX5/R3teCDTFj3p2AcR3DdYldryzDjvqTGKvDb+3y7+2uKGS0nDTO/YVf1sc3pnbkQHX10PbbuGzHmac7qfLb96Y0Qa04SLcGmMOM4tv3O24bshyD20BbMDu91T91YWwcIb4au/H9sEGK7ELOlMSp1azO15bIzy+k2uqZTzpVFHnU7xtD2nP95SqVIVv9nL285bPsgw83WaJ+EivLNtZBLdjkrfC0Xfc1toNPqTaZ2iPOcitFDTKV3iqUZ73iX+eWmU2j3pyzzXzBzaZlAHc4QwjfxGl++IObOM9k+2fC9Uhz8zGrWLtlCeu2+COeqc0NyC8ZePRN8HOJFxxjRP0Xv360RnMkIwp3m+plh+MkU2M0Y9uzq/olOY2Sx3DdAWzkv1oSrmHPJ1w8iw6CBXNe+JuRwRORm9tMQvjtP74GPUcxSgoa7kRsXUGNp+jOzi/WrRaFxsdDGXXj5U/O4kW9+808v/Hhw10J7Dc9cRrE2eTTr+h2y92mHjzXAJLAY1y7lSvahyDXTno9KbSD0o7tEc12xXOi0dCFxk61UfuiyqrsfvxzC9Ih34+ZZOLcYArlcaTS4aptc30ltatjer+hli9Y7OOFcHp2+qDUUMF+p3NxFdw1G2fz33cVZteZ5ZOYZSoYsLNLfZpLWh89SRYrExw9VS2EG2f7OH7blft1SXCmmebZm6OTci19xzvXhX8fj1appi09OwSVvQm71K9y6ej1f9To9s9M1dm81DpvSf9tTjgYvOb4PshjJ6LY7lJqLR2bZjvi8d76pBesNS25m4rJ9HActKC+t7MT2hTnQW84VtwOOeaHeWvb2pV6WRz43ori8N5TJLj5lUdi3N/oZ6VERMeaTH76wt6Juu6vt3UheGhsivJe3bplKyDA5sd8bu2wluvXO5jemm0r2XD1K2g1KEbyvpTxvSG5Q63rxhoBJ+esfH0NYDz8PifVMcDfPQje7UwZTMJFvvwHQxzbOw6Dhsz/3S8m8HDUcFt0aEc24ev6xEKeb671qoF8Hbglz/uUxrnRn1o7j/81n9v2MPezxcspD2EVMgWARWWzuo7OWRDrblOsx2P47ituIeDqv6GTLSdzq0dcxfDm9glcVXRGC9rOGyrtI0z30xzaM+vxkyrdwZOTz3heWzU5qWwUKlscjWW9jNTuvMOJZFRPViU1s4k3PQbWHUNMKT833uxKXzKzqVgdSX4y2yeY1E90i5/P2zrPpjLsppTDdEz7Gw2hDE6P/+M7N4Ts4GltnP+0WapGdVP48iKEgtrOIBWIc4zfNGfDK/WpzvtYtdtXr5ny43EV7f2OWZ0pMP74qhcfGICmN+uBgNxE4xzVPUjZmraFzufcyNaaSNU2HSgZqR7dZgIyvd16mzYqgsKVnkYQYwbYz+VxXassvjuQux+/39huFLnWFYo6Fttp4DO/hdpqXz1eV94VAYKS+FzTdE9yOjUc86UDcWPttCqe7tau+FiPttPyCxtH9hWHXzYYU9Kz1XDusa70u93AfLgjUvxN8OLrQZlQ4T2GV641rQEnklu+NZzr8Qf7Fmv5D/LPL5621twceO64WF9M1lrSH2gJjTc9cWIjevrW0n9alGpH8Y0pfoohjijSx7Sh/rZ8vCOthdpsazNV4rtsMo6XXHc5bepi1TVuYSuruOnYfPtmBKcblj1LQygrCLltvHIltvPrQZDc+3uGnXaOB1FJjaC2DelxpFsamjt6PArrO368t9PGBp5xrgAxF/XhrGjhxGSauKUc+hlOks+/khVcvAu0qbSs+qLdiMFuVvzo3odmE5atTR9nXLj/uY2I6GpbzMtjTdI/xHoyO9zRLjqBhSyiqaYufiD9nNZ0ZOxfKvgVFpLh1XdvM4QvLJ4lkoSwfrZyeGnJzcuCst/6tDv6Vz98WsFBnetlwv5o46GXPHtQ3XIkad95+l6FcL7nP29iUot7vqmtwInxijxQuZCdDl+1QaJRQd02eHLliV6vG+xwtfGjIfyb2I21LH9jl7+4KZRUceI+60fpqrd46l0Ir3al7sGFbpC37qaVhUXLyQDC2i5HnWcLOPbK7KjYroZHNVaSlsZelbTAs1PneP3Jbq7azlelGebmgivXHFtlA8CuBkzzW8sZGdBGHLbL3Us5gWGbVxIassY5VVR8eG+Pt7Ah99jU6zw8Kqfh6VhnQfZZrhbMuXFzIVlFeISBelnzYi1D38pyrfK3VIc2M0UoUqjXXh6BgujWhusOUtUKsa56SFMY383Ded37JJfZKRTi5lutix/HdR49hs65+vtrDc09mtsp93dJrnoTvAu4rPB8oluh9l63fkbiunhYwC5g3qz6b28dWI1PNd0zzqWH+TTn/bjIE+l4eKI9V5TRftS2/pIK3K9XPfy7KLYduiK6sfAOC1/WpBe7lR6TNtx8epO8B+1+7r+OT/AgwA19F+HzctvPwAAAAASUVORK5CYII=";
  if (logo) {
    pdf.addImage(logo, "PNG", 140, 10, 50, 20);
  }

  let y = 20;

  pdf.setFontSize(18);
  pdf.text("AUFTRAGSBERICHT", 10, y);

  // Linie für "Profi Look"
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

  if (a.unterschrift) {
    pdf.text("Unterschrift:", 10, y);
    y += 5;
    pdf.addImage(a.unterschrift, "PNG", 10, y, 80, 40);
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
          <button onClick={logout} style={{ width: "100%", padding: 15 }}>
            🚪 Logout
          </button>

          {meine.map((a) => (
            <div key={a._id} style={{ marginBottom: 20 }}>
              <b>{a.nummer}</b>
              <div>{a.strasse}</div>
              <div>{a.plzOrt}</div>
              <div>{a.material}</div>

              <SignatureCanvas
                ref={(ref) => (sigRefs.current[a._id] = ref)}
                penColor="black"
                canvasProps={{
                  width: 320,
                  height: 150,
                  style: { border: "2px solid black" },
                }}
              />

              <button onClick={() => sigRefs.current[a._id]?.clear()}>
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