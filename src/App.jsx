import { useState, useEffect, useMemo } from "react";
import { storage } from "./storage";

const uid = () => Math.random().toString(36).slice(2, 10);
const todayISO = () => new Date().toISOString().slice(0, 10);

function weekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 3600 * 1000));
  return `${target.getFullYear()}-S${String(week).padStart(2, "0")}`;
}

function weekRangeLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dayNr = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - dayNr);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (x) => x.toLocaleDateString("es-MX", { day: "numeric", month: "short" });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

const money = (n) =>
  (isFinite(n) ? n : 0).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
const pct = (n) => `${(n * 100).toFixed(1)}%`;

const DEFAULT_MENU = [
  { id: uid(), nombre: "Latte", caliente: 70, frio: 75 },
  { id: uid(), nombre: "Americano", caliente: 55, frio: 60 },
  { id: uid(), nombre: "Flat White", caliente: 55, frio: null },
  { id: uid(), nombre: "Matcha", caliente: 83, frio: 87 },
  { id: uid(), nombre: "Chai", caliente: 85, frio: 89 },
];

const DEFAULT_EXTRAS = [
  { id: uid(), nombre: "J. Caramelo", precio: 15 },
  { id: uid(), nombre: "J. Vainilla", precio: 15 },
];

const DEFAULT_LECHES = [
  { id: uid(), nombre: "Coco", precio: 15 },
  { id: uid(), nombre: "Avena", precio: 20 },
  { id: uid(), nombre: "Soya", precio: 15 },
  { id: uid(), nombre: "Almendra", precio: 15 },
];

const DEFAULT_USUARIOS = ["Barista 1", "Barista 2"];

export default function CasaElinaSistema() {
  const [loaded, setLoaded] = useState(false);
  const [entries, setEntries] = useState([]);
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [extras, setExtras] = useState(DEFAULT_EXTRAS);
  const [leches, setLeches] = useState(DEFAULT_LECHES);
  const [usuarios, setUsuarios] = useState(DEFAULT_USUARIOS);
  const [pin, setPin] = useState("0000");
  const [config, setConfig] = useState({
    tasaBase: 0.2,
    tasaMax: 0.25,
    insumos: 0.3,
    meta: 3000,
    usarMeta: false,
  });

  const [session, setSession] = useState(null);
  const [view, setView] = useState("vender");

  useEffect(() => {
    (async () => {
      const load = async (key, fallback) => {
        try {
          const v = await storage.get(key);
          return v ?? fallback;
        } catch (_) {
          return fallback;
        }
      };
      setEntries(await load("entries", []));
      setMenu(await load("menu", DEFAULT_MENU));
      setExtras(await load("extras", DEFAULT_EXTRAS));
      setLeches(await load("leches", DEFAULT_LECHES));
      setUsuarios(await load("usuarios", DEFAULT_USUARIOS));
      setPin(await load("pin", "0000"));
      setConfig(await load("config", config));
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (key, value, setter) => {
    setter(value);
    try {
      await storage.set(key, value);
    } catch (_) {}
  };

  function splitFor(venta, priorWeekTotal) {
    const insumos = venta * config.insumos;
    let socio;
    if (config.usarMeta && config.meta > 0) {
      const before = priorWeekTotal;
      const bajoMeta = Math.max(0, Math.min(venta, config.meta - before));
      const sobreMeta = venta - bajoMeta;
      socio = bajoMeta * config.tasaBase + sobreMeta * config.tasaMax;
    } else {
      socio = venta * config.tasaBase;
    }
    const casaElina = venta - insumos - socio;
    return { insumos, socio, casaElina };
  }

  const weeks = useMemo(() => {
    const map = {};
    const chron = [...entries].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    for (const en of chron) {
      const k = weekKey(en.fecha);
      if (!map[k]) map[k] = { key: k, label: weekRangeLabel(en.fecha), items: [], acumVenta: 0 };
      const before = map[k].acumVenta;
      const s = splitFor(en.venta, before);
      map[k].items.push({ ...en, ...s });
      map[k].acumVenta += en.venta;
    }
    return Object.values(map).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [entries, config]);

  async function addEntry(entry) {
    await persist("entries", [...entries, entry], setEntries);
  }
  async function deleteEntry(id) {
    await persist("entries", entries.filter((e) => e.id !== id), setEntries);
  }

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[#241712] flex items-center justify-center">
        <div className="text-[#D8C9B4] font-mono text-sm tracking-widest animate-pulse">CARGANDO…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginView
        usuarios={usuarios}
        pin={pin}
        onEnter={(s) => {
          setSession(s);
          setView("vender");
        }}
      />
    );
  }

  const tabs = session.isAdmin
    ? [
        ["vender", "Vender"],
        ["historial", "Historial"],
        ["corte", "Corte"],
        ["bebidas", "Bebidas"],
      ]
    : [
        ["vender", "Vender"],
        ["misventas", "Mis ventas"],
      ];

  return (
    <div className="min-h-screen bg-[#241712] text-[#EFE6D8] font-sans">
      <div className="max-w-md mx-auto px-4 pt-8 pb-24">
        <Header session={session} onLogout={() => setSession(null)} />

        <nav className="flex gap-1 mb-6 bg-[#1A100C] rounded-full p-1 border border-[#3E2C22]">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`flex-1 text-[11px] tracking-wide uppercase font-semibold py-2 rounded-full transition-colors ${
                view === k ? "bg-[#B8935A] text-[#241712]" : "text-[#B8A088] hover:text-[#EFE6D8]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {view === "vender" && (
          <VenderView menu={menu} extras={extras} leches={leches} usuario={session.name} onRegister={addEntry} />
        )}

        {view === "misventas" && <MisVentasView entries={entries} usuario={session.name} />}

        {session.isAdmin && view === "historial" && (
          <HistorialView entries={entries} usuarios={usuarios} config={config} deleteEntry={deleteEntry} splitFor={splitFor} />
        )}

        {session.isAdmin && view === "corte" && (
          <CorteView weeks={weeks} config={config} usuarios={usuarios} />
        )}

        {session.isAdmin && view === "bebidas" && <BebidasView entries={entries} usuarios={usuarios} />}

        {session.isAdmin && (
          <ConfigPanel
            config={config}
            menu={menu}
            extras={extras}
            leches={leches}
            usuarios={usuarios}
            pin={pin}
            onSaveConfig={(c) => persist("config", c, setConfig)}
            onSaveMenu={(m) => persist("menu", m, setMenu)}
            onSaveExtras={(x) => persist("extras", x, setExtras)}
            onSaveLeches={(l) => persist("leches", l, setLeches)}
            onSaveUsuarios={(u) => persist("usuarios", u, setUsuarios)}
            onSavePin={(p) => persist("pin", p, setPin)}
          />
        )}
      </div>
    </div>
  );
}

function Header({ session, onLogout }) {
  return (
    <div className="mb-8 text-center relative">
      <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-[#B8935A] mb-1">
        <span className="w-6 h-px bg-[#B8935A]" />
        Coffee Bar
        <span className="w-6 h-px bg-[#B8935A]" />
      </div>
      <h1 className="font-serif text-3xl" style={{ fontFamily: "'Georgia', serif" }}>Casa Elina</h1>
      <div className="flex items-center justify-center gap-2 mt-1">
        <p className="text-[11px] text-[#8A7862] tracking-wide">
          {session.isAdmin ? "Administrador" : session.name}
        </p>
        <button onClick={onLogout} className="text-[10px] text-[#8A5A2B] underline underline-offset-2">
          cambiar
        </button>
      </div>
    </div>
  );
}

function LoginView({ usuarios, pin, onEnter }) {
  const [step, setStep] = useState("select");
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");

  function checkPin() {
    if (pinInput === pin) {
      onEnter({ name: "Administrador", isAdmin: true });
    } else {
      setError("PIN incorrecto");
    }
  }

  return (
    <div className="min-h-screen bg-[#241712] text-[#EFE6D8] font-sans flex items-center justify-center px-4">
      <div className="max-w-xs w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-[#B8935A] mb-1">
            <span className="w-6 h-px bg-[#B8935A]" />Coffee Bar<span className="w-6 h-px bg-[#B8935A]" />
          </div>
          <h1 className="font-serif text-3xl" style={{ fontFamily: "'Georgia', serif" }}>Casa Elina</h1>
        </div>

        {step === "select" && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wide text-[#B8A088] mb-3 text-center">¿Quién eres?</p>
            {usuarios.map((u) => (
              <button
                key={u}
                onClick={() => onEnter({ name: u, isAdmin: false })}
                className="w-full bg-[#1A100C] border border-[#3E2C22] rounded-lg py-3 text-sm hover:border-[#B8935A] transition-colors"
              >
                {u}
              </button>
            ))}
            <button
              onClick={() => setStep("pin")}
              className="w-full bg-transparent border border-dashed border-[#3E2C22] rounded-lg py-3 text-sm text-[#8A7862] hover:text-[#B8935A] hover:border-[#B8935A] transition-colors mt-4"
            >
              Administrador
            </button>
          </div>
        )}

        {step === "pin" && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-[#B8A088] mb-3 text-center">PIN de administrador</p>
            <input
              type="password"
              inputMode="numeric"
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value);
                setError("");
              }}
              className="w-full bg-[#1A100C] border border-[#3E2C22] rounded-lg px-3 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[#B8935A] mb-2"
              autoFocus
            />
            {error && <div className="text-[#D98066] text-xs text-center mb-2">{error}</div>}
            <button
              onClick={checkPin}
              className="w-full bg-[#B8935A] text-[#241712] font-semibold uppercase tracking-wide text-sm py-2.5 rounded-lg hover:bg-[#C9A66E] transition-colors mb-2"
            >
              Entrar
            </button>
            <button onClick={() => setStep("select")} className="w-full text-[11px] text-[#8A7862] py-1">
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Stepper({ label, price, qty, onChange }) {
  return (
    <div className="flex items-center justify-between bg-[#241712] rounded-lg px-2.5 py-1.5">
      <div>
        <div className="text-[12px] leading-tight">{label}</div>
        <div className="text-[10px] text-[#8A7862] font-mono">{money(price)}</div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, qty - 1))}
          className="w-6 h-6 rounded-full bg-[#1A100C] border border-[#3E2C22] text-[#EFE6D8] flex items-center justify-center text-sm"
        >
          −
        </button>
        <span className="font-mono text-xs w-4 text-center">{qty}</span>
        <button
          onClick={() => onChange(qty + 1)}
          className="w-6 h-6 rounded-full bg-[#B8935A] text-[#241712] flex items-center justify-center text-sm font-semibold"
        >
          +
        </button>
      </div>
    </div>
  );
}

function VenderView({ menu, extras, leches, usuario, onRegister }) {
  const [cart, setCart] = useState({}); // key -> {nombre, variante, precio, qty, tipo}
  const [fecha, setFecha] = useState(todayISO());
  const [nota, setNota] = useState("");
  const [flash, setFlash] = useState(false);

  const items = Object.values(cart).filter((i) => i.qty > 0);
  const total = items.reduce((s, i) => s + i.precio * i.qty, 0);

  function setQty(key, base, qty) {
    if (qty <= 0) {
      const next = { ...cart };
      delete next[key];
      setCart(next);
    } else {
      setCart({ ...cart, [key]: { ...base, qty } });
    }
  }

  async function handleRegister() {
    if (items.length === 0) return;
    await onRegister({ id: uid(), fecha, usuario, items, venta: total, nota: nota.trim() });
    setCart({});
    setNota("");
    setFlash(true);
    setTimeout(() => setFlash(false), 1400);
  }

  return (
    <div>
      <div className="mb-4">
        <label className="block text-[11px] uppercase tracking-wide text-[#B8A088] mb-1">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="w-full bg-[#1A100C] border border-[#3E2C22] rounded-lg px-3 py-2 text-[#EFE6D8] outline-none focus:border-[#B8935A]"
        />
      </div>

      <p className="text-[11px] uppercase tracking-wide text-[#B8A088] mb-2">Bebidas vendidas</p>
      <div className="space-y-2 mb-5">
        {menu.map((m) => (
          <div key={m.id} className="bg-[#1A100C] border border-[#3E2C22] rounded-lg p-2.5">
            <div className="text-sm font-semibold mb-1.5">{m.nombre}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {m.caliente != null && (
                <Stepper
                  label="Caliente"
                  price={m.caliente}
                  qty={cart[`${m.id}-H`]?.qty || 0}
                  onChange={(q) => setQty(`${m.id}-H`, { nombre: m.nombre, variante: "Caliente", precio: m.caliente, tipo: "bebida" }, q)}
                />
              )}
              {m.frio != null && (
                <Stepper
                  label="Frío"
                  price={m.frio}
                  qty={cart[`${m.id}-C`]?.qty || 0}
                  onChange={(q) => setQty(`${m.id}-C`, { nombre: m.nombre, variante: "Frío", precio: m.frio, tipo: "bebida" }, q)}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {extras.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wide text-[#B8A088] mb-2">Extras</p>
          <div className="grid grid-cols-2 gap-1.5 mb-5">
            {extras.map((x) => (
              <Stepper
                key={x.id}
                label={x.nombre}
                price={x.precio}
                qty={cart[`extra-${x.id}`]?.qty || 0}
                onChange={(q) => setQty(`extra-${x.id}`, { nombre: x.nombre, variante: null, precio: x.precio, tipo: "extra" }, q)}
              />
            ))}
          </div>
        </>
      )}

      {leches.length > 0 && (
        <>
          <p className="text-[11px] uppercase tracking-wide text-[#B8A088] mb-2">Leche alternativa</p>
          <div className="grid grid-cols-2 gap-1.5 mb-5">
            {leches.map((l) => (
              <Stepper
                key={l.id}
                label={l.nombre}
                price={l.precio}
                qty={cart[`leche-${l.id}`]?.qty || 0}
                onChange={(q) => setQty(`leche-${l.id}`, { nombre: l.nombre, variante: null, precio: l.precio, tipo: "leche" }, q)}
              />
            ))}
          </div>
        </>
      )}

      <input
        type="text"
        placeholder="Nota (opcional)"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        className="w-full bg-[#1A100C] border border-[#3E2C22] rounded-lg px-3 py-2 mb-4 text-[#EFE6D8] outline-none focus:border-[#B8935A]"
      />

      <div className="bg-[#1A100C] border border-[#3E2C22] rounded-xl p-4 sticky bottom-4">
        {items.length === 0 ? (
          <div className="text-center text-[#6E5C4A] text-xs py-2">Toca lo vendido para agregarlo</div>
        ) : (
          <div className="mb-3 space-y-1 text-sm font-mono">
            {items.map((i, idx) => (
              <div key={idx} className="flex justify-between">
                <span>{i.qty} × {i.nombre}{i.variante ? ` (${i.variante})` : ""}</span>
                <span>{money(i.precio * i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-dashed border-[#3E2C22] my-1.5 pt-1.5 flex justify-between font-bold">
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>
        )}
        <button
          onClick={handleRegister}
          disabled={items.length === 0}
          className="w-full bg-[#B8935A] disabled:opacity-40 text-[#241712] font-semibold uppercase tracking-wide text-sm py-2.5 rounded-lg hover:bg-[#C9A66E] transition-colors"
        >
          {flash ? "Registrado ✓" : "Registrar venta"}
        </button>
      </div>
    </div>
  );
}

function SimpleTicket({ entry }) {
  const d = new Date(entry.fecha + "T00:00:00");
  const fechaLabel = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short" });
  return (
    <div className="bg-[#F5EFE3] text-[#241712] rounded-sm px-5 py-4 font-mono text-[13px] shadow-lg mb-3">
      <div className="capitalize font-semibold mb-2">{fechaLabel}</div>
      <div className="border-t border-dashed border-[#B8A088] my-1.5" />
      {entry.items.map((i, idx) => (
        <div key={idx} className="flex justify-between">
          <span>{i.qty} × {i.nombre}{i.variante ? ` (${i.variante})` : ""}</span>
          <span>{money(i.precio * i.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-[#B8A088] my-1.5" />
      <div className="flex justify-between font-bold">
        <span>Total</span>
        <span>{money(entry.venta)}</span>
      </div>
      {entry.nota && <div className="mt-2 text-[11px] italic text-[#8A7862]">"{entry.nota}"</div>}
    </div>
  );
}

function MisVentasView({ entries, usuario }) {
  const mias = [...entries].filter((e) => e.usuario === usuario).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  if (mias.length === 0) {
    return (
      <div className="text-center text-[#6E5C4A] text-xs py-10 border border-dashed border-[#3E2C22] rounded-xl">
        Aún no has registrado ventas
      </div>
    );
  }
  return <div>{mias.map((e) => <SimpleTicket key={e.id} entry={e} />)}</div>;
}

function Row({ label, value, bold, muted, accent }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={muted ? "text-[#8A7862]" : ""}>{label}</span>
      <span className={bold ? "font-bold" : accent ? "font-bold text-[#8A5A2B]" : muted ? "text-[#8A7862]" : ""}>
        {value}
      </span>
    </div>
  );
}

function Receipt({ entry, insumos, socio, casaElina, config, onDelete }) {
  const d = new Date(entry.fecha + "T00:00:00");
  const fechaLabel = d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div className="relative bg-[#F5EFE3] text-[#241712] rounded-sm px-5 py-5 font-mono text-[13px] shadow-lg mb-4">
      <div
        className="absolute -top-1.5 left-0 right-0 h-3"
        style={{
          backgroundImage: "radial-gradient(circle at 6px 6px, #241712 4px, transparent 4.5px)",
          backgroundSize: "12px 12px",
        }}
      />
      <div className="text-center mb-2">
        <div className="text-[10px] tracking-[0.25em] uppercase text-[#8A7862]">Corte diario</div>
        <div className="capitalize font-semibold">{fechaLabel}</div>
        <div className="text-[11px] text-[#8A7862]">{entry.usuario}</div>
      </div>
      <div className="border-t border-dashed border-[#B8A088] my-2" />
      {entry.items.map((i, idx) => (
        <div key={idx} className="flex justify-between text-[12px] text-[#5A4A3A]">
          <span>{i.qty} × {i.nombre}{i.variante ? ` (${i.variante})` : ""}</span>
          <span>{money(i.precio * i.qty)}</span>
        </div>
      ))}
      <div className="border-t border-dashed border-[#B8A088] my-2" />
      <Row label="Venta neta cobrada" value={money(entry.venta)} bold />
      <Row label={`Insumos (${pct(config.insumos)})`} value={`− ${money(insumos)}`} muted />
      <div className="border-t border-dashed border-[#B8A088] my-2" />
      <Row label="Pago socio operativo" value={money(socio)} accent />
      <Row label="Resultado Casa Elina" value={money(casaElina)} />
      {entry.nota && <div className="mt-2 text-[11px] italic text-[#8A7862]">"{entry.nota}"</div>}
      {onDelete && (
        <button onClick={onDelete} className="mt-3 text-[10px] uppercase tracking-wide text-[#A85C3B] hover:text-[#7A3F26] underline underline-offset-2">
          Eliminar
        </button>
      )}
      <div className="border-t border-dashed border-[#B8A088] mt-3 pt-2 text-center text-[9px] tracking-[0.2em] text-[#B8A088] uppercase">
        * * * Casa Elina * * *
      </div>
    </div>
  );
}

function UsuarioFilter({ usuarios, value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#1A100C] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-xs text-[#EFE6D8] outline-none focus:border-[#B8935A] mb-4"
    >
      <option value="__todos">Todos los usuarios</option>
      {usuarios.map((u) => (
        <option key={u} value={u}>{u}</option>
      ))}
    </select>
  );
}

function HistorialView({ entries, usuarios, config, deleteEntry, splitFor }) {
  const [filtro, setFiltro] = useState("__todos");

  const withSplit = useMemo(() => {
    const chron = [...entries].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
    const acumPorSemana = {};
    const out = [];
    for (const en of chron) {
      const k = weekKey(en.fecha);
      const before = acumPorSemana[k] || 0;
      const s = splitFor(en.venta, before);
      acumPorSemana[k] = before + en.venta;
      out.push({ entry: en, ...s });
    }
    return out.reverse();
  }, [entries, config]);

  const filtrados = withSplit.filter((x) => filtro === "__todos" || x.entry.usuario === filtro);

  if (filtrados.length === 0) {
    return (
      <div>
        <UsuarioFilter usuarios={usuarios} value={filtro} onChange={setFiltro} />
        <div className="text-center text-[#6E5C4A] text-xs py-10 border border-dashed border-[#3E2C22] rounded-xl">
          Sin ventas registradas
        </div>
      </div>
    );
  }

  return (
    <div>
      <UsuarioFilter usuarios={usuarios} value={filtro} onChange={setFiltro} />
      {filtrados.map((x) => (
        <Receipt
          key={x.entry.id}
          entry={x.entry}
          insumos={x.insumos}
          socio={x.socio}
          casaElina={x.casaElina}
          config={config}
          onDelete={() => deleteEntry(x.entry.id)}
        />
      ))}
    </div>
  );
}

function CorteView({ weeks, config, usuarios }) {
  const [filtro, setFiltro] = useState("__todos");

  if (weeks.length === 0) {
    return (
      <div className="text-center text-[#6E5C4A] text-xs py-10 border border-dashed border-[#3E2C22] rounded-xl">
        Aún no hay ventas para generar un corte
      </div>
    );
  }
  return (
    <div>
      <UsuarioFilter usuarios={usuarios} value={filtro} onChange={setFiltro} />
      <div className="space-y-5">
        {weeks.map((w) => {
          const items = filtro === "__todos" ? w.items : w.items.filter((i) => i.usuario === filtro);
          if (items.length === 0) return null;
          const totVenta = items.reduce((s, i) => s + i.venta, 0);
          const totInsumos = items.reduce((s, i) => s + i.insumos, 0);
          const totSocio = items.reduce((s, i) => s + i.socio, 0);
          const totCasa = items.reduce((s, i) => s + i.casaElina, 0);
          const ventaSemanaCompleta = w.items.reduce((s, i) => s + i.venta, 0);
          const metaAlcanzada = config.usarMeta && ventaSemanaCompleta >= config.meta;
          return (
            <div key={w.key} className="bg-[#1A100C] border border-[#3E2C22] rounded-xl p-4">
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-[11px] uppercase tracking-wide text-[#B8935A]">{w.label}</div>
                <div className="text-[10px] text-[#6E5C4A]">{items.length} venta(s)</div>
              </div>
              <div className="space-y-1 text-sm font-mono">
                <Row label="Venta total" value={money(totVenta)} bold />
                <Row label={`Insumos (${pct(config.insumos)})`} value={`− ${money(totInsumos)}`} muted />
                <div className="border-t border-dashed border-[#3E2C22] my-1.5" />
                <Row label="Pago socio operativo" value={money(totSocio)} accent />
                <Row label="Resultado Casa Elina" value={money(totCasa)} />
              </div>
              {config.usarMeta && (
                <div className="mt-3 text-[11px] text-[#8A7862]">
                  Meta semanal: {money(config.meta)} —{" "}
                  {metaAlcanzada ? (
                    <span className="text-[#B8935A]">alcanzada, aplica {pct(config.tasaMax)} sobre el excedente</span>
                  ) : (
                    <span>faltan {money(Math.max(0, config.meta - ventaSemanaCompleta))}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BebidasView({ entries, usuarios }) {
  const [filtro, setFiltro] = useState("__todos");

  const ranking = useMemo(() => {
    const map = {};
    for (const e of entries) {
      if (filtro !== "__todos" && e.usuario !== filtro) continue;
      for (const i of e.items) {
        const label =
          i.tipo === "extra"
            ? `Extra: ${i.nombre}`
            : i.tipo === "leche"
            ? `Leche: ${i.nombre}`
            : i.variante
            ? `${i.nombre} · ${i.variante}`
            : i.nombre;
        if (!map[label]) map[label] = { label, qty: 0, revenue: 0 };
        map[label].qty += i.qty;
        map[label].revenue += i.qty * i.precio;
      }
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty);
  }, [entries, filtro]);

  const totalUnidades = ranking.reduce((s, r) => s + r.qty, 0);

  return (
    <div>
      <UsuarioFilter usuarios={usuarios} value={filtro} onChange={setFiltro} />
      {ranking.length === 0 ? (
        <div className="text-center text-[#6E5C4A] text-xs py-10 border border-dashed border-[#3E2C22] rounded-xl">
          Aún no hay bebidas registradas
        </div>
      ) : (
        <div className="bg-[#1A100C] border border-[#3E2C22] rounded-xl p-4">
          <div className="text-[11px] uppercase tracking-wide text-[#B8935A] mb-3">
            Control de bebidas vendidas · {totalUnidades} unidades
          </div>
          <div className="space-y-3">
            {ranking.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{r.label}</span>
                  <span className="font-mono text-[#B8935A]">{r.qty} vendidas</span>
                </div>
                <div className="h-1.5 bg-[#241712] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#B8935A] rounded-full"
                    style={{ width: `${totalUnidades ? (r.qty / totalUnidades) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-[10px] text-[#6E5C4A] font-mono mt-0.5">{money(r.revenue)} en ventas</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldPercent({ label, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] uppercase tracking-wide text-[#B8A088] mb-1">
        <span>{label}</span>
        <span className="text-[#EFE6D8] font-mono">{pct(value)}</span>
      </div>
      <input
        type="range"
        min="0"
        max="0.5"
        step="0.005"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#B8935A]"
      />
    </div>
  );
}

function ConfigPanel({ config, menu, extras, leches, usuarios, pin, onSaveConfig, onSaveMenu, onSaveExtras, onSaveLeches, onSaveUsuarios, onSavePin }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("tasas");
  const [localConfig, setLocalConfig] = useState(config);
  const [localMenu, setLocalMenu] = useState(menu);
  const [localExtras, setLocalExtras] = useState(extras);
  const [localLeches, setLocalLeches] = useState(leches);
  const [localUsuarios, setLocalUsuarios] = useState(usuarios);
  const [localPin, setLocalPin] = useState(pin);
  const [nuevoUsuario, setNuevoUsuario] = useState("");

  useEffect(() => setLocalConfig(config), [config]);
  useEffect(() => setLocalMenu(menu), [menu]);
  useEffect(() => setLocalExtras(extras), [extras]);
  useEffect(() => setLocalLeches(leches), [leches]);
  useEffect(() => setLocalUsuarios(usuarios), [usuarios]);
  useEffect(() => setLocalPin(pin), [pin]);

  function updateMenuItem(id, field, value) {
    setLocalMenu(localMenu.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }
  function toggleVariante(id, campo, activo) {
    setLocalMenu(localMenu.map((m) => (m.id === id ? { ...m, [campo]: activo ? 0 : null } : m)));
  }
  function addMenuItem() {
    setLocalMenu([...localMenu, { id: uid(), nombre: "Nueva bebida", caliente: 0, frio: null }]);
  }
  function removeMenuItem(id) {
    setLocalMenu(localMenu.filter((m) => m.id !== id));
  }

  function updateExtra(id, field, value) {
    setLocalExtras(localExtras.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  }
  function addExtra() {
    setLocalExtras([...localExtras, { id: uid(), nombre: "Nuevo extra", precio: 0 }]);
  }
  function removeExtra(id) {
    setLocalExtras(localExtras.filter((x) => x.id !== id));
  }

  function updateLeche(id, field, value) {
    setLocalLeches(localLeches.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }
  function addLeche() {
    setLocalLeches([...localLeches, { id: uid(), nombre: "Nueva leche", precio: 0 }]);
  }
  function removeLeche(id) {
    setLocalLeches(localLeches.filter((l) => l.id !== id));
  }

  function addUsuario() {
    const n = nuevoUsuario.trim();
    if (n && !localUsuarios.includes(n)) {
      setLocalUsuarios([...localUsuarios, n]);
      setNuevoUsuario("");
    }
  }
  function removeUsuario(u) {
    setLocalUsuarios(localUsuarios.filter((x) => x !== u));
  }

  function saveAll() {
    onSaveConfig(localConfig);
    onSaveMenu(localMenu);
    onSaveExtras(localExtras);
    onSaveLeches(localLeches);
    onSaveUsuarios(localUsuarios);
    onSavePin(localPin);
    setOpen(false);
  }

  return (
    <div className="mt-8 border-t border-[#3E2C22] pt-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] uppercase tracking-wide text-[#8A7862] hover:text-[#B8935A] flex items-center gap-1.5"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
        Configuración
      </button>

      {open && (
        <div className="mt-4 bg-[#1A100C] border border-[#3E2C22] rounded-xl p-4">
          <div className="flex gap-3 mb-4 text-[11px] uppercase tracking-wide flex-wrap">
            {[["tasas", "Reparto"], ["menu", "Menú"], ["extras", "Extras"], ["leches", "Leches"], ["usuarios", "Usuarios"]].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={tab === k ? "text-[#B8935A] font-semibold" : "text-[#6E5C4A]"}
              >
                {l}
              </button>
            ))}
          </div>

          {tab === "tasas" && (
            <div className="space-y-4">
              <FieldPercent label="Tasa base del socio" value={localConfig.tasaBase} onChange={(v) => setLocalConfig({ ...localConfig, tasaBase: v })} />
              <FieldPercent label="Costo de insumos estimado" value={localConfig.insumos} onChange={(v) => setLocalConfig({ ...localConfig, insumos: v })} />
              <div className="flex items-center justify-between">
                <label className="text-[11px] uppercase tracking-wide text-[#B8A088]">Escalón por meta semanal</label>
                <input
                  type="checkbox"
                  checked={localConfig.usarMeta}
                  onChange={(e) => setLocalConfig({ ...localConfig, usarMeta: e.target.checked })}
                  className="w-4 h-4 accent-[#B8935A]"
                />
              </div>
              {localConfig.usarMeta && (
                <>
                  <FieldPercent label="Tasa máxima sobre excedente" value={localConfig.tasaMax} onChange={(v) => setLocalConfig({ ...localConfig, tasaMax: v })} />
                  <div>
                    <label className="block text-[11px] uppercase tracking-wide text-[#B8A088] mb-1">Meta semanal ($)</label>
                    <input
                      type="number"
                      value={localConfig.meta}
                      onChange={(e) => setLocalConfig({ ...localConfig, meta: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#241712] border border-[#3E2C22] rounded-lg px-3 py-2 text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-[#B8A088] mb-1">PIN de administrador</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={localPin}
                  onChange={(e) => setLocalPin(e.target.value)}
                  className="w-full bg-[#241712] border border-[#3E2C22] rounded-lg px-3 py-2 text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                />
              </div>
            </div>
          )}

          {tab === "menu" && (
            <div className="space-y-3">
              {localMenu.map((m) => (
                <div key={m.id} className="bg-[#241712] border border-[#3E2C22] rounded-lg p-2.5">
                  <div className="flex gap-2 items-center mb-2">
                    <input
                      type="text"
                      value={m.nombre}
                      onChange={(e) => updateMenuItem(m.id, "nombre", e.target.value)}
                      className="flex-1 bg-[#1A100C] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                    />
                    <button onClick={() => removeMenuItem(m.id)} className="text-[#A85C3B] text-xs px-1">✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5">
                      <input type="checkbox" checked={m.caliente != null} onChange={(e) => toggleVariante(m.id, "caliente", e.target.checked)} className="accent-[#B8935A]" />
                      <span className="text-[10px] text-[#8A7862] w-12">Caliente</span>
                      <input
                        type="number"
                        disabled={m.caliente == null}
                        value={m.caliente ?? ""}
                        onChange={(e) => updateMenuItem(m.id, "caliente", parseFloat(e.target.value) || 0)}
                        className="w-16 bg-[#1A100C] border border-[#3E2C22] rounded-lg px-2 py-1 text-xs text-[#EFE6D8] outline-none focus:border-[#B8935A] disabled:opacity-30"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input type="checkbox" checked={m.frio != null} onChange={(e) => toggleVariante(m.id, "frio", e.target.checked)} className="accent-[#B8935A]" />
                      <span className="text-[10px] text-[#8A7862] w-12">Frío</span>
                      <input
                        type="number"
                        disabled={m.frio == null}
                        value={m.frio ?? ""}
                        onChange={(e) => updateMenuItem(m.id, "frio", parseFloat(e.target.value) || 0)}
                        className="w-16 bg-[#1A100C] border border-[#3E2C22] rounded-lg px-2 py-1 text-xs text-[#EFE6D8] outline-none focus:border-[#B8935A] disabled:opacity-30"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button onClick={addMenuItem} className="w-full text-[11px] uppercase tracking-wide text-[#B8935A] border border-dashed border-[#3E2C22] rounded-lg py-2 mt-1">
                + Agregar bebida
              </button>
            </div>
          )}

          {tab === "extras" && (
            <div className="space-y-2">
              {localExtras.map((x) => (
                <div key={x.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={x.nombre}
                    onChange={(e) => updateExtra(x.id, "nombre", e.target.value)}
                    className="flex-1 bg-[#241712] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                  />
                  <input
                    type="number"
                    value={x.precio}
                    onChange={(e) => updateExtra(x.id, "precio", parseFloat(e.target.value) || 0)}
                    className="w-20 bg-[#241712] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                  />
                  <button onClick={() => removeExtra(x.id)} className="text-[#A85C3B] text-xs px-1">✕</button>
                </div>
              ))}
              <button onClick={addExtra} className="w-full text-[11px] uppercase tracking-wide text-[#B8935A] border border-dashed border-[#3E2C22] rounded-lg py-2 mt-2">
                + Agregar extra
              </button>
            </div>
          )}

          {tab === "leches" && (
            <div className="space-y-2">
              {localLeches.map((l) => (
                <div key={l.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={l.nombre}
                    onChange={(e) => updateLeche(l.id, "nombre", e.target.value)}
                    className="flex-1 bg-[#241712] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                  />
                  <input
                    type="number"
                    value={l.precio}
                    onChange={(e) => updateLeche(l.id, "precio", parseFloat(e.target.value) || 0)}
                    className="w-20 bg-[#241712] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                  />
                  <button onClick={() => removeLeche(l.id)} className="text-[#A85C3B] text-xs px-1">✕</button>
                </div>
              ))}
              <button onClick={addLeche} className="w-full text-[11px] uppercase tracking-wide text-[#B8935A] border border-dashed border-[#3E2C22] rounded-lg py-2 mt-2">
                + Agregar leche alternativa
              </button>
            </div>
          )}

          {tab === "usuarios" && (
            <div className="space-y-2">
              {localUsuarios.map((u) => (
                <div key={u} className="flex justify-between items-center bg-[#241712] border border-[#3E2C22] rounded-lg px-3 py-2">
                  <span className="text-sm">{u}</span>
                  <button onClick={() => removeUsuario(u)} className="text-[#A85C3B] text-xs px-1">✕</button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Nombre del usuario"
                  value={nuevoUsuario}
                  onChange={(e) => setNuevoUsuario(e.target.value)}
                  className="flex-1 bg-[#241712] border border-[#3E2C22] rounded-lg px-2 py-1.5 text-sm text-[#EFE6D8] outline-none focus:border-[#B8935A]"
                />
                <button onClick={addUsuario} className="text-[11px] uppercase tracking-wide text-[#B8935A] border border-dashed border-[#3E2C22] rounded-lg px-3">
                  + Agregar
                </button>
              </div>
            </div>
          )}

          <button
            onClick={saveAll}
            className="w-full bg-[#B8935A] text-[#241712] font-semibold uppercase tracking-wide text-sm py-2 rounded-lg hover:bg-[#C9A66E] transition-colors mt-4"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}

