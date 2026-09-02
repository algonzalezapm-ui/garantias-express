"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

function DispositionQueueModal({
  kind,
  items,
  onClose,
  onRemove,
  onMove,
  avisar,
}: {
  kind: "destruction" | "return";
  items: RoutedDiagnosis[];
  onClose: () => void;
  onRemove: (folios: string[]) => void;
  onMove: (folios: string[], destination: string) => void;
  avisar: (s: string) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({}),
    [selectedQty, setSelectedQty] = useState<Record<string, number>>({}),
    [chosen, setChosen] = useState<string[]>([]),
    [carrier, setCarrier] = useState<Record<string, string>>({}),
    [guide, setGuide] = useState<Record<string, string>>({}),
    [moveTarget, setMoveTarget] = useState<Record<string, string>>({}),
    [printMode, setPrintMode] = useState<"all" | "selected" | null>(null),
    [authOpen, setAuthOpen] = useState(false),
    [authUser, setAuthUser] = useState(""),
    [authPassword, setAuthPassword] = useState(""),
    [authError, setAuthError] = useState("");
  const groups =
      kind === "destruction"
        ? Object.values(
            items.reduce(
              (a, i) => {
                (a[i.sku] ??= {
                  sku: i.sku,
                  producto: i.producto,
                  rows: [],
                }).rows.push(i);
                return a;
              },
              {} as Record<
                string,
                { sku: string; producto: string; rows: RoutedDiagnosis[] }
              >,
            ),
          )
        : [],
    returnGroups =
      kind === "return"
        ? Object.entries(
            items.reduce(
              (a, i) => {
                (a[i.sucursal] ??= []).push(i);
                return a;
              },
              {} as Record<string, RoutedDiagnosis[]>,
            ),
          )
        : [];
  const selection = groups
      .map((g) => ({
        ...g,
        amount: Math.min(Math.max(selectedQty[g.sku] || 0, 0), g.rows.length),
      }))
      .filter((g) => g.amount > 0),
    destructionTotal = selection.reduce((n, g) => n + g.amount, 0),
    availableGroups = groups
      .map((g) => ({
        ...g,
        available: g.rows.length - (selectedQty[g.sku] || 0),
      }))
      .filter((g) => g.available > 0);
  const selectedRows = selection.flatMap((g) => g.rows.slice(0, g.amount));
  const selectedFor = (branch: string, rows: RoutedDiagnosis[]) =>
    rows.filter((i) => chosen.includes(i.folio)).map((i) => i.folio);
  const toggle = (folio: string, checked: boolean) =>
    setChosen((x) =>
      checked ? [...new Set([...x, folio])] : x.filter((f) => f !== folio),
    );
  const printReport = (mode: "all" | "selected") => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 120);
  };
  const addToSelection = (sku: string, available: number) => {
    const amount = Math.min(Math.max(qty[sku] || 0, 0), available);
    if (!amount) return;
    setSelectedQty((x) => ({ ...x, [sku]: (x[sku] || 0) + amount }));
    setQty((x) => ({ ...x, [sku]: 0 }));
  };
  const destroyAll = async () => {
    if (!destructionTotal) return;
    if (
      !(await askQuestion(
        `¿Confirmas dar de baja ${destructionTotal} pieza(s) de ${selection.length} código(s) por destrucción?`,
      ))
    )
      return;
    setAuthError("");
    setAuthOpen(true);
  };
  const authorizeDestruction = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      authUser.trim().toLowerCase() !== "agonzalez" ||
      authPassword !== "0000"
    ) {
      setAuthError("Usuario no autorizado. Verifica las credenciales.");
      return;
    }
    onRemove(selectedRows.map((i) => i.folio));
    setQty({});
    setSelectedQty({});
    setAuthOpen(false);
    setAuthUser("");
    setAuthPassword("");
    setAuthError("");
    avisar(`${destructionTotal} pieza(s) dadas de baja por destrucción`);
  };
  const moveSelected = async (branch: string, rows: RoutedDiagnosis[]) => {
    const folios = selectedFor(branch, rows),
      target = moveTarget[branch] || "";
    if (!folios.length || !target) return;
    if (
      !(await askQuestion(
        `¿Confirmas mover ${folios.length} solicitud(es) de ${branch} a ${target}?`,
      ))
    )
      return;
    onMove(folios, target);
    setChosen((x) => x.filter((f) => !folios.includes(f)));
    setMoveTarget((x) => ({ ...x, [branch]: "" }));
    avisar(`${folios.length} solicitud(es) de ${branch} movidas a ${target}`);
  };
  const ship = async (branch: string, rows: RoutedDiagnosis[]) => {
    const folios = selectedFor(branch, rows),
      selectedCarrier = carrier[branch] || "",
      selectedGuide = guide[branch] || "",
      needsGuide = selectedCarrier !== "Transporte interno";
    if (!folios.length || !selectedCarrier || (needsGuide && !selectedGuide))
      return;
    const reference = needsGuide
      ? ` con guía ${selectedGuide}`
      : " mediante transporte interno";
    if (
      !(await askQuestion(
        `¿Confirmas generar el retorno de ${folios.length} solicitud(es) de ${branch}${reference}?`,
      ))
    )
      return;
    onRemove(folios);
    setChosen((x) => x.filter((f) => !folios.includes(f)));
    setCarrier((x) => ({ ...x, [branch]: "" }));
    setGuide((x) => ({ ...x, [branch]: "" }));
    setMoveTarget((x) => ({ ...x, [branch]: "" }));
    avisar(
      `Envío de retorno generado para ${branch}: ${folios.length} solicitud(es)`,
    );
  };
  const Report = ({
    mode,
    rows,
  }: {
    mode: "all" | "selected";
    rows: RoutedDiagnosis[];
  }) => (
    <section
      className={`destruction-print-report ${printMode === mode ? "active" : ""}`}
    >
      <header>
        <small>GARANTÍAS CENTRAL</small>
        <h1>
          {mode === "all"
            ? "Reporte general de solicitudes a destrucción"
            : "Reporte de productos seleccionados para destrucción"}
        </h1>
        <p>
          Fecha de emisión: {new Date().toLocaleDateString("es-MX")} · Total:{" "}
          {rows.length} pieza(s)
        </p>
      </header>
      <table>
        <thead>
          <tr>
            <th>Folio</th>
            <th>Código</th>
            <th>Descripción</th>
            <th>Sucursal</th>
            <th>Cantidad</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.folio}>
              <td>{i.folio}</td>
              <td>{i.sku}</td>
              <td>{i.producto}</td>
              <td>{i.sucursal}</td>
              <td>1</td>
            </tr>
          ))}
        </tbody>
      </table>
      <footer>
        Reporte de disposición de garantías · {rows.length} solicitudes
      </footer>
    </section>
  );
  return (
    <div
      className="queue-modal request-card-modal"
      role="dialog"
      aria-modal="true"
    >
      <section>
        <header>
          <div>
            <small>DISPOSICIÓN DE GARANTÍAS</small>
            <h2>
              {kind === "destruction"
                ? "Solicitudes a destrucción"
                : "Retorno a sucursal"}
            </h2>
            <p>
              {kind === "destruction"
                ? "Selecciona cantidades y concentra en una sola baja lo que será destruido."
                : "Selecciona solicitudes y gestiona cada sucursal de forma independiente."}
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <main>
          {kind === "destruction" ? (
            <>
              <div className="destruction-workbench">
                <section className="destruction-catalog panel">
                  <header>
                    <div>
                      <small>LISTADO TOTAL</small>
                      <h3>Solicitudes pendientes</h3>
                      <p>
                        {availableGroups.reduce((n, g) => n + g.available, 0)}{" "}
                        piezas en {availableGroups.length} códigos
                      </p>
                    </div>
                    <button
                      className="destruction-report-action"
                      onClick={() => printReport("all")}
                    >
                      ▧ Imprimir reporte general
                    </button>
                  </header>
                  <div className="destruction-code-list">
                    {availableGroups.map((g) => (
                      <article key={g.sku}>
                        <div>
                          <small>CÓDIGO</small>
                          <h3>{g.sku}</h3>
                          <p>{g.producto}</p>
                          <em>
                            Origen:{" "}
                            {g.rows.some((r) => r.origin === "Calidad")
                              ? "Calidad"
                              : "Diagnóstico"}
                          </em>
                        </div>
                        <strong>{g.available} piezas</strong>
                        <label className="destruction-quantity-field">
                          <span>Cantidad a destruir</span>
                          <input
                            type="number"
                            min="0"
                            max={g.available}
                            placeholder="0"
                            aria-label={`Cantidad a destruir de ${g.sku}`}
                            value={qty[g.sku] || ""}
                            onChange={(e) =>
                              setQty((x) => ({
                                ...x,
                                [g.sku]: Math.min(+e.target.value, g.available),
                              }))
                            }
                          />
                        </label>
                        <button
                          className="add-to-concentrate"
                          disabled={!qty[g.sku]}
                          onClick={() => addToSelection(g.sku, g.available)}
                        >
                          Agregar
                        </button>
                      </article>
                    ))}
                  </div>
                </section>
                <aside className="destruction-selection panel">
                  <header>
                    <div>
                      <small>CONCENTRADO</small>
                      <h3>Por destruir</h3>
                    </div>
                    <div className="destruction-header-actions">
                      <button
                        className="destruction-report-action"
                        disabled={!destructionTotal}
                        onClick={() => printReport("selected")}
                      >
                        ▧ Imprimir reporte
                      </button>
                      <span>{destructionTotal} piezas</span>
                    </div>
                  </header>
                  <div className="destruction-selection-list">
                    {selection.length ? (
                      selection.map((g) => (
                        <article key={g.sku}>
                          <div>
                            <b>{g.sku}</b>
                            <small>{g.producto}</small>
                          </div>
                          <strong>{g.amount}</strong>
                          <span>
                            Existencia restante: {g.rows.length - g.amount}
                          </span>
                          <button
                            className="return-to-list-icon"
                            title="Devolver al listado"
                            aria-label={`Devolver ${g.sku} al listado`}
                            onClick={() =>
                              setSelectedQty((x) => ({ ...x, [g.sku]: 0 }))
                            }
                          >
                            ↩
                          </button>
                        </article>
                      ))
                    ) : (
                      <div className="destruction-empty">
                        <i>□</i>
                        <b>Sin productos seleccionados</b>
                        <p>
                          Captura una cantidad en el listado para concentrarla
                          aquí.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="destruction-total">
                    <span>Total a destruir</span>
                    <b>{destructionTotal} piezas</b>
                  </div>
                  <button
                    className="primario peligro"
                    disabled={!destructionTotal}
                    onClick={destroyAll}
                  >
                    Dar de baja
                  </button>
                </aside>
              </div>
              <Report mode="all" rows={items} />
              <Report mode="selected" rows={selectedRows} />
            </>
          ) : (
            <div className="return-branch-groups">
              {returnGroups.map(([branch, rows]) => {
                const selected = selectedFor(branch, rows),
                  enabled = selected.length > 0;
                return (
                  <section className="return-branch-card panel" key={branch}>
                    <header>
                      <div>
                        <small>SUCURSAL DE DESTINO</small>
                        <h3>{branch}</h3>
                        <p>{rows.length} solicitud(es) pendientes</p>
                      </div>
                      <span>{selected.length} seleccionada(s)</span>
                    </header>
                    <div className="return-requests">
                      {rows.map((i) => (
                        <label
                          className={chosen.includes(i.folio) ? "selected" : ""}
                          key={i.folio}
                        >
                          <input
                            type="checkbox"
                            checked={chosen.includes(i.folio)}
                            onChange={(e) => toggle(i.folio, e.target.checked)}
                          />
                          <span>
                            <b>{i.folio}</b>
                            <small>
                              {i.sku} · {i.producto}
                            </small>
                          </span>
                          <em>{i.sucursal}</em>
                        </label>
                      ))}
                    </div>
                    <div className="return-branch-actions">
                      <div className="return-disposition panel">
                        <div>
                          <small>CAMBIAR DISPOSICIÓN</small>
                          <b>Mover solicitudes seleccionadas</b>
                          <p>Conserva el folio y actualiza el destino.</p>
                        </div>
                        <label>
                          Nuevo destino
                          <select
                            disabled={!enabled}
                            value={moveTarget[branch] || ""}
                            onChange={(e) =>
                              setMoveTarget((x) => ({
                                ...x,
                                [branch]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Seleccionar destino</option>
                            <option>A destrucción</option>
                            <option>A reparación</option>
                            <option>Almacén Proveedor</option>
                          </select>
                        </label>
                        <button
                          disabled={!enabled || !moveTarget[branch]}
                          onClick={() => moveSelected(branch, rows)}
                        >
                          Confirmar movimiento
                        </button>
                      </div>
                      <div className="return-logistics panel">
                        <label>
                          Paquetería
                          <select
                            disabled={!enabled}
                            value={carrier[branch] || ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              setCarrier((x) => ({ ...x, [branch]: value }));
                              if (value === "Transporte interno")
                                setGuide((x) => ({ ...x, [branch]: "" }));
                            }}
                          >
                            <option value="">Seleccionar paquetería</option>
                            <option>Paquetexpress</option>
                            <option>Estafeta</option>
                            <option>DHL</option>
                            <option>Transporte interno</option>
                          </select>
                        </label>
                        <label>
                          Guía{" "}
                          {carrier[branch] === "Transporte interno" && (
                            <small>No requerida</small>
                          )}
                          <input
                            disabled={
                              !enabled ||
                              carrier[branch] === "Transporte interno"
                            }
                            value={guide[branch] || ""}
                            onChange={(e) =>
                              setGuide((x) => ({
                                ...x,
                                [branch]: e.target.value,
                              }))
                            }
                            placeholder={
                              carrier[branch] === "Transporte interno"
                                ? "No aplica para transporte interno"
                                : "Número de guía"
                            }
                          />
                        </label>
                        <button
                          className="primario"
                          disabled={
                            !enabled ||
                            !carrier[branch] ||
                            (carrier[branch] !== "Transporte interno" &&
                              !guide[branch])
                          }
                          onClick={() => ship(branch, rows)}
                        >
                          Generar envío
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
        <footer>
          <span>
            {items.length} solicitudes pendientes ·{" "}
            {returnGroups.length || groups.length} grupo(s)
          </span>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </section>
      {authOpen && (
        <div className="destruction-auth-modal">
          <form onSubmit={authorizeDestruction}>
            <header>
              <div>
                <small>AUTORIZACIÓN REQUERIDA</small>
                <h2>Confirmar baja por destrucción</h2>
                <p>
                  Ingresa las credenciales del usuario autorizado para aplicar
                  la baja.
                </p>
              </div>
              <button type="button" onClick={() => setAuthOpen(false)}>
                ×
              </button>
            </header>
            <main>
              <label>
                Usuario
                <input
                  autoFocus
                  value={authUser}
                  onChange={(e) => setAuthUser(e.target.value)}
                  placeholder="Usuario autorizado"
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Contraseña"
                />
              </label>
              {authError && <div className="auth-error">! {authError}</div>}
              <div className="auth-destruction-summary">
                <span>Piezas a destruir</span>
                <b>{destructionTotal}</b>
              </div>
            </main>
            <footer>
              <button type="button" onClick={() => setAuthOpen(false)}>
                Cancelar
              </button>
              <button className="peligro" type="submit">
                Autorizar y dar de baja
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
type Status =
  | "Nueva"
  | "Inspección completada"
  | "Diagnóstico completado"
  | "Por recibir"
  | "Producto en custodia";
type Aplicacion = "Anticipo" | "Aplicado a factura" | "Devolución de efectivo";
type Caso = {
  id: string;
  sucursal: string;
  cliente: string;
  producto: string;
  sku: string;
  canal: "Retail" | "No Retail";
  estado: Status;
  tiempo: string;
  recibido: boolean;
  bateria?: boolean;
  resultado?: "Procede" | "No procede";
  observacion?: string;
  notaCredito?: string;
  tipoAplicacion?: Aplicacion;
  importeBonificacion?: string;
  factura?: string;
  fechaSolicitud?: string;
  origenBot?: boolean;
  custodia?: string;
  caja?: string;
  origenMostrador?: boolean;
  entregadoAlmacen?: boolean;
  usuario?: string;
};
const data: Caso[] = [
  {
    id: "GE-260824-1842",
    sucursal: "GDL Centro",
    cliente: "Refaccionaria El Volante",
    producto: "Alternador Bosch 12V",
    sku: "BO-AL394",
    canal: "No Retail",
    estado: "Diagnóstico completado",
    tiempo: "18 min",
    recibido: true,
    resultado: "Procede",
    notaCredito: "NC-1842",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$3,480.00",
    factura: "FA-804211",
    fechaSolicitud: "24 ago 2026 · 10:21",
    custodia: "Con Paquetería",
    caja: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1841",
    sucursal: "Zapopan Norte",
    cliente: "María González",
    producto: "Batería LTH H-47",
    sku: "LTH-H47",
    canal: "Retail",
    estado: "Inspección completada",
    tiempo: "3 min",
    recibido: true,
    bateria: true,
    resultado: "Procede",
    notaCredito: "NC-1841",
    tipoAplicacion: "Devolución de efectivo",
    importeBonificacion: "$1,722.50",
    factura: "FA-803944",
    fechaSolicitud: "24 ago 2026 · 09:48",
    custodia: "Con Paquetería",
    caja: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1839",
    sucursal: "León Torres",
    cliente: "Taller Automotriz Ríos",
    producto: "Bomba de agua GMB",
    sku: "GMB-1256",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "41 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1839",
    tipoAplicacion: "Anticipo",
    importeBonificacion: "$1,890.00",
    factura: "FA-801173",
    fechaSolicitud: "23 ago 2026 · 16:32",
    custodia: "Con el cliente",
  },
  {
    id: "GE-260824-1856",
    sucursal: "Querétaro Centro",
    cliente: "Autopartes del Bajío",
    producto: "Amortiguador Monroe",
    sku: "MO-7281",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "27 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1856",
    tipoAplicacion: "Anticipo",
    importeBonificacion: "$1,780.00",
    factura: "FA-805126",
    fechaSolicitud: "24 ago 2026 · 11:08",
    custodia: "En sucursal",
  },
  {
    id: "GE-260824-1854",
    sucursal: "León Torres",
    cliente: "Servicio Automotriz del Centro",
    producto: "Bomba de agua GMB",
    sku: "GMB-1256",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "34 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1854",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$1,890.00",
    factura: "FA-805081",
    fechaSolicitud: "24 ago 2026 · 10:52",
    custodia: "Con el asesor",
  },
  {
    id: "GE-260824-1851",
    sucursal: "Zapopan Norte",
    cliente: "Refaccionaria La Estación",
    producto: "Sensor de oxígeno Denso",
    sku: "DE-2341",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "52 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1851",
    tipoAplicacion: "Anticipo",
    importeBonificacion: "$1,460.00",
    factura: "FA-804990",
    fechaSolicitud: "24 ago 2026 · 10:03",
    custodia: "En sucursal",
  },
  {
    id: "GE-260824-1849",
    sucursal: "Aguascalientes Sur",
    cliente: "Taller Mecánico San Marcos",
    producto: "Bujía NGK Iridium",
    sku: "NGK-7090",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "1 h 6 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1849",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$420.00",
    factura: "FA-804901",
    fechaSolicitud: "24 ago 2026 · 09:36",
    custodia: "Con el asesor",
  },
  {
    id: "GE-260824-1837",
    sucursal: "Aguascalientes Sur",
    cliente: "José Ramírez",
    producto: "Sensor de oxígeno Denso",
    sku: "DE-2341",
    canal: "Retail",
    estado: "Diagnóstico completado",
    tiempo: "1 h 12 min",
    recibido: true,
    resultado: "No procede",
    fechaSolicitud: "23 ago 2026 · 11:14",
    custodia: "Sin custodia",
  },
  {
    id: "GE-260824-1828",
    sucursal: "GDL Centro",
    cliente: "Grupo Motor Plus",
    producto: "Juego de balatas Fritec",
    sku: "FR-D1287",
    canal: "No Retail",
    estado: "Producto en custodia",
    tiempo: "2 h 4 min",
    recibido: true,
    resultado: "Procede",
    notaCredito: "NC-1828",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$2,140.00",
    factura: "FA-800928",
    fechaSolicitud: "22 ago 2026 · 15:07",
    custodia: "Con Paquetería",
    caja: "GX-GDL-014",
  },
  {
    id: "GE-260824-1838",
    sucursal: "Zapopan Norte",
    cliente: "Servicio Automotriz Luna",
    producto: "Sensor de oxígeno Denso",
    sku: "DE-2341",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "1 h 35 min",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1838",
    tipoAplicacion: "Anticipo",
    importeBonificacion: "$1,460.00",
    factura: "FA-801004",
    fechaSolicitud: "23 ago 2026 · 15:40",
    custodia: "Con Paquetería",
    caja: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1835",
    sucursal: "Zapopan Norte",
    cliente: "Refacciones del Valle",
    producto: "Juego de balatas Fritec",
    sku: "FR-D1287",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "2 h",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1835",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$2,140.00",
    factura: "FA-800811",
    fechaSolicitud: "23 ago 2026 · 14:12",
    custodia: "Con Paquetería",
    caja: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1824",
    sucursal: "GDL Centro",
    cliente: "Taller Mecánico Rivera",
    producto: "Bomba de agua GMB",
    sku: "GMB-1256",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "3 h",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1824",
    tipoAplicacion: "Anticipo",
    importeBonificacion: "$1,890.00",
    factura: "FA-799982",
    fechaSolicitud: "22 ago 2026 · 13:48",
    custodia: "Con Paquetería",
    caja: "GX-GDL-014",
  },
  {
    id: "GE-260823-1798",
    sucursal: "León Torres",
    cliente: "Autopartes del Bajío",
    producto: "Sensor de oxígeno Denso",
    sku: "DE-2341",
    canal: "No Retail",
    estado: "Por recibir",
    tiempo: "1 día",
    recibido: false,
    resultado: "Procede",
    notaCredito: "NC-1798",
    tipoAplicacion: "Aplicado a factura",
    importeBonificacion: "$1,460.00",
    factura: "FA-798314",
    fechaSolicitud: "23 ago 2026 · 09:22",
    custodia: "Con Paquetería",
    caja: "GX-LEO-003",
  },
];
const etapas: Status[] = [
  "Nueva",
  "Inspección completada",
  "Diagnóstico completado",
  "Por recibir",
  "Producto en custodia",
];
function requestDate(value?: string) {
  if (!value) return "";
  const months: Record<string, string> = {
      ene: "01",
      feb: "02",
      mar: "03",
      abr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      ago: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dic: "12",
    },
    parts = value.split(" · ")[0].split(" ");
  return parts.length === 3
    ? `${parts[2]}-${months[parts[1]] || "01"}-${parts[0].padStart(2, "0")}`
    : "";
}
type QuestionDetail = {
  message: string;
  resolve: (accepted: boolean) => void;
  onAccept?: () => void;
};
const askQuestion = (message: string, onAccept?: () => void) =>
  new Promise<boolean>((resolve) =>
    window.dispatchEvent(
      new CustomEvent<QuestionDetail>("gx-question", {
        detail: { message, resolve, onAccept },
      }),
    ),
  );
function QuestionModalHost() {
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  useEffect(() => {
    const listener = (event: Event) =>
      setQuestion((event as CustomEvent<QuestionDetail>).detail);
    window.addEventListener("gx-question", listener);
    return () => window.removeEventListener("gx-question", listener);
  }, []);
  if (!question) return null;
  const answer = (accepted: boolean) => {
    if (accepted) question.onAccept?.();
    question.resolve(accepted);
    setQuestion(null);
  };
  return (
    <div
      className="app-question"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-question-title"
    >
      <section>
        <i>?</i>
        <small>CONFIRMACIÓN REQUERIDA</small>
        <h2 id="app-question-title">¿Deseas continuar?</h2>
        <p>{question.message}</p>
        <footer>
          <button onClick={() => answer(false)}>Cancelar</button>
          <button className="primario" onClick={() => answer(true)}>
            Sí, confirmar
          </button>
        </footer>
      </section>
    </div>
  );
}
const openBatteryGuide = () =>
  window.dispatchEvent(new Event("gx-battery-guide"));
const showInfo = (message: string) =>
  window.dispatchEvent(new CustomEvent<string>("gx-info", { detail: message }));
function InfoModalHost() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const show = (event: Event) =>
      setMessage((event as CustomEvent<string>).detail);
    window.addEventListener("gx-info", show);
    return () => window.removeEventListener("gx-info", show);
  }, []);
  if (!message) return null;
  return (
    <div className="app-info-modal" role="dialog" aria-modal="true">
      <section>
        <i>i</i>
        <small>INFORMACIÓN</small>
        <h2>
          {message.startsWith("Usuario no autorizado")
            ? "Acceso no autorizado"
            : message.includes("existencia")
              ? "Sin existencias"
              : "Información"}
        </h2>
        <p>{message}</p>
        <footer>
          <button className="primario" onClick={() => setMessage("")}>
            Aceptar
          </button>
        </footer>
      </section>
    </div>
  );
}
function BatteryGuideHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("gx-battery-guide", show);
    return () => window.removeEventListener("gx-battery-guide", show);
  }, []);
  if (!open) return null;
  return (
    <div
      className="battery-guide"
      role="dialog"
      aria-modal="true"
      aria-labelledby="battery-guide-title"
    >
      <section>
        <header>
          <div>
            <small>MANUAL DE PRUEBAS · BATERÍA</small>
            <h2 id="battery-guide-title">Guía de diagnóstico técnico</h2>
            <p>Secuencia demostrativa para una batería automotriz de 12 V.</p>
          </div>
          <button onClick={() => setOpen(false)}>×</button>
        </header>
        <main>
          <article className="guide-warning">
            <i>!</i>
            <div>
              <b>Seguridad primero</b>
              <p>
                Usa guantes, lentes y herramienta aislada. No realices pruebas
                si existe fuga, deformación o daño severo.
              </p>
            </div>
          </article>
          <ol>
            <li>
              <i>1</i>
              <div>
                <b>Inspección visual</b>
                <p>
                  Valida carcasa, terminales, sulfatación, golpes, fugas,
                  etiqueta y fecha de fabricación. Registra evidencia
                  fotográfica.
                </p>
              </div>
            </li>
            <li>
              <i>2</i>
              <div>
                <b>Voltaje en reposo</b>
                <p>
                  Espera 10 minutos sin carga. 12.60 V o más indica carga
                  completa; menos de 12.20 V requiere carga controlada antes de
                  dictaminar.
                </p>
              </div>
            </li>
            <li>
              <i>3</i>
              <div>
                <b>Conductancia y CCA</b>
                <p>
                  Configura el estándar y CCA indicados en la etiqueta. Registra
                  CCA medido, resistencia interna y resultado del equipo.
                </p>
              </div>
            </li>
            <li>
              <i>4</i>
              <div>
                <b>Prueba bajo carga</b>
                <p>
                  Aplica la carga autorizada durante 15 segundos. Como
                  referencia, el voltaje no debe caer por debajo de 9.6 V a 21
                  °C.
                </p>
              </div>
            </li>
            <li>
              <i>5</i>
              <div>
                <b>Dictamen y evidencia</b>
                <p>
                  Documenta lecturas, número de serie del probador, fotografías,
                  técnico, fecha y observaciones antes de confirmar el destino.
                </p>
              </div>
            </li>
          </ol>
          <div className="guide-criteria">
            <span>
              <b>Procede</b>
              <small>Falla interna sin daño atribuible al usuario.</small>
            </span>
            <span>
              <b>No procede</b>
              <small>
                Golpe, manipulación, sobrecarga, fuga o instalación incorrecta.
              </small>
            </span>
          </div>
        </main>
        <footer>
          <a
            href="/manual-pruebas-bateria.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Abrir versión PDF
          </a>
          <button className="primario" onClick={() => setOpen(false)}>
            Entendido
          </button>
        </footer>
      </section>
    </div>
  );
}
function PredictiveFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  const shown = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase()),
  );
  const openList = () => {
    setQuery("");
    setOpen(true);
  };
  return (
    <label
      className="predictive-filter"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <span>{label}</span>
      <div>
        <input
          role="combobox"
          aria-expanded={open}
          aria-label={`Buscar en ${label}`}
          value={open ? query : value}
          onFocus={openList}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Escribe para buscar…"
        />
        <button
          type="button"
          aria-label={`Mostrar opciones de ${label}`}
          onClick={openList}
        >
          ⌄
        </button>
        {open && (
          <section role="listbox">
            <small>Escribe para filtrar o selecciona una opción</small>
            {shown.length ? (
              shown.map((o) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={o === value}
                  className={o === value ? "selected" : ""}
                  key={o}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  {o}
                  <i>{o === value ? "✓" : ""}</i>
                </button>
              ))
            ) : (
              <p>Sin coincidencias</p>
            )}
          </section>
        )}
      </div>
    </label>
  );
}
function EnhancedReceptionArrival({
  avisar,
  receivedBoxes,
  onReceived,
  onIncident,
  onReturn,
}: {
  avisar: (s: string) => void;
  receivedBoxes: string[];
  onReceived: (numero: string) => void;
  onIncident: (folios: string[]) => void;
  onReturn: (item: {
    folio: string;
    sku: string;
    producto: string;
    sucursal: string;
    caja: string;
    note: string;
  }) => void;
}) {
  const [boxInput, setBoxInput] = useState(""),
    [box, setBox] = useState(""),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [moved, setMoved] = useState<string[]>([]),
    [labelsReady, setLabelsReady] = useState(false),
    [difference, setDifference] = useState(false),
    [reported, setReported] = useState<string[]>([]),
    [incidentNotes, setIncidentNotes] = useState<Record<string, string>>({}),
    [incidentCenter, setIncidentCenter] = useState(false),
    [incidentSearch, setIncidentSearch] = useState(""),
    [scanning, setScanning] = useState(false),
    [printedIncidentLabels, setPrintedIncidentLabels] = useState<string[]>([]),
    [labelToPrint, setLabelToPrint] = useState<string | null>(null);
  const selected = cajasCentral.find((c) => c.numero === box),
    visible = (selected?.items || []).filter(
      (i) => !moved.includes(i.folio) && !reported.includes(i.folio),
    ),
    selectedCount = visible.filter((i) => checks[i.folio]).length,
    pending = visible.filter((i) => !checks[i.folio]),
    received = Boolean(selected && receivedBoxes.includes(selected.numero)),
    incidentRows = cajasCentral
      .flatMap((c) =>
        c.items.map((i) => ({ ...i, caja: c.numero, sucursal: c.sucursal })),
      )
      .filter((i) => reported.includes(i.folio) && !moved.includes(i.folio))
      .filter(
        (i) =>
          !incidentSearch.trim() ||
          [i.producto, i.sku, i.folio, i.sucursal, i.caja].some((v) =>
            v.toLowerCase().includes(incidentSearch.toLowerCase()),
          ),
      );
  const loadBox = (value = boxInput) => {
    const normalized = value.trim().toUpperCase(),
      found = cajasCentral.find((c) => c.numero === normalized);
    if (!found) {
      avisar("No se encontró una caja con el número ingresado");
      return;
    }
    setBox(found.numero);
    setBoxInput(found.numero);
    setChecks({});
    setLabelsReady(false);
  };
  const scanBox = () => {
    setScanning(true);
    setTimeout(() => {
      const found =
        cajasCentral.find((c) => !receivedBoxes.includes(c.numero)) ||
        cajasCentral[0];
      setScanning(false);
      setBoxInput(found.numero);
      loadBox(found.numero);
      avisar(`Etiqueta ${found.numero} escaneada correctamente`);
    }, 700);
  };
  const labels = () => {
    setLabelsReady(true);
    avisar(
      selected
        ? `Etiquetas generadas para ${selected.numero}; recepción habilitada`
        : "Selecciona o escanea una caja",
    );
  };
  const confirm = async () => {
    if (!selected) return;
    const ids = visible.filter((i) => checks[i.folio]).map((i) => i.folio),
      complete = ids.length === visible.length;
    if (
      !(await askQuestion(
        `¿Confirmas la recepción de ${ids.length} producto(s) de la caja ${selected.numero}? ${complete ? "La caja quedará completamente recibida." : "Los productos restantes permanecerán pendientes."}`,
      ))
    )
      return;
    setMoved((x) => [...new Set([...x, ...ids])]);
    setChecks({});
    setLabelsReady(false);
    setBoxInput("");
    if (complete) {
      onReceived(selected.numero);
      setBox("");
    }
    avisar(
      complete
        ? `${selected.numero} recibida completamente y retirada de pendientes`
        : `${ids.length} producto(s) confirmados; ${visible.length - ids.length} continúan pendientes`,
    );
  };
  const openDifference = () => {
    if (!labelsReady) {
      showInfo("Genera las etiquetas antes de reportar diferencias");
      return;
    }
    if (pending.some((i) => reported.includes(i.folio))) {
      showInfo("Ya existe una incidencia reportada para ese producto");
      return;
    }
    setDifference(true);
  };
  const printIncidentLabel = (folio: string) => {
    setLabelToPrint(folio);
    setPrintedIncidentLabels((x) => (x.includes(folio) ? x : [...x, folio]));
    avisar(`Etiqueta de ${folio} generada; recepción habilitada`);
    setTimeout(() => {
      window.print();
      setLabelToPrint(null);
    }, 150);
  };
  const resolveIncident = async (folio: string) => {
    if (!printedIncidentLabels.includes(folio)) {
      showInfo("Genera e imprime la etiqueta antes de confirmar la recepción");
      return;
    }
    if (!(await askQuestion(`¿Confirmas la recepción del producto ${folio}?`)))
      return;
    setMoved((x) => [...new Set([...x, folio])]);
    setReported((x) => x.filter((id) => id !== folio));
    avisar(
      `Incidencia resuelta · Producto confirmado · ${new Date().toLocaleString("es-MX")} · Andrea Martínez`,
    );
  };
  const returnIncident = async (folio: string) => {
    const note = incidentNotes[folio] || "Diferencia reportada",
      item = incidentRows.find((i) => i.folio === folio);
    if (!item) return;
    if (
      !(await askQuestion(
        `¿Confirmas retornar ${folio} a la sucursal con la observación: “${note}”?`,
      ))
    )
      return;
    onReturn({
      folio: item.folio,
      sku: item.sku,
      producto: item.producto,
      sucursal: item.sucursal,
      caja: item.caja,
      note,
    });
    setMoved((x) => [...new Set([...x, folio])]);
    setReported((x) => x.filter((id) => id !== folio));
    avisar(`Producto agregado a Retorno · Observación: ${note}`);
  };
  return (
    <section className="arrival-workspace enhanced-reception">
      <div className="panel box-identification">
        <div>
          <small>IDENTIFICAR CAJA</small>
          <h2>Escanea o captura la etiqueta</h2>
          <p>El número puede leerse con el escáner o escribirse manualmente.</p>
        </div>
        <label>
          Número de caja
          <div>
            <input
              list="reception-boxes"
              value={boxInput}
              onChange={(e) => setBoxInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  loadBox();
                }
              }}
              placeholder="Ej. GX-ZPN-008"
            />
            <datalist id="reception-boxes">
              {cajasCentral.map((c) => (
                <option key={c.numero} value={c.numero}>
                  {c.sucursal}
                </option>
              ))}
            </datalist>
            <button onClick={() => loadBox()}>Cargar caja</button>
          </div>
        </label>
        <button
          className="scan-box-button"
          onClick={scanBox}
          disabled={scanning}
        >
          <i>▥</i>
          <span>
            <b>{scanning ? "Escaneando…" : "Escanear etiqueta"}</b>
            <small>Simular lectura del código</small>
          </span>
        </button>
        <button
          className="incident-center-card"
          onClick={() => setIncidentCenter(true)}
        >
          <i>!</i>
          <span>
            <small>PRODUCTOS CON INCIDENCIA</small>
            <b>
              {reported.filter((f) => !moved.includes(f)).length} pendientes
            </b>
            <em>Consultar concentrado</em>
          </span>
        </button>
      </div>
      {!selected ? (
        <div className="panel arrival-empty">
          <i>▣</i>
          <h2>Caja sin identificar</h2>
          <p>
            Escanea una etiqueta o ingresa el número para consultar su
            contenido.
          </p>
        </div>
      ) : (
        <>
          <div className="arrival-summary">
            <article>
              <small>CAJA</small>
              <b>{selected.numero}</b>
              <span>{selected.sucursal}</span>
            </article>
            <article className={received ? "complete" : ""}>
              <small>ESTADO DE LA CAJA</small>
              <b>{received ? "Recibida" : "En tránsito"}</b>
              <span>
                {received ? "Recepción registrada" : "Pendiente de recibir"}
              </span>
            </article>
            <article>
              <small>PRODUCTOS CONFIRMADOS</small>
              <b>
                {selectedCount} / {visible.length}
              </b>
              <span>Conteo físico actual</span>
            </article>
            <article>
              <small>DIFERENCIAS</small>
              <b>{reported.length}</b>
              <span>
                {reported.length ? "Con aclaración" : "Sin diferencias"}
              </span>
            </article>
          </div>
          <div className="arrival-grid">
            <div className="panel">
              <div className="trace-head">
                <div>
                  <h2>Contenido de la caja</h2>
                  <p>Marca únicamente los productos encontrados físicamente.</p>
                </div>
                <span>{visible.length} pendientes</span>
              </div>
              <div className="arrival-items simple">
                {visible.length ? (
                  visible.map((i, n) => (
                    <article
                      className={checks[i.folio] ? "checked" : ""}
                      key={i.folio}
                    >
                      <span>{n + 1}</span>
                      <div>
                        <small>{i.folio}</small>
                        <strong>{i.producto}</strong>
                        <p>
                          {i.sku} · 1 pieza{" "}
                          {reported.includes(i.folio)
                            ? "· Diferencia reportada"
                            : ""}
                        </p>
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(checks[i.folio])}
                          onChange={(e) =>
                            setChecks((x) => ({
                              ...x,
                              [i.folio]: e.target.checked,
                            }))
                          }
                        />
                        <i>{checks[i.folio] ? "✓" : ""}</i>
                        <b>
                          {checks[i.folio]
                            ? "Confirmado"
                            : "Confirmar producto"}
                        </b>
                      </label>
                    </article>
                  ))
                ) : (
                  <div className="trace-empty">
                    <i>✓</i>
                    <strong>Sin productos pendientes</strong>
                    <p>
                      Los productos confirmados fueron retirados del contenido
                      pendiente.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <aside className="panel arrival-actions">
              <Cab t="Acciones" s="Recepción de la caja identificada" />
              <button onClick={labels}>▤ Generar etiquetas</button>
              <button
                disabled={!labelsReady || !pending.length}
                onClick={openDifference}
              >
                ! Reportar diferencia ({pending.length})
              </button>
              <button
                className="primario"
                disabled={!labelsReady || !selectedCount}
                onClick={confirm}
              >
                Confirmar recepción ({selectedCount})
              </button>
              <p>
                {received
                  ? "La caja ya tiene estado Recibida. Puedes continuar conciliando productos pendientes."
                  : labelsReady
                    ? "Selecciona al menos un producto para confirmar."
                    : "Genera las etiquetas para habilitar la confirmación."}
              </p>
            </aside>
          </div>
          {difference && (
            <div className="incident-sheet">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const note = String(
                    new FormData(e.currentTarget).get("incidentObservation") ||
                      "",
                  );
                  setReported((x) => [
                    ...new Set([...x, ...pending.map((i) => i.folio)]),
                  ]);
                  setIncidentNotes((x) => ({
                    ...x,
                    ...Object.fromEntries(pending.map((i) => [i.folio, note])),
                  }));
                  onIncident(pending.map((i) => i.folio));
                  setDifference(false);
                  const remainingConfirmed = visible.filter(
                    (i) => checks[i.folio] && !pending.some((p) => p.folio === i.folio),
                  );
                  if (!remainingConfirmed.length) {
                    if (selected) onReceived(selected.numero);
                    setBox("");
                    setBoxInput("");
                    setChecks({});
                    setLabelsReady(false);
                    avisar(
                      "Incidencia creada; la caja quedó sin contenido pendiente y puedes escanear otra",
                    );
                  } else {
                    avisar(
                      `${pending.length} producto(s) movidos a Incidencias; confirma la recepción de los ${remainingConfirmed.length} producto(s) encontrados`,
                    );
                  }
                }}
              >
                <button type="button" onClick={() => setDifference(false)}>
                  ×
                </button>
                <small>PRODUCTOS NO CONFIRMADOS</small>
                <h2>Reportar diferencia</h2>
                <div className="missing-products">
                  {pending.map((i) => (
                    <div key={i.folio}>
                      <i>!</i>
                      <span>
                        <b>{i.producto}</b>
                        <small>
                          {i.folio} · {i.sku}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
                <label>
                  Observaciones
                  <textarea name="incidentObservation" required rows={4} />
                </label>
                <footer>
                  <button type="button" onClick={() => setDifference(false)}>
                    Cancelar
                  </button>
                  <button className="primario">Crear incidencia</button>
                </footer>
              </form>
            </div>
          )}
        </>
      )}
      {incidentCenter && (
        <div className="incident-reception-center">
          <section>
            <header>
              <div>
                <small>RECEPCIÓN CENTRAL</small>
                <h2>Productos con incidencia</h2>
                <p>
                  Confirma su recepción o gestiona el retorno a la sucursal.
                </p>
              </div>
              <button onClick={() => setIncidentCenter(false)}>×</button>
            </header>
            <div className="incident-center-search">
              ⌕
              <input
                value={incidentSearch}
                onChange={(e) => setIncidentSearch(e.target.value)}
                placeholder="Buscar producto, código, solicitud, sucursal o caja"
              />
            </div>
            <main>
              {incidentRows.length ? (
                incidentRows.map((i) => (
                  <article key={i.folio}>
                    <span>
                      <small>
                        {i.folio} · {i.caja}
                      </small>
                      <b>{i.producto}</b>
                      <p>
                        {i.sku} · {i.sucursal}
                      </p>
                      <em>
                        Observación:{" "}
                        {incidentNotes[i.folio] || "Diferencia reportada"}
                      </em>
                    </span>
                    <div className="incident-row-actions">
                      <button
                        className={
                          printedIncidentLabels.includes(i.folio)
                            ? "label-ready"
                            : ""
                        }
                        onClick={() => printIncidentLabel(i.folio)}
                      >
                        {printedIncidentLabels.includes(i.folio)
                          ? "✓ Etiqueta generada"
                          : "▤ Generar etiqueta"}
                      </button>
                      <button onClick={() => returnIncident(i.folio)}>
                        ↩ Retorno a sucursal
                      </button>
                      <button
                        className="primario"
                        disabled={!printedIncidentLabels.includes(i.folio)}
                        title={
                          printedIncidentLabels.includes(i.folio)
                            ? ""
                            : "Genera e imprime la etiqueta para habilitar la recepción"
                        }
                        onClick={() => resolveIncident(i.folio)}
                      >
                        ✓ Confirmar recepción
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <div className="trace-empty">
                  <i>✓</i>
                  <strong>Sin productos con incidencia</strong>
                  <p>No existen coincidencias pendientes de atención.</p>
                </div>
              )}
            </main>
            <footer>
              <span>{incidentRows.length} productos encontrados</span>
              <button onClick={() => setIncidentCenter(false)}>Cerrar</button>
            </footer>
            {labelToPrint && (() => {
              const item = incidentRows.find((row) => row.folio === labelToPrint);
              return item ? (
                <article className="incident-label-print">
                  <small>GARANTÍAS CENTRAL · RECEPCIÓN</small>
                  <h1>{item.folio}</h1>
                  <b>{item.sku}</b>
                  <p>{item.producto}</p>
                  <span>Caja {item.caja} · {item.sucursal}</span>
                  <div>▥ {item.folio}</div>
                </article>
              ) : null;
            })()}
          </section>
        </div>
      )}
      <div className="pending-box-count">
        <i>▣</i>
        <span>
          <b>
            {
              cajasCentral.filter((c) => !receivedBoxes.includes(c.numero))
                .length
            }{" "}
            cajas pendientes de recibir
          </b>
          <small>Escanea o captura una caja para continuar</small>
        </span>
      </div>
    </section>
  );
}
type PendingDiagnosis = {
  folio: string;
  sku: string;
  producto: string;
  sucursal: string;
  caja: string;
};
function DiagnosisModalFlow({
  items,
  onClose,
  onComplete,
  avisar,
}: {
  items: PendingDiagnosis[];
  onClose: () => void;
  onComplete: (item: PendingDiagnosis, destination: string) => void;
  avisar: (s: string) => void;
}) {
  const [code, setCode] = useState(""),
    [selected, setSelected] = useState<PendingDiagnosis | null>(null),
    [destination, setDestination] = useState(""),
    [observation, setObservation] = useState(""),
    [scanning, setScanning] = useState(false);
  const load = (value = code) => {
    const normalized = value.trim().toUpperCase(),
      found = items.find((i) => i.folio === normalized || i.sku === normalized);
    if (!found) {
      avisar("No se encontró una solicitud pendiente con el código ingresado");
      return;
    }
    setSelected(found);
    setCode(found.folio);
    setDestination("");
    setObservation("");
  };
  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      const found = items.find((i) => i.folio !== selected?.folio) || items[0];
      setScanning(false);
      if (!found) {
        avisar("No hay solicitudes pendientes de diagnóstico");
        return;
      }
      setCode(found.folio);
      setSelected(found);
      setDestination("");
      setObservation("");
      avisar(`Etiqueta ${found.folio} escaneada correctamente`);
    }, 700);
  };
  const confirm = async () => {
    if (!selected || !destination) return;
    if (
      !(await askQuestion(
        `¿Confirmas el diagnóstico de ${selected.folio} y su disposición como “${destination}”?`,
      ))
    )
      return;
    onComplete(selected, destination);
    setSelected(null);
    setCode("");
    setDestination("");
    setObservation("");
    avisar(`${selected.folio}: diagnóstico confirmado — ${destination}`);
  };
  return (
    <div
      className="diagnosis-modal request-card-modal"
      role="dialog"
      aria-modal="true"
    >
      <section>
        <header>
          <div>
            <small>GARANTÍAS CENTRAL</small>
            <h2>Diagnóstico de garantías</h2>
            <p>
              Escanea la solicitud recibida, valida el producto y determina su
              disposición.
            </p>
          </div>
          <button className="outbound-close" onClick={onClose}>
            ×
          </button>
        </header>
        <main>
          <div className="diagnosis-scan panel">
            <div>
              <small>IDENTIFICAR SOLICITUD</small>
              <h3>Etiqueta o código de barras</h3>
              <p>
                Puedes utilizar el escáner o ingresar manualmente el folio o
                SKU.
              </p>
            </div>
            <label>
              Folio o código
              <div>
                <input
                  list="diagnosis-codes"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      load();
                    }
                  }}
                  placeholder="Ej. GE-260824-1842"
                />
                <datalist id="diagnosis-codes">
                  {items.map((i) => (
                    <option key={i.folio} value={i.folio}>
                      {i.sku} · {i.producto}
                    </option>
                  ))}
                </datalist>
                <button onClick={() => load()}>Cargar</button>
              </div>
            </label>
            <button
              className="scan-box-button"
              onClick={scan}
              disabled={scanning}
            >
              <i>▥</i>
              <span>
                <b>{scanning ? "Escaneando…" : "Escanear etiqueta"}</b>
                <small>Simular lectura del código</small>
              </span>
            </button>
          </div>
          {selected ? (
            <div className="diagnosis-work">
              <article className="panel diagnosis-product">
                <small>SOLICITUD RECIBIDA</small>
                <h3>{selected.producto}</h3>
                <p>
                  {selected.folio} · {selected.sku}
                </p>
                <dl>
                  <div>
                    <dt>Sucursal</dt>
                    <dd>{selected.sucursal}</dd>
                  </div>
                  <div>
                    <dt>Caja recibida</dt>
                    <dd>{selected.caja}</dd>
                  </div>
                  <div>
                    <dt>Custodia</dt>
                    <dd>Garantías Central</dd>
                  </div>
                </dl>
                <button
                  className="test-manual"
                  onClick={() =>
                    selected.producto.toLowerCase().includes("batería") ||
                    selected.sku.startsWith("LTH")
                      ? openBatteryGuide()
                      : showInfo("El producto no cuenta con manual de pruebas.")
                  }
                >
                  ▤ Manual de pruebas
                </button>
              </article>
              <section className="panel diagnosis-capture">
                <h3>Resultado técnico y disposición</h3>
                <label>
                  Disposición autorizada
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                  >
                    <option value="">Seleccionar destino</option>
                    <option>A destrucción</option>
                    <option>Almacén Proveedor</option>
                    <option>A reparación</option>
                    <option>Retorno a Sucursal</option>
                  </select>
                </label>
                <label>
                  Observaciones del diagnóstico
                  <textarea
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    rows={5}
                    placeholder="Describe las condiciones encontradas durante el diagnóstico…"
                  />
                </label>
                <div className="diagnosis-ready">
                  <i>✓</i>
                  <span>
                    <b>Recepción confirmada</b>
                    <small>
                      La solicitud está disponible para diagnóstico porque su
                      caja fue recibida.
                    </small>
                  </span>
                </div>
                <button
                  className="primario"
                  disabled={!destination}
                  onClick={confirm}
                >
                  Confirmar diagnóstico
                </button>
              </section>
            </div>
          ) : (
            <div className="diagnosis-placeholder">
              <article className="panel">
                <small>SOLICITUD RECIBIDA</small>
                <div className="blank-request">
                  <i>▥</i>
                  <h3>Sin solicitud cargada</h3>
                  <p>
                    Escanea una etiqueta o ingresa un folio o código para
                    mostrar aquí la información de la pieza.
                  </p>
                </div>
              </article>
              <section className="panel">
                <small>RESULTADO TÉCNICO</small>
                <div className="blank-request">
                  <i>◇</i>
                  <h3>Diagnóstico pendiente</h3>
                  <p>
                    Los campos de diagnóstico se habilitarán después de
                    identificar la solicitud.
                  </p>
                </div>
              </section>
            </div>
          )}
        </main>
        <footer>
          <span>
            <b>{items.length}</b> solicitudes pendientes de diagnóstico
          </span>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
type RoutedDiagnosis = PendingDiagnosis & {
  destination: string;
  origin?: "Diagnóstico" | "Calidad" | "Incidencia";
  note?: string;
};
function DispositionQueueModalLegacy({
  kind,
  items,
  onClose,
  onRemove,
  onMove,
  avisar,
}: {
  kind: "destruction" | "return";
  items: RoutedDiagnosis[];
  onClose: () => void;
  onRemove: (folios: string[]) => void;
  onMove: (folios: string[], destination: string) => void;
  avisar: (s: string) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({}),
    [chosen, setChosen] = useState<string[]>([]),
    [carrier, setCarrier] = useState<Record<string, string>>({}),
    [guide, setGuide] = useState<Record<string, string>>({}),
    [moveTarget, setMoveTarget] = useState<Record<string, string>>({});
  const groups =
      kind === "destruction"
        ? Object.values(
            items.reduce(
              (a, i) => {
                (a[i.sku] ??= {
                  sku: i.sku,
                  producto: i.producto,
                  rows: [],
                }).rows.push(i);
                return a;
              },
              {} as Record<
                string,
                { sku: string; producto: string; rows: RoutedDiagnosis[] }
              >,
            ),
          )
        : [],
    returnGroups =
      kind === "return"
        ? Object.entries(
            items.reduce(
              (a, i) => {
                (a[i.sucursal] ??= []).push(i);
                return a;
              },
              {} as Record<string, RoutedDiagnosis[]>,
            ),
          )
        : [];
  const selectedFor = (branch: string, rows: RoutedDiagnosis[]) =>
    rows.filter((i) => chosen.includes(i.folio)).map((i) => i.folio);
  const toggle = (folio: string, checked: boolean) =>
    setChosen((x) =>
      checked ? [...new Set([...x, folio])] : x.filter((f) => f !== folio),
    );
  const destroy = async (sku: string, rows: RoutedDiagnosis[]) => {
    const amount = Math.min(qty[sku] || 0, rows.length);
    if (!amount) return;
    if (
      !(await askQuestion(
        `¿Confirmas dar de baja ${amount} pieza(s) de ${sku} por destrucción?`,
      ))
    )
      return;
    onRemove(rows.slice(0, amount).map((i) => i.folio));
    avisar(`${amount} pieza(s) enviadas a destrucción`);
  };
  const moveSelected = async (branch: string, rows: RoutedDiagnosis[]) => {
    const folios = selectedFor(branch, rows),
      target = moveTarget[branch] || "";
    if (!folios.length || !target) return;
    if (
      !(await askQuestion(
        `¿Confirmas mover ${folios.length} solicitud(es) de ${branch} a ${target}?`,
      ))
    )
      return;
    onMove(folios, target);
    setChosen((x) => x.filter((f) => !folios.includes(f)));
    setMoveTarget((x) => ({ ...x, [branch]: "" }));
    avisar(`${folios.length} solicitud(es) de ${branch} movidas a ${target}`);
  };
  const ship = async (branch: string, rows: RoutedDiagnosis[]) => {
    const folios = selectedFor(branch, rows),
      selectedCarrier = carrier[branch] || "",
      selectedGuide = guide[branch] || "";
    if (!folios.length || !selectedCarrier || !selectedGuide) return;
    if (
      !(await askQuestion(
        `¿Confirmas generar el retorno de ${folios.length} solicitud(es) de ${branch} con guía ${selectedGuide}?`,
      ))
    )
      return;
    onRemove(folios);
    setChosen((x) => x.filter((f) => !folios.includes(f)));
    setCarrier((x) => ({ ...x, [branch]: "" }));
    setGuide((x) => ({ ...x, [branch]: "" }));
    setMoveTarget((x) => ({ ...x, [branch]: "" }));
    avisar(
      `Envío de retorno generado para ${branch}: ${folios.length} solicitud(es)`,
    );
  };
  return (
    <div className="queue-modal">
      <section>
        <header>
          <div>
            <small>DISPOSICIÓN DE GARANTÍAS</small>
            <h2>
              {kind === "destruction"
                ? "Solicitudes a destrucción"
                : "Retorno a sucursal"}
            </h2>
            <p>
              {kind === "destruction"
                ? "Confirma cantidades antes de registrar la baja."
                : "Selecciona solicitudes y gestiona cada sucursal de forma independiente."}
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <main>
          {kind === "destruction" ? (
            <div className="queue-groups">
              {groups.map((g) => (
                <article className="panel" key={g.sku}>
                  <div>
                    <small>CÓDIGO</small>
                    <h3>{g.sku}</h3>
                    <p>{g.producto}</p>
                    <em className="destruction-origin">
                      Origen:{" "}
                      {g.rows.some((r) => r.origin === "Calidad")
                        ? "Calidad"
                        : "Diagnóstico"}
                    </em>
                  </div>
                  <strong>{g.rows.length} piezas</strong>
                  <label>
                    Cantidad a destruir
                    <input
                      type="number"
                      min="1"
                      max={g.rows.length}
                      value={qty[g.sku] || ""}
                      onChange={(e) =>
                        setQty((x) => ({ ...x, [g.sku]: +e.target.value }))
                      }
                    />
                  </label>
                  <span>
                    Existencia nueva:{" "}
                    <b>
                      {g.rows.length - Math.min(qty[g.sku] || 0, g.rows.length)}
                    </b>
                  </span>
                  <button
                    className="primario"
                    disabled={!qty[g.sku]}
                    onClick={() => destroy(g.sku, g.rows)}
                  >
                    Dar de baja
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="return-branch-groups">
              {returnGroups.map(([branch, rows]) => {
                const selected = selectedFor(branch, rows),
                  enabled = selected.length > 0;
                return (
                  <section className="return-branch-card panel" key={branch}>
                    <header>
                      <div>
                        <small>SUCURSAL DE DESTINO</small>
                        <h3>{branch}</h3>
                        <p>{rows.length} solicitud(es) pendientes</p>
                      </div>
                      <span>{selected.length} seleccionada(s)</span>
                    </header>
                    <div className="return-requests">
                      {rows.map((i) => (
                        <label
                          className={chosen.includes(i.folio) ? "selected" : ""}
                          key={i.folio}
                        >
                          <input
                            type="checkbox"
                            checked={chosen.includes(i.folio)}
                            onChange={(e) => toggle(i.folio, e.target.checked)}
                          />
                          <span>
                            <b>{i.folio}</b>
                            <small>
                              {i.sku} · {i.producto}
                            </small>
                          </span>
                          <em>{i.sucursal}</em>
                        </label>
                      ))}
                    </div>
                    <div className="return-branch-actions">
                      <div className="return-disposition panel">
                        <div>
                          <small>CAMBIAR DISPOSICIÓN</small>
                          <b>Mover solicitudes seleccionadas</b>
                          <p>Conserva el folio y actualiza el destino.</p>
                        </div>
                        <label>
                          Nuevo destino
                          <select
                            disabled={!enabled}
                            value={moveTarget[branch] || ""}
                            onChange={(e) =>
                              setMoveTarget((x) => ({
                                ...x,
                                [branch]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Seleccionar destino</option>
                            <option>A destrucción</option>
                            <option>A reparación</option>
                            <option>Almacén Proveedor</option>
                          </select>
                        </label>
                        <button
                          disabled={!enabled || !moveTarget[branch]}
                          onClick={() => moveSelected(branch, rows)}
                        >
                          Confirmar movimiento
                        </button>
                      </div>
                      <div className="return-logistics panel">
                        <label>
                          Paquetería
                          <select
                            disabled={!enabled}
                            value={carrier[branch] || ""}
                            onChange={(e) =>
                              setCarrier((x) => ({
                                ...x,
                                [branch]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Seleccionar paquetería</option>
                            <option>Paquetexpress</option>
                            <option>Estafeta</option>
                            <option>DHL</option>
                            <option>Transporte interno</option>
                          </select>
                        </label>
                        <label>
                          Guía
                          <input
                            disabled={!enabled}
                            value={guide[branch] || ""}
                            onChange={(e) =>
                              setGuide((x) => ({
                                ...x,
                                [branch]: e.target.value,
                              }))
                            }
                            placeholder="Número de guía"
                          />
                        </label>
                        <button
                          className="primario"
                          disabled={
                            !enabled || !carrier[branch] || !guide[branch]
                          }
                          onClick={() => ship(branch, rows)}
                        >
                          Generar envío
                        </button>
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </main>
        <footer>
          <span>
            {items.length} solicitudes pendientes ·{" "}
            {returnGroups.length || groups.length} grupo(s)
          </span>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </section>
    </div>
  );
}
function EnhancedWarehouse({
  items,
  onStored,
  avisar,
  initialDest = "A reparación",
}: {
  items: RoutedDiagnosis[];
  onStored: (folios: string[]) => void;
  avisar: (s: string) => void;
  initialDest?: string;
}) {
  const [dest, setDest] = useState(initialDest),
    [sku, setSku] = useState(""),
    [scanned, setScanned] = useState<string[]>([]),
    [mode, setMode] = useState<"existing" | "new">("existing"),
    [newLocation, setNewLocation] = useState(""),
    [scanValue, setScanValue] = useState("");
  const relevant = items.filter((i) => i.destination === dest),
    groups = Object.values(
      relevant.reduce(
        (a, i) => {
          (a[i.sku] ??= {
            sku: i.sku,
            producto: i.producto,
            rows: [],
          }).rows.push(i);
          return a;
        },
        {} as Record<
          string,
          { sku: string; producto: string; rows: RoutedDiagnosis[] }
        >,
      ),
    ),
    group = groups.find((g) => g.sku === sku),
    complete = Boolean(group && scanned.length === group.rows.length),
    location = dest === "A reparación" ? "REP-02-B" : "PROV-07-A";
  const mark = (folio: string) =>
    setScanned((x) => (x.includes(folio) ? x : [...x, folio]));
  const scan = () => {
    if (!group) return;
    const found =
      group.rows.find(
        (i) =>
          !scanned.includes(i.folio) &&
          (i.folio === scanValue.trim().toUpperCase() ||
            i.sku === scanValue.trim().toUpperCase()),
      ) || group.rows.find((i) => !scanned.includes(i.folio));
    if (found) {
      mark(found.folio);
      setScanValue("");
      avisar(`${found.folio} escaneada`);
    }
  };
  const confirm = async () => {
    if (!group || !complete || (mode === "new" && !newLocation.trim())) return;
    const loc = mode === "new" ? newLocation : location;
    if (
      !(await askQuestion(
        `¿Confirmas almacenar ${group.rows.length} pieza(s) de ${group.sku} en ${loc}?`,
      ))
    )
      return;
    onStored(group.rows.map((i) => i.folio));
    setSku("");
    setScanned([]);
    setNewLocation("");
    avisar(`Ubicación ${loc} confirmada`);
  };
  return (
    <section className="enhanced-warehouse">
      <div className="warehouse-cards">
        <button
          className={dest === "A reparación" ? "active repair" : "repair"}
          onClick={() => {
            setDest("A reparación");
            setSku("");
            setScanned([]);
          }}
        >
          <i>⌁</i>
          <span>
            <small>ALMACÉN DE REPARACIÓN</small>
            <b>
              {items.filter((i) => i.destination === "A reparación").length}
            </b>
            <em>tareas por almacenar</em>
          </span>
        </button>
        <button
          className={
            dest === "Almacén Proveedor" ? "active provider" : "provider"
          }
          onClick={() => {
            setDest("Almacén Proveedor");
            setSku("");
            setScanned([]);
          }}
        >
          <i>▤</i>
          <span>
            <small>ALMACÉN PROVEEDOR</small>
            <b>
              {
                items.filter((i) => i.destination === "Almacén Proveedor")
                  .length
              }
            </b>
            <em>tareas por almacenar</em>
          </span>
        </button>
      </div>
      <div className="warehouse-task-layout">
        <div className="panel warehouse-code-groups">
          <div className="trace-head">
            <div>
              <h2>
                {dest === "A reparación"
                  ? "Almacén de reparación"
                  : "Almacén proveedor"}
              </h2>
              <p>Agrupado por código y cantidad.</p>
            </div>
          </div>
          {groups.map((g) => (
            <button
              className={sku === g.sku ? "selected" : ""}
              key={g.sku}
              onClick={() => {
                setSku(g.sku);
                setScanned([]);
              }}
            >
              <span>
                <b>{g.sku}</b>
                <small>{g.producto}</small>
              </span>
              <strong>{g.rows.length} piezas</strong>
            </button>
          ))}
        </div>
        <div className="panel warehouse-scan-detail">
          {group ? (
            <>
              <small>DETALLE DEL CÓDIGO</small>
              <h2>{group.sku}</h2>
              <p>{group.producto}</p>
              <div className="scan-products">
                <label>
                  Escanear producto
                  <div>
                    <input
                      value={scanValue}
                      onChange={(e) =>
                        setScanValue(e.target.value.toUpperCase())
                      }
                      placeholder="Folio o código"
                    />
                    <button onClick={scan}>▥ Escanear</button>
                  </div>
                </label>
                {group.rows.map((i) => (
                  <button
                    className={scanned.includes(i.folio) ? "scanned" : ""}
                    key={i.folio}
                    onClick={() => mark(i.folio)}
                  >
                    <i>{scanned.includes(i.folio) ? "✓" : "○"}</i>
                    <span>
                      <b>{i.folio}</b>
                      <small>
                        {i.sucursal} · {i.caja}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              <div
                className={
                  complete ? "scan-progress complete" : "scan-progress"
                }
              >
                <b>
                  {scanned.length} / {group.rows.length}
                </b>
                <span>
                  {complete ? "Escaneo completo" : "Productos por escanear"}
                </span>
              </div>
              <div className="location-mode">
                <button
                  className={mode === "existing" ? "active" : ""}
                  onClick={() => setMode("existing")}
                >
                  Ubicación sugerida
                </button>
                <button
                  className={mode === "new" ? "active" : ""}
                  onClick={() => setMode("new")}
                >
                  Nueva ubicación
                </button>
              </div>
              {mode === "existing" ? (
                <div className="suggested-location">
                  <small>UBICACIÓN</small>
                  <b>{location}</b>
                  <p>
                    Existencia actual: 4 · Existencia nueva:{" "}
                    {4 + group.rows.length}
                  </p>
                </div>
              ) : (
                <label className="new-location-scan">
                  Nueva ubicación
                  <div>
                    <input
                      value={newLocation}
                      onChange={(e) =>
                        setNewLocation(e.target.value.toUpperCase())
                      }
                      placeholder="Escanea o ingresa la ubicación"
                    />
                    <button
                      onClick={() => {
                        setNewLocation("NUEVA-03-C");
                        avisar("Ubicación escaneada");
                      }}
                    >
                      ▥ Escanear
                    </button>
                  </div>
                </label>
              )}
              <button
                className="primario compact-action-button"
                disabled={!complete || (mode === "new" && !newLocation)}
                onClick={confirm}
              >
                Confirmar ubicación
              </button>
            </>
          ) : (
            <div className="arrival-empty">
              <i>▤</i>
              <h2>Selecciona un código</h2>
              <p>Consulta las solicitudes que conforman la cantidad total.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
type OutboundKind = "repair" | "provider";
const outboundSeed: Record<
  OutboundKind,
  {
    sku: string;
    product: string;
    provider?: string;
    locations: { location: string; qty: number }[];
  }[]
> = {
  repair: [
    {
      sku: "BO-AL394",
      product: "Alternador Bosch 12V",
      locations: [
        { location: "REP-A-01", qty: 5 },
        { location: "REP-B-03", qty: 5 },
      ],
    },
    {
      sku: "MO-7281",
      product: "Amortiguador Monroe",
      locations: [
        { location: "REP-C-02", qty: 3 },
        { location: "REP-A-04", qty: 2 },
      ],
    },
  ],
  provider: [
    {
      sku: "GMB-1256",
      product: "Bomba de agua GMB",
      provider: "PRV-1028",
      locations: [
        { location: "PROV-P-07-A", qty: 6 },
        { location: "PROV-P-08-C", qty: 4 },
      ],
    },
    {
      sku: "NGK-7090",
      product: "Bujía NGK Iridium",
      provider: "PRV-2145",
      locations: [
        { location: "PROV-N-02-B", qty: 5 },
        { location: "PROV-N-04-A", qty: 3 },
      ],
    },
  ],
};
function WarehouseOutboundModal({
  kind,
  onClose,
  avisar,
  embedded = false,
  controlledStock,
  onStockChange,
}: {
  kind: OutboundKind;
  onClose: () => void;
  avisar: (s: string) => void;
  embedded?: boolean;
  controlledStock?: typeof outboundSeed.provider;
  onStockChange?: (rows: typeof outboundSeed.provider) => void;
}) {
  const [stock, setStock] = useState(
      () => controlledStock || outboundSeed[kind],
    ),
    [selectedSku, setSelectedSku] = useState(""),
    [qty, setQty] = useState(0),
    [withdrawals, setWithdrawals] = useState<Record<string, number>>({}),
    [query, setQuery] = useState("");
  const groups = stock.filter(
      (g) =>
        !query.trim() ||
        `${g.sku} ${g.product} ${g.provider || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    ),
    selected = stock.find((g) => g.sku === selectedSku),
    total = selected?.locations.reduce((s, l) => s + l.qty, 0) || 0,
    allocated = Object.values(withdrawals).reduce(
      (s, n) => s + (Number(n) || 0),
      0,
    );
  const start = (sku: string) => {
    setSelectedSku(sku);
    setQty(0);
    setWithdrawals({});
  };
  const confirm = async () => {
    if (!selected || qty < 1 || allocated !== qty) return;
    const target = kind === "repair" ? "técnico" : "proveedor";
    if (
      !(await askQuestion(
        `¿Confirmas retirar ${qty} pieza(s) de ${selected.sku} desde ${Object.values(withdrawals).filter(Boolean).length} ubicación(es) y enviarlas a ${target}?`,
      ))
    )
      return;
    setStock((rows) => {
      const next = rows
        .map((g) =>
          g.sku !== selected.sku
            ? g
            : {
                ...g,
                locations: g.locations
                  .map((l) => ({
                    ...l,
                    qty: l.qty - (withdrawals[l.location] || 0),
                  }))
                  .filter((l) => l.qty > 0),
              },
        )
        .filter((g) => g.locations.some((l) => l.qty > 0));
      onStockChange?.(next as typeof outboundSeed.provider);
      return next;
    });
    setSelectedSku("");
    setQty(0);
    setWithdrawals({});
    avisar(
      `${qty} pieza(s) transferidas a ${target}; existencias actualizadas`,
    );
  };
  return (
    <div
      className={
        embedded
          ? "warehouse-outbound-modal embedded"
          : "warehouse-outbound-modal"
      }
      role={embedded ? undefined : "dialog"}
      aria-modal={embedded ? undefined : "true"}
    >
      <section>
        <header>
          <div>
            <small>SALIDAS · ALMACÉN DE GARANTÍAS</small>
            <h2>
              {kind === "repair" ? "Salida a reparación" : "Salida a proveedor"}
            </h2>
            <p>
              Inventario agrupado por código con retiro controlado desde una o
              varias ubicaciones.
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <main>
          <label className="outbound-search">
            ⌕
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && !groups.length)
                  showInfo(
                    "El código consultado no tiene existencia disponible.",
                  );
              }}
              placeholder={
                kind === "provider"
                  ? "Buscar código, producto o proveedor"
                  : "Buscar código o producto"
              }
            />
            <button
              type="button"
              onClick={() =>
                query.trim() &&
                !groups.length &&
                showInfo("El código consultado no tiene existencia disponible.")
              }
            >
              Buscar
            </button>
          </label>
          <div className="outbound-groups">
            {groups.map((g) => {
              const current = g.locations.reduce((s, l) => s + l.qty, 0);
              return (
                <article className="panel" key={g.sku}>
                  <div>
                    <small>CÓDIGO</small>
                    <b>{g.sku}</b>
                    <span>{g.product}</span>
                    {g.provider && <em>Proveedor {g.provider}</em>}
                    {kind === "repair" && (
                      <em className="request-date">
                        Solicitud: 27 ago 2026 · 09:30
                      </em>
                    )}
                  </div>
                  <div>
                    <small>UBICACIONES</small>
                    <span>
                      {g.locations
                        .filter((l) => l.qty > 0)
                        .map((l) => (
                          <i key={l.location}>
                            {l.location} · {l.qty}
                          </i>
                        ))}
                    </span>
                  </div>
                  <strong>
                    {current}
                    <small> piezas</small>
                  </strong>
                  <button className="primario" onClick={() => start(g.sku)}>
                    {kind === "repair"
                      ? "Transferir a técnico"
                      : "Enviar a proveedor"}
                  </button>
                </article>
              );
            })}
          </div>
        </main>
        <footer>
          <span>{groups.length} códigos disponibles</span>
          <button onClick={onClose}>Cerrar</button>
        </footer>
      </section>
      {selected && (
        <div className="outbound-allocation">
          <section>
            <header>
              <div>
                <small>TRANSFERENCIA CONTROLADA</small>
                <h2>
                  {selected.sku} · {selected.product}
                </h2>
                <p>
                  Indica la cantidad total y distribuye el retiro entre las
                  ubicaciones.
                </p>
              </div>
              <button onClick={() => setSelectedSku("")}>×</button>
            </header>
            <main>
              <div className="transfer-quantity">
                <span>
                  <small>EXISTENCIA TOTAL ACTUAL</small>
                  <b>{total} piezas</b>
                </span>
                <label>
                  Cantidad a transferir
                  <input
                    type="number"
                    min="1"
                    max={total}
                    value={qty || ""}
                    onChange={(e) => {
                      setQty(
                        Math.min(total, Math.max(0, Number(e.target.value))),
                      );
                      setWithdrawals({});
                    }}
                  />
                </label>
                <span
                  className={
                    allocated === qty && qty > 0 ? "complete" : "pending"
                  }
                >
                  <small>CANTIDAD ASIGNADA</small>
                  <b>
                    {allocated} de {qty || 0}
                  </b>
                </span>
              </div>
              <div className="allocation-table">
                <div className="allocation-head">
                  <span>Seleccionar</span>
                  <span>Ubicación</span>
                  <span>Existencia actual</span>
                  <span>Cantidad a retirar</span>
                  <span>Existencia nueva</span>
                </div>
                {selected.locations
                  .filter((l) => l.qty > 0)
                  .map((l) => {
                    const take = withdrawals[l.location] || 0,
                      max = Math.min(
                        l.qty,
                        Math.max(0, qty - (allocated - take)),
                      );
                    return (
                      <label
                        className={take > 0 ? "used" : ""}
                        key={l.location}
                      >
                        <input
                          type="checkbox"
                          checked={take > 0}
                          onChange={(e) =>
                            setWithdrawals((x) => ({
                              ...x,
                              [l.location]: e.target.checked
                                ? Math.min(l.qty, Math.max(1, qty - allocated))
                                : 0,
                            }))
                          }
                        />
                        <b>{l.location}</b>
                        <strong>{l.qty}</strong>
                        <input
                          type="number"
                          min="0"
                          max={max}
                          value={take || ""}
                          disabled={!qty}
                          onChange={(e) =>
                            setWithdrawals((x) => ({
                              ...x,
                              [l.location]: Math.min(
                                max,
                                Math.max(0, Number(e.target.value)),
                              ),
                            }))
                          }
                        />
                        <em>{l.qty - take}</em>
                      </label>
                    );
                  })}
              </div>
              {qty > 0 && allocated !== qty && (
                <div className="allocation-warning">
                  Falta asignar {qty - allocated} pieza(s) entre las
                  ubicaciones.
                </div>
              )}
              <div className="transfer-summary">
                <span>
                  <small>Existencia actual</small>
                  <b>{total} piezas</b>
                </span>
                <i>→</i>
                <span>
                  <small>Existencia nueva</small>
                  <b>{total - qty} piezas</b>
                </span>
              </div>
            </main>
            <footer>
              <button onClick={() => setSelectedSku("")}>Cancelar</button>
              <button
                className="primario"
                disabled={!qty || allocated !== qty}
                onClick={confirm}
              >
                {kind === "repair"
                  ? "Confirmar retiro y transferir"
                  : "Confirmar retiro y enviar"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
type WarehouseWorkspace =
  | "in-repair"
  | "in-provider"
  | "out-repair"
  | "out-provider"
  | "inventory"
  | "queries"
  | "relocate";
const inventoryRows = [
  {
    sku: "BO-AL394",
    product: "Alternador Bosch 12V",
    provider: "Bosch México",
    location: "REP-A-01",
    qty: 8,
    cost: 3480,
    type: "Reparación",
  },
  {
    sku: "BO-MA810",
    product: "Marcha Bosch",
    provider: "Bosch México",
    location: "REP-A-04",
    qty: 5,
    cost: 3120,
    type: "Reparación",
  },
  {
    sku: "BO-MA810",
    product: "Marcha Bosch",
    provider: "Bosch México",
    location: "REP-C-02",
    qty: 3,
    cost: 3120,
    type: "Reparación",
  },
  {
    sku: "GMB-1256",
    product: "Bomba de agua GMB",
    provider: "GMB North America",
    location: "REP-B-01",
    qty: 9,
    cost: 1890,
    type: "Reparación",
  },
  {
    sku: "GMB-1256",
    product: "Bomba de agua GMB",
    provider: "GMB North America",
    location: "REP-D-03",
    qty: 6,
    cost: 1890,
    type: "Reparación",
  },
  {
    sku: "NGK-7090",
    product: "Bujía NGK Iridium",
    provider: "NGK de México",
    location: "REP-N-02",
    qty: 20,
    cost: 420,
    type: "Reparación",
  },
  {
    sku: "NGK-7090",
    product: "Bujía NGK Iridium",
    provider: "NGK de México",
    location: "REP-N-05",
    qty: 12,
    cost: 420,
    type: "Reparación",
  },
  {
    sku: "FR-D1287",
    product: "Juego de balatas Fritec",
    provider: "Fritec",
    location: "REP-F-01",
    qty: 7,
    cost: 2140,
    type: "Reparación",
  },
  {
    sku: "FR-D1287",
    product: "Juego de balatas Fritec",
    provider: "Fritec",
    location: "REP-F-06",
    qty: 4,
    cost: 2140,
    type: "Reparación",
  },
  {
    sku: "DE-2341",
    product: "Sensor de oxígeno Denso",
    provider: "Denso México",
    location: "REP-D-04",
    qty: 6,
    cost: 1460,
    type: "Reparación",
  },
  {
    sku: "LTH-H47",
    product: "Batería LTH H-47",
    provider: "LTH / Clarios",
    location: "REP-L-02",
    qty: 4,
    cost: 2650,
    type: "Reparación",
  },
  {
    sku: "MO-7281",
    product: "Amortiguador Monroe",
    provider: "Monroe México",
    location: "REP-M-03",
    qty: 10,
    cost: 1780,
    type: "Reparación",
  },
  {
    sku: "SKF-VKBA",
    product: "Kit de balero de rueda SKF",
    provider: "SKF México",
    location: "REP-S-01",
    qty: 5,
    cost: 2380,
    type: "Reparación",
  },
  {
    sku: "VA-SF123",
    product: "Filtro de aceite Valeo",
    provider: "Valeo Service",
    location: "REP-V-04",
    qty: 24,
    cost: 310,
    type: "Reparación",
  },
  {
    sku: "BO-AL394",
    product: "Alternador Bosch 12V",
    provider: "Bosch México",
    location: "REP-B-03",
    qty: 6,
    cost: 3480,
    type: "Reparación",
  },
  {
    sku: "GMB-1256",
    product: "Bomba de agua GMB",
    provider: "GMB North America",
    location: "PROV-P-07-A",
    qty: 12,
    cost: 1890,
    type: "Proveedor",
  },
  {
    sku: "NGK-7090",
    product: "Bujía NGK Iridium",
    provider: "NGK de México",
    location: "PROV-N-02-B",
    qty: 15,
    cost: 420,
    type: "Proveedor",
  },
  {
    sku: "DE-2341",
    product: "Sensor de oxígeno Denso",
    provider: "Denso México",
    location: "PROV-D-04-A",
    qty: 9,
    cost: 1460,
    type: "Proveedor",
  },
  {
    sku: "FR-D1287",
    product: "Juego de balatas Fritec",
    provider: "Fritec",
    location: "PROV-F-05-C",
    qty: 14,
    cost: 2140,
    type: "Proveedor",
  },
  {
    sku: "LTH-H47",
    product: "Batería LTH H-47",
    provider: "LTH / Clarios",
    location: "PROV-L-01-B",
    qty: 7,
    cost: 2650,
    type: "Proveedor",
  },
  {
    sku: "MO-7281",
    product: "Amortiguador Monroe",
    provider: "Monroe México",
    location: "PROV-M-08-D",
    qty: 11,
    cost: 1780,
    type: "Proveedor",
  },
];
type RepairRequest = {
  requestFolio: string;
  warrantyFolios: string[];
  sku: string;
  product: string;
  provider: string;
  requestedQty: number;
  technician: string;
  requestedAt: string;
  status: "Solicitada" | "Transferida";
};
type ProviderOutboundRequest = {
  requestFolio: string;
  sku: string;
  product: string;
  provider: string;
  requestedQty: number;
  requestedAt: string;
  status: "Solicitada" | "Transferida";
};
type RepairPieceStatus =
  | "Por recibir"
  | "Asignada al técnico"
  | "En reparación"
  | "Reparación finalizada"
  | "En calidad"
  | "Calidad aprobada"
  | "En tarima"
  | "Transferida a CEDIS"
  | "Rechazada por calidad";
type RepairPiece = {
  pieceId: string;
  requestFolio: string;
  warrantyFolio: string;
  sku: string;
  product: string;
  originLocation: string;
  technician: string;
  status: RepairPieceStatus;
  transferredAt: string;
  branch?: string;
  requestedAt?: string;
  startedAt?: number;
  elapsedSeconds?: number;
  finishedAt?: string;
  qualityAt?: string;
  qualityReturn?: boolean;
  qualityReason?: string;
};
function WarehouseControl({
  mode,
  avisar,
  stock = inventoryRows,
}: {
  mode: "inventory" | "queries" | "relocate";
  avisar: (s: string) => void;
  stock?: typeof inventoryRows;
}) {
  const [query, setQuery] = useState(""),
    [sku, setSku] = useState(""),
    [productInput, setProductInput] = useState(""),
    [origin, setOrigin] = useState(""),
    [destination, setDestination] = useState(""),
    hasQuery = Boolean(query.trim()),
    rows = stock.filter(
      (r) =>
        (mode !== "queries" || hasQuery) &&
        (!hasQuery ||
          `${r.sku} ${r.product} ${r.provider} ${r.location} ${r.type}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    ),
    selectedRows = stock.filter((r) => r.sku === sku),
    selected = selectedRows.find((r) => r.location === origin),
    money = (n: number) =>
      n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    identifyProduct = (value = productInput) => {
      const normalized = value.trim().toUpperCase(),
        found = stock.find(
          (r) =>
            r.sku === normalized ||
            r.product.toUpperCase().includes(normalized),
        );
      if (!found) {
        avisar("No se encontró un producto con el código ingresado");
        return;
      }
      setSku(found.sku);
      setProductInput(found.sku);
      setOrigin("");
      avisar(found.sku + " identificado correctamente");
    },
    move = async () => {
      if (!selected || !destination.trim() || destination === origin) return;
      if (
        !(await askQuestion(
          `¿Confirmas mover ${selected.qty} pieza(s) de ${selected.sku} de ${origin} a ${destination}?`,
        ))
      )
        return;
      avisar(
        `Movimiento confirmado: ${selected.sku} · ${origin} → ${destination}`,
      );
      setSku("");
      setProductInput("");
      setOrigin("");
      setDestination("");
    };
  if (mode === "relocate")
    return (
      <section className="panel warehouse-control relocation">
        <div className="trace-head">
          <div>
            <h2>Cambiar mercancía de ubicación</h2>
            <p>
              Movimiento interno con confirmación y trazabilidad de origen y
              destino.
            </p>
          </div>
          <span>Transferencia interna</span>
        </div>
        <div className="relocation-flow">
          <label>
            Producto
            <div className="relocation-product-input">
              <input
                list="relocation-products"
                value={productInput}
                onChange={(e) => {
                  setProductInput(e.target.value.toUpperCase());
                  setSku("");
                  setOrigin("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    identifyProduct();
                  }
                }}
                placeholder="Ingresa SKU o nombre del producto"
              />
              <datalist id="relocation-products">
                {[...new Map(stock.map((r) => [r.sku, r])).values()].map(
                  (r) => (
                    <option value={r.sku} key={r.sku}>
                      {r.product}
                    </option>
                  ),
                )}
              </datalist>
              <button type="button" onClick={() => identifyProduct()}>
                Buscar
              </button>
              <button type="button" onClick={() => identifyProduct("BO-AL394")}>
                ▥ Escanear
              </button>
            </div>
            <small>
              {sku
                ? "Producto identificado: " + sku
                : "Captura manual o lectura del código de barras"}
            </small>
          </label>
          <label>
            Ubicación origen
            <select
              value={origin}
              disabled={!sku}
              onChange={(e) => setOrigin(e.target.value)}
            >
              <option value="">Seleccionar ubicación</option>
              {selectedRows.map((r) => (
                <option key={r.location}>{r.location}</option>
              ))}
            </select>
          </label>
          <label>
            Nueva ubicación
            <div>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value.toUpperCase())}
                placeholder="Escanea o ingresa ubicación"
              />
              <button onClick={() => setDestination("REP-C-05")}>
                ▥ Escanear
              </button>
            </div>
          </label>
        </div>
        {selected && (
          <div className="relocation-summary">
            <span>
              <small>PRODUCTO</small>
              <b>{selected.sku}</b>
              <em>{selected.product}</em>
            </span>
            <span>
              <small>EXISTENCIA A MOVER</small>
              <b>{selected.qty} piezas</b>
            </span>
            <span>
              <small>ORIGEN</small>
              <b>{origin}</b>
            </span>
            <i>→</i>
            <span>
              <small>DESTINO</small>
              <b>{destination || "Pendiente"}</b>
            </span>
          </div>
        )}
        <button
          className="primario relocation-confirm"
          disabled={!selected || !destination || destination === origin}
          onClick={move}
        >
          Confirmar cambio de ubicación
        </button>
      </section>
    );
  return (
    <section className="panel warehouse-control">
      <div className="trace-head">
        <div>
          <h2>
            {mode === "inventory"
              ? "Inventario de garantías"
              : "Consulta de almacén"}
          </h2>
          <p>
            {mode === "inventory"
              ? "Existencias consolidadas por código, proveedor y ubicación."
              : "Busca por código, producto, ubicación o proveedor. Los resultados aparecen después de ingresar un criterio."}
          </p>
        </div>
        {mode === "inventory" && (
          <span>
            {rows.reduce((s, r) => s + r.qty, 0)} piezas ·{" "}
            {money(rows.reduce((s, r) => s + r.qty * r.cost, 0))}
          </span>
        )}
      </div>
      <label className="outbound-search">
        ⌕
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Código, producto, ubicación o proveedor"
        />
      </label>
      {mode === "queries" && !hasQuery ? (
        <div className="warehouse-query-empty">
          <i>⌕</i>
          <b>Ingresa un criterio de consulta</b>
          <p>
            La información permanecerá vacía hasta buscar un código, producto,
            ubicación o proveedor.
          </p>
        </div>
      ) : (
        <div className="inventory-table inventory-table-cost">
          <header>
            <span>Código y producto</span>
            <span>Proveedor</span>
            <span>Tipo</span>
            <span>Ubicación</span>
            <span>Existencia</span>
            <span>Costo unitario</span>
            <span>Valor</span>
          </header>
          {rows.length ? (
            rows.map((r) => (
              <article key={`${r.sku}-${r.location}`}>
                <span>
                  <b>{r.sku}</b>
                  <small>{r.product}</small>
                </span>
                <span className="inventory-provider">{r.provider}</span>
                <em>{r.type}</em>
                <strong>{r.location}</strong>
                <b>{r.qty} piezas</b>
                <span>{money(r.cost)}</span>
                <b className="inventory-value">{money(r.qty * r.cost)}</b>
              </article>
            ))
          ) : (
            <div className="warehouse-query-empty compact">
              <i>⌕</i>
              <b>Sin coincidencias</b>
              <p>Prueba con otro código, producto, ubicación o proveedor.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function WarehouseHub({
  items,
  onStored,
  avisar,
}: {
  items: RoutedDiagnosis[];
  onStored: (folios: string[]) => void;
  avisar: (s: string) => void;
}) {
  const [workspace, setWorkspace] = useState<WarehouseWorkspace>("in-repair"),
    repairIn = items.filter((i) => i.destination === "A reparación").length,
    providerIn = items.filter(
      (i) => i.destination === "Almacén Proveedor",
    ).length;
  const choose = (next: WarehouseWorkspace) => setWorkspace(next);
  return (
    <section className="warehouse-hub">
      <div className="warehouse-command">
        <section>
          <div>
            <small>ENTRADAS</small>
            <h2>Recepción en almacén</h2>
            <p>
              Escanea, valida y asigna ubicación a las piezas diagnosticadas.
            </p>
          </div>
          <div>
            <button
              className={workspace === "in-repair" ? "active repair" : "repair"}
              onClick={() => choose("in-repair")}
            >
              <i>↓</i>
              <span>
                <small>ALMACÉN DE REPARACIÓN</small>
                <b>{repairIn}</b>
                <em>tareas por almacenar</em>
              </span>
              <strong>Gestionar →</strong>
            </button>
            <button
              className={
                workspace === "in-provider" ? "active provider" : "provider"
              }
              onClick={() => choose("in-provider")}
            >
              <i>↓</i>
              <span>
                <small>ALMACÉN PROVEEDOR</small>
                <b>{providerIn}</b>
                <em>tareas por almacenar</em>
              </span>
              <strong>Gestionar →</strong>
            </button>
          </div>
        </section>
        <section>
          <div>
            <small>SALIDAS</small>
            <h2>Movimientos desde almacén</h2>
            <p>Retira existencias para entregarlas a técnico o proveedor.</p>
          </div>
          <div>
            <button
              className={
                workspace === "out-repair" ? "active repair" : "repair"
              }
              onClick={() => choose("out-repair")}
            >
              <i>⌁</i>
              <span>
                <small>SALIDA A REPARACIÓN</small>
                <b>15</b>
                <em>piezas disponibles</em>
              </span>
              <strong>Gestionar →</strong>
            </button>
            <button
              className={
                workspace === "out-provider" ? "active provider" : "provider"
              }
              onClick={() => choose("out-provider")}
            >
              <i>↗</i>
              <span>
                <small>SALIDA A PROVEEDOR</small>
                <b> 18</b>
                <em>piezas disponibles</em>
              </span>
              <strong>Gestionar →</strong>
            </button>
          </div>
        </section>
        <section className="control-section">
          <div>
            <small>CONTROL</small>
            <h2>Consulta y movimientos internos</h2>
            <p>
              Supervisa existencias y conserva la trazabilidad de las
              ubicaciones.
            </p>
          </div>
          <div>
            <button
              className={workspace === "inventory" ? "active" : ""}
              onClick={() => choose("inventory")}
            >
              <i>▦</i>
              <span>
                <small>INVENTARIO</small>
                <b>21</b>
                <em>piezas registradas</em>
              </span>
              <strong>Abrir →</strong>
            </button>
            <button
              className={workspace === "queries" ? "active" : ""}
              onClick={() => choose("queries")}
            >
              <i>⌕</i>
              <span>
                <small>CONSULTAS</small>
                <em>consulta por criterio</em>
              </span>
              <strong>Abrir →</strong>
            </button>
            <button
              className={workspace === "relocate" ? "active" : ""}
              onClick={() => choose("relocate")}
            >
              <i>⇄</i>
              <span>
                <small>CAMBIAR UBICACIÓN</small>
                <b>↔</b>
                <em>movimiento interno</em>
              </span>
              <strong>Abrir →</strong>
            </button>
          </div>
        </section>
      </div>
      <div className="warehouse-active-work">
        <div className="workspace-label">
          <small>ÁREA DE TRABAJO</small>
          <b>
            {workspace === "in-repair"
              ? "Entrada · Almacén de reparación"
              : workspace === "in-provider"
                ? "Entrada · Almacén proveedor"
                : workspace === "out-repair"
                  ? "Salida · Reparación"
                  : workspace === "out-provider"
                    ? "Salida · Proveedor"
                    : workspace === "inventory"
                      ? "Inventario"
                      : workspace === "queries"
                        ? "Consultas"
                        : "Cambiar ubicación"}
          </b>
        </div>
        {workspace === "in-repair" || workspace === "in-provider" ? (
          <EnhancedWarehouse
            key={workspace}
            items={items}
            onStored={onStored}
            avisar={avisar}
            initialDest={
              workspace === "in-repair" ? "A reparación" : "Almacén Proveedor"
            }
          />
        ) : workspace === "out-repair" || workspace === "out-provider" ? (
          <WarehouseOutboundModal
            key={workspace}
            kind={workspace === "out-repair" ? "repair" : "provider"}
            embedded
            onClose={() => {}}
            avisar={avisar}
          />
        ) : (
          <WarehouseControl mode={workspace} avisar={avisar} />
        )}
      </div>
    </section>
  );
}
export default function Home() {
  const [portal, setPortal] = useState<
      "central" | "sucursal" | "mostrador" | null
    >(null),
    [vista, setVista] = useState("Solicitudes"),
    [casos, setCasos] = useState(data),
    [sel, setSel] = useState<Caso | null>(data[0]),
    [buscar, setBuscar] = useState(""),
    [sucursal, setSucursal] = useState("Todas"),
    [estadoSolicitud, setEstadoSolicitud] = useState("Todos"),
    [estadoCustodia, setEstadoCustodia] = useState("Todos"),
    [cajaFiltro, setCajaFiltro] = useState("Todas"),
    [modal, setModal] = useState(false),
    [receptionModal, setReceptionModal] = useState(false),
    [diagnosisModal, setDiagnosisModal] = useState(false),
    [receivedBoxes, setReceivedBoxes] = useState<string[]>(["GX-ZPN-008"]),
    [diagnosedRequests, setDiagnosedRequests] = useState<string[]>([]),
    [routedRequests, setRoutedRequests] = useState<RoutedDiagnosis[]>([
      {
        folio: "GE-260824-1761",
        sku: "FR-D1287",
        producto: "Juego de balatas Fritec",
        sucursal: "GDL Centro",
        caja: "GX-GDL-011",
        destination: "A destrucción",
      },
      {
        folio: "GE-260824-1762",
        sku: "GMB-1256",
        producto: "Bomba de agua GMB",
        sucursal: "León Torres",
        caja: "GX-LEO-002",
        destination: "Retorno a Sucursal",
      },
      {
        folio: "GE-260824-1763",
        sku: "BO-AL394",
        producto: "Alternador Bosch 12V",
        sucursal: "GDL Centro",
        caja: "GX-GDL-011",
        destination: "A reparación",
      },
      {
        folio: "GE-260824-1764",
        sku: "BO-AL394",
        producto: "Alternador Bosch 12V",
        sucursal: "Zapopan Norte",
        caja: "GX-ZPN-006",
        destination: "A reparación",
      },
      {
        folio: "GE-260824-1765",
        sku: "DE-2341",
        producto: "Sensor de oxígeno Denso",
        sucursal: "Aguascalientes Sur",
        caja: "GX-AGS-004",
        destination: "Almacén Proveedor",
      },
    ]),
    [storedRequests, setStoredRequests] = useState<string[]>([]),
    [queueModal, setQueueModal] = useState<"destruction" | "return" | null>(
      null,
    ),
    [botFlow, setBotFlow] = useState<Caso | null>(null),
    [botOutcomes, setBotOutcomes] = useState<Record<string, Caso>>({}),
    [toast, setToast] = useState(""),
    [meses, setMeses] = useState(19),
    [base, setBase] = useState(2650),
    [aprobado, setAprobado] = useState(false),
    [invoiceStock, setInvoiceStock] = useState<Record<string, number>>(() => {
      const s: Record<string, number> = {};
      for (const f of facturas) {
        for (const it of f.items || [
          { sku: f.sku, cantidadDisponible: f.cantidad },
        ]) {
          s[claveStock(f.folio, it.sku)] = it.cantidadDisponible;
        }
      }
      return s;
    }),
    [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [repairTransfers, setRepairTransfers] = useState<DispositionItem[]>([]),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState("");
  const [menuCollapsed, setMenuCollapsed] = useState(false),
    [repairQualityTab, setRepairQualityTab] = useState<"repair" | "quality">(
      "repair",
    );
  const [repairRequests, setRepairRequests] = useState<RepairRequest[]>([
    {
      requestFolio: "SMR-260825-0001",
      warrantyFolios: ["GE-260824-1763", "GE-260824-1764"],
      sku: "BO-AL394",
      product: "Alternador Bosch 12V",
      provider: "Bosch México",
      requestedQty: 2,
      technician: "Carlos Méndez",
      requestedAt: "25 ago 2026 · 09:18",
      status: "Solicitada",
    },
    {
      requestFolio: "SMR-260826-0003",
      warrantyFolios: ["GE-260826-1903", "GE-260826-1904", "GE-260826-1905"],
      sku: "GMB-1256",
      product: "Bomba de agua GMB",
      provider: "GMB North America",
      requestedQty: 3,
      technician: "Laura Ramírez",
      requestedAt: "26 ago 2026 · 08:12",
      status: "Solicitada",
    },
    {
      requestFolio: "SMR-260826-0004",
      warrantyFolios: [
        "GE-260826-1906",
        "GE-260826-1907",
        "GE-260826-1908",
        "GE-260826-1909",
      ],
      sku: "NGK-7090",
      product: "Bujía NGK Iridium",
      provider: "NGK de México",
      requestedQty: 4,
      technician: "José Salgado",
      requestedAt: "26 ago 2026 · 08:36",
      status: "Solicitada",
    },
    {
      requestFolio: "SMR-260826-0005",
      warrantyFolios: ["GE-260826-1910", "GE-260826-1911", "GE-260826-1912"],
      sku: "BO-AL394",
      product: "Alternador Bosch 12V",
      provider: "Bosch México",
      requestedQty: 3,
      technician: "Carlos Méndez",
      requestedAt: "26 ago 2026 · 09:05",
      status: "Solicitada",
    },
  ]);
  const [repairPieces, setRepairPieces] = useState<RepairPiece[]>([
    {
      pieceId: "PZA-GE-260823-1794-01",
      requestFolio: "SMR-260824-0098",
      warrantyFolio: "GE-260823-1794",
      sku: "BO-MA810",
      product: "Marcha Bosch",
      originLocation: "Por recibir",
      technician: "Carlos Méndez",
      status: "Por recibir",
      transferredAt: "Pendiente",
    },
    {
      pieceId: "PZA-GE-260824-1763-01",
      requestFolio: "SMR-260825-0001",
      warrantyFolio: "GE-260824-1763",
      sku: "BO-AL394",
      product: "Alternador Bosch 12V",
      originLocation: "REP-A-01",
      technician: "Carlos Méndez",
      status: "En calidad",
      transferredAt: "25 ago 2026 · 10:12",
      branch: "GDL Centro",
      requestedAt: "24 ago 2026 · 09:18",
      elapsedSeconds: 847,
      finishedAt: "25 ago 2026 · 11:26",
      qualityAt: "25 ago 2026 · 11:30",
    },
    {
      pieceId: "PZA-GE-260824-1764-01",
      requestFolio: "SMR-260825-0002",
      warrantyFolio: "GE-260824-1764",
      sku: "FR-D1287",
      product: "Juego de balatas Fritec",
      originLocation: "REP-B-02",
      technician: "Laura Ramírez",
      status: "Calidad aprobada",
      transferredAt: "25 ago 2026 · 12:10",
      branch: "Zapopan Norte",
      requestedAt: "24 ago 2026 · 10:05",
      elapsedSeconds: 1124,
      finishedAt: "25 ago 2026 · 14:18",
      qualityAt: "25 ago 2026 · 14:25",
    },
  ]);
  const [warehouseStock, setWarehouseStock] = useState(inventoryRows);
  const [providerOutboundRequests, setProviderOutboundRequests] = useState<
    ProviderOutboundRequest[]
  >([
    {
      requestFolio: "FSP-260828-0001",
      sku: "FR-D1287",
      product: "Juego de balatas Fritec",
      provider: "Fritec",
      requestedQty: 2,
      requestedAt: "28 ago 2026 · 08:42",
      status: "Solicitada",
    },
  ]);
  const [qualityIncidents, setQualityIncidents] = useState<
      QualityGeneratedIncident[]
    >([]),
    [receptionIncidentFolios, setReceptionIncidentFolios] = useState<string[]>(
      [],
    ),
    [resolvedIncidentFolios, setResolvedIncidentFolios] = useState<string[]>(
      [],
    ),
    [incidentResolutionNotes, setIncidentResolutionNotes] = useState<
      Record<string, string>
    >({}),
    [incidentDetail, setIncidentDetail] = useState<string | null>(null);
  const filtrados = useMemo(
    () =>
      casos.filter((c) => {
        const d = requestDate(c.fechaSolicitud);
        return (
          (sucursal === "Todas" ||
            c.sucursal.toLowerCase().includes(sucursal.toLowerCase())) &&
          (estadoSolicitud === "Todos" ||
            estadoVisible(c)
              .toLowerCase()
              .includes(estadoSolicitud.toLowerCase())) &&
          (estadoCustodia === "Todos" ||
            (receivedBoxes.includes(c.caja || "")
              ? "Garantías Central"
              : c.custodia || "Con el cliente"
            )
              .toLowerCase()
              .includes(estadoCustodia.toLowerCase())) &&
          (cajaFiltro === "Todas" ||
            (cajaFiltro === "Pendiente"
              ? !c.caja
              : (c.caja || "")
                  .toLowerCase()
                  .includes(cajaFiltro.toLowerCase()))) &&
          (!dateFrom || d >= dateFrom) &&
          (!dateTo || d <= dateTo) &&
          !receptionIncidentFolios.includes(c.id) &&
          `${c.id} ${c.cliente} ${c.producto} ${c.sku}`
            .toLowerCase()
            .includes(buscar.toLowerCase())
        );
      }),
    [
      casos,
      sucursal,
      buscar,
      estadoSolicitud,
      estadoCustodia,
      cajaFiltro,
      receivedBoxes,
      dateFrom,
      dateTo,
      receptionIncidentFolios,
    ],
  );
  const pendingReception = cajasCentral
    .filter((c) => !receivedBoxes.includes(c.numero))
    .reduce((total, c) => total + c.items.length, 0);
  const pendingDiagnosisItems: PendingDiagnosis[] = cajasCentral
    .filter((c) => receivedBoxes.includes(c.numero))
    .flatMap((c) =>
      c.items
        .filter((i) => !diagnosedRequests.includes(i.folio))
        .map((i) => ({ ...i, sucursal: c.sucursal, caja: c.numero })),
    );
  const destructionQueue = routedRequests.filter(
      (i) => i.destination === "A destrucción",
    ),
    returnQueue = routedRequests.filter(
      (i) => i.destination === "Retorno a Sucursal",
    ),
    warehouseQueue = routedRequests.filter(
      (i) =>
        (i.destination === "A reparación" ||
          i.destination === "Almacén Proveedor") &&
        !storedRequests.includes(i.folio),
    );
  const pct =
      meses <= 12
        ? 0
        : meses <= 18
          ? 20
          : meses <= 24
            ? 35
            : meses <= 30
              ? 50
              : 65,
    credito = Math.max(0, base * (1 - pct / 100));
  const avisar = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };
  const createRepairRequest = (
    input: Omit<
      RepairRequest,
      "requestFolio" | "status" | "requestedAt" | "warrantyFolios"
    >,
  ) => {
    const requestFolio = `SMR-260825-${String(2 + repairRequests.length).padStart(4, "0")}`,
      warrantyFolios = Array.from(
        { length: input.requestedQty },
        (_, i) =>
          `GE-260825-${String(1901 + repairRequests.reduce((s, r) => s + r.requestedQty, 0) + i).padStart(4, "0")}`,
      );
    setRepairRequests((x) => [
      {
        ...input,
        requestFolio,
        warrantyFolios,
        requestedAt: "25 ago 2026 · Ahora",
        status: "Solicitada",
      },
      ...x,
    ]);
    avisar(
      `Solicitud ${requestFolio} generada y enviada a Salida a reparación`,
    );
  };
  const cancelRepairRequest = async (folio: string) => {
    const request = repairRequests.find((r) => r.requestFolio === folio);
    if (!request || request.status !== "Solicitada") return;
    if (
      !(await askQuestion(
        `¿Confirmas cancelar la solicitud ${folio} por ${request.requestedQty} pieza(s)? Las piezas volverán a estar disponibles.`,
      ))
    )
      return;
    setRepairRequests((x) => x.filter((r) => r.requestFolio !== folio));
    avisar(
      `${folio}: solicitud cancelada; ${request.requestedQty} pieza(s) liberadas`,
    );
  };
  const createProviderOutboundRequest = (input: {
    sku: string;
    product: string;
    provider: string;
    requestedQty: number;
  }) => {
    const requestFolio = `FSP-260828-${String(providerOutboundRequests.length + 2).padStart(4, "0")}`;
    setProviderOutboundRequests((current) => [
      {
        ...input,
        requestFolio,
        requestedAt: "28 ago 2026 · Ahora",
        status: "Solicitada",
      },
      ...current,
    ]);
    avisar(`${requestFolio}: solicitud generada en Salida a proveedor`);
  };
  const cancelProviderOutboundRequest = async (folio: string) => {
    const request = providerOutboundRequests.find(
      (item) => item.requestFolio === folio,
    );
    if (
      !request ||
      !(await askQuestion(
        `¿Confirmas cancelar ${folio}? Se liberarán ${request.requestedQty} pieza(s) del inventario comprometido.`,
      ))
    )
      return;
    setProviderOutboundRequests((current) =>
      current.filter((item) => item.requestFolio !== folio),
    );
    avisar(`${folio}: solicitud cancelada y existencia liberada`);
  };
  const transferProviderOutboundRequest = (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => {
    const request = providerOutboundRequests.find(
      (item) => item.requestFolio === folio,
    );
    if (!request || request.status === "Transferida") return;
    const withdrawn = scans.reduce(
      (byLocation, scan) => {
        byLocation[scan.location] = (byLocation[scan.location] || 0) + 1;
        return byLocation;
      },
      {} as Record<string, number>,
    );
    setWarehouseStock((current) =>
      current
        .map((row) =>
          row.type === "Proveedor" && withdrawn[row.location]
            ? { ...row, qty: Math.max(0, row.qty - withdrawn[row.location]) }
            : row,
        )
        .filter((row) => row.qty > 0),
    );
    setProviderOutboundRequests((current) =>
      current.map((item) =>
        item.requestFolio === folio
          ? { ...item, status: "Transferida" }
          : item,
      ),
    );
    avisar(`${folio}: salida a proveedor confirmada sin duplicar registros`);
  };
  const transferRepairRequest = (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => {
    const request = repairRequests.find((r) => r.requestFolio === folio);
    if (!request) return;
    if (request.status === "Transferida") {
      avisar(
        `${folio}: la solicitud ya fue transferida; no se generaron registros duplicados`,
      );
      return;
    }
    const now = "26 ago 2026 · Ahora",
      withdrawn = scans.reduce(
        (a, s) => ((a[s.location] = (a[s.location] || 0) + 1), a),
        {} as Record<string, number>,
      ),
      incoming = request.warrantyFolios.map((warrantyFolio, i) => ({
        pieceId: `PZA-${warrantyFolio}-${String(i + 1).padStart(2, "0")}`,
        requestFolio: folio,
        warrantyFolio,
        sku: request.sku,
        product: request.product,
        originLocation: scans[i]?.location || "REP-A-01",
        technician: request.technician,
        status: "Asignada al técnico" as RepairPieceStatus,
        transferredAt: now,
        elapsedSeconds: 0,
        startedAt: undefined,
        qualityReturn: false,
        qualityReason: undefined,
        branch: i % 2 ? "Zapopan Norte" : "GDL Centro",
        requestedAt: request.requestedAt,
      }));
    setWarehouseStock((rows) =>
      rows.map((r) =>
        r.sku === request.sku && withdrawn[r.location]
          ? { ...r, qty: Math.max(0, r.qty - withdrawn[r.location]) }
          : r,
      ),
    );
    setRepairRequests((x) =>
      x.map((r) =>
        r.requestFolio === folio ? { ...r, status: "Transferida" } : r,
      ),
    );
    setRepairPieces((current) => {
      const incomingByFolio = new Map(
        incoming.map((p) => [p.warrantyFolio, p]),
      );
      const updated = current.map((p) =>
          incomingByFolio.has(p.warrantyFolio)
            ? { ...p, ...incomingByFolio.get(p.warrantyFolio)! }
            : p,
        ),
        existing = new Set(current.map((p) => p.warrantyFolio));
      return [
        ...incoming.filter((p) => !existing.has(p.warrantyFolio)),
        ...updated,
      ];
    });
    avisar(
      `${folio}: transferencia confirmada; ${request.requestedQty} registro(s) únicos asignados a ${request.technician}`,
    );
  };
  const updateRepairPiece = (pieceId: string, update: Partial<RepairPiece>) =>
    setRepairPieces((x) =>
      x.map((p) => (p.pieceId === pieceId ? { ...p, ...update } : p)),
    );
  const storeWarehouseFolios = (folios: string[]) => {
    const entering = warehouseQueue.filter((i) => folios.includes(i.folio));
    setStoredRequests((x) => [...new Set([...x, ...folios])]);
    setWarehouseStock((rows) => {
      const next = [...rows];
      entering.forEach((item) => {
        const type =
            item.destination === "A reparación" ? "Reparación" : "Proveedor",
          location = type === "Reparación" ? "REP-02-B" : "PROV-07-A",
          found = next.findIndex(
            (r) => r.sku === item.sku && r.location === location,
          );
        if (found >= 0)
          next[found] = { ...next[found], qty: next[found].qty + 1 };
        else
          next.push({
            sku: item.sku,
            product: item.producto,
            provider:
              type === "Reparación"
                ? "Proveedor relacionado"
                : "Proveedor por confirmar",
            location,
            qty: 1,
            cost: 0,
            type,
          });
      });
      return next;
    });
    avisar(`${folios.length} pieza(s) ingresadas e inventario actualizado`);
  };
  const resolveQuality = async (
    piece: RepairPiece,
    action: "approved" | "return" | "rejected",
    reason?: string,
  ) => {
    const label =
      action === "approved"
        ? "aprobar la pieza y enviarla a Armado"
        : action === "return"
          ? "devolverla al técnico para retrabajo"
          : "rechazarla y enviarla a destrucción";
    if (
      !(await askQuestion(`¿Confirmas ${label} para ${piece.warrantyFolio}?`))
    )
      return;
    if (action === "approved")
      updateRepairPiece(piece.pieceId, { status: "Calidad aprobada" });
    if (action === "return")
      updateRepairPiece(piece.pieceId, {
        status: "Asignada al técnico",
        qualityReturn: true,
        qualityReason: reason,
        startedAt: undefined,
        finishedAt: undefined,
      });
    if (action === "rejected") {
      updateRepairPiece(piece.pieceId, {
        status: "Rechazada por calidad",
        qualityReason: reason,
      });
      setRoutedRequests((x) => [
        ...x,
        {
          folio: piece.warrantyFolio,
          sku: piece.sku,
          producto: piece.product,
          sucursal: piece.branch || "GDL Centro",
          caja: "Transferencia Calidad",
          destination: "A destrucción",
          origin: "Calidad",
        },
      ]);
    }
    avisar(
      action === "approved"
        ? `${piece.warrantyFolio}: transferida a Armado`
        : action === "return"
          ? `${piece.warrantyFolio}: devuelta a Reparación con tiempo acumulado`
          : `${piece.warrantyFolio}: enviada a Destrucción desde Calidad`,
    );
  };
  const actualizar = (id: string, u: Partial<Caso>) => {
    setCasos((x) => x.map((c) => (c.id === id ? { ...c, ...u } : c)));
    setSel((c) => (c?.id === id ? { ...c, ...u } : c));
  };
  const crearDesdeBot = (c: Caso) => {
    const existente = casos.find((x) => x.id === c.id);
    if (existente) {
      setVista("Solicitudes");
      setSel(existente);
      avisar("La solicitud del bot ya está en la bandeja");
      return;
    }
    setCasos((x) => [c, ...x]);
    setSel(c);
    setVista("Solicitudes");
    avisar(`Solicitud ${c.id} incorporada a la bandeja`);
  };
  const resolverBot = (id: string, u: Partial<Caso>) => {
    const original = casos.find((c) => c.id === id);
    actualizar(id, u);
    if (original)
      setBotOutcomes((x) => ({ ...x, [id]: { ...original, ...u } }));
    setBotFlow(null);
    avisar(
      u.resultado === "Procede"
        ? "Solicitud aplicada y dictamen generado"
        : "Solicitud rechazada y dictamen generado",
    );
  };
  function crear(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      folio = String(f.get("factura")),
      resultado = String(f.get("resultado")) as Caso["resultado"],
      tipo = ((
        e.currentTarget.querySelector(
          ".application-row select",
        ) as HTMLSelectElement | null
      )?.value || "Aplicado a factura") as Aplicacion,
      importe =
        f.get("bateria") === "on"
          ? Number(f.get("batteryCredit") || 0).toLocaleString("es-MX", {
              style: "currency",
              currency: "MXN",
            })
          : facturas.find((x) => x.folio === folio)?.precio || "$0.00";
    const c: Caso = {
      id: `GE-260824-${1843 + casos.length}`,
      sucursal: String(f.get("sucursal")),
      cliente: String(f.get("cliente")),
      producto: String(f.get("producto")),
      sku: String(f.get("sku")),
      canal: String(f.get("canal")) as Caso["canal"],
      estado: "Diagnóstico completado",
      tiempo: "Ahora",
      recibido: false,
      bateria: f.get("bateria") === "on",
      resultado,
      observacion: String(f.get("observacion")),
      notaCredito:
        resultado === "Procede"
          ? `NC-${String(1843 + casos.length).padStart(4, "0")}`
          : undefined,
      tipoAplicacion: resultado === "Procede" ? tipo : undefined,
      importeBonificacion: resultado === "Procede" ? importe : undefined,
      factura: folio,
      fechaSolicitud: "25 ago 2026 · Ahora",
      usuario: "Andrea Martínez",
    };
    setInvoiceStock((s) => {
      const key = claveStock(folio, c.sku);
      return { ...s, [key]: Math.max(0, (s[key] || 0) - 1) };
    });
    setCasos((x) => [c, ...x]);
    setSel(c);
    setModal(false);
    setVista("Solicitudes");
    imprimirDictamen(c);
    avisar(
      c.resultado === "Procede"
        ? `Solicitud aplicada correctamente, folio de la nota de crédito ${c.notaCredito}`
        : "Solicitud rechazada y dictamen generado",
    );
  }
  function crearDesdeMostrador(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      folio = String(f.get("factura")),
      resultado = String(f.get("resultado")) as Caso["resultado"],
      tipo = ((
        e.currentTarget.querySelector(
          ".application-row select",
        ) as HTMLSelectElement | null
      )?.value || "Aplicado a factura") as Aplicacion,
      importe =
        f.get("bateria") === "on"
          ? Number(f.get("batteryCredit") || 0).toLocaleString("es-MX", {
              style: "currency",
              currency: "MXN",
            })
          : facturas.find((x) => x.folio === folio)?.precio || "$0.00";
    const c: Caso = {
      id: `GE-260901-${5100 + casos.length}`,
      sucursal: String(f.get("sucursal")),
      cliente: String(f.get("cliente")),
      producto: String(f.get("producto")),
      sku: String(f.get("sku")),
      canal: String(f.get("canal")) as Caso["canal"],
      estado: "Diagnóstico completado",
      tiempo: "Ahora",
      recibido: false,
      bateria: f.get("bateria") === "on",
      resultado,
      observacion: String(f.get("observacion")),
      notaCredito:
        resultado === "Procede"
          ? `NC-${String(5100 + casos.length).padStart(4, "0")}`
          : undefined,
      tipoAplicacion: resultado === "Procede" ? tipo : undefined,
      importeBonificacion: resultado === "Procede" ? importe : undefined,
      factura: folio,
      fechaSolicitud: "1 sep 2026 · Ahora",
      origenMostrador: true,
      custodia: "Con el cliente",
      usuario: "Luis Martínez",
    };
    setInvoiceStock((s) => {
      const key = claveStock(folio, c.sku);
      return { ...s, [key]: Math.max(0, (s[key] || 0) - 1) };
    });
    setCasos((x) => [c, ...x]);
    imprimirDictamen(c);
    avisar(
      c.resultado === "Procede"
        ? `Solicitud aplicada correctamente, folio de la nota de crédito ${c.notaCredito}`
        : "Solicitud rechazada y dictamen generado",
    );
  }
  function crearDevolucion(
    input: Omit<
      Devolucion,
      "folio" | "notaCredito" | "estado" | "custodia" | "creadaEn" | "usuario"
    >,
  ) {
    const n = devoluciones.length,
      d: Devolucion = {
        ...input,
        folio: `DEV-260901-${String(1001 + n).padStart(4, "0")}`,
        notaCredito: `NC-${String(6001 + n).padStart(4, "0")}`,
        estado: "Capturada",
        custodia: "En mostrador",
        creadaEn: "1 sep 2026 · Ahora",
        usuario: "Luis Martínez",
      };
    setDevoluciones((x) => [d, ...x]);
    setInvoiceStock((s) => {
      const next = { ...s };
      for (const item of d.items) {
        if (item.cantidad > 0) {
          const key = claveStock(d.documento, item.sku);
          next[key] = Math.max(0, (next[key] || 0) - item.cantidad);
        }
      }
      return next;
    });
    imprimirNotaCreditoDevolucion(d);
    avisar(`Devolución ${d.folio} capturada, nota de crédito ${d.notaCredito}`);
  }
  async function entregarGarantiaAAlmacen(id: string) {
    if (!(await askQuestion(`¿Confirmas entregar ${id} a Garantías Sucursal?`)))
      return;
    setCasos((x) =>
      x.map((c) =>
        c.id === id
          ? { ...c, entregadoAlmacen: true, custodia: "En sucursal" }
          : c,
      ),
    );
    avisar(`${id} entregado a Garantías Sucursal`);
  }
  async function entregarDevolucionAAlmacen(folio: string) {
    if (
      !(await askQuestion(`¿Confirmas entregar la devolución ${folio} a Garantías Sucursal?`))
    )
      return;
    setDevoluciones((x) =>
      x.map((d) =>
        d.folio === folio ? { ...d, estado: "Entregada a almacén" } : d,
      ),
    );
    avisar(`Devolución ${folio} entregada a Garantías Sucursal`);
  }
  async function recibirDevolucionEnAlmacen(folio: string) {
    if (
      !(await askQuestion(`¿Confirmas la recepción de la devolución ${folio} en el almacén de la sucursal?`))
    )
      return;
    setDevoluciones((x) =>
      x.map((d) =>
        d.folio === folio
          ? { ...d, estado: "Recibida en almacén", custodia: "En almacén" }
          : d,
      ),
    );
  }
  const titulos: Record<string, [string, string]> = {
    Inicio: [
      "Indicadores",
      "Monitorea los principales indicadores operativos, financieros y comerciales.",
    ],
    Solicitudes: [
      "Solicitudes de garantía",
      "Atiende cualquier sucursal desde una sola bandeja de trabajo.",
    ],
    "Recepción y arribo": [
      "Recepción de garantías",
      "Concilia por sucursal y caja cada producto recibido en Garantías Central.",
    ],
    Diagnóstico: [
      "Diagnóstico de garantías",
      "Evalúa técnicamente cada pieza recibida.",
    ],
    Operación: [
      "Disposición de garantías",
      "Autoriza el destino final de las piezas diagnosticadas.",
    ],
    Almacén: [
      "Almacén de garantías",
      "Controla piezas enviadas a proveedor o pendientes de reparación.",
    ],
    Reparación: [
      "Reparación y Calidad",
      "Controla el seguimiento técnico, las validaciones de Calidad, el armado y las alertas de recurrencia.",
    ],
    Incidencias: [
      "Incidencias",
      "Aclara diferencias de recepción con las sucursales de origen.",
    ],
  };
  if (!portal)
    return (
      <>
        <PortalSelector
          onSelect={(p) => {
            if (p === "central") setVista("Solicitudes");
            setPortal(p);
          }}
        />
        <QuestionModalHost />
      </>
    );
  if (portal === "sucursal")
    return (
      <>
        <SucursalPortal
          casos={casos}
          qualityIncidents={qualityIncidents}
          devoluciones={devoluciones}
          onRecibirDevolucion={recibirDevolucionEnAlmacen}
          onBack={() => setPortal(null)}
        />
        <QuestionModalHost />
        <InfoModalHost />
      </>
    );
  if (portal === "mostrador")
    return (
      <>
        <MostradorPortal
          casos={casos}
          devoluciones={devoluciones}
          stock={invoiceStock}
          onCrearGarantia={crearDesdeMostrador}
          onCrearDevolucion={crearDevolucion}
          onEntregarGarantia={entregarGarantiaAAlmacen}
          onEntregarDevolucion={entregarDevolucionAAlmacen}
          onBack={() => setPortal(null)}
        />
        <QuestionModalHost />
        <InfoModalHost />
      </>
    );
  return (
    <div className={`shell ${menuCollapsed ? "menu-collapsed" : ""}`}>
      <aside>
        <button
          className="side-collapse"
          onClick={() => setMenuCollapsed((x) => !x)}
          aria-label={menuCollapsed ? "Expandir menú" : "Contraer menú"}
        >
          {menuCollapsed ? "›" : "‹"}
        </button>
        <div className="marca">
          <b>GX</b>
          <span>
            <strong>Garantías</strong>
            <small>Central</small>
          </span>
        </div>
        <nav>
          {[
            ["Inicio", "▦", "Indicadores"],
            ["Solicitudes", "◎", "Solicitudes"],
            ["Almacén", "▤", "Almacén de garantías"],
            ["Reparación", "⚙", "Reparación y Calidad"],
            ["Incidencias", "!", "Incidencias"],
          ].map(([n, i, label]) => (
            <button
              key={n}
              className={vista === n ? "activo" : ""}
              onClick={() => setVista(n)}
            >
              <i>{i}</i>
              <span>{label}</span>
              {n === "Solicitudes" && <em>12</em>}
              {n === "Incidencias" && <em>3</em>}
            </button>
          ))}
        </nav>
        <div className="usuario">
          <b>AM</b>
          <span>
            <strong>Andrea Martínez</strong>
            <small>Ejecutivo de Garantías</small>
          </span>
        </div>
      </aside>
      <main>
        <header>
          {vista !== "Solicitudes" && (
            <label>
              ⌕ <input placeholder="Buscar folio, cliente, SKU…" />
            </label>
          )}
          <button className="top-module-switch" onClick={() => setPortal(null)}>
            ⇄ Cambiar módulo
          </button>
          <span className="header-spacer" />
          <button>?</button>
          <button>♢</button>
          <button className="primario" onClick={() => setModal(true)}>
            ＋ Nueva solicitud
          </button>
        </header>
        <div className="contenido">
          <div className="titulo">
            <div>
              <small>LUNES, 24 DE AGOSTO · GARANTÍAS CENTRAL</small>
              <h1>{titulos[vista][0]}</h1>
              <p>{titulos[vista][1]}</p>
            </div>
            <button onClick={() => avisar("Información actualizada")}>
              ↻ Actualizar
            </button>
          </div>
          {vista === "Inicio" && <CentralDashboard />}
          {vista === "Solicitudes" && (
            <section className="solicitudes solicitudes-full">
              <div className="panel">
                <div className="request-toolbar">
                  <div>
                    <small>OPERACIÓN DE GARANTÍAS</small>
                    <h2>Bandeja centralizada</h2>
                    <p>
                      Consulta las solicitudes o abre el detalle de recepción de
                      cajas.
                    </p>
                  </div>
                  <button
                    className="pending-reception-card"
                    onClick={() => setReceptionModal(true)}
                    aria-label="Abrir detalle de recepción"
                  >
                    <i>↓</i>
                    <span>
                      <small>PENDIENTE DE RECIBIR</small>
                      <b>{pendingReception}</b>
                      <em>solicitudes en tránsito</em>
                    </span>
                    <strong>Ver detalle →</strong>
                  </button>
                  <button
                    className="pending-diagnosis-card"
                    onClick={() => setDiagnosisModal(true)}
                    aria-label="Abrir diagnóstico de garantías"
                  >
                    <i>◇</i>
                    <span>
                      <small>PENDIENTES DE DIAGNÓSTICO</small>
                      <b>{pendingDiagnosisItems.length}</b>
                      <em>solicitudes recibidas</em>
                    </span>
                    <strong>Diagnosticar →</strong>
                  </button>
                  <button
                    className="queue-card destruction"
                    onClick={() => setQueueModal("destruction")}
                  >
                    <i>×</i>
                    <span>
                      <small>A DESTRUCCIÓN</small>
                      <b>{destructionQueue.length}</b>
                      <em>
                        {
                          destructionQueue.filter((i) => i.origin === "Calidad")
                            .length
                        }{" "}
                        Calidad ·{" "}
                        {
                          destructionQueue.filter((i) => i.origin !== "Calidad")
                            .length
                        }{" "}
                        Diagnóstico
                      </em>
                    </span>
                    <strong>Gestionar →</strong>
                  </button>
                  <button
                    className="queue-card return"
                    onClick={() => setQueueModal("return")}
                  >
                    <i>↩</i>
                    <span>
                      <small>RETORNO</small>
                      <b>{returnQueue.length}</b>
                      <em>solicitudes pendientes</em>
                    </span>
                    <strong>Gestionar →</strong>
                  </button>
                </div>
                <div className="filtros request-filters">
                  <label className="search-filter">
                    <span>Buscar</span>
                    <div>
                      ⌕{" "}
                      <input
                        value={buscar}
                        onChange={(e) => setBuscar(e.target.value)}
                        placeholder="Folio, cliente o SKU…"
                      />
                    </div>
                  </label>
                  <PredictiveFilter
                    label="Sucursal"
                    value={sucursal}
                    options={[
                      "Todas",
                      ...[...new Set(casos.map((c) => c.sucursal))],
                    ]}
                    onChange={setSucursal}
                  />
                  <PredictiveFilter
                    label="Estado de la solicitud"
                    value={estadoSolicitud}
                    options={["Todos", "Aplicada", "Rechazada", "Pendiente"]}
                    onChange={setEstadoSolicitud}
                  />
                  <PredictiveFilter
                    label="Estado de custodia"
                    value={estadoCustodia}
                    options={[
                      "Todos",
                      "Garantías Central",
                      ...[
                        ...new Set(
                          casos.map((c) => c.custodia || "Con el cliente"),
                        ),
                      ],
                    ]}
                    onChange={setEstadoCustodia}
                  />
                  <PredictiveFilter
                    label="Número de caja"
                    value={cajaFiltro}
                    options={[
                      "Todas",
                      "Pendiente",
                      ...[
                        ...new Set(
                          casos.flatMap((c) => (c.caja ? [c.caja] : [])),
                        ),
                      ],
                    ]}
                    onChange={setCajaFiltro}
                  />
                  <label className="date-range-filter">
                    <span>Fecha desde</span>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </label>
                  <label className="date-range-filter">
                    <span>Fecha hasta</span>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </label>
                </div>
                <Tabla
                  items={filtrados}
                  sel={sel}
                  elegir={setSel}
                  confirmar={setBotFlow}
                  receivedBoxes={receivedBoxes}
                  incidentFolios={receptionIncidentFolios}
                  resolvedIncidentFolios={resolvedIncidentFolios}
                  onIncidentDetail={setIncidentDetail}
                />
              </div>
            </section>
          )}
          {vista === "Almacén" && (
            <IntegratedWarehouseHub
              items={warehouseQueue}
              onStored={storeWarehouseFolios}
              avisar={avisar}
              requests={repairRequests}
              providerRequests={providerOutboundRequests}
              stock={warehouseStock}
              onTransfer={transferRepairRequest}
              onProviderTransfer={transferProviderOutboundRequest}
            />
          )}
          {vista === "Reparación" && (
            <section className="repair-quality-hub">
              <nav className="repair-quality-module-tabs">
                <button
                  className={repairQualityTab === "repair" ? "active" : ""}
                  onClick={() => setRepairQualityTab("repair")}
                >
                  <i>⚙</i>
                  <span>
                    <b>Reparación de garantías</b>
                    <small>
                      Inventario, transferencias y seguimiento técnico
                    </small>
                  </span>
                </button>
                <button
                  className={repairQualityTab === "quality" ? "active" : ""}
                  onClick={() => setRepairQualityTab("quality")}
                >
                  <i>△</i>
                  <span>
                    <b>Calidad</b>
                    <small>Validación, armado y alertas de recurrencia</small>
                  </span>
                </button>
              </nav>
              {repairQualityTab === "repair" ? (
                <IntegratedRepairView
                  avisar={avisar}
                  requests={repairRequests}
                  pieces={repairPieces}
                  stock={warehouseStock}
                  onRequest={createRepairRequest}
                  onCancelRequest={cancelRepairRequest}
                  onUpdatePiece={updateRepairPiece}
                />
              ) : (
                <QualityView
                  pieces={repairPieces.filter(
                    (p) =>
                      p.status === "En calidad" ||
                      p.status === "Calidad aprobada",
                  )}
                  onResolve={resolveQuality}
                  avisar={avisar}
                  approved={aprobado}
                  setApproved={setAprobado}
                  stock={warehouseStock}
                  providerRequests={providerOutboundRequests}
                  onProviderRequest={createProviderOutboundRequest}
                  onCancelProviderRequest={cancelProviderOutboundRequest}
                  onCreateIncident={(incident) =>
                    setQualityIncidents((current) =>
                      current.some((item) => item.id === incident.id)
                        ? current
                        : [incident, ...current],
                    )
                  }
                />
              )}
            </section>
          )}
          {vista === "Incidencias" && (
            <IncidentsView
              avisar={avisar}
              externalFolios={receptionIncidentFolios}
              externalQualityIncidents={qualityIncidents}
            />
          )}
        </div>
      </main>
      {modal && (
        <NewRequestModal
          onClose={() => setModal(false)}
          onSubmit={crear}
          stock={invoiceStock}
        />
      )}{" "}
      {receptionModal && (
        <div
          className="reception-modal request-card-modal"
          role="dialog"
          aria-modal="true"
        >
          <section>
            <header>
              <div>
                <small>SOLICITUDES DE GARANTÍA</small>
                <h2>Detalle de recepción</h2>
                <p>
                  Selecciona una caja y confirma únicamente los productos
                  recibidos.
                </p>
              </div>
              <button onClick={() => setReceptionModal(false)}>×</button>
            </header>
            <main>
              <EnhancedReceptionArrival
                avisar={avisar}
                receivedBoxes={receivedBoxes}
                onReceived={(numero) =>
                  setReceivedBoxes((x) =>
                    x.includes(numero) ? x : [...x, numero],
                  )
                }
                onIncident={(folios) =>
                  setReceptionIncidentFolios((x) => [
                    ...new Set([...x, ...folios]),
                  ])
                }
                onReturn={(item) =>
                  setRoutedRequests((current) =>
                    current.some((row) => row.folio === item.folio)
                      ? current.map((row) =>
                          row.folio === item.folio
                            ? { ...row, destination: "Retorno a Sucursal" }
                            : row,
                        )
                      : [
                          ...current,
                          {
                            folio: item.folio,
                            sku: item.sku,
                            producto: item.producto,
                            sucursal: item.sucursal,
                            caja: item.caja,
                            destination: "Retorno a Sucursal",
                            origin: "Incidencia",
                            note: item.note,
                          },
                        ],
                  )
                }
              />
            </main>
            <footer>
              <span>
                <b>{pendingReception}</b> solicitudes pendientes de recibir
              </span>
              <button onClick={() => setReceptionModal(false)}>
                Cerrar detalle
              </button>
            </footer>
          </section>
        </div>
      )}{" "}
      {diagnosisModal && (
        <DiagnosisModalFlow
          items={pendingDiagnosisItems}
          onClose={() => setDiagnosisModal(false)}
          onComplete={(item, destination) => {
            setDiagnosedRequests((x) =>
              x.includes(item.folio) ? x : [...x, item.folio],
            );
            setRoutedRequests((x) => [...x, { ...item, destination }]);
          }}
          avisar={avisar}
        />
      )}{" "}
      {queueModal && (
        <DispositionQueueModal
          kind={queueModal}
          items={queueModal === "destruction" ? destructionQueue : returnQueue}
          onClose={() => setQueueModal(null)}
          onRemove={(folios) =>
            setRoutedRequests((x) => x.filter((i) => !folios.includes(i.folio)))
          }
          onMove={(folios, destination) =>
            setRoutedRequests((x) =>
              x.map((i) =>
                folios.includes(i.folio) ? { ...i, destination } : i,
              ),
            )
          }
          avisar={avisar}
        />
      )}{" "}
      {botFlow && (
        <BotWarrantyFlow
          caso={botFlow}
          onClose={() => setBotFlow(null)}
          onResolve={resolverBot}
        />
      )}{" "}
      {incidentDetail && (
        <div className="incident-detail-modal">
          <section>
            <header>
              <div>
                <small>DETALLE DE INCIDENCIA</small>
                <h2>{incidentDetail}</h2>
                <p>Diferencia detectada durante la recepción física.</p>
              </div>
              <button onClick={() => setIncidentDetail(null)}>×</button>
            </header>
            <main>
              <span
                className={
                  resolvedIncidentFolios.includes(incidentDetail)
                    ? "resolved"
                    : "open"
                }
              >
                <small>ESTADO</small>
                <b>
                  {resolvedIncidentFolios.includes(incidentDetail)
                    ? "Resuelta"
                    : "En aclaración"}
                </b>
              </span>
              <article>
                <small>REPORTE DE GARANTÍAS CENTRAL</small>
                <p>
                  El producto no fue localizado durante la conciliación del
                  contenido de la caja.
                </p>
              </article>
              <article>
                <small>RESPUESTA DE SUCURSAL</small>
                <p>
                  La sucursal valida evidencias de empaque y prepara la
                  aclaración correspondiente.
                </p>
              </article>
              {resolvedIncidentFolios.includes(incidentDetail) ? (
                <article>
                  <small>RESOLUCIÓN</small>
                  <p>{incidentResolutionNotes[incidentDetail]}</p>
                </article>
              ) : (
                <label className="incident-resolution-field">
                  <span>Observación de resolución</span>
                  <textarea
                    value={incidentResolutionNotes[incidentDetail] || ""}
                    onChange={(e) =>
                      setIncidentResolutionNotes((x) => ({
                        ...x,
                        [incidentDetail]: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Describe la aclaración, evidencia validada y acuerdo de cierre…"
                  />
                  <small>
                    La observación es obligatoria y quedará registrada en el
                    historial de la incidencia.
                  </small>
                </label>
              )}
            </main>
            <footer>
              <button onClick={() => setIncidentDetail(null)}>Cerrar</button>
              {!resolvedIncidentFolios.includes(incidentDetail) && (
                <button
                  className="primario"
                  disabled={!incidentResolutionNotes[incidentDetail]?.trim()}
                  onClick={async () => {
                    const note =
                      incidentResolutionNotes[incidentDetail]?.trim();
                    if (!note) return;
                    if (
                      !(await askQuestion(
                        `¿Confirmas resolver la incidencia de ${incidentDetail} con la observación capturada?`,
                      ))
                    )
                      return;
                    setIncidentResolutionNotes((x) => ({
                      ...x,
                      [incidentDetail]: note,
                    }));
                    setResolvedIncidentFolios((x) => [
                      ...new Set([...x, incidentDetail]),
                    ]);
                    avisar(`Incidencia ${incidentDetail} resuelta`);
                  }}
                >
                  Resolver incidencia
                </button>
              )}
            </footer>
          </section>
        </div>
      )}{" "}
      {toast && <div className="toast">✓　{toast}</div>}
      <FreshchatSimulator onCreate={crearDesdeBot} outcomes={botOutcomes} />
      <QuestionModalHost />
      <BatteryGuideHost />
      <InfoModalHost />
    </div>
  );
}
type BotChat = {
  key: string;
  folio: string;
  initials: string;
  cliente: string;
  clienteId: string;
  sucursal: string;
  producto: string;
  sku: string;
  canal: "Retail" | "No Retail";
  bateria?: boolean;
  facturaCapturada: string;
  meses?: number;
  evidencias: number;
  originalDisponible: boolean;
  alternativas: {
    folio: string;
    fecha: string;
    sucursal: string;
    disponibles: number;
    importe: string;
  }[];
  mensaje: string;
};
const botChats: BotChat[] = [
  {
    key: "chat-1",
    folio: "GE-260825-1854",
    initials: "MG",
    cliente: "María González",
    clienteId: "1",
    sucursal: "Zapopan Norte",
    producto: "Batería LTH H-47",
    sku: "LTH-H47",
    canal: "Retail",
    bateria: true,
    facturaCapturada: "FA-803944",
    meses: 19,
    evidencias: 2,
    originalDisponible: true,
    alternativas: [],
    mensaje: "Necesito garantía de una batería que dejó de retener carga.",
  },
  {
    key: "chat-2",
    folio: "GE-260825-1855",
    initials: "RV",
    cliente: "Refaccionaria El Volante",
    clienteId: "30214",
    sucursal: "GDL Centro",
    producto: "Alternador Bosch 12V",
    sku: "BO-AL394",
    canal: "No Retail",
    facturaCapturada: "FA-804210",
    evidencias: 3,
    originalDisponible: false,
    alternativas: [
      {
        folio: "FA-804211",
        fecha: "20 ago 2026",
        sucursal: "GDL Centro",
        disponibles: 2,
        importe: "$3,480.00",
      },
      {
        folio: "FA-799845",
        fecha: "02 ago 2026",
        sucursal: "Zapopan Norte",
        disponibles: 1,
        importe: "$3,420.00",
      },
    ],
    mensaje: "El alternador dejó de cargar; envié la factura y fotografías.",
  },
  {
    key: "chat-3",
    folio: "",
    initials: "JR",
    cliente: "José Ramírez",
    clienteId: "1",
    sucursal: "Aguascalientes Sur",
    producto: "Sensor de oxígeno Denso",
    sku: "DE-2341",
    canal: "Retail",
    facturaCapturada: "FA-790112",
    evidencias: 1,
    originalDisponible: false,
    alternativas: [],
    mensaje:
      "Solicito garantía del sensor; el vehículo mantiene encendido el testigo.",
  },
];
function FreshchatSimulator({
  onCreate,
  outcomes,
}: {
  onCreate: (c: Caso) => void;
  outcomes: Record<string, Caso>;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState("chat-1"),
    [validated, setValidated] = useState<Record<string, boolean>>({}),
    [selectedInvoice, setSelectedInvoice] = useState<Record<string, string>>(
      {},
    ),
    [created, setCreated] = useState<Record<string, boolean>>({}),
    [replies, setReplies] = useState<Record<string, string>>({}),
    [messages, setMessages] = useState<Record<string, string[]>>({}),
    [attached, setAttached] = useState<Record<string, boolean>>({}),
    [resolved, setResolved] = useState<Record<string, boolean>>({});
  const chat = botChats.find((c) => c.key === active)!,
    outcome = chat.folio ? outcomes[chat.folio] : undefined,
    chosen = chat.originalDisponible
      ? chat.facturaCapturada
      : selectedInvoice[chat.key],
    canCreate = chat.originalDisponible || Boolean(chosen),
    reply = replies[active] || "",
    chatMessages = messages[active] || [];
  const validateAndCreate = () => {
    setValidated((x) => ({ ...x, [active]: true }));
    if (!canCreate || created[active]) return;
    const caso: Caso = {
      id: chat.folio,
      sucursal: chat.sucursal,
      cliente: chat.cliente,
      producto: chat.producto,
      sku: chat.sku,
      canal: chat.canal,
      estado: "Nueva",
      tiempo: "Ahora",
      recibido: false,
      bateria: chat.bateria,
      factura: chosen,
      fechaSolicitud: "25 ago 2026 · Ahora",
      origenBot: true,
    };
    onCreate(caso);
    setCreated((x) => ({ ...x, [active]: true }));
  };
  const send = () => {
    if (!reply.trim() || resolved[active]) return;
    setMessages((x) => ({
      ...x,
      [active]: [...(x[active] || []), reply.trim()],
    }));
    setReplies((x) => ({ ...x, [active]: "" }));
  };
  const unresolved = botChats.filter((c) => !resolved[c.key]).length;
  return (
    <div
      className={`freshchat-sim agent-chat multi-chat ${open ? "open" : ""}`}
    >
      <button className="freshchat-launcher" onClick={() => setOpen(!open)}>
        <i>▣</i>
        <span>
          <b>Bandeja Freshchat</b>
          <small>{unresolved} conversaciones por atender</small>
        </span>
        <em>{open ? "×" : unresolved}</em>
      </button>
      {open && (
        <section>
          <header>
            <div>
              <b>Atención de Garantías</b>
              <small>Agente: Andrea Martínez · Disponible</small>
            </div>
            <button onClick={() => setOpen(false)}>×</button>
          </header>
          <div className="chat-layout">
            <aside className="chat-inbox">
              <small>CONVERSACIONES</small>
              {botChats.map((c) => (
                <button
                  className={active === c.key ? "active" : ""}
                  key={c.key}
                  onClick={() => setActive(c.key)}
                >
                  <i>{c.initials}</i>
                  <span>
                    <b>{c.cliente}</b>
                    <small>{c.producto}</small>
                  </span>
                  <em
                    className={
                      resolved[c.key] ? "done" : created[c.key] ? "created" : ""
                    }
                  >
                    {resolved[c.key]
                      ? "✓"
                      : created[c.key]
                        ? "Solicitud"
                        : "Nueva"}
                  </em>
                </button>
              ))}
            </aside>
            <div className="agent-conversation">
              <div className="agent-client">
                <span>{chat.initials}</span>
                <div>
                  <strong>{chat.cliente}</strong>
                  <small>
                    ClienteID {chat.clienteId} · {chat.canal} · hace 2 min
                  </small>
                </div>
                <em className={resolved[active] ? "resolved" : ""}>
                  {resolved[active] ? "Resuelta" : "Nueva"}
                </em>
              </div>
              <div className="customer-message">
                <p>{chat.mensaje}</p>
                <dl>
                  <div>
                    <dt>SKU</dt>
                    <dd>{chat.sku}</dd>
                  </div>
                  <div>
                    <dt>Factura capturada</dt>
                    <dd>{chat.facturaCapturada}</dd>
                  </div>
                  {chat.meses && (
                    <div>
                      <dt>Meses de uso</dt>
                      <dd>{chat.meses} meses</dd>
                    </div>
                  )}
                  <div>
                    <dt>Evidencia</dt>
                    <dd>
                      {chat.evidencias}{" "}
                      {chat.evidencias === 1 ? "fotografía" : "fotografías"}
                    </dd>
                  </div>
                </dl>
              </div>
              {validated[active] && !chat.originalDisponible && (
                <div
                  className={
                    chat.alternativas.length
                      ? "invoice-validation alternatives"
                      : "invoice-validation unavailable"
                  }
                >
                  {chat.alternativas.length ? (
                    <>
                      <div>
                        <i>!</i>
                        <span>
                          <b>
                            La factura {chat.facturaCapturada} no tiene piezas
                            disponibles
                          </b>
                          <small>
                            Selecciona otra factura del cliente que contenga el
                            producto.
                          </small>
                        </span>
                      </div>
                      {chat.alternativas.map((f) => (
                        <label
                          className={chosen === f.folio ? "selected" : ""}
                          key={f.folio}
                        >
                          <input
                            type="radio"
                            checked={chosen === f.folio}
                            onChange={() =>
                              setSelectedInvoice((x) => ({
                                ...x,
                                [active]: f.folio,
                              }))
                            }
                          />
                          <span>
                            <b>{f.folio}</b>
                            <small>
                              {f.fecha} · {f.sucursal}
                            </small>
                          </span>
                          <em>
                            {f.disponibles}{" "}
                            {f.disponibles === 1 ? "pieza" : "piezas"}
                          </em>
                          <strong>{f.importe}</strong>
                        </label>
                      ))}
                    </>
                  ) : (
                    <>
                      <div>
                        <i>×</i>
                        <span>
                          <b>
                            No se encontraron facturas disponibles con el
                            producto ingresado
                          </b>
                          <small>
                            El cliente no cuenta con piezas disponibles de{" "}
                            {chat.sku}. No es posible generar la solicitud.
                          </small>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
              {created[active] && (
                <div className="request-created">
                  <i>✓</i>
                  <span>
                    <b>Solicitud {chat.folio} creada</b>
                    <small>
                      Disponible en Solicitudes de garantía para confirmar
                      inspección.
                    </small>
                  </span>
                </div>
              )}
              {chatMessages.map((m, i) => (
                <div className="agent-sent" key={i}>
                  <small>RESPUESTA DEL AGENTE</small>
                  <p>{m}</p>
                </div>
              ))}
              {attached[active] && outcome && (
                <button
                  className="chat-attachment"
                  onClick={() => imprimirDictamen(outcome)}
                >
                  <i>▧</i>
                  <span>
                    <b>Dictamen técnico adjunto</b>
                    <small>
                      {outcome.id} ·{" "}
                      {outcome.resultado === "Procede"
                        ? "Aprobado"
                        : "Rechazado"}{" "}
                      · Descargar PDF
                    </small>
                  </span>
                </button>
              )}
              {resolved[active] ? (
                <div className="chat-resolved">
                  <i>✓</i>
                  <span>
                    <b>Conversación resuelta</b>
                    <small>
                      El cliente recibió la respuesta y el dictamen.
                    </small>
                  </span>
                </div>
              ) : (
                <label>
                  Escribir respuesta
                  <textarea
                    value={reply}
                    onChange={(e) =>
                      setReplies((x) => ({ ...x, [active]: e.target.value }))
                    }
                    rows={2}
                    placeholder="Escribe una nueva respuesta…"
                  />
                </label>
              )}
              <div className="agent-actions chat-workflow">
                <button
                  className={created[active] ? "created" : ""}
                  disabled={
                    created[active] || (validated[active] && !canCreate)
                  }
                  onClick={validateAndCreate}
                >
                  {created[active]
                    ? `✓ ${chat.folio} creada`
                    : validated[active] && chosen
                      ? "Crear con factura seleccionada"
                      : "Crear solicitud"}
                </button>
                <button
                  disabled={!outcome || attached[active]}
                  onClick={() => setAttached((x) => ({ ...x, [active]: true }))}
                >
                  {attached[active]
                    ? "✓ Dictamen adjunto"
                    : "Adjuntar dictamen"}
                </button>
                <button
                  className="primario"
                  disabled={!reply.trim() || resolved[active]}
                  onClick={send}
                >
                  Enviar respuesta
                </button>
                <button
                  className="resolve-chat"
                  onClick={() => setResolved((x) => ({ ...x, [active]: true }))}
                >
                  {resolved[active] ? "✓ Resuelta" : "Resolver conversación"}
                </button>
              </div>
              <small className="chat-disclaimer">
                Simulación de la vista del agente. No está conectada a
                Freshchat.
              </small>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
function BotWarrantyFlow({
  caso,
  onClose,
  onResolve,
}: {
  caso: Caso;
  onClose: () => void;
  onResolve: (id: string, u: Partial<Caso>) => void;
}) {
  const [step, setStep] = useState<"inspection" | "diagnosis" | "credit">(
      "inspection",
    ),
    [checks, setChecks] = useState([false, false, false]),
    [result, setResult] = useState<"Procede" | "No procede" | null>(null),
    [observation, setObservation] = useState(""),
    [application, setApplication] = useState<Aplicacion>("Aplicado a factura"),
    [batteryBase, setBatteryBase] = useState(2650),
    [batteryMonths, setBatteryMonths] = useState(19),
    [batteryApplied, setBatteryApplied] = useState(false);
  const batteryPct =
      batteryMonths <= 12
        ? 0
        : batteryMonths <= 18
          ? 20
          : batteryMonths <= 24
            ? 35
            : batteryMonths <= 30
              ? 50
              : 65,
    batteryCredit = Math.max(0, batteryBase * (1 - batteryPct / 100)),
    amount = batteryCredit.toLocaleString("es-MX", {
      style: "currency",
      currency: "MXN",
    }),
    inspected = checks.every(Boolean) && (!caso.bateria || batteryApplied);
  const choose = (r: "Procede" | "No procede") => {
    setResult(r);
    setObservation(r === "Procede" ? obsProcede : obsNoProcede);
  };
  const applicationLegend =
    application === "Anticipo"
      ? "La bonificación fue aplicada como anticipo en su cuenta."
      : application === "Aplicado a factura"
        ? `La bonificación fue aplicada a la Factura ${caso.factura}.`
        : "La bonificación será entregada mediante un código QR de un solo uso.";
  const reject = () => {
    const update: Partial<Caso> = {
      estado: "Diagnóstico completado",
      resultado: "No procede",
      observacion: observation,
    };
    onResolve(caso.id, update);
    setTimeout(() => imprimirDictamen({ ...caso, ...update }), 100);
  };
  const apply = async () => {
    if (
      !(await askQuestion(
        `¿Confirmas la aprobación de ${caso.id}, la aplicación de la nota de crédito por ${amount} y la generación del dictamen PDF?`,
      ))
    )
      return;
    const update: Partial<Caso> = {
      estado: "Diagnóstico completado",
      resultado: "Procede",
      observacion: `${observation} ${applicationLegend}`,
      notaCredito: "NC-1854",
      tipoAplicacion: application,
      importeBonificacion: amount,
    };
    onResolve(caso.id, update);
    setTimeout(() => imprimirDictamen({ ...caso, ...update }), 100);
  };
  return (
    <div className="bot-flow">
      <section>
        <header>
          <div>
            <small>SOLICITUD DESDE FRESHCHAT · {caso.id}</small>
            <h2>
              {step === "inspection"
                ? "Confirmar inspección"
                : step === "diagnosis"
                  ? "Diagnóstico de garantía"
                  : "Confirmar nota de crédito"}
            </h2>
            <p>
              {caso.cliente} · {caso.producto}
            </p>
          </div>
          <button onClick={onClose}>×</button>
        </header>
        <div className="bot-flow-progress">
          <span className="done">1 Solicitud</span>
          <span className={step !== "inspection" ? "done" : "active"}>
            2 Inspección
          </span>
          <span
            className={
              step === "diagnosis" ? "active" : step === "credit" ? "done" : ""
            }
          >
            3 Diagnóstico
          </span>
          <span className={step === "credit" ? "active" : ""}>
            4 Aplicación
          </span>
        </div>
        {step === "inspection" && (
          <main>
            <div className="bot-source">
              <b>Información recibida por el bot</b>
              <span>
                Factura {caso.factura} · SKU {caso.sku} · 19 meses de uso · 2
                evidencias
              </span>
            </div>
            <h3>Inspección visual</h3>
            {[
              "El producto corresponde al SKU y factura seleccionados",
              "No presenta manipulación, golpes o mala instalación",
              "La evidencia y condición física fueron revisadas",
            ].map((x, i) => (
              <label className={checks[i] ? "checked" : ""} key={x}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() =>
                    setChecks((a) => a.map((v, j) => (j === i ? !v : v)))
                  }
                />
                <i>{checks[i] ? "✓" : ""}</i>
                <span>{x}</span>
              </label>
            ))}
            {caso.bateria && (
              <section className="bot-battery">
                <div className="battery-inline-head">
                  <span>
                    <h3>Garantía de batería</h3>
                    <p>Bonificación proporcional obligatoria</p>
                  </span>
                  <em
                    className={
                      batteryApplied ? "battery-ok" : "battery-pending"
                    }
                  >
                    {batteryApplied
                      ? "✓ Aplicado al dictamen"
                      : "Cálculo pendiente"}
                  </em>
                </div>
                <div className="battery-inline-fields">
                  <label>
                    Base elegible
                    <input
                      type="number"
                      value={batteryBase}
                      onChange={(e) => {
                        setBatteryBase(+e.target.value);
                        setBatteryApplied(false);
                      }}
                    />
                  </label>
                  <label>
                    Meses de uso
                    <input
                      type="number"
                      value={batteryMonths}
                      onChange={(e) => {
                        setBatteryMonths(+e.target.value);
                        setBatteryApplied(false);
                      }}
                    />
                  </label>
                </div>
                <div className="battery-inline-result">
                  <span>
                    Descuento por uso <b>{batteryPct}%</b>
                  </span>
                  <strong>{amount}</strong>
                  <small>Importe de nota de crédito</small>
                </div>
                <button
                  className="primario"
                  onClick={() => setBatteryApplied(true)}
                >
                  {batteryApplied
                    ? "✓ Bonificación aplicada"
                    : "Aplicar al dictamen"}
                </button>
                <p>
                  El cálculo debe aplicarse antes de confirmar la inspección.
                </p>
              </section>
            )}
            <footer>
              <button onClick={onClose}>Cancelar</button>
              <button
                className="primario"
                disabled={!inspected}
                onClick={() => setStep("diagnosis")}
              >
                Confirmar inspección
              </button>
            </footer>
          </main>
        )}
        {step === "diagnosis" && (
          <main>
            <div className="diagnosis-choice">
              <button
                className={result === "Procede" ? "selected proceed" : ""}
                onClick={() => choose("Procede")}
              >
                ✓{" "}
                <span>
                  <b>Procede</b>
                  <small>Cumple las condiciones</small>
                </span>
              </button>
              <button
                className={result === "No procede" ? "selected reject" : ""}
                onClick={() => choose("No procede")}
              >
                ×{" "}
                <span>
                  <b>No procede</b>
                  <small>Invalida la garantía</small>
                </span>
              </button>
            </div>
            <label className="observation">
              Observaciones del diagnóstico
              <textarea
                rows={6}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
              />
            </label>
            <footer>
              <button
                className="compact-back"
                onClick={() => setStep("inspection")}
              >
                Volver
              </button>
              {result === "Procede" ? (
                <button className="primario" onClick={() => setStep("credit")}>
                  Confirmar aprobación
                </button>
              ) : result === "No procede" ? (
                <button className="peligro" onClick={reject}>
                  Rechazar y generar dictamen PDF
                </button>
              ) : (
                <button className="primario" disabled>
                  Selecciona una resolución
                </button>
              )}
            </footer>
          </main>
        )}
        {step === "credit" && (
          <main className="credit-confirm-modal">
            <div className="credit-warning">!</div>
            <h2>Confirmar nota de crédito</h2>
            <p className="credit-question">
              ¿Deseas aplicar la solicitud y generar la nota de crédito? Al
              confirmar se generará el PDF del diagnóstico aprobado.
            </p>
            <div className="credit-confirm-data">
              <span>
                <small>Cliente</small>
                <b>{caso.cliente}</b>
              </span>
              <span>
                <small>Producto</small>
                <b>
                  {caso.sku} · {caso.producto}
                </b>
              </span>
              <span>
                <small>Importe</small>
                <b>{amount}</b>
              </span>
              <label>
                <small>Tipo de aplicación</small>
                <select
                  value={application}
                  onChange={(e) => setApplication(e.target.value as Aplicacion)}
                >
                  <option>Anticipo</option>
                  <option>Aplicado a factura</option>
                  <option>Devolución de efectivo</option>
                </select>
              </label>
            </div>
            <div className="credit-application-legend">{applicationLegend}</div>
            <footer className="credit-confirm-actions">
              <button
                className="back-inspection compact-credit-action"
                onClick={() => setStep("inspection")}
              >
                <i>←</i>
                <span>
                  <b>Volver</b>
                </span>
              </button>
              <button
                className="confirm-dictamen compact-credit-action"
                onClick={apply}
              >
                <i>✓</i>
                <span>
                  <b>Confirmar</b>
                </span>
              </button>
            </footer>
          </main>
        )}
      </section>
    </div>
  );
}
function Metrica({
  t,
  v,
  d,
  c,
}: {
  t: string;
  v: string;
  d: string;
  c: string;
}) {
  return (
    <article className={`metrica ${c}`}>
      <span>
        <small>{t}</small>
        <b>{v}</b>
        <em>{d}</em>
      </span>
      <i>{c === "rojo" ? "!" : "↗"}</i>
    </article>
  );
}
function Cab({ t, s }: { t: string; s: string }) {
  return (
    <div className="cab">
      <div>
        <strong>{t}</strong>
        <small>{s}</small>
      </div>
    </div>
  );
}

function CentralDashboard() {
  const [periodo, setPeriodo] = useState("Últimos 6 meses"),
    [branch, setBranch] = useState("Todas las sucursales"),
    [channel, setChannel] = useState("Todos los canales"),
    [provider, setProvider] = useState("Todos los proveedores"),
    [applied, setApplied] = useState({
      periodo: "Últimos 6 meses",
      branch: "Todas las sucursales",
      channel: "Todos los canales",
      provider: "Todos los proveedores",
    });
  const productosTop = [
    {
      n: "Sensor de oxígeno Denso",
      s: "DE-2341",
      v: "4.8%",
      c: 86,
      a: "critical",
    },
    { n: "Batería LTH H-47", s: "LTH-H47", v: "2.7%", c: 64, a: "high" },
    { n: "Alternador Bosch 12V", s: "BO-AL394", v: "1.8%", c: 51, a: "medium" },
    { n: "Bomba de agua GMB", s: "GMB-1256", v: "0.9%", c: 38, a: "normal" },
  ];
  const sucursalesTop = [
    { n: "GDL Centro", s: "186 garantías", v: "$684,320", c: 100 },
    { n: "Zapopan Norte", s: "142 garantías", v: "$518,740", c: 76 },
    { n: "León Torres", s: "119 garantías", v: "$431,800", c: 63 },
    { n: "Aguascalientes Sur", s: "94 garantías", v: "$352,190", c: 51 },
  ];
  const asesoresTop = [
    { n: "Carlos Mendoza", s: "GDL Centro · 78 casos", v: "$264,800", c: 100 },
    { n: "Laura Ortiz", s: "Zapopan Norte · 64 casos", v: "$218,420", c: 82 },
    { n: "Miguel Torres", s: "León Torres · 57 casos", v: "$186,950", c: 71 },
    {
      n: "Sofía Ramírez",
      s: "Aguascalientes · 49 casos",
      v: "$161,300",
      c: 62,
    },
  ];
  const proveedoresTop = [
    {
      n: "Denso México",
      s: "38% recuperado",
      v: "$742,600",
      c: 100,
      a: "critical",
    },
    {
      n: "Bosch Autopartes",
      s: "71% recuperado",
      v: "$586,240",
      c: 79,
      a: "high",
    },
    {
      n: "LTH / Clarios",
      s: "82% recuperado",
      v: "$418,900",
      c: 56,
      a: "medium",
    },
    { n: "GMB", s: "89% recuperado", v: "$296,180", c: 40, a: "normal" },
  ];
  const clientesTop = [
    {
      n: "Refaccionaria El Volante",
      s: "42 garantías · 2.9% sobre compras",
      v: "MXN 184,620",
      c: 100,
      a: "high",
    },
    {
      n: "Grupo Motor Plus",
      s: "36 garantías · 2.1% sobre compras",
      v: "MXN 151,480",
      c: 82,
      a: "medium",
    },
    {
      n: "Taller Automotriz Ríos",
      s: "29 garantías · 1.7% sobre compras",
      v: "MXN 118,900",
      c: 64,
      a: "medium",
    },
    {
      n: "Autopartes del Bajío",
      s: "24 garantías · 0.9% sobre compras",
      v: "MXN 92,350",
      c: 50,
      a: "normal",
    },
  ];
  const filterFactor =
      (applied.branch === "Todas las sucursales" ? 1 : 0.28) *
      (applied.channel === "Todos los canales" ? 1 : 0.62) *
      (applied.provider === "Todos los proveedores" ? 1 : 0.34) *
      (applied.periodo === "Últimos 6 meses"
        ? 1
        : applied.periodo === "Últimos 3 meses"
          ? 0.52
          : 0.18),
    simulatedTotal = Math.max(
      1,
      Math.round(7042 * filterFactor),
    ).toLocaleString("es-MX");
  return (
    <div className="central-dashboard">
      <div className="dash-filters">
        <div>
          <span>Periodo</span>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option>Últimos 6 meses</option>
            <option>Últimos 3 meses</option>
            <option>Mes actual</option>
          </select>
        </div>
        <div>
          <span>Sucursal</span>
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option>Todas las sucursales</option>
            <option>GDL Centro</option>
            <option>Zapopan Norte</option>
          </select>
        </div>
        <div>
          <span>Canal</span>
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option>Todos los canales</option>
            <option>Retail</option>
            <option>No Retail</option>
          </select>
        </div>
        <div>
          <span>Proveedor</span>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option>Todos los proveedores</option>
            <option>Denso México</option>
            <option>Bosch Autopartes</option>
          </select>
        </div>
        <button
          onClick={() => setApplied({ periodo, branch, channel, provider })}
        >
          Aplicar filtros
        </button>
      </div>
      <div className="dashboard-filter-result">
        <i>✓</i>
        <span>
          <b>Vista simulada actualizada</b>
          <small>
            {applied.periodo} · {applied.branch} · {applied.channel} ·{" "}
            {applied.provider}
          </small>
        </span>
      </div>
      <div className="threshold-note">
        <span>
          Fórmula: <b>garantías ÷ piezas vendidas × 100</b>
        </span>
        <div>
          <i className="normal" /> &lt;1% Normal <i className="medium" /> 1–2%
          Preventivo <i className="high" /> 2–3% Alto <i className="critical" />{" "}
          &gt;3% Crítico
        </div>
      </div>
      <section className="exec-kpis">
        <ExecKpi
          area="OPERATIVO"
          label="Solicitudes de garantía"
          value={simulatedTotal}
          delta="↑ 6.4% vs. periodo anterior"
          tone="blue"
        />
        <ExecKpi
          area="COMERCIAL"
          label="Garantías sobre ventas"
          value="1.84%"
          delta="Dentro del rango preventivo"
          tone="yellow"
        />
        <ExecKpi
          area="FINANCIERO"
          label="Monto bonificado"
          value="$4.82 M"
          delta="↑ 8.1% vs. periodo anterior"
          tone="purple"
        />
        <ExecKpi
          area="FINANCIERO"
          label="Pendiente de proveedor"
          value="$1.16 M"
          delta="24.1% del monto bonificado"
          tone="orange"
        />
        <ExecKpi
          area="OPERATIVO"
          label="Resolución dentro de SLA"
          value="82%"
          delta="Meta configurada: 90%"
          tone="red"
        />
        <ExecKpi
          area="FINANCIERO"
          label="Inventario de garantías"
          value="$742 mil"
          delta="128 piezas en resguardo"
          tone="green"
        />
      </section>
      <section className="dash-main">
        <div className="rankings">
          <Ranking
            title="Top productos con garantía"
            subtitle="Incidencia sobre piezas vendidas"
            items={productosTop}
          />
          <Ranking
            title="Monto de garantías por sucursal"
            subtitle="Bonificaciones acumuladas"
            items={sucursalesTop}
          />
          <Ranking
            title="Monto de garantías por asesor"
            subtitle="Casos asociados al asesor de venta"
            items={asesoresTop}
          />
          <Ranking
            title="Monto de garantías por proveedor"
            subtitle="Importe generado y recuperación"
            items={proveedoresTop}
          />
          <Ranking
            title="Top garantías por cliente"
            subtitle="Importe y proporción sobre compras del cliente"
            items={clientesTop}
          />
        </div>
        <aside className="alerts-panel">
          <div className="alerts-title">
            <div>
              <h2>Alertas</h2>
              <p>Requieren atención</p>
            </div>
            <b>4</b>
          </div>
          <DashAlert
            tone="critical"
            title="Defecto de fabricación"
            copy="DE-2341 alcanza 4.8% de garantías sobre ventas."
            meta="86 casos · Denso México"
          />
          <DashAlert
            tone="high"
            title="Recuperación vencida"
            copy="$284,600 pendientes con más de 60 días."
            meta="Proveedor: Denso México"
          />
          <DashAlert
            tone="high"
            title="Sucursal sobre umbral"
            copy="GDL Centro registra 3.2% de garantías sobre ventas."
            meta="186 solicitudes"
          />
          <DashAlert
            tone="medium"
            title="SLA operativo por debajo"
            copy="18% de las solicitudes excedieron el tiempo objetivo."
            meta="Meta: 90% · Actual: 82%"
          />
          <button>Ver todas las alertas　→</button>
        </aside>
      </section>
    </div>
  );
}
function ExecKpi({
  area,
  label,
  value,
  delta,
  tone,
}: {
  area: string;
  label: string;
  value: string;
  delta: string;
  tone: string;
}) {
  return (
    <article className={`exec-kpi ${tone}`}>
      <span>{area}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{delta}</small>
    </article>
  );
}
function Ranking({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: { n: string; s: string; v: string; c: number; a?: string }[];
}) {
  return (
    <article className="panel ranking">
      <div className="ranking-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <button>Ver detalle</button>
      </div>
      <div>
        {items.map((x, i) => (
          <div className="ranking-row" key={x.n}>
            <b>{i + 1}</b>
            <span>
              <strong>{x.n}</strong>
              <small>{x.s}</small>
              <i>
                <em style={{ width: `${x.c}%` }} />
              </i>
            </span>
            <div>
              <strong>{x.v}</strong>
              {x.a && (
                <small className={x.a}>
                  {x.a === "critical"
                    ? "Crítico"
                    : x.a === "high"
                      ? "Alto"
                      : x.a === "medium"
                        ? "Preventivo"
                        : "Normal"}
                </small>
              )}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
function DashAlert({
  tone,
  title,
  copy,
  meta,
}: {
  tone: string;
  title: string;
  copy: string;
  meta: string;
}) {
  return (
    <article className={`dash-alert ${tone}`}>
      <i>!</i>
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
        <small>{meta}</small>
      </div>
      <button>→</button>
    </article>
  );
}
function estadoVisible(c: Caso) {
  return c.origenBot && !c.resultado
    ? "Pendiente de inspección"
    : c.resultado === "No procede"
      ? "Rechazada"
      : "Aplicada";
}
function imprimirDictamen(c: Caso) {
  const w = window.open("", "_blank", "width=850,height=900");
  if (!w) return;
  const aprobado = c.resultado === "Procede",
    tipo = c.tipoAplicacion || "Aplicado a factura",
    leyenda =
      tipo === "Anticipo"
        ? "La bonificación fue aplicada como anticipo en su cuenta."
        : tipo === "Aplicado a factura"
          ? `La bonificación fue aplicada a la Factura ${c.factura || "relacionada"}.`
          : "La bonificación será entregada mediante un código QR de un solo uso.";
  const qr =
    tipo === "Devolución de efectivo"
      ? `<aside class="qr"><div class="qrbox"></div><p><b>QR-${c.notaCredito}-U1</b><small>Código de un solo uso para devolución de efectivo. Validar identidad del beneficiario antes de aplicarlo.</small></p></aside>`
      : "";
  w.document.write(
    `<html><head><title>Dictamen ${c.id}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{font-family:Arial;color:#172338;margin:0}.doc{width:7.2in;min-height:9.7in;padding:.55in .65in}.head{border-bottom:4px solid #173d79;padding-bottom:20px;display:flex;justify-content:space-between;gap:24px}.brand{background:#173d79;color:white;padding:18px 28px;font-size:24px;font-weight:bold}.head small{color:#3268ab;font-weight:bold}.head h1{margin:6px 0;font-size:22px}.meta,.data{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#dfe6ee;margin-top:20px}.meta div,.data div{background:#f7f9fc;padding:13px}.data{grid-template-columns:1fr 2fr}.label{font-size:8px;color:#718096;display:block}.value{font-size:12px;font-weight:bold;display:block;margin-top:5px}.status{display:inline-block;margin-top:22px;padding:8px 14px;border-radius:20px;background:${aprobado ? "#e5f6ef" : "#fdebed"};color:${aprobado ? "#14775a" : "#c63843"};font-weight:bold}.diag{border-left:4px solid #3268ab;background:#f7f9fc;padding:18px;margin-top:10px;min-height:105px;font-size:12px;line-height:1.65}.application{margin-top:20px;border:1px solid #dfe6ee;border-radius:9px;overflow:hidden}.application h2{font-size:13px;background:#edf4fc;color:#173d79;margin:0;padding:11px 15px}.application>div{display:flex;justify-content:space-between;align-items:center;padding:15px}.application span{display:flex;flex-direction:column;gap:5px}.legend{margin:0 15px 15px;border-left:4px solid #168565;background:#eef8f4;padding:11px;font-size:11px;font-weight:bold}.qr{display:flex;align-items:center;gap:12px}.qrbox{width:84px;height:84px;border:6px solid white;outline:1px solid #172c47;background:repeating-conic-gradient(#172c47 0 25%,#fff 0 50%) 0/12px 12px}.qr p{display:flex;flex-direction:column;max-width:185px;margin:0}.qr small{font-size:8px;line-height:1.4;margin-top:5px}.foot{margin-top:38px;border-top:1px solid #dce3eb;padding-top:15px;color:#718096;font-size:9px}.actions{text-align:center;margin:20px}.actions button{background:#173d79;color:white;border:0;border-radius:7px;padding:10px 18px;font-weight:bold}@media print{.actions{display:none}}</style></head><body><div class="doc"><div class="head"><div class="brand">APYMSA</div><div><small>DICTAMEN TÉCNICO</small><h1>Diagnóstico de Garantía Express</h1><p>Documento de resolución, bonificación y trazabilidad</p></div></div><div class="meta"><div><span class="label">SOLICITUD</span><span class="value">${c.id}</span></div><div><span class="label">FECHA</span><span class="value">25/08/2026</span></div><div><span class="label">RESOLUCIÓN</span><span class="value">${aprobado ? "APROBADA" : "RECHAZADA"}</span></div></div><div class="data"><div><span class="label">CLIENTE</span><span class="value">${c.cliente}</span></div><div><span class="label">PRODUCTO</span><span class="value">${c.sku} · ${c.producto}</span></div></div><span class="status">${aprobado ? "✓ GARANTÍA APROBADA" : "× GARANTÍA RECHAZADA"}</span><h2>Diagnóstico técnico</h2><div class="diag">${c.observacion || (aprobado ? obsProcede : obsNoProcede)}</div>${aprobado ? `<section class="application"><h2>Aplicación de la nota de crédito</h2><div><span><small class="label">TIPO DE BONIFICACIÓN</small><strong>${tipo}</strong><small>Folio ${c.notaCredito} · Importe ${c.importeBonificacion || "$0.00"}</small></span>${qr}</div><p class="legend">${leyenda}</p></section>` : ""}<div class="foot"><b>Departamento de Garantías · Grupo APYMSA</b><p>Documento generado electrónicamente por Garantías Express.</p></div></div><div class="actions"><button onclick="window.print()">Descargar / imprimir PDF</button></div></body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
function imprimirNotaCreditoDevolucion(d: Devolucion) {
  const w = window.open("", "_blank", "width=850,height=900");
  if (!w) return;
  const leyenda =
    d.tipoAplicacion === "Anticipo"
      ? "La bonificación fue aplicada como anticipo en su cuenta."
      : d.tipoAplicacion === "Aplicado a factura"
        ? `La bonificación fue aplicada a la Factura ${d.documento}.`
        : "La bonificación será entregada mediante un código QR de un solo uso.";
  const qr =
    d.tipoAplicacion === "Devolución de efectivo"
      ? `<aside class="qr"><div class="qrbox"></div><p><b>QR-${d.notaCredito}-U1</b><small>Código de un solo uso para devolución de efectivo. Validar identidad del beneficiario antes de aplicarlo.</small></p></aside>`
      : "";
  const filas = d.items
    .filter((i) => i.cantidad > 0)
    .map(
      (i) =>
        `<tr><td>${i.sku}</td><td>${i.descripcion}</td><td>${i.motivo}</td><td>${i.cantidad}</td><td>${formatMoney(i.precio)}</td><td>${i.descuento}%</td><td>${formatMoney(i.cantidad * i.precio * (1 - i.descuento / 100))}</td></tr>`,
    )
    .join("");
  w.document.write(
    `<html><head><title>Nota de crédito ${d.notaCredito}</title><style>@page{size:letter;margin:0}*{box-sizing:border-box}body{font-family:Arial;color:#172338;margin:0}.doc{width:7.2in;min-height:9.7in;padding:.55in .65in}.head{border-bottom:4px solid #173d79;padding-bottom:20px;display:flex;justify-content:space-between;gap:24px}.brand{background:#173d79;color:white;padding:18px 28px;font-size:24px;font-weight:bold}.head small{color:#3268ab;font-weight:bold}.head h1{margin:6px 0;font-size:22px}.meta,.data{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#dfe6ee;margin-top:20px}.meta div,.data div{background:#f7f9fc;padding:13px}.data{grid-template-columns:1fr 2fr}.label{font-size:8px;color:#718096;display:block}.value{font-size:12px;font-weight:bold;display:block;margin-top:5px}table{width:100%;border-collapse:collapse;margin-top:18px;font-size:10px}th,td{border:1px solid #dfe6ee;padding:8px;text-align:left}th{background:#edf4fc;color:#173d79}.totales{margin-top:14px;margin-left:auto;width:260px}.totales div{display:flex;justify-content:space-between;padding:6px 0;font-size:11px}.totales .total{font-weight:bold;border-top:2px solid #173d79;margin-top:4px}.application{margin-top:20px;border:1px solid #dfe6ee;border-radius:9px;overflow:hidden}.application h2{font-size:13px;background:#edf4fc;color:#173d79;margin:0;padding:11px 15px}.application>div{display:flex;justify-content:space-between;align-items:center;padding:15px}.application span{display:flex;flex-direction:column;gap:5px}.legend{margin:0 15px 15px;border-left:4px solid #168565;background:#eef8f4;padding:11px;font-size:11px;font-weight:bold}.qr{display:flex;align-items:center;gap:12px}.qrbox{width:84px;height:84px;border:6px solid white;outline:1px solid #172c47;background:repeating-conic-gradient(#172c47 0 25%,#fff 0 50%) 0/12px 12px}.qr p{display:flex;flex-direction:column;max-width:185px;margin:0}.qr small{font-size:8px;line-height:1.4;margin-top:5px}.foot{margin-top:38px;border-top:1px solid #dce3eb;padding-top:15px;color:#718096;font-size:9px}.actions{text-align:center;margin:20px}.actions button{background:#173d79;color:white;border:0;border-radius:7px;padding:10px 18px;font-weight:bold}@media print{.actions{display:none}}</style></head><body><div class="doc"><div class="head"><div class="brand">APYMSA</div><div><small>NOTA DE CRÉDITO</small><h1>Registro de devoluciones y garantías</h1><p>Documento de devolución, bonificación y trazabilidad</p></div></div><div class="meta"><div><span class="label">NOTA DE CRÉDITO</span><span class="value">${d.notaCredito}</span></div><div><span class="label">DOCUMENTO / SERIE</span><span class="value">${d.documento} · ${d.serie}</span></div><div><span class="label">FECHA</span><span class="value">${d.creadaEn}</span></div></div><div class="data"><div><span class="label">CLIENTE</span><span class="value">${d.clienteNombre} (${d.clienteId})</span></div><div><span class="label">SUCURSAL / VENDEDOR</span><span class="value">${d.sucursal} · ${d.vendedorId}</span></div></div><table><thead><tr><th>Código</th><th>Descripción</th><th>Motivo</th><th>Cant.</th><th>Precio</th><th>Descuento (%)</th><th>Importe</th></tr></thead><tbody>${filas}</tbody></table><div class="totales"><div><span>Subtotal</span><span>${formatMoney(d.subtotal)}</span></div><div><span>IVA</span><span>${formatMoney(d.iva)}</span></div><div class="total"><span>Total</span><span>${formatMoney(d.total)}</span></div></div><section class="application"><h2>Aplicación de la nota de crédito</h2><div><span><small class="label">TIPO DE MOVIMIENTO</small><strong>${d.tipoAplicacion}</strong><small>Folio ${d.notaCredito} · Importe ${formatMoney(d.total)}</small></span>${qr}</div><p class="legend">${leyenda}</p></section><div class="foot"><b>Departamento de Garantías · Grupo APYMSA</b><p>Documento generado electrónicamente por Garantías Express.</p></div></div><div class="actions"><button onclick="window.print()">Descargar / imprimir PDF</button></div></body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
function custodyOperation(c: Caso, receivedBoxes: string[]) {
  const central = Boolean(c.caja && receivedBoxes.includes(c.caja)),
    holder =
      c.resultado === "No procede"
        ? "Sin custodia"
        : central
          ? "Garantías Central"
          : c.custodia || "Con el cliente";
  if (holder === "Con Paquetería")
    return {
      holder,
      next: "Confirmar recepción física",
      sla: c.id.endsWith("1841") ? "Por vencer" : "En tiempo",
      tone: c.id.endsWith("1841") ? "warning" : "ok",
    };
  if (holder === "Garantías Central")
    return {
      holder,
      next: "Realizar diagnóstico técnico",
      sla: "En tiempo",
      tone: "ok",
    };
  if (holder === "Con el cliente")
    return {
      holder,
      next: "Coordinar entrega de la pieza",
      sla: c.id.endsWith("1839") ? "Vencida" : "Por vencer",
      tone: c.id.endsWith("1839") ? "critical" : "warning",
    };
  if (holder === "En sucursal")
    return {
      holder,
      next: "Preparar entrega a Garantías",
      sla: "En tiempo",
      tone: "ok",
    };
  if (holder === "Con el asesor")
    return {
      holder,
      next: "Entregar producto en sucursal",
      sla: "Por vencer",
      tone: "warning",
    };
  if (holder === "En caja de Garantías")
    return {
      holder,
      next: "Documentar envío logístico",
      sla: "En tiempo",
      tone: "ok",
    };
  if (holder === "En mostrador")
    return {
      holder,
      next: "Entregar a almacén de la sucursal",
      sla: "En tiempo",
      tone: "warning",
    };
  if (holder === "En almacén")
    return {
      holder,
      next: "Proceso finalizado",
      sla: "En tiempo",
      tone: "ok",
    };
  return {
    holder,
    next:
      holder === "Sin custodia"
        ? "Proceso finalizado"
        : "Dar seguimiento operativo",
    sla: holder === "Sin custodia" ? "No aplica" : "En tiempo",
    tone: "ok",
  };
}
function Tabla({
  items,
  sel,
  elegir,
  confirmar,
  receivedBoxes,
  incidentFolios,
  resolvedIncidentFolios,
  onIncidentDetail,
}: {
  items: Caso[];
  sel: Caso | null;
  elegir: (c: Caso) => void;
  confirmar: (c: Caso) => void;
  receivedBoxes: string[];
  incidentFolios: string[];
  resolvedIncidentFolios: string[];
  onIncidentDetail: (folio: string) => void;
}) {
  return (
    <div className="tabla request-table">
      <div className="fila th">
        <span>Folio / fecha</span>
        <span>Cliente y producto</span>
        <span>Estado solicitud</span>
        <span>Estado de custodia</span>
        <span>Siguiente acción</span>
        <span>Cumplimiento</span>
        <span>Número de caja</span>
        <span>Nota de crédito</span>
        <span>Acción / dictamen</span>
      </div>
      {items.map((c) => {
        const pendiente = c.origenBot && !c.resultado,
          rechazada = c.resultado === "No procede",
          estado = estadoVisible(c),
          boxReceived = Boolean(c.caja && receivedBoxes.includes(c.caja)),
          operation = custodyOperation(c, receivedBoxes);
        return (
          <button className="fila" key={c.id} onClick={() => elegir(c)}>
            <span>
              <b>{c.id}</b>
              <small>
                {c.fechaSolicitud || "Fecha pendiente"}
                {c.usuario ? ` · ${c.usuario}` : ""}
              </small>
              <em className="request-branch">{c.sucursal}</em>
              <em className="bot-origin">
                {c.origenBot
                  ? "BOT"
                  : c.origenMostrador
                    ? "Mostrador"
                    : "Garantías Central"}
              </em>
            </span>
            <span>
              <b>{c.cliente}</b>
              <small>{c.producto}</small>
              <em className="request-sku">{c.sku}</em>
            </span>
            <span>
              <i
                className={`request-state ${estado.toLowerCase().replaceAll(" ", "-")}`}
              />
              {estado}
            </span>
            <span
              className={`custody-cell ${operation.holder === "Con Paquetería" ? "custody-alert" : operation.holder === "Garantías Central" ? "custody-central" : operation.holder === "Con el cliente" ? "custody-client" : operation.holder === "En sucursal" || operation.holder === "Con el asesor" ? "custody-branch" : ""}`}
            >
              <i>⌖</i>
              <b>{operation.holder}</b>
            </span>
            <span className="next-action-cell">
              <b>{operation.next}</b>
              <small>Responsable según custodia</small>
            </span>
            <span>
              <em className={`sla-status ${operation.tone}`}>
                ● {operation.sla}
              </em>
            </span>
            <span className={c.caja ? "box-cell assigned" : "box-cell pending"}>
              <b>{c.caja || "Pendiente"}</b>
              <small>
                {c.caja
                  ? boxReceived
                    ? "Recibida"
                    : "En tránsito"
                  : "Sin asignar"}
              </small>
            </span>
            <span className="nc-cell">
              <b>{c.notaCredito || "—"}</b>
              <small>
                {c.notaCredito
                  ? "Aplicada"
                  : pendiente
                    ? "Por determinar"
                    : rechazada
                      ? "No aplica"
                      : "Sin aplicar"}
              </small>
            </span>
            {pendiente ? (
              <span
                className="inspect-action"
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  confirmar(c);
                }}
              >
                Confirmar inspección
              </span>
            ) : (
              <span
                className={`pdf-action ${c.resultado ? "available" : ""}`}
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (c.resultado) imprimirDictamen(c);
                }}
              >
                ▧ {c.resultado ? "Descargar PDF" : "Pendiente"}
              </span>
            )}
          </button>
        );
      })}
      {!items.length && (
        <div className="table-empty">
          <i>⌕</i>
          <b>No se encontraron solicitudes</b>
          <span>
            Ajusta los filtros o consulta los folios con diferencia en el menú
            Incidencias.
          </span>
        </div>
      )}
    </div>
  );
}
function Actividad({ h, t, s }: { h: string; t: string; s: string }) {
  return (
    <div className="actividad">
      <time>{h}</time>
      <i />
      <span>
        <strong>{t}</strong>
        <small>{s}</small>
      </span>
    </div>
  );
}
function custodyDates(caso: Caso) {
  const day = caso.id.endsWith("1842") ? "24 ago" : "23 ago";
  return [
    `${day} · 10:21`,
    `${day} · 11:04`,
    `${day} · 14:36`,
    "24 ago · 17:18",
    "25 ago · 07:42",
    "25 ago · 09:42",
  ];
}
function Detalle({
  caso,
}: {
  caso: Caso;
  actualizar: (id: string, u: Partial<Caso>) => void;
  avisar: (s: string) => void;
}) {
  const pending = caso.origenBot && !caso.resultado,
    rejected = caso.resultado === "No procede",
    process = [
      "Nueva",
      "Inspección completada",
      "Diagnóstico completado",
      "Autorizado",
      "NC aplicada",
    ],
    active = pending ? 0 : rejected ? 2 : 4,
    custody = [
      "Con el cliente",
      "Con el asesor",
      "En sucursal",
      "En caja de Garantías",
      "En tránsito",
      "Garantías Central",
    ],
    custodyIndex =
      caso.estado === "Producto en custodia"
        ? 5
        : caso.recibido
          ? 3
          : caso.canal === "No Retail"
            ? 1
            : 0;
  return (
    <aside className="panel detalle detail-readonly">
      <em>{caso.canal}</em>
      {caso.origenBot && <em className="bot-detail">Origen: Freshchat Bot</em>}
      <small>{caso.id}</small>
      <h2>{caso.producto}</h2>
      <p>
        {caso.cliente} · {caso.sucursal}
      </p>
      <div className="mini">
        <span>
          SKU <b>{caso.sku}</b>
        </span>
        <span>
          Estado{" "}
          <b className={rejected ? "text-red" : ""}>
            {pending
              ? "Pendiente de inspección"
              : rejected
                ? "Rechazada"
                : "Aplicada"}
          </b>
        </span>
      </div>
      {!rejected && !pending && (
        <div className="nc-applied">
          <i>✓</i>
          <span>
            <small>NOTA DE CRÉDITO APLICADA</small>
            <strong>{caso.notaCredito || "NC-0000"}</strong>
          </span>
        </div>
      )}
      <section className="detail-section">
        <h3>Trazabilidad de la solicitud</h3>
        <div className="progreso">
          {process.map((e, i) => (
            <span
              className={i <= active || (rejected && i === 3) ? "hecho" : ""}
              key={e}
            >
              <i className={rejected && i === 3 ? "rejected-step" : ""}>
                {rejected && i === 3
                  ? "×"
                  : i < active
                    ? "✓"
                    : i === active
                      ? "•"
                      : ""}
              </i>
              {e}
            </span>
          ))}
        </div>
      </section>
      <section className="detail-section">
        <h3>Custodia de la pieza</h3>
        {rejected ? (
          <div className="custody-empty">
            <i>—</i>
            <span>
              <b>Sin custodia registrada</b>
              <small>
                La solicitud fue rechazada y la pieza no ingresó al flujo de
                custodia.
              </small>
            </span>
          </div>
        ) : (
          <div className="custody-vertical">
            {custody.map((e, i) => (
              <span className={i <= custodyIndex ? "hecho" : ""} key={e}>
                <i>{i < custodyIndex ? "✓" : i === custodyIndex ? "•" : ""}</i>
                <b>
                  {e}
                  <small>
                    {i <= custodyIndex ? custodyDates(caso)[i] : "Pendiente"}
                  </small>
                </b>
              </span>
            ))}
          </div>
        )}
      </section>
      <div
        className={
          rejected ? "regla warn" : pending ? "regla pending" : "regla ok"
        }
      >
        <strong>
          {rejected
            ? "Solicitud rechazada"
            : pending
              ? "Inspección requerida"
              : "Solicitud aplicada"}
        </strong>
        <p>
          {rejected
            ? "El diagnóstico no fue autorizado. Consulta el PDF para conocer la resolución."
            : pending
              ? "Confirma la inspección para abrir el diagnóstico y continuar el proceso."
              : `Folio de nota de crédito: ${caso.notaCredito || "NC-0000"}.`}
        </p>
      </div>
    </aside>
  );
}
function Alerta({
  t,
  s,
  a,
  critica,
  avisar,
}: {
  t: string;
  s: string;
  a: string;
  critica?: boolean;
  avisar: (s: string) => void;
}) {
  return (
    <div className={`alerta ${critica ? "critica" : ""}`}>
      <i>{critica ? "!" : "↑"}</i>
      <span>
        <strong>{t}</strong>
        <small>{s}</small>
      </span>
      <button onClick={() => avisar(a + " enviado a autorización")}>{a}</button>
    </div>
  );
}

const cajasCentral = [
  {
    sucursal: "Zapopan Norte",
    numero: "GX-ZPN-008",
    fecha: "24 ago · 09:42",
    items: [
      {
        folio: "GE-260824-1842",
        sku: "BO-AL394",
        producto: "Alternador Bosch 12V",
      },
      { folio: "GE-260824-1841", sku: "LTH-H47", producto: "Batería LTH H-47" },
      {
        folio: "GE-260824-1838",
        sku: "DE-2341",
        producto: "Sensor de oxígeno Denso",
      },
      {
        folio: "GE-260824-1835",
        sku: "FR-D1287",
        producto: "Juego de balatas Fritec",
      },
    ],
  },
  {
    sucursal: "GDL Centro",
    numero: "GX-GDL-014",
    fecha: "24 ago · 10:18",
    items: [
      {
        folio: "GE-260824-1828",
        sku: "FR-D1287",
        producto: "Juego de balatas Fritec",
      },
      {
        folio: "GE-260824-1824",
        sku: "GMB-1256",
        producto: "Bomba de agua GMB",
      },
    ],
  },
  {
    sucursal: "León Torres",
    numero: "GX-LEO-003",
    fecha: "23 ago · 17:06",
    items: [
      {
        folio: "GE-260823-1798",
        sku: "DE-2341",
        producto: "Sensor de oxígeno Denso",
      },
    ],
  },
];
function LegacyReceptionArrival({ avisar }: { avisar: (s: string) => void }) {
  const [branch, setBranch] = useState(""),
    [box, setBox] = useState(""),
    [checked, setChecked] = useState<Record<string, boolean>>({}),
    [incident, setIncident] = useState(false),
    [incidentSaved, setIncidentSaved] = useState(false),
    [labels, setLabels] = useState(false),
    [removed, setRemoved] = useState<Record<string, boolean>>({}),
    [warehouse, setWarehouse] = useState<Record<string, boolean>>({}),
    [confirmAction, setConfirmAction] = useState<{
      folio: string;
      action: "remove" | "warehouse";
    } | null>(null);
  const boxes = cajasCentral.filter((c) => c.sucursal === branch),
    selected = cajasCentral.find((c) => c.numero === box),
    activeItems =
      selected?.items.filter((i) => !removed[i.folio] && !warehouse[i.folio]) ||
      [],
    confirmed = activeItems.filter((i) => checked[i.folio]).length,
    ready = Boolean(
      selected &&
      activeItems.length > 0 &&
      (confirmed === activeItems.length || incidentSaved),
    );
  const chooseBranch = (v: string) => {
    setBranch(v);
    setBox("");
    setChecked({});
    setIncident(false);
    setIncidentSaved(false);
    setLabels(false);
    setRemoved({});
    setWarehouse({});
  };
  const executeAction = () => {
    if (!confirmAction) return;
    const { folio, action } = confirmAction;
    if (action === "remove") {
      setRemoved((x) => ({ ...x, [folio]: true }));
      avisar(`${folio} regresó a Caja Abierta`);
    } else {
      setWarehouse((x) => ({ ...x, [folio]: true }));
      avisar(`${folio} se movió al Almacén de Garantías`);
    }
    setChecked((x) => ({ ...x, [folio]: false }));
    setConfirmAction(null);
  };
  return (
    <section className="arrival-workspace">
      <div className="panel arrival-select">
        <div>
          <small>1 · IDENTIFICA EL ENVÍO</small>
          <h2>Selecciona la caja pendiente de arribo</h2>
          <p>
            Las cajas aparecen al confirmar su envío desde Garantías Sucursal.
          </p>
        </div>
        <label>
          Sucursal de origen
          <select value={branch} onChange={(e) => chooseBranch(e.target.value)}>
            <option value="">Seleccionar sucursal</option>
            {[...new Set(cajasCentral.map((c) => c.sucursal))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Número de caja
          <select
            value={box}
            disabled={!branch}
            onChange={(e) => {
              setBox(e.target.value);
              setChecked({});
              setIncidentSaved(false);
            }}
          >
            <option value="">Seleccionar caja</option>
            {boxes.map((c) => (
              <option key={c.numero}>{c.numero}</option>
            ))}
          </select>
        </label>
      </div>
      {!selected ? (
        <div className="panel arrival-empty">
          <i>▣</i>
          <h2>Contenido de la caja</h2>
          <p>
            Selecciona la sucursal y el número de caja para iniciar la
            recepción.
          </p>
        </div>
      ) : (
        <>
          <div className="arrival-summary">
            <article>
              <small>CAJA</small>
              <b>{selected.numero}</b>
              <span>Enviada {selected.fecha}</span>
            </article>
            <article>
              <small>ORIGEN</small>
              <b>{selected.sucursal}</b>
              <span>Transportista: Paquetexpress</span>
            </article>
            <article
              className={confirmed === activeItems.length ? "complete" : ""}
            >
              <small>CONTEO CONFIRMADO</small>
              <b>
                {confirmed} / {activeItems.length}
              </b>
              <span>
                {confirmed === activeItems.length
                  ? "Contenido conciliado"
                  : "Confirma cada producto"}
              </span>
            </article>
            <article>
              <small>DIFERENCIAS</small>
              <b>{incidentSaved ? "1" : "0"}</b>
              <span>
                {incidentSaved ? "Incidencia registrada" : "Sin diferencias"}
              </span>
            </article>
          </div>
          <div className="arrival-grid">
            <div className="panel">
              <div className="trace-head">
                <div>
                  <h2>Detalle del contenido</h2>
                  <p>
                    Confirma, quita o mueve cada pieza al almacén según
                    corresponda.
                  </p>
                </div>
                <span>{activeItems.length} productos activos</span>
              </div>
              <div className="arrival-items">
                {activeItems.length ? (
                  activeItems.map((i, n) => (
                    <article
                      className={checked[i.folio] ? "checked" : ""}
                      key={i.folio}
                    >
                      <span>{n + 1}</span>
                      <div>
                        <small>{i.folio}</small>
                        <strong>{i.producto}</strong>
                        <p>{i.sku} · Cantidad esperada: 1</p>
                      </div>
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(checked[i.folio])}
                          onChange={(e) =>
                            setChecked((x) => ({
                              ...x,
                              [i.folio]: e.target.checked,
                            }))
                          }
                        />
                        <i>{checked[i.folio] ? "✓" : ""}</i>
                        <b>
                          {checked[i.folio]
                            ? "Producto confirmado"
                            : "Confirmar producto"}
                        </b>
                      </label>
                      <div className="arrival-row-actions">
                        <button
                          onClick={() =>
                            setConfirmAction({
                              folio: i.folio,
                              action: "remove",
                            })
                          }
                        >
                          Quitar
                        </button>
                        <button
                          onClick={() =>
                            setConfirmAction({
                              folio: i.folio,
                              action: "warehouse",
                            })
                          }
                        >
                          Mover a almacén
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="trace-empty">
                    <i>✓</i>
                    <strong>No hay productos pendientes en esta caja</strong>
                    <p>
                      Todos los registros fueron retirados o movidos al almacén.
                    </p>
                  </div>
                )}
              </div>
              <div className="arrival-counter">
                <span>
                  <b>{confirmed}</b> de {activeItems.length} productos
                  confirmados
                </span>
                <progress
                  value={confirmed}
                  max={Math.max(activeItems.length, 1)}
                />
              </div>
            </div>
            <aside className="panel arrival-actions">
              <Cab
                t="Acciones de recepción"
                s="Documenta y avanza la caja completa"
              />
              <button
                onClick={() => {
                  setLabels(true);
                  avisar("Etiquetas generadas para la caja y sus productos");
                }}
              >
                ▤　Generar etiquetas
              </button>
              {labels && (
                <div className="label-preview">
                  <b>{selected.numero}</b>
                  <span>ORIGEN · {selected.sucursal}</span>
                  <small>▥ ▥▥ ▥ ▥▥▥</small>
                  <em>{activeItems.length} etiquetas de producto listas</em>
                </div>
              )}
              <button
                className={incidentSaved ? "incident-done" : ""}
                onClick={() => setIncident(true)}
              >
                !　
                {incidentSaved
                  ? "Incidencia registrada"
                  : "Reportar diferencia"}
              </button>
              <button
                className="primario"
                disabled={!ready}
                onClick={() =>
                  avisar(`${selected.numero} enviada a la etapa de Diagnóstico`)
                }
              >
                Enviar a Diagnóstico　→
              </button>
              <p>
                {ready
                  ? "La caja puede avanzar con el conteo conciliado o la diferencia documentada."
                  : "Confirma todos los productos. Si existe una diferencia, registra una incidencia para continuar."}
              </p>
            </aside>
          </div>
          {incident && (
            <div className="incident-sheet">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setIncident(false);
                  setIncidentSaved(true);
                  avisar("Incidencia enviada a " + selected.sucursal);
                }}
              >
                <button type="button" onClick={() => setIncident(false)}>
                  ×
                </button>
                <small>ACLARACIÓN CON SUCURSAL</small>
                <h2>Registrar diferencia de recepción</h2>
                <p>
                  {selected.numero} · {selected.sucursal}
                </p>
                <label>
                  Tipo de diferencia
                  <select required>
                    <option>Producto faltante</option>
                    <option>Producto adicional</option>
                    <option>Producto incorrecto</option>
                    <option>Daño durante traslado</option>
                  </select>
                </label>
                <label>
                  Detalle de la incidencia
                  <textarea
                    required
                    placeholder="Describe la diferencia encontrada y el producto relacionado…"
                    rows={4}
                  />
                </label>
                <footer>
                  <button type="button" onClick={() => setIncident(false)}>
                    Cancelar
                  </button>
                  <button className="primario">Crear incidencia</button>
                </footer>
              </form>
            </div>
          )}
          {confirmAction && (
            <div className="explicit-confirm">
              <div>
                <i>!</i>
                <small>CONFIRMACIÓN OBLIGATORIA</small>
                <h2>
                  {confirmAction.action === "remove"
                    ? "¿Quitar el producto del arribo?"
                    : "¿Mover el producto al Almacén de Garantías?"}
                </h2>
                <p>
                  {confirmAction.action === "remove"
                    ? "El registro regresará a la pantalla Caja Abierta de la sucursal y dejará de formar parte de esta recepción."
                    : "El producto saldrá del conteo de arribo y quedará registrado bajo custodia del Almacén de Garantías."}
                </p>
                <strong>{confirmAction.folio}</strong>
                <footer>
                  <button onClick={() => setConfirmAction(null)}>
                    Cancelar
                  </button>
                  <button
                    className={
                      confirmAction.action === "remove"
                        ? "danger-action"
                        : "primario"
                    }
                    onClick={executeAction}
                  >
                    {confirmAction.action === "remove"
                      ? "Sí, quitar producto"
                      : "Sí, mover a almacén"}
                  </button>
                </footer>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
function LegacyDiagnosisDisposition({
  avisar,
}: {
  avisar: (s: string) => void;
}) {
  const pieces = [
    {
      id: "GE-260824-1842",
      sku: "BO-AL394",
      product: "Alternador Bosch 12V",
      box: "GX-ZPN-008",
      branch: "Zapopan Norte",
    },
    {
      id: "GE-260824-1841",
      sku: "LTH-H47",
      product: "Batería LTH H-47",
      box: "GX-ZPN-008",
      branch: "Zapopan Norte",
    },
    {
      id: "GE-260824-1828",
      sku: "FR-D1287",
      product: "Juego de balatas Fritec",
      box: "GX-GDL-014",
      branch: "GDL Centro",
    },
    {
      id: "GE-260824-1824",
      sku: "GMB-1256",
      product: "Bomba de agua GMB",
      box: "GX-GDL-014",
      branch: "GDL Centro",
    },
  ];
  const [destinations, setDestinations] = useState<Record<string, string>>({}),
    [saved, setSaved] = useState<Record<string, boolean>>({});
  const options = [
    "A destrucción",
    "Almacén Proveedor",
    "A reparación",
    "Retorno a Sucursal",
  ];
  return (
    <section className="diagnosis-workspace">
      <div className="disposition-kpis">
        {options.map((x, i) => (
          <article key={x}>
            <i>{["♲", "▣", "⌁", "↩"][i]}</i>
            <span>
              <small>{x.toUpperCase()}</small>
              <b>{Object.values(destinations).filter((v) => v === x).length}</b>
            </span>
          </article>
        ))}
      </div>
      <div className="panel">
        <div className="trace-head">
          <div>
            <h2>Piezas pendientes de disposición</h2>
            <p>
              El técnico de Garantías determina y confirma el destino
              individual.
            </p>
          </div>
          <span>{pieces.filter((p) => !saved[p.id]).length} pendientes</span>
        </div>
        <div className="disposition-table">
          <div className="head">
            <span>Solicitud / caja</span>
            <span>Producto</span>
            <span>Sucursal</span>
            <span>Disposición</span>
            <span>Acción</span>
          </div>
          {pieces.map((p) => (
            <article key={p.id}>
              <span>
                <b>{p.id}</b>
                <small>{p.box}</small>
              </span>
              <span>
                <b>{p.product}</b>
                <small>{p.sku} · 1 pieza</small>
              </span>
              <span>{p.branch}</span>
              <select
                value={destinations[p.id] || ""}
                disabled={saved[p.id]}
                onChange={(e) =>
                  setDestinations((x) => ({ ...x, [p.id]: e.target.value }))
                }
              >
                <option value="">Seleccionar destino</option>
                {options.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
              <button
                className={saved[p.id] ? "saved" : "primario"}
                disabled={!destinations[p.id] || saved[p.id]}
                onClick={() => {
                  setSaved((x) => ({ ...x, [p.id]: true }));
                  avisar(`Disposición confirmada: ${destinations[p.id]}`);
                }}
              >
                {saved[p.id] ? "✓ Confirmada" : "Confirmar"}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function PreviousReceptionArrival({ avisar }: { avisar: (s: string) => void }) {
  const [branch, setBranch] = useState(""),
    [box, setBox] = useState(""),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [difference, setDifference] = useState(false),
    [incident, setIncident] = useState(false);
  const boxes = cajasCentral.filter((c) => c.sucursal === branch),
    selected = cajasCentral.find((c) => c.numero === box),
    pending = selected?.items.filter((i) => !checks[i.folio]) || [],
    confirmed = selected?.items.filter((i) => checks[i.folio]).length || 0;
  const labels = () =>
    avisar(
      selected
        ? `Etiquetas generadas para ${selected.numero}`
        : "Plantilla de etiquetas generada; selecciona una caja para imprimir etiquetas de producto",
    );
  return (
    <section className="arrival-workspace">
      <div className="panel arrival-toolbar">
        <div>
          <small>RECEPCIÓN CENTRAL</small>
          <h2>Cajas pendientes de arribo</h2>
          <p>
            Selecciona el origen y la relación logística que vas a conciliar.
          </p>
        </div>
        <label>
          Sucursal
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setBox("");
              setChecks({});
            }}
          >
            <option value="">Seleccionar sucursal</option>
            {[...new Set(cajasCentral.map((c) => c.sucursal))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Número de caja
          <select
            value={box}
            disabled={!branch}
            onChange={(e) => {
              setBox(e.target.value);
              setChecks({});
            }}
          >
            <option value="">Seleccionar caja</option>
            {boxes.map((c) => (
              <option key={c.numero}>{c.numero}</option>
            ))}
          </select>
        </label>
        <button onClick={labels}>▤ Generar etiquetas</button>
      </div>
      {!selected ? (
        <div className="panel arrival-empty">
          <i>▣</i>
          <h2>Selecciona una caja pendiente</h2>
          <p>
            La generación de etiquetas permanece disponible desde la barra
            superior.
          </p>
        </div>
      ) : (
        <>
          <div className="arrival-summary">
            <article>
              <small>CAJA</small>
              <b>{selected.numero}</b>
              <span>Enviada {selected.fecha}</span>
            </article>
            <article>
              <small>ORIGEN</small>
              <b>{selected.sucursal}</b>
              <span>Relación logística confirmada</span>
            </article>
            <article
              className={confirmed === selected.items.length ? "complete" : ""}
            >
              <small>PRODUCTOS CONFIRMADOS</small>
              <b>
                {confirmed} / {selected.items.length}
              </b>
              <span>Conteo físico</span>
            </article>
            <article>
              <small>PENDIENTES</small>
              <b>{pending.length}</b>
              <span>Sin confirmar</span>
            </article>
          </div>
          <div className="arrival-grid">
            <div className="panel">
              <div className="trace-head">
                <div>
                  <h2>Productos incluidos en la caja</h2>
                  <p>Marca únicamente los productos encontrados físicamente.</p>
                </div>
                <span>{selected.items.length} productos</span>
              </div>
              <div className="arrival-items simple">
                {selected.items.map((i, n) => (
                  <article
                    className={checks[i.folio] ? "checked" : ""}
                    key={i.folio}
                  >
                    <span>{n + 1}</span>
                    <div>
                      <small>{i.folio}</small>
                      <strong>{i.producto}</strong>
                      <p>{i.sku} · 1 pieza</p>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(checks[i.folio])}
                        onChange={(e) =>
                          setChecks((x) => ({
                            ...x,
                            [i.folio]: e.target.checked,
                          }))
                        }
                      />
                      <i>{checks[i.folio] ? "✓" : ""}</i>
                      <b>
                        {checks[i.folio]
                          ? "Producto confirmado"
                          : "Confirmar producto"}
                      </b>
                    </label>
                  </article>
                ))}
              </div>
            </div>
            <aside className="panel arrival-actions">
              <Cab t="Conciliación" s="Acciones sobre la caja seleccionada" />
              <button onClick={labels}>▤ Generar etiquetas</button>
              <button
                className={incident ? "incident-done" : ""}
                onClick={() => setDifference(true)}
              >
                ! Reportar diferencia{" "}
                {pending.length ? `(${pending.length})` : ""}
              </button>
              <button
                className="primario"
                disabled={confirmed !== selected.items.length && !incident}
                onClick={() =>
                  avisar(`${selected.numero} recibida y enviada a Diagnóstico`)
                }
              >
                Confirmar recepción　→
              </button>
              <p>
                Al reportar una diferencia se incluirán automáticamente los
                productos que no fueron confirmados.
              </p>
            </aside>
          </div>
          {difference && (
            <div className="incident-sheet">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setDifference(false);
                  setIncident(true);
                  avisar("Incidencia creada con los productos no confirmados");
                }}
              >
                <button type="button" onClick={() => setDifference(false)}>
                  ×
                </button>
                <small>PRODUCTOS NO CONFIRMADOS</small>
                <h2>Reportar diferencia</h2>
                <p>
                  {selected.numero} · {selected.sucursal}
                </p>
                <div className="missing-products">
                  {pending.length ? (
                    pending.map((i) => (
                      <div key={i.folio}>
                        <i>!</i>
                        <span>
                          <b>{i.producto}</b>
                          <small>
                            {i.folio} · {i.sku}
                          </small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="all-confirmed">
                      Todos los productos están confirmados.
                    </div>
                  )}
                </div>
                <label>
                  Detalle de la diferencia
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe las condiciones encontradas…"
                  />
                </label>
                <footer>
                  <button type="button" onClick={() => setDifference(false)}>
                    Cancelar
                  </button>
                  <button className="primario" disabled={!pending.length}>
                    Crear incidencia
                  </button>
                </footer>
              </form>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const diagnosticSeed = [
  {
    id: "GE-260824-1842",
    sku: "BO-AL394",
    product: "Alternador Bosch 12V",
    branch: "Zapopan Norte",
    box: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1841",
    sku: "LTH-H47",
    product: "Batería LTH H-47",
    branch: "Zapopan Norte",
    box: "GX-ZPN-008",
  },
  {
    id: "GE-260824-1828",
    sku: "FR-D1287",
    product: "Juego de balatas Fritec",
    branch: "GDL Centro",
    box: "GX-GDL-014",
  },
  {
    id: "GE-260824-1824",
    sku: "GMB-1256",
    product: "Bomba de agua GMB",
    branch: "GDL Centro",
    box: "GX-GDL-014",
  },
];
function DiagnosisDisposition({ avisar }: { avisar: (s: string) => void }) {
  const [branch, setBranch] = useState(""),
    [items, setItems] = useState(diagnosticSeed),
    [dest, setDest] = useState<Record<string, string>>({});
  const filtered = items.filter((i) => i.branch === branch),
    options = [
      "A destrucción",
      "Almacén Proveedor",
      "A reparación",
      "Retorno a Sucursal",
    ];
  return (
    <section className="diagnostic-by-branch">
      <div className="panel diagnostic-selector">
        <div>
          <small>PASO 1</small>
          <h2>Selecciona la sucursal</h2>
          <p>
            Se cargarán únicamente las piezas recibidas pendientes de
            diagnóstico.
          </p>
        </div>
        <label>
          Sucursal
          <select value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="">Seleccionar sucursal</option>
            {[...new Set(items.map((i) => i.branch))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <span>{branch ? `${filtered.length} pendientes` : "—"}</span>
      </div>
      {!branch ? (
        <div className="panel arrival-empty">
          <i>◇</i>
          <h2>Solicitudes pendientes de diagnóstico</h2>
          <p>Selecciona una sucursal para comenzar.</p>
        </div>
      ) : (
        <div className="panel">
          <div className="trace-head">
            <div>
              <h2>{branch}</h2>
              <p>Determina la disposición y confirma individualmente.</p>
            </div>
            <span>{filtered.length} solicitudes</span>
          </div>
          <div className="diagnostic-cards">
            {filtered.length ? (
              filtered.map((i) => (
                <article key={i.id}>
                  <div>
                    <small>
                      {i.id} · {i.box}
                    </small>
                    <strong>{i.product}</strong>
                    <p>{i.sku} · 1 pieza</p>
                  </div>
                  <label>
                    Destino autorizado
                    <select
                      value={dest[i.id] || ""}
                      onChange={(e) =>
                        setDest((x) => ({ ...x, [i.id]: e.target.value }))
                      }
                    >
                      <option value="">Seleccionar destino</option>
                      {options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="primario compact-confirm"
                    disabled={!dest[i.id]}
                    onClick={async () => {
                      const d = dest[i.id];
                      if (
                        !(await askQuestion(
                          `¿Confirmas la disposición de ${i.id} como “${d}”? La solicitud saldrá de la lista pendiente.`,
                        ))
                      )
                        return;
                      setItems((x) => x.filter((p) => p.id !== i.id));
                      avisar(`${i.id}: disposición confirmada — ${d}`);
                    }}
                  >
                    Confirmar
                  </button>
                </article>
              ))
            ) : (
              <div className="trace-empty">
                <i>✓</i>
                <strong>Diagnóstico completado</strong>
                <p>No quedan solicitudes pendientes para esta sucursal.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const warehouseSeed = [
  {
    id: "GE-260824-1842",
    sku: "BO-AL394",
    product: "Alternador Bosch 12V",
    branch: "Zapopan Norte",
    destination: "A reparación",
    location: "R-02-B",
    same: 3,
  },
  {
    id: "GE-260824-1828",
    sku: "FR-D1287",
    product: "Juego de balatas Fritec",
    branch: "GDL Centro",
    destination: "Almacén Proveedor",
    location: "P-07-A",
    same: 6,
  },
  {
    id: "GE-260823-1791",
    sku: "BO-AL394",
    product: "Alternador Bosch 12V",
    branch: "León Torres",
    destination: "Almacén Proveedor",
    location: "P-03-C",
    same: 3,
  },
  {
    id: "GE-260824-1862",
    sku: "MO-7281",
    product: "Amortiguador Monroe",
    branch: "Aguascalientes Sur",
    destination: "A reparación",
    location: "",
    same: 0,
  },
  {
    id: "GE-260824-1860",
    sku: "NGK-7090",
    product: "Bujía NGK Iridium",
    branch: "León Torres",
    destination: "Almacén Proveedor",
    location: "",
    same: 0,
  },
];
function PreviousWarrantyWarehouse({
  avisar,
}: {
  avisar: (s: string) => void;
}) {
  const [selected, setSelected] = useState(warehouseSeed[0]);
  return (
    <section className="warehouse-workspace">
      <div className="panel warehouse-list">
        <div className="trace-head">
          <div>
            <h2>Solicitudes almacenadas</h2>
            <p>Piezas con disposición Almacén Proveedor o A reparación.</p>
          </div>
          <span>{warehouseSeed.length} solicitudes</span>
        </div>
        {warehouseSeed.map((i) => (
          <button
            className={selected.id === i.id ? "selected" : ""}
            key={i.id}
            onClick={() => setSelected(i)}
          >
            <i>▤</i>
            <div>
              <small>
                {i.id} · {i.branch}
              </small>
              <strong>{i.product}</strong>
              <p>{i.sku}</p>
            </div>
            <em>{i.destination}</em>
          </button>
        ))}
      </div>
      <aside className="panel warehouse-detail">
        <small>DETALLE DE ALMACENAMIENTO</small>
        <h2>{selected.product}</h2>
        <p>
          {selected.id} · {selected.sku}
        </p>
        <span className="warehouse-destination">{selected.destination}</span>
        <div className="warehouse-location">
          <article>
            <small>UBICACIÓN</small>
            <b>{selected.location}</b>
            <span>Pasillo · Rack · Nivel</span>
          </article>
          <article>
            <small>MISMO CÓDIGO</small>
            <b>{selected.same} piezas</b>
            <span>Existencia total almacenada</span>
          </article>
        </div>
        <div className="same-code">
          <h3>Otras piezas del código {selected.sku}</h3>
          {warehouseSeed
            .filter((i) => i.sku === selected.sku && i.id !== selected.id)
            .map((i) => (
              <div key={i.id}>
                <span>
                  <b>{i.id}</b>
                  <small>{i.destination}</small>
                </span>
                <em>{i.location}</em>
              </div>
            ))}
          {!warehouseSeed.some(
            (i) => i.sku === selected.sku && i.id !== selected.id,
          ) && <p>No existen otras solicitudes de este código.</p>}
        </div>
        <button
          className="primario"
          onClick={() => avisar("Movimiento de almacén abierto")}
        >
          Registrar movimiento
        </button>
      </aside>
    </section>
  );
}

function PriorReceptionArrival({ avisar }: { avisar: (s: string) => void }) {
  const [branch, setBranch] = useState(""),
    [box, setBox] = useState(""),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [difference, setDifference] = useState(false),
    [reported, setReported] = useState<string[]>([]),
    [done, setDone] = useState(false);
  const selected = cajasCentral.find((c) => c.numero === box),
    visible = done
      ? selected?.items.filter((i) => reported.includes(i.folio)) || []
      : selected?.items || [],
    pending = (selected?.items || []).filter((i) => !checks[i.folio]);
  const confirm = () => {
    setDone(true);
    avisar(
      reported.length
        ? "Recepción confirmada; se conserva únicamente el código con diferencia"
        : "Recepción confirmada; solicitudes retiradas de la bandeja",
    );
  };
  return (
    <section className="arrival-workspace">
      <div className="panel arrival-toolbar">
        <div>
          <small>RECEPCIÓN CENTRAL</small>
          <h2>Cajas pendientes de arribo</h2>
          <p>Concilia el contenido físico contra la relación logística.</p>
        </div>
        <label>
          Sucursal
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setBox("");
              setDone(false);
            }}
          >
            <option value="">Seleccionar sucursal</option>
            {[...new Set(cajasCentral.map((c) => c.sucursal))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Caja
          <select
            value={box}
            disabled={!branch}
            onChange={(e) => {
              setBox(e.target.value);
              setChecks({});
              setDone(false);
              setReported([]);
            }}
          >
            <option value="">Seleccionar caja</option>
            {cajasCentral
              .filter((c) => c.sucursal === branch)
              .map((c) => (
                <option key={c.numero}>{c.numero}</option>
              ))}
          </select>
        </label>
        <button
          onClick={() =>
            avisar(
              selected
                ? `Etiquetas generadas para ${selected.numero}`
                : "Plantilla de etiquetas disponible",
            )
          }
        >
          ▤ Generar etiquetas
        </button>
      </div>
      {!selected ? (
        <div className="panel arrival-empty">
          <i>▣</i>
          <h2>Selecciona una caja pendiente</h2>
          <p>
            La generación de etiquetas está disponible sin seleccionar
            productos.
          </p>
        </div>
      ) : (
        <div className="arrival-grid">
          <div className="panel">
            <div className="trace-head">
              <div>
                <h2>
                  {done ? "Resultado de la recepción" : "Contenido de la caja"}
                </h2>
                <p>
                  {done
                    ? visible.length
                      ? "Sólo permanece el código reportado con diferencia."
                      : "La caja fue conciliada completamente."
                    : "Confirma cada producto encontrado."}
                </p>
              </div>
              <span>{visible.length} productos</span>
            </div>
            <div className="arrival-items simple">
              {visible.length ? (
                visible.map((i, n) => (
                  <article
                    className={checks[i.folio] ? "checked" : ""}
                    key={i.folio}
                  >
                    <span>{n + 1}</span>
                    <div>
                      <small>{i.folio}</small>
                      <strong>{i.producto}</strong>
                      <p>{i.sku} · 1 pieza</p>
                    </div>
                    {!done ? (
                      <label>
                        <input
                          type="checkbox"
                          checked={Boolean(checks[i.folio])}
                          onChange={(e) =>
                            setChecks((x) => ({
                              ...x,
                              [i.folio]: e.target.checked,
                            }))
                          }
                        />
                        <i>{checks[i.folio] ? "✓" : ""}</i>
                        <b>
                          {checks[i.folio]
                            ? "Confirmado"
                            : "Confirmar producto"}
                        </b>
                      </label>
                    ) : (
                      <em className="difference-code">Diferencia reportada</em>
                    )}
                  </article>
                ))
              ) : (
                <div className="trace-empty">
                  <i>✓</i>
                  <strong>Recepción completada</strong>
                  <p>No existen solicitudes pendientes en esta caja.</p>
                </div>
              )}
            </div>
          </div>
          <aside className="panel arrival-actions">
            <Cab t="Acciones" s="Recepción de la caja seleccionada" />
            <button
              onClick={() =>
                avisar(`Etiquetas generadas para ${selected.numero}`)
              }
            >
              ▤ Generar etiquetas
            </button>
            <button disabled={done} onClick={() => setDifference(true)}>
              ! Reportar diferencia ({pending.length})
            </button>
            <button
              className="primario"
              disabled={done || (!reported.length && pending.length > 0)}
              onClick={confirm}
            >
              Confirmar recepción
            </button>
          </aside>
        </div>
      )}
      {difference && selected && (
        <div className="incident-sheet">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setReported(pending.map((i) => i.folio));
              setDifference(false);
              avisar("Diferencia registrada");
            }}
          >
            <button type="button" onClick={() => setDifference(false)}>
              ×
            </button>
            <small>PRODUCTOS NO CONFIRMADOS</small>
            <h2>Reportar diferencia</h2>
            <div className="missing-products">
              {pending.map((i) => (
                <div key={i.folio}>
                  <i>!</i>
                  <span>
                    <b>{i.producto}</b>
                    <small>
                      {i.folio} · {i.sku}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <label>
              Observaciones
              <textarea required rows={4} />
            </label>
            <footer>
              <button type="button" onClick={() => setDifference(false)}>
                Cancelar
              </button>
              <button className="primario" disabled={!pending.length}>
                Crear incidencia
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function PriorWarrantyWarehouse({ avisar }: { avisar: (s: string) => void }) {
  const [selected, setSelected] = useState(warehouseSeed[0]),
    [locations, setLocations] = useState<
      Record<string, { name: string; qty: number }[]>
    >({
      "BO-AL394": [{ name: "R-02-B", qty: 3 }],
      "FR-D1287": [{ name: "P-07-A", qty: 6 }],
    }),
    [mode, setMode] = useState<"existing" | "new">("existing"),
    [newLocation, setNewLocation] = useState("");
  const list = locations[selected.sku] || [],
    total = list.reduce((a, b) => a + b.qty, 0),
    confirm = () => {
      if (mode === "new" && !newLocation.trim()) return;
      const name = mode === "new" ? newLocation.trim() : selected.location;
      setLocations((x) => {
        const cur = x[selected.sku] || [],
          found = cur.find((l) => l.name === name);
        return {
          ...x,
          [selected.sku]: found
            ? cur.map((l) => (l.name === name ? { ...l, qty: l.qty + 1 } : l))
            : [...cur, { name, qty: 1 }],
        };
      });
      setNewLocation("");
      avisar(
        `Ubicación ${name} confirmada; existencia incrementada en 1 pieza`,
      );
    };
  return (
    <section className="warehouse-workspace">
      <div className="panel warehouse-list">
        <div className="trace-head">
          <div>
            <h2>Solicitudes almacenadas</h2>
            <p>Selecciona una solicitud para registrar su ubicación.</p>
          </div>
          <span>{warehouseSeed.length}</span>
        </div>
        {warehouseSeed.map((i) => (
          <button
            className={selected.id === i.id ? "selected" : ""}
            key={i.id}
            onClick={() => {
              setSelected(i);
              setMode("existing");
            }}
          >
            <i>▤</i>
            <div>
              <small>
                {i.id} · {i.branch}
              </small>
              <strong>{i.product}</strong>
              <p>{i.sku}</p>
            </div>
            <em>{i.destination}</em>
          </button>
        ))}
      </div>
      <aside className="panel warehouse-detail">
        <small>UBICACIÓN DEL PRODUCTO</small>
        <h2>{selected.product}</h2>
        <p>
          {selected.id} · {selected.sku} · Cantidad de solicitud: 1
        </p>
        <div className="warehouse-location-list">
          {list.map((l) => (
            <article key={l.name}>
              <span>
                <small>UBICACIÓN</small>
                <b>{l.name}</b>
              </span>
              <strong>{l.qty} piezas</strong>
            </article>
          ))}
        </div>
        <div className="warehouse-total">
          <span>Existencia total del SKU</span>
          <b>{total} piezas</b>
        </div>
        <div className="location-choice">
          <button
            className={mode === "existing" ? "active" : ""}
            onClick={() => setMode("existing")}
          >
            Usar ubicación sugerida
          </button>
          <button
            className={mode === "new" ? "active" : ""}
            onClick={() => setMode("new")}
          >
            Nueva ubicación
          </button>
        </div>
        {mode === "existing" ? (
          <div className="suggested-location">
            <small>UBICACIÓN SUGERIDA</small>
            <b>{selected.location}</b>
            <p>Se incrementará 1 pieza en esta ubicación.</p>
          </div>
        ) : (
          <label className="new-location">
            Nueva ubicación
            <input
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
              placeholder="Ej. R-04-C"
            />
          </label>
        )}
        <button
          className="primario compact-action-button"
          disabled={mode === "new" && !newLocation.trim()}
          onClick={confirm}
        >
          Confirmar ubicación
        </button>
      </aside>
    </section>
  );
}

function ReceptionArrival({ avisar }: { avisar: (s: string) => void }) {
  const [branch, setBranch] = useState(""),
    [box, setBox] = useState(""),
    [checks, setChecks] = useState<Record<string, boolean>>({}),
    [moved, setMoved] = useState<string[]>([]),
    [labelsReady, setLabelsReady] = useState(false),
    [difference, setDifference] = useState(false),
    [reported, setReported] = useState<string[]>([]);
  const selected = cajasCentral.find((c) => c.numero === box),
    visible = (selected?.items || []).filter((i) => !moved.includes(i.folio)),
    selectedCount = visible.filter((i) => checks[i.folio]).length,
    pending = visible.filter((i) => !checks[i.folio]);
  const labels = () => {
      setLabelsReady(true);
      avisar(
        selected
          ? `Etiquetas generadas para ${selected.numero}; recepción habilitada`
          : "Plantilla de etiquetas generada",
      );
    },
    confirm = async () => {
      const ids = visible.filter((i) => checks[i.folio]).map((i) => i.folio);
      if (
        !(await askQuestion(
          `¿Confirmas la recepción de ${ids.length} producto(s)? Los productos no seleccionados permanecerán en la caja.`,
        ))
      )
        return;
      setMoved((x) => [...x, ...ids]);
      setChecks({});
      setLabelsReady(false);
      avisar(
        `${ids.length} producto(s) recibidos; los no seleccionados permanecen en la caja`,
      );
    };
  return (
    <section className="arrival-workspace">
      <div className="panel arrival-toolbar">
        <div>
          <small>RECEPCIÓN CENTRAL</small>
          <h2>Cajas pendientes de arribo</h2>
          <p>
            La recepción se aplica únicamente a los productos seleccionados.
          </p>
        </div>
        <label>
          Sucursal
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value);
              setBox("");
              setChecks({});
              setMoved([]);
            }}
          >
            <option value="">Seleccionar sucursal</option>
            {[...new Set(cajasCentral.map((c) => c.sucursal))].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Caja
          <select
            value={box}
            disabled={!branch}
            onChange={(e) => {
              setBox(e.target.value);
              setChecks({});
              setMoved([]);
              setLabelsReady(false);
            }}
          >
            <option value="">Seleccionar caja</option>
            {cajasCentral
              .filter((c) => c.sucursal === branch)
              .map((c) => (
                <option key={c.numero}>{c.numero}</option>
              ))}
          </select>
        </label>
        <button onClick={labels}>▤ Generar etiquetas</button>
      </div>
      {!selected ? (
        <div className="panel arrival-empty">
          <i>▣</i>
          <h2>Selecciona una caja</h2>
          <p>
            Puedes generar la plantilla de etiquetas sin seleccionar productos.
          </p>
        </div>
      ) : (
        <div className="arrival-grid">
          <div className="panel">
            <div className="trace-head">
              <div>
                <h2>Contenido pendiente de la caja</h2>
                <p>Los productos no marcados permanecerán en este listado.</p>
              </div>
              <span>{visible.length} pendientes</span>
            </div>
            <div className="arrival-items simple">
              {visible.length ? (
                visible.map((i, n) => (
                  <article
                    className={checks[i.folio] ? "checked" : ""}
                    key={i.folio}
                  >
                    <span>{n + 1}</span>
                    <div>
                      <small>{i.folio}</small>
                      <strong>{i.producto}</strong>
                      <p>
                        {i.sku} · 1 pieza{" "}
                        {reported.includes(i.folio)
                          ? "· Diferencia reportada"
                          : ""}
                      </p>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={Boolean(checks[i.folio])}
                        onChange={(e) =>
                          setChecks((x) => ({
                            ...x,
                            [i.folio]: e.target.checked,
                          }))
                        }
                      />
                      <i>{checks[i.folio] ? "✓" : ""}</i>
                      <b>
                        {checks[i.folio] ? "Confirmado" : "Confirmar producto"}
                      </b>
                    </label>
                  </article>
                ))
              ) : (
                <div className="trace-empty">
                  <i>✓</i>
                  <strong>Caja recibida completamente</strong>
                  <p>No quedan productos pendientes.</p>
                </div>
              )}
            </div>
          </div>
          <aside className="panel arrival-actions">
            <Cab t="Acciones" s="Recepción parcial por selección" />
            <button onClick={labels}>▤ Generar etiquetas</button>
            <button
              disabled={!pending.length}
              onClick={() => setDifference(true)}
            >
              ! Reportar diferencia ({pending.length})
            </button>
            <button
              className="primario"
              disabled={!labelsReady || !selectedCount}
              onClick={confirm}
            >
              Confirmar recepción ({selectedCount})
            </button>
            <p>
              {labelsReady
                ? "Selecciona al menos un producto para confirmar."
                : "Genera las etiquetas para habilitar la confirmación."}
            </p>
          </aside>
        </div>
      )}
      {difference && (
        <div className="incident-sheet">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setReported((x) => [
                ...new Set([...x, ...pending.map((i) => i.folio)]),
              ]);
              setDifference(false);
              avisar("Diferencia registrada para productos no confirmados");
            }}
          >
            <button type="button" onClick={() => setDifference(false)}>
              ×
            </button>
            <small>PRODUCTOS NO CONFIRMADOS</small>
            <h2>Reportar diferencia</h2>
            <div className="missing-products">
              {pending.map((i) => (
                <div key={i.folio}>
                  <i>!</i>
                  <span>
                    <b>{i.producto}</b>
                    <small>
                      {i.folio} · {i.sku}
                    </small>
                  </span>
                </div>
              ))}
            </div>
            <label>
              Observaciones
              <textarea required rows={4} />
            </label>
            <footer>
              <button type="button" onClick={() => setDifference(false)}>
                Cancelar
              </button>
              <button className="primario">Crear incidencia</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function WarrantyWarehouse({ avisar }: { avisar: (s: string) => void }) {
  const [items, setItems] = useState(warehouseSeed),
    [selected, setSelected] = useState(warehouseSeed[0]),
    [tab, setTab] = useState<"pending" | "query">("pending"),
    [query, setQuery] = useState<"product" | "location">("product"),
    [locations, setLocations] = useState<
      Record<string, { name: string; qty: number }[]>
    >({
      "BO-AL394": [
        { name: "R-02-B", qty: 3 },
        { name: "P-01-A", qty: 1 },
      ],
      "FR-D1287": [{ name: "P-07-A", qty: 6 }],
    }),
    [mode, setMode] = useState<"existing" | "new">("existing"),
    [newLoc, setNewLoc] = useState(""),
    [chosenLoc, setChosenLoc] = useState("R-02-B"),
    [pickMode, setPickMode] = useState<"scan" | "manual">("scan"),
    [scan, setScan] = useState("");
  const choose = (item: (typeof warehouseSeed)[number]) => {
    setSelected(item);
    const available = locations[item.sku] || [];
    setMode(available.length ? "existing" : "new");
    setChosenLoc([...available].sort((a, b) => b.qty - a.qty)[0]?.name || "");
  };
  const scanProduct = () => {
      const value = scan.trim().toUpperCase(),
        found = items.find((i) => i.sku === value || i.id === value);
      if (found) {
        choose(found);
        avisar(`Producto ${found.sku} identificado por escaneo`);
      } else
        avisar(
          "No se encontró una solicitud pendiente para el código escaneado",
        );
    },
    simulateScan = () => {
      const sample = items.find((i) => i.sku === "BO-AL394") || items[0];
      if (!sample) {
        avisar("No hay productos pendientes para simular el escaneo");
        return;
      }
      setPickMode("scan");
      setScan(sample.sku);
      choose(sample);
      avisar(`Escaneo simulado: ${sample.sku} · ${sample.product}`);
    };
  const list = locations[selected?.sku] || [],
    suggested = [...list].sort((a, b) => b.qty - a.qty)[0],
    confirm = async () => {
      if (!selected) return;
      const name = mode === "new" ? newLoc : chosenLoc;
      if (!name) return;
      if (
        !(await askQuestion(
          `¿Confirmas almacenar ${selected.id} en la ubicación ${name}? Se incrementará la existencia y la solicitud saldrá de pendientes.`,
        ))
      )
        return;
      setLocations((x) => {
        const cur = x[selected.sku] || [],
          found = cur.find((l) => l.name === name);
        return {
          ...x,
          [selected.sku]: found
            ? cur.map((l) => (l.name === name ? { ...l, qty: l.qty + 1 } : l))
            : [...cur, { name, qty: 1 }],
        };
      });
      const rest = items.filter((i) => i.id !== selected.id);
      setItems(rest);
      setSelected(rest[0] || selected);
      setMode("existing");
      setNewLoc("");
      setChosenLoc("");
      setScan("");
      avisar(`Ubicación ${name} confirmada; solicitud retirada de pendientes`);
    };
  return (
    <section>
      <div className="warehouse-tabs">
        <button
          className={tab === "pending" ? "active" : ""}
          onClick={() => setTab("pending")}
        >
          Solicitudes pendientes
        </button>
        <button
          className={tab === "query" ? "active" : ""}
          onClick={() => setTab("query")}
        >
          Consulta de almacén
        </button>
      </div>
      {tab === "pending" ? (
        <>
          <div className="panel warehouse-picker">
            <div>
              <small>IDENTIFICAR PRODUCTO</small>
              <h2>Escanea o selecciona una solicitud</h2>
              <p>
                El código puede corresponder al SKU o al folio de Garantía
                Express.
              </p>
            </div>
            <div className="picker-mode">
              <button
                className={pickMode === "scan" ? "active" : ""}
                onClick={() => setPickMode("scan")}
              >
                ▥ Escanear código
              </button>
              <button
                className={pickMode === "manual" ? "active" : ""}
                onClick={() => setPickMode("manual")}
              >
                ☝ Selección manual
              </button>
            </div>
            {pickMode === "scan" ? (
              <div className="scan-control">
                <input
                  value={scan}
                  onChange={(e) => setScan(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && scanProduct()}
                  placeholder="Escanea o ingresa SKU / folio"
                  autoFocus
                />
                <button
                  className="primario"
                  disabled={!scan.trim()}
                  onClick={scanProduct}
                >
                  Buscar producto
                </button>
                <button
                  type="button"
                  className="simulate-scan"
                  onClick={simulateScan}
                >
                  ▥ Simular escaneo
                </button>
                <small>Ejemplos: BO-AL394, MO-7281 o GE-260824-1842</small>
              </div>
            ) : (
              <label className="manual-select">
                Solicitud pendiente
                <select
                  value={selected?.id || ""}
                  onChange={(e) => {
                    const found = items.find((i) => i.id === e.target.value);
                    if (found) choose(found);
                  }}
                >
                  <option value="">Seleccionar solicitud</option>
                  {items.map((i) => (
                    <option value={i.id} key={i.id}>
                      {i.id} · {i.sku} · {i.product}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="warehouse-workspace">
            <div className="panel warehouse-list">
              <div className="trace-head">
                <div>
                  <h2>Solicitudes por ubicar</h2>
                  <p>
                    {pickMode === "scan"
                      ? "El producto identificado queda seleccionado."
                      : "Selecciona una solicitud de la lista."}
                  </p>
                </div>
                <span>{items.length}</span>
              </div>
              {items.length ? (
                items.map((i) => (
                  <button
                    className={selected?.id === i.id ? "selected" : ""}
                    key={i.id}
                    onClick={() => {
                      setPickMode("manual");
                      choose(i);
                    }}
                  >
                    <i>▤</i>
                    <div>
                      <small>{i.id}</small>
                      <strong>{i.product}</strong>
                      <p>{i.sku}</p>
                    </div>
                    <em>{i.destination}</em>
                  </button>
                ))
              ) : (
                <div className="trace-empty">
                  <i>✓</i>
                  <strong>Sin solicitudes pendientes</strong>
                </div>
              )}
            </div>
            {selected && items.some((i) => i.id === selected.id) && (
              <aside className="panel warehouse-detail">
                <small>CONFIRMAR UBICACIÓN</small>
                <h2>{selected.product}</h2>
                <p>
                  {selected.id} · {selected.sku}
                </p>
                <div className="warehouse-location-list">
                  {list.map((l) => (
                    <button
                      type="button"
                      className={`${suggested?.name === l.name ? "suggested" : ""} ${chosenLoc === l.name ? "chosen" : ""}`}
                      key={l.name}
                      onClick={() => {
                        setChosenLoc(l.name);
                        setMode("existing");
                      }}
                    >
                      <span>
                        <small>
                          {suggested?.name === l.name
                            ? "SUGERIDA · MAYOR EXISTENCIA"
                            : "UBICACIÓN DISPONIBLE"}
                        </small>
                        <b>{l.name}</b>
                      </span>
                      <strong>{l.qty} piezas</strong>
                      <i>{chosenLoc === l.name ? "✓" : ""}</i>
                    </button>
                  ))}
                </div>
                {suggested ? (
                  <>
                    <div className="location-choice">
                      <button
                        className={mode === "existing" ? "active" : ""}
                        onClick={() => setMode("existing")}
                      >
                        Ubicación existente
                      </button>
                      <button
                        className={mode === "new" ? "active" : ""}
                        onClick={() => setMode("new")}
                      >
                        Nueva ubicación
                      </button>
                    </div>
                    {mode === "existing" ? (
                      <div className="suggested-location">
                        <b>{chosenLoc || suggested.name}</b>
                        <p>
                          {chosenLoc === suggested.name
                            ? `Es la ubicación con más piezas: ${suggested.qty}.`
                            : "Ubicación seleccionada por el usuario."}{" "}
                          Se incrementará 1 pieza.
                        </p>
                      </div>
                    ) : (
                      <label className="new-location">
                        Nueva ubicación
                        <input
                          value={newLoc}
                          onChange={(e) => setNewLoc(e.target.value)}
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <>
                    <div className="no-location">
                      <i>!</i>
                      <span>
                        <b>No existen ubicaciones con este producto</b>
                        <small>
                          Debes registrar una nueva ubicación para continuar.
                        </small>
                      </span>
                    </div>
                    <button
                      className="new-only active"
                      onClick={() => setMode("new")}
                    >
                      ＋ Nueva ubicación
                    </button>
                    <label className="new-location">
                      Nueva ubicación
                      <input
                        autoFocus
                        value={newLoc}
                        onChange={(e) => setNewLoc(e.target.value)}
                        placeholder="Ej. R-04-C"
                      />
                    </label>
                  </>
                )}
                <button
                  className="primario compact-action-button"
                  disabled={
                    (mode === "new" && !newLoc) ||
                    (!suggested && mode !== "new")
                  }
                  onClick={confirm}
                >
                  Confirmar ubicación
                </button>
              </aside>
            )}
          </div>
        </>
      ) : (
        <div className="panel warehouse-query">
          <div className="trace-head">
            <div>
              <h2>Consulta de existencias</h2>
              <p>Busca inventario por producto o por ubicación.</p>
            </div>
            <div className="query-mode">
              <button
                className={query === "product" ? "active" : ""}
                onClick={() => setQuery("product")}
              >
                Por producto
              </button>
              <button
                className={query === "location" ? "active" : ""}
                onClick={() => setQuery("location")}
              >
                Por ubicación
              </button>
            </div>
          </div>
          <label>
            Buscar {query === "product" ? "SKU o descripción" : "ubicación"}
            <input
              placeholder={query === "product" ? "Ej. BO-AL394" : "Ej. R-02-B"}
            />
          </label>
          <div className="query-results">
            {Object.entries(locations).flatMap(([sku, ls]) =>
              ls.map((l) => (
                <article key={sku + l.name}>
                  <span>
                    <small>SKU</small>
                    <b>{sku}</b>
                  </span>
                  <span>
                    <small>UBICACIÓN</small>
                    <b>{l.name}</b>
                  </span>
                  <span>
                    <small>EXISTENCIA</small>
                    <b>{l.qty} piezas</b>
                  </span>
                </article>
              )),
            )}
          </div>
        </div>
      )}
    </section>
  );
}

type DispositionType =
  "Almacén de reparación" | "Destrucción" | "Almacén proveedor" | "Retorno";
type DispositionItem = {
  id: string;
  sku: string;
  product: string;
  branch: string;
  box: string;
  destination: DispositionType;
  note: string;
  date: string;
};
function DispositionBoard({
  avisar,
  onTransfer,
}: {
  avisar: (s: string) => void;
  onTransfer: (items: DispositionItem[]) => void;
}) {
  const destinations: DispositionType[] = [
      "Almacén de reparación",
      "Destrucción",
      "Almacén proveedor",
      "Retorno",
    ],
    [active, setActive] = useState<DispositionType>("Almacén de reparación"),
    [items, setItems] = useState<DispositionItem[]>([
      {
        id: "GE-260824-1837",
        sku: "DE-2341",
        product: "Sensor de oxígeno Denso",
        branch: "Aguascalientes Sur",
        box: "GX-AGS-006",
        destination: "Destrucción",
        note: "Evidencia fotográfica y peso requeridos",
        date: "24 ago · 17:30",
      },
      {
        id: "GE-260823-1799",
        sku: "FR-D1287",
        product: "Juego de balatas Fritec",
        branch: "Zapopan Norte",
        box: "GX-ZPN-008",
        destination: "Destrucción",
        note: "Pendiente de visita de auditoría",
        date: "24 ago · 13:08",
      },
      {
        id: "GE-260824-1826",
        sku: "GMB-1256",
        product: "Bomba de agua GMB",
        branch: "GDL Centro",
        box: "GX-GDL-012",
        destination: "Almacén proveedor",
        note: "Ubicación sugerida P-07-A",
        date: "24 ago · 12:14",
      },
      {
        id: "GE-260823-1788",
        sku: "NGK-7090",
        product: "Bujía NGK Iridium",
        branch: "León Torres",
        box: "GX-LEO-002",
        destination: "Almacén proveedor",
        note: "Agrupar para recuperación con proveedor",
        date: "23 ago · 16:21",
      },
      {
        id: "GE-260824-1828",
        sku: "FR-D1287",
        product: "Juego de balatas Fritec",
        branch: "Zapopan Norte",
        box: "GX-ZPN-007",
        destination: "Retorno",
        note: "Retornar a sucursal de origen",
        date: "24 ago · 11:55",
      },
      {
        id: "GE-260824-1845",
        sku: "BO-AL394",
        product: "Alternador Bosch 12V",
        branch: "Zapopan Norte",
        box: "GX-ZPN-009",
        destination: "Retorno",
        note: "Devolución posterior a diagnóstico",
        date: "25 ago · 08:35",
      },
      {
        id: "GE-260824-1847",
        sku: "GMB-1256",
        product: "Bomba de agua GMB",
        branch: "GDL Centro",
        box: "GX-GDL-016",
        destination: "Retorno",
        note: "Retorno autorizado a sucursal",
        date: "25 ago · 09:12",
      },
      {
        id: "GE-260824-1849",
        sku: "NGK-7090",
        product: "Bujía NGK Iridium",
        branch: "León Torres",
        box: "GX-LEO-010",
        destination: "Retorno",
        note: "Producto disponible para retorno",
        date: "25 ago · 09:48",
      },
    ]),
    [moveTo, setMoveTo] = useState<Record<string, DispositionType>>({}),
    [selected, setSelected] = useState<string[]>([]),
    [search, setSearch] = useState(""),
    [transferSku, setTransferSku] = useState(""),
    [transferQty, setTransferQty] = useState(0),
    [withdrawals, setWithdrawals] = useState<Record<string, number>>({}),
    [shipBranch, setShipBranch] = useState(""),
    [destroySku, setDestroySku] = useState(""),
    [destroyQty, setDestroyQty] = useState(0),
    [destructionStock, setDestructionStock] = useState<Record<string, number>>({
      "DE-2341": 7,
      "FR-D1287": 4,
    }),
    [locationStock, setLocationStock] = useState<
      Record<string, { location: string; qty: number }[]>
    >({
      "BO-AL394": [
        { location: "REP-A-01", qty: 5 },
        { location: "REP-B-03", qty: 5 },
      ],
      "MO-7281": [
        { location: "REP-C-02", qty: 3 },
        { location: "REP-A-04", qty: 2 },
      ],
      "FR-D1287": [{ location: "REP-D-01", qty: 4 }],
      "DE-2341": [{ location: "REP-B-05", qty: 2 }],
    }),
    [providerStock, setProviderStock] = useState<
      Record<string, { location: string; qty: number }[]>
    >({
      "GMB-1256": [
        { location: "PROV-P-07-A", qty: 6 },
        { location: "PROV-P-08-C", qty: 4 },
      ],
      "NGK-7090": [
        { location: "PROV-N-02-B", qty: 5 },
        { location: "PROV-N-04-A", qty: 3 },
      ],
    }),
    products = useState<Record<string, string>>({
      "BO-AL394": "Alternador Bosch 12V",
      "MO-7281": "Amortiguador Monroe",
      "FR-D1287": "Juego de balatas Fritec",
      "DE-2341": "Sensor de oxígeno Denso",
      "GMB-1256": "Bomba de agua GMB",
      "NGK-7090": "Bujía NGK Iridium",
    })[0],
    providerNumbers = useState<Record<string, string>>({
      "GMB-1256": "PRV-1028",
      "NGK-7090": "PRV-2145",
    })[0];
  const currentStock =
      active === "Almacén proveedor" ? providerStock : locationStock,
    grouped = Object.entries(currentStock)
      .map(([sku, locations]) => ({
        sku,
        product: products[sku] || sku,
        provider: providerNumbers[sku] || "",
        locations,
        total: locations.reduce((s, l) => s + l.qty, 0),
      }))
      .filter(
        (g) =>
          g.total > 0 &&
          (!search.trim() ||
            `${g.sku} ${g.product} ${g.provider}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    filtered = items.filter(
      (i) =>
        i.destination === active &&
        (!search.trim() ||
          [i.id, i.sku, i.product, i.branch].some((v) =>
            v.toLowerCase().includes(search.toLowerCase()),
          )),
    ),
    move = async (item: DispositionItem) => {
      const target = moveTo[item.id];
      if (!target || target === item.destination) return;
      if (
        !(await askQuestion(
          `¿Confirmas mover ${item.id} de “${item.destination}” a “${target}”? Este cambio actualizará su disposición autorizada.`,
        ))
      )
        return;
      setItems((x) =>
        x.map((i) =>
          i.id === item.id
            ? {
                ...i,
                destination: target,
                note: `Movida desde ${item.destination} por el técnico de Garantías`,
                date: "25 ago · Ahora",
              }
            : i,
        ),
      );
      setMoveTo((x) => {
        const next = { ...x };
        delete next[item.id];
        return next;
      });
      avisar(`${item.id} movida a ${target}`);
    };
  const toggle = (id: string) =>
      setSelected((x) =>
        x.includes(id) ? x.filter((n) => n !== id) : [...x, id],
      ),
    chosen = filtered.filter((x) => selected.includes(x.id)),
    stockTotal = Object.values(currentStock)
      .flat()
      .reduce((s, l) => s + l.qty, 0),
    transferGroup =
      grouped.find((g) => g.sku === transferSku) ||
      Object.entries(currentStock)
        .map(([sku, locations]) => ({
          sku,
          product: products[sku] || sku,
          locations,
          total: locations.reduce((s, l) => s + l.qty, 0),
        }))
        .find((g) => g.sku === transferSku),
    destructionGroups = Object.entries(destructionStock)
      .map(([sku, total]) => ({ sku, product: products[sku] || sku, total }))
      .filter(
        (g) =>
          g.total > 0 &&
          (!search.trim() ||
            `${g.sku} ${g.product}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    destroyGroup = Object.entries(destructionStock)
      .map(([sku, total]) => ({ sku, product: products[sku] || sku, total }))
      .find((g) => g.sku === destroySku),
    returnGroups = items
      .filter(
        (i) =>
          i.destination === "Retorno" &&
          (!search.trim() ||
            [i.branch, i.id, i.sku, i.product].some((v) =>
              v.toLowerCase().includes(search.toLowerCase()),
            )),
      )
      .reduce(
        (a, i) => ({ ...a, [i.branch]: [...(a[i.branch] || []), i] }),
        {} as Record<string, DispositionItem[]>,
      ),
    allocated = Object.values(withdrawals).reduce(
      (s, n) => s + (Number(n) || 0),
      0,
    );
  const startTransfer = (sku: string) => {
      setTransferSku(sku);
      setTransferQty(0);
      setWithdrawals({});
    },
    moveGroup = async (sku: string) => {
      const target = moveTo[sku],
        source = active;
      if (!target || target === source) return;
      const locations = currentStock[sku] || [],
        total = locations.reduce((s, l) => s + l.qty, 0);
      if (
        !(await askQuestion(
          `¿Confirmas mover ${sku} (${total} piezas) de “${source}” a “${target}”?`,
        ))
      )
        return;
      if (source === "Almacén proveedor")
        setProviderStock((s) => {
          const n = { ...s };
          delete n[sku];
          return n;
        });
      else
        setLocationStock((s) => {
          const n = { ...s };
          delete n[sku];
          return n;
        });
      if (target === "Almacén proveedor")
        setProviderStock((s) => ({
          ...s,
          [sku]: locations.map((l) => ({
            ...l,
            location: l.location.replace("REP-", "PROV-"),
          })),
        }));
      else if (target === "Almacén de reparación")
        setLocationStock((s) => ({
          ...s,
          [sku]: locations.map((l) => ({
            ...l,
            location: l.location.replace("PROV-", "REP-"),
          })),
        }));
      else
        setItems((x) => [
          {
            id: `MOV-${sku}-${Date.now()}`,
            sku,
            product: products[sku] || sku,
            branch: "Garantías Central",
            box: "Movimiento agrupado",
            destination: target,
            note: `${total} piezas movidas desde ${source}`,
            date: "25 ago · Ahora",
          },
          ...x,
        ]);
      setMoveTo((x) => {
        const n = { ...x };
        delete n[sku];
        return n;
      });
      avisar(`${sku} movido a ${target}`);
    },
    destruct = async () => {
      if (
        !chosen.length ||
        !(await askQuestion(
          `¿Confirmas dar de baja por destrucción ${chosen.length} solicitud(es)? Esta acción retirará los registros de esta lista.`,
        ))
      )
        return;
      setItems((x) => x.filter((i) => !selected.includes(i.id)));
      setSelected([]);
      avisar(`${chosen.length} solicitud(es) dadas de baja por destrucción`);
    };
  const confirmTransfer = async () => {
    if (!transferGroup || transferQty < 1 || allocated !== transferQty) return;
    const provider = active === "Almacén proveedor",
      recipient = provider ? "Proveedor" : "Técnico";
    if (
      !(await askQuestion(
        `¿Confirmas enviar ${transferQty} pieza(s) de ${transferSku} a ${recipient}? Se descontarán de ${Object.values(withdrawals).filter(Boolean).length} ubicación(es).`,
      ))
    )
      return;
    const updater = (
      s: Record<string, { location: string; qty: number }[]>,
    ) => ({
      ...s,
      [transferSku]: s[transferSku].map((l) => ({
        ...l,
        qty: l.qty - (withdrawals[l.location] || 0),
      })),
    });
    if (provider) setProviderStock(updater);
    else {
      setLocationStock(updater);
      onTransfer([
        {
          id: `TR-${transferSku}-${Date.now()}`,
          sku: transferSku,
          product: `${transferGroup.product} · ${transferQty} pieza(s)`,
          branch: "Garantías Central",
          box: "Transferencia interna",
          destination: "Almacén de reparación",
          note: `Retiro de ${Object.entries(withdrawals)
            .filter(([, q]) => q > 0)
            .map(([l, q]) => `${l}: ${q}`)
            .join(", ")}`,
          date: "25 ago · Ahora",
        },
      ]);
    }
    setTransferSku("");
    avisar(
      `${transferQty} pieza(s) enviadas a ${recipient}; existencias actualizadas`,
    );
  };
  const confirmShipment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      carrier = String(f.get("carrier")),
      guide = String(f.get("guide")),
      packages = String(f.get("packages")),
      chosenReturns = (returnGroups[shipBranch] || []).filter((i) =>
        selected.includes(i.id),
      );
    if (!chosenReturns.length) return;
    if (
      !(await askQuestion(
        `¿Confirmas generar el envío de ${shipBranch} con ${carrier}, guía ${guide} y ${packages} bulto(s) para ${chosenReturns.length} solicitud(es)?`,
      ))
    )
      return;
    const ids = chosenReturns.map((i) => i.id),
      branch = shipBranch;
    setItems((x) => x.filter((i) => !ids.includes(i.id)));
    setSelected((x) => x.filter((id) => !ids.includes(id)));
    setShipBranch("");
    avisar(
      `Envío generado para ${branch}: ${ids.length} producto(s) entregados a Logística`,
    );
  };
  const confirmDestruction = async () => {
    if (!destroyGroup || destroyQty < 1 || destroyQty > destroyGroup.total)
      return;
    if (
      !(await askQuestion(
        `¿Confirmas dar de baja por destrucción ${destroyQty} pieza(s) de ${destroySku}? La existencia cambiará de ${destroyGroup.total} a ${destroyGroup.total - destroyQty}.`,
      ))
    )
      return;
    setDestructionStock((s) => ({
      ...s,
      [destroySku]: s[destroySku] - destroyQty,
    }));
    setDestroySku("");
    avisar(`${destroyQty} pieza(s) dadas de baja por destrucción`);
  };
  const moveDestruction = async (sku: string) => {
    const target = moveTo[sku],
      qty = destructionStock[sku] || 0;
    if (!target || !qty) return;
    if (
      !(await askQuestion(
        `¿Confirmas mover ${qty} pieza(s) de ${sku} de Destrucción a ${target}?`,
      ))
    )
      return;
    setDestructionStock((s) => {
      const n = { ...s };
      delete n[sku];
      return n;
    });
    if (target === "Almacén de reparación")
      setLocationStock((s) => ({
        ...s,
        [sku]: [{ location: "REP-NUEVA", qty }],
      }));
    else if (target === "Almacén proveedor")
      setProviderStock((s) => ({
        ...s,
        [sku]: [{ location: "PROV-NUEVA", qty }],
      }));
    else
      setItems((x) => [
        {
          id: `MOV-${sku}-${Date.now()}`,
          sku,
          product: products[sku] || sku,
          branch: "Garantías Central",
          box: "Movimiento agrupado",
          destination: target,
          note: `${qty} piezas movidas desde Destrucción`,
          date: "25 ago · Ahora",
        },
        ...x,
      ]);
    setMoveTo((x) => {
      const n = { ...x };
      delete n[sku];
      return n;
    });
    avisar(`${sku} movido a ${target}`);
  };
  return (
    <section className="disposition-board">
      <div className="disposition-tabs">
        {destinations.map((d, i) => (
          <button
            className={active === d ? "active" : ""}
            key={d}
            onClick={() => {
              setActive(d);
              setSelected([]);
              setSearch("");
            }}
          >
            <i>{["⌁", "×", "▤", "↩"][i]}</i>
            <span>
              <b>{d}</b>
              <small>
                {d === "Destrucción"
                  ? Object.values(destructionStock).reduce((s, n) => s + n, 0)
                  : (d === "Almacén de reparación"
                      ? Object.values(locationStock)
                      : d === "Almacén proveedor"
                        ? Object.values(providerStock)
                        : []
                    )
                      .flat()
                      .reduce((s, l) => s + l.qty, 0) ||
                    items.filter((x) => x.destination === d).length}{" "}
                piezas
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="disposition-stock">
        <span>
          <small>
            {active === "Retorno"
              ? "RETORNOS PENDIENTES POR SUCURSAL"
              : active === "Destrucción"
                ? "PIEZAS PENDIENTES DE DESTRUCCIÓN"
                : `EXISTENCIA TOTAL · ${active.toUpperCase()}`}
          </small>
          <b>
            {active === "Retorno"
              ? `${Object.keys(returnGroups).length} sucursales · ${filtered.length} solicitudes`
              : active === "Destrucción"
                ? `${Object.values(destructionStock).reduce((s, n) => s + n, 0)} piezas · ${destructionGroups.length} productos`
                : `${stockTotal} piezas · ${grouped.length} códigos`}
          </b>
        </span>
        <label>
          ⌕
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              active === "Almacén proveedor"
                ? "Buscar por código, producto o número de proveedor"
                : active === "Retorno"
                  ? "Buscar por sucursal, código, folio o producto"
                  : "Buscar por código, folio o producto"
            }
          />
        </label>
      </div>
      {active === "Almacén de reparación" || active === "Almacén proveedor" ? (
        <div className="panel repair-grouped">
          <div className="trace-head">
            <div>
              <h2>Inventario agrupado por código</h2>
              <p>
                Consulta la existencia consolidada y retira mercancía desde una
                o varias ubicaciones.
              </p>
            </div>
            <span>{grouped.length} códigos</span>
          </div>
          {grouped.length ? (
            grouped.map((g) => (
              <article key={g.sku}>
                <div className="group-code">
                  <i>▤</i>
                  <span>
                    <small>CÓDIGO</small>
                    <b>{g.sku}</b>
                    <strong>{g.product}</strong>
                    {active === "Almacén proveedor" && (
                      <em className="provider-number">
                        Proveedor {g.provider}
                      </em>
                    )}
                  </span>
                </div>
                <div className="group-locations">
                  <small>UBICACIONES</small>
                  <span>
                    {g.locations
                      .filter((l) => l.qty > 0)
                      .map((l) => (
                        <em key={l.location}>
                          {l.location} · {l.qty}
                        </em>
                      ))}
                  </span>
                </div>
                <div className="group-total">
                  <small>TOTAL EN ALMACÉN</small>
                  <b>{g.total}</b>
                  <span>piezas</span>
                </div>
                <div className="group-actions">
                  <button
                    className="primario"
                    onClick={() => startTransfer(g.sku)}
                  >
                    {active === "Almacén proveedor"
                      ? "Enviar a Proveedor"
                      : "Transferir a Técnico"}
                  </button>
                  <label>
                    Mover a
                    <select
                      value={moveTo[g.sku] || ""}
                      onChange={(e) =>
                        setMoveTo((x) => ({
                          ...x,
                          [g.sku]: e.target.value as DispositionType,
                        }))
                      }
                    >
                      <option value="">Seleccionar destino</option>
                      {destinations
                        .filter((d) => d !== active)
                        .map((d) => (
                          <option key={d}>{d}</option>
                        ))}
                    </select>
                  </label>
                  <button
                    disabled={!moveTo[g.sku]}
                    onClick={() => moveGroup(g.sku)}
                  >
                    Confirmar movimiento
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="trace-empty">
              <i>⌕</i>
              <strong>No se encontraron códigos</strong>
            </div>
          )}
        </div>
      ) : active === "Destrucción" ? (
        <div className="panel destruction-grouped">
          <div className="trace-head">
            <div>
              <h2>Inventario agrupado por producto</h2>
              <p>
                Selecciona la cantidad que será dada de baja; no se requiere
                ubicación.
              </p>
            </div>
            <span>{destructionGroups.length} productos</span>
          </div>
          {destructionGroups.map((g) => (
            <article key={g.sku}>
              <div className="group-code">
                <i>×</i>
                <span>
                  <small>CÓDIGO</small>
                  <b>{g.sku}</b>
                  <strong>{g.product}</strong>
                </span>
              </div>
              <div className="group-total">
                <small>PIEZAS PENDIENTES</small>
                <b>{g.total}</b>
                <span>piezas</span>
              </div>
              <div className="group-actions destruction-actions">
                <button
                  className="peligro compact-destroy"
                  onClick={() => {
                    setDestroySku(g.sku);
                    setDestroyQty(0);
                  }}
                >
                  Dar de baja por destrucción
                </button>
                <label>
                  Mover a
                  <select
                    value={moveTo[g.sku] || ""}
                    onChange={(e) =>
                      setMoveTo((x) => ({
                        ...x,
                        [g.sku]: e.target.value as DispositionType,
                      }))
                    }
                  >
                    <option value="">Seleccionar destino</option>
                    {destinations
                      .filter((d) => d !== "Destrucción")
                      .map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={!moveTo[g.sku]}
                  onClick={() => moveDestruction(g.sku)}
                >
                  Confirmar movimiento
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : active === "Retorno" ? (
        <div className="return-groups">
          {Object.entries(returnGroups).length ? (
            Object.entries(returnGroups).map(([branch, requests]) => (
              <section className="panel" key={branch}>
                <header>
                  <div>
                    <small>SUCURSAL DE DESTINO</small>
                    <h2>{branch}</h2>
                    <p>{requests.length} solicitud(es) listas para retorno</p>
                  </div>
                  <button
                    className="primario"
                    disabled={!requests.some((i) => selected.includes(i.id))}
                    onClick={() => setShipBranch(branch)}
                  >
                    Generar envío (
                    {requests.filter((i) => selected.includes(i.id)).length})
                  </button>
                </header>
                <div className="return-detail-title">
                  <span>
                    <i>▤</i>
                    <b>Detalle de solicitudes de {branch}</b>
                  </span>
                  <em>{requests.length} registros</em>
                </div>
                <div className="return-request-head">
                  <span>Folio de la solicitud</span>
                  <span>Código y producto</span>
                  <span>Cantidad</span>
                  <span>Último movimiento</span>
                  <span>Cambiar disposición</span>
                </div>
                {requests.map((item) => (
                  <article key={item.id}>
                    <div className="return-summary-line">
                      <b>Solicitud {item.id}</b>
                      <span>
                        Producto {item.sku} · {item.product}
                      </span>
                      <em>Cantidad: 1 pieza</em>
                    </div>
                    <div className="return-request-id">
                      <label className="return-select">
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggle(item.id)}
                        />
                        <i>{selected.includes(item.id) ? "✓" : ""}</i>
                        <span>Seleccionar</span>
                      </label>
                      <small>FOLIO DE LA SOLICITUD</small>
                      <strong>{item.id}</strong>
                      <p>Caja: {item.box}</p>
                    </div>
                    <div className="return-product">
                      <small>CÓDIGO / PRODUCTO</small>
                      <b>{item.sku}</b>
                      <strong>{item.product}</strong>
                    </div>
                    <div className="return-quantity">
                      <small>CANTIDAD</small>
                      <b>1 pieza</b>
                    </div>
                    <span>
                      <b>{item.date}</b>
                      <em>{item.note}</em>
                    </span>
                    <div className="return-move">
                      <label>
                        Mover a
                        <select
                          value={moveTo[item.id] || ""}
                          onChange={(e) =>
                            setMoveTo((x) => ({
                              ...x,
                              [item.id]: e.target.value as DispositionType,
                            }))
                          }
                        >
                          <option value="">Seleccionar destino</option>
                          {destinations
                            .filter((d) => d !== "Retorno")
                            .map((d) => (
                              <option key={d}>{d}</option>
                            ))}
                        </select>
                      </label>
                      <button
                        disabled={!moveTo[item.id]}
                        onClick={() => move(item)}
                      >
                        Confirmar movimiento
                      </button>
                    </div>
                  </article>
                ))}
              </section>
            ))
          ) : (
            <div className="panel trace-empty">
              <i>⌕</i>
              <strong>No se encontraron retornos</strong>
              <p>Busca otra sucursal, código o solicitud.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="panel disposition-list">
          <div className="trace-head">
            <div>
              <h2>{active}</h2>
              <p>
                Sólo el técnico de Garantías puede modificar la disposición
                autorizada.
              </p>
            </div>
            <div className="disposition-head-actions">
              <span>{filtered.length} solicitudes</span>
              {active === "Destrucción" && (
                <button
                  className="peligro"
                  disabled={!chosen.length}
                  onClick={destruct}
                >
                  Dar de baja por destrucción{" "}
                  {chosen.length ? `(${chosen.length})` : ""}
                </button>
              )}
            </div>
          </div>
          {filtered.length ? (
            filtered.map((item) => (
              <article key={item.id}>
                {active === "Destrucción" ? (
                  <label className="disposition-check">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                    />
                    <i>✓</i>
                  </label>
                ) : (
                  <i>{active === "Almacén proveedor" ? "▤" : "↩"}</i>
                )}
                <div>
                  <small>
                    {item.id} · {item.box}
                  </small>
                  <strong>{item.product}</strong>
                  <p>
                    {item.sku} · {item.branch}
                  </p>
                </div>
                <span>
                  <small>ÚLTIMO MOVIMIENTO</small>
                  <b>{item.date}</b>
                  <em>{item.note}</em>
                </span>
                <label>
                  Mover a
                  <select
                    value={moveTo[item.id] || ""}
                    onChange={(e) =>
                      setMoveTo((x) => ({
                        ...x,
                        [item.id]: e.target.value as DispositionType,
                      }))
                    }
                  >
                    <option value="">Seleccionar destino</option>
                    {destinations
                      .filter((d) => d !== item.destination)
                      .map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                  </select>
                </label>
                <button
                  className="primario"
                  disabled={!moveTo[item.id]}
                  onClick={() => move(item)}
                >
                  Confirmar movimiento
                </button>
              </article>
            ))
          ) : (
            <div className="trace-empty">
              <i>⌕</i>
              <strong>No se encontraron solicitudes</strong>
            </div>
          )}
        </div>
      )}
      {transferSku && transferGroup && (
        <div className="transfer-location-modal">
          <section>
            <header>
              <div>
                <small>TRANSFERENCIA CONTROLADA</small>
                <h2>
                  {transferGroup.sku} · {transferGroup.product}
                </h2>
                <p>
                  Indica la cantidad total y distribuye el retiro entre una o
                  varias ubicaciones.
                </p>
              </div>
              <button onClick={() => setTransferSku("")}>×</button>
            </header>
            <main>
              <div className="transfer-quantity">
                <span>
                  <small>EXISTENCIA TOTAL ACTUAL</small>
                  <b>{transferGroup.total} piezas</b>
                </span>
                <label>
                  Cantidad a transferir
                  <input
                    type="number"
                    min="1"
                    max={transferGroup.total}
                    value={transferQty || ""}
                    onChange={(e) => {
                      const n = Math.min(
                        transferGroup.total,
                        Math.max(0, Number(e.target.value)),
                      );
                      setTransferQty(n);
                      setWithdrawals({});
                    }}
                    placeholder="Ej. 8"
                  />
                </label>
                <span
                  className={
                    allocated === transferQty && transferQty > 0
                      ? "complete"
                      : "pending"
                  }
                >
                  <small>CANTIDAD ASIGNADA</small>
                  <b>
                    {allocated} de {transferQty || 0}
                  </b>
                </span>
              </div>
              <div className="allocation-table">
                <div className="allocation-head">
                  <span>Seleccionar</span>
                  <span>Ubicación</span>
                  <span>Existencia actual</span>
                  <span>Cantidad a retirar</span>
                  <span>Existencia nueva</span>
                </div>
                {transferGroup.locations
                  .filter((l) => l.qty > 0)
                  .map((l) => {
                    const qty = withdrawals[l.location] || 0;
                    return (
                      <label className={qty > 0 ? "used" : ""} key={l.location}>
                        <input
                          type="checkbox"
                          checked={qty > 0}
                          onChange={(e) =>
                            setWithdrawals((x) => ({
                              ...x,
                              [l.location]: e.target.checked
                                ? Math.min(
                                    l.qty,
                                    Math.max(1, transferQty - allocated),
                                  )
                                : 0,
                            }))
                          }
                        />
                        <b>{l.location}</b>
                        <strong>{l.qty}</strong>
                        <input
                          type="number"
                          min="0"
                          max={Math.min(
                            l.qty,
                            Math.max(0, transferQty - (allocated - qty)),
                          )}
                          value={qty || ""}
                          disabled={!transferQty}
                          onChange={(e) => {
                            const max = Math.min(
                                l.qty,
                                Math.max(0, transferQty - (allocated - qty)),
                              ),
                              n = Math.min(
                                max,
                                Math.max(0, Number(e.target.value)),
                              );
                            setWithdrawals((x) => ({ ...x, [l.location]: n }));
                          }}
                          placeholder="0"
                        />
                        <em>{l.qty - qty}</em>
                      </label>
                    );
                  })}
              </div>
              {transferQty > 0 && allocated !== transferQty && (
                <div className="allocation-warning">
                  ! Falta asignar {transferQty - allocated} pieza(s) entre las
                  ubicaciones disponibles.
                </div>
              )}
              <div className="transfer-summary">
                <span>
                  <small>Existencia total actual</small>
                  <b>{transferGroup.total} piezas</b>
                </span>
                <i>→</i>
                <span>
                  <small>Existencia total nueva</small>
                  <b>{transferGroup.total - transferQty} piezas</b>
                </span>
              </div>
            </main>
            <footer>
              <button onClick={() => setTransferSku("")}>Cancelar</button>
              <button
                className="primario"
                disabled={!transferQty || allocated !== transferQty}
                onClick={confirmTransfer}
              >
                {active === "Almacén proveedor"
                  ? "Confirmar retiro y enviar"
                  : "Confirmar retiro y transferir"}
              </button>
            </footer>
          </section>
        </div>
      )}
      {destroySku && destroyGroup && (
        <div className="transfer-location-modal destruction-dialog">
          <section>
            <header>
              <div>
                <small>BAJA DE ALMACÉN</small>
                <h2>Destrucción · {destroyGroup.sku}</h2>
                <p>Indica cuántas piezas se enviarán a destrucción.</p>
              </div>
              <button onClick={() => setDestroySku("")}>×</button>
            </header>
            <main>
              <div className="destruction-product">
                <span>
                  <small>CÓDIGO / PRODUCTO</small>
                  <b>
                    {destroyGroup.sku} · {destroyGroup.product}
                  </b>
                </span>
                <span>
                  <small>CANTIDAD TOTAL</small>
                  <b>{destroyGroup.total} piezas</b>
                </span>
              </div>
              <label className="destruction-qty">
                Cantidad a destruir <small>Captura manual obligatoria</small>
                <input
                  type="number"
                  min="1"
                  max={destroyGroup.total}
                  value={destroyQty || ""}
                  onChange={(e) =>
                    setDestroyQty(
                      Math.min(
                        destroyGroup.total,
                        Math.max(0, Number(e.target.value)),
                      ),
                    )
                  }
                  placeholder="Ingresa la cantidad de piezas"
                />
              </label>
              <div className="destruction-preview four">
                <span>
                  <small>CANTIDAD TOTAL</small>
                  <b>{destroyGroup.total}</b>
                </span>
                <span>
                  <small>CANTIDAD A DESTRUIR</small>
                  <b>{destroyQty || 0}</b>
                </span>
                <span>
                  <small>EXISTENCIA ACTUAL</small>
                  <b>{destroyGroup.total}</b>
                </span>
                <span className="new">
                  <small>EXISTENCIA NUEVA</small>
                  <b>{destroyGroup.total - destroyQty}</b>
                </span>
              </div>
              {destroyQty === destroyGroup.total && (
                <div className="destroy-zero">
                  La existencia nueva será cero; el producto se retirará de la
                  lista al confirmar.
                </div>
              )}
              <div className="destruction-confirm-note">
                <b>Confirmación requerida</b>
                <p>
                  La baja quedará registrada como destrucción de mercancía y no
                  podrá revertirse desde esta pantalla.
                </p>
              </div>
            </main>
            <footer>
              <button onClick={() => setDestroySku("")}>Cancelar</button>
              <button
                className="peligro"
                disabled={!destroyQty}
                onClick={confirmDestruction}
              >
                Confirmar baja por destrucción
              </button>
            </footer>
          </section>
        </div>
      )}
      {shipBranch && (
        <div className="transfer-location-modal logistics-modal">
          <form onSubmit={confirmShipment}>
            <header>
              <div>
                <small>PROCESO LOGÍSTICO DE RETORNO</small>
                <h2>Generar envío · {shipBranch}</h2>
                <p>
                  Captura los datos para entregar las piezas a transportación.
                </p>
              </div>
              <button type="button" onClick={() => setShipBranch("")}>
                ×
              </button>
            </header>
            <main>
              <div className="logistics-summary">
                <span>
                  <small>SUCURSAL DESTINO</small>
                  <b>{shipBranch}</b>
                </span>
                <span>
                  <small>SOLICITUDES</small>
                  <b>
                    {
                      (returnGroups[shipBranch] || []).filter((i) =>
                        selected.includes(i.id),
                      ).length
                    }{" "}
                    piezas
                  </b>
                </span>
              </div>
              <div className="logistics-fields">
                <label>
                  Paquetería
                  <select name="carrier" required defaultValue="">
                    <option value="" disabled>
                      Seleccionar paquetería
                    </option>
                    <option>Paquetexpress</option>
                    <option>Estafeta</option>
                    <option>DHL</option>
                    <option>Transporte interno</option>
                  </select>
                </label>
                <label>
                  Número de guía
                  <input name="guide" required placeholder="Ej. 4567890123" />
                </label>
                <label>
                  Número de bultos
                  <input
                    name="packages"
                    type="number"
                    min="1"
                    required
                    defaultValue="1"
                  />
                </label>
                <label>
                  Fecha estimada de entrega
                  <input name="delivery" type="date" required />
                </label>
                <label className="wide">
                  Observaciones
                  <textarea
                    name="notes"
                    placeholder="Indicaciones de entrega, embalaje o contacto de la sucursal"
                  />
                </label>
              </div>
              <div className="shipment-contents">
                <small>CONTENIDO DEL ENVÍO</small>
                {(returnGroups[shipBranch] || [])
                  .filter((i) => selected.includes(i.id))
                  .map((i) => (
                    <span key={i.id}>
                      <b>{i.id}</b>
                      <em>
                        {i.sku} · {i.product}
                      </em>
                    </span>
                  ))}
              </div>
            </main>
            <footer>
              <button type="button" onClick={() => setShipBranch("")}>
                Cancelar
              </button>
              <button className="primario" type="submit">
                Aceptar y generar envío
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
function RepairView({
  avisar,
  transfers,
}: {
  avisar: (s: string) => void;
  transfers: DispositionItem[];
}) {
  const baseRepairs = [
      {
        id: "GE-260823-1794",
        sku: "BO-MA810",
        product: "Marcha Bosch",
        provider: "Electromecánica GDL",
        sent: "20 ago 2026",
        estimate: "26 ago 2026",
        status: "Por recibir",
      },
    ],
    repairs = [
      ...transfers.map((x) => ({
        id: x.id,
        sku: x.sku,
        product: x.product,
        provider: "Técnico por asignar",
        sent: "25 ago 2026",
        estimate: "Pendiente",
        status: "Transferida a técnico",
      })),
      ...baseRepairs,
    ];
  return (
    <section className="repair-view">
      <div className="repair-kpis">
        <article>
          <small>EN REPARACIÓN</small>
          <b>8</b>
          <span>3 proveedores activos</span>
        </article>
        <article>
          <small>POR VENCER</small>
          <b>2</b>
          <span>Próximas 48 horas</span>
        </article>
        <article>
          <small>TIEMPO PROMEDIO</small>
          <b>5.4 días</b>
          <span>Últimos 6 meses</span>
        </article>
      </div>
      <div className="panel repair-list">
        <div className="trace-head">
          <div>
            <h2>Seguimiento de reparaciones</h2>
            <p>Piezas cuya disposición autorizada es A reparación.</p>
          </div>
          <span>{repairs.length} solicitudes</span>
        </div>
        {repairs.map((r) => (
          <article key={r.id}>
            <i>⌁</i>
            <div>
              <small>
                {r.id} · {r.sku}
              </small>
              <strong>{r.product}</strong>
              <p>{r.provider}</p>
            </div>
            <span>
              <small>FECHA DE ENVÍO</small>
              <b>{r.sent}</b>
            </span>
            <span>
              <small>ENTREGA ESTIMADA</small>
              <b>{r.estimate}</b>
            </span>
            <em>{r.status}</em>
            <button onClick={() => avisar(`Seguimiento abierto para ${r.id}`)}>
              Ver seguimiento
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RepairTransferWorkspace({
  requests,
  onTransfer,
  avisar,
  stock,
}: {
  requests: RepairRequest[];
  onTransfer: (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => void;
  avisar: (s: string) => void;
  stock: typeof inventoryRows;
}) {
  const pending = requests.filter((r) => r.status === "Solicitada"),
    [folio, setFolio] = useState(""),
    [location, setLocation] = useState(""),
    [label, setLabel] = useState(""),
    [scans, setScans] = useState<{ location: string; scannedAt: string }[]>([]);
  const request = pending.find((r) => r.requestFolio === folio),
    locations = request
      ? stock.filter(
          (r) => r.sku === request.sku && r.type === "Reparación" && r.qty > 0,
        )
      : [],
    locationStock = locations.find((r) => r.location === location)?.qty || 0,
    fromLocation = scans.filter((s) => s.location === location).length;
  const scan = () => {
    if (!request || !location) return;
    const value = label.trim().toUpperCase();
    if (value && value !== request.requestFolio) {
      avisar("La etiqueta no corresponde al folio seleccionado");
      return;
    }
    if (scans.length >= request.requestedQty) {
      avisar("Ya se alcanzó la cantidad solicitada");
      return;
    }
    if (fromLocation >= locationStock) {
      avisar("No hay existencia disponible adicional en esta ubicación");
      return;
    }
    setScans((x) => [
      ...x,
      {
        location,
        scannedAt: new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    ]);
    setLabel("");
  };
  const confirm = async () => {
    if (!request || scans.length !== request.requestedQty) return;
    if (
      !(await askQuestion(
        `¿Confirmas transferir ${request.requestedQty} pieza(s) del folio ${request.requestFolio} a ${request.technician}?`,
      ))
    )
      return;
    onTransfer(request.requestFolio, scans);
    setFolio("");
    setLocation("");
    setScans([]);
  };
  return (
    <section className="panel repair-transfer-work">
      <div className="trace-head">
        <div>
          <h2>Salida a reparación</h2>
          <p>
            Selecciona el folio solicitado y retira cada pieza mediante el
            escaneo de su etiqueta.
          </p>
        </div>
        <span>
          {pending.reduce((s, r) => s + r.requestedQty, 0)} piezas solicitadas
        </span>
      </div>
      <div className="repair-request-list">
        {pending.map((r) => (
          <button
            className={folio === r.requestFolio ? "selected" : ""}
            key={r.requestFolio}
            onClick={() => {
              setFolio(r.requestFolio);
              setScans([]);
              setLocation("");
            }}
          >
            <span>
              <small>FOLIO DE SOLICITUD</small>
              <b>{r.requestFolio}</b>
              <em>
                {r.sku} · {r.product}
              </em>
            </span>
            <span className="repair-request-date">
              <small>FECHA DE SOLICITUD</small>
              <b>{r.requestedAt}</b>
            </span>
            <strong>
              {r.requestedQty}
              <small> piezas</small>
            </strong>
            <i>{r.technician}</i>
          </button>
        ))}
      </div>
      {request ? (
        <div className="controlled-transfer">
          <div className="transfer-fixed">
            <span>
              <small>CANTIDAD A TRANSFERIR</small>
              <b>{request.requestedQty} piezas</b>
              <em>Definida por la solicitud del técnico</em>
            </span>
            <span>
              <small>ESCANEADAS</small>
              <b>
                {scans.length} de {request.requestedQty}
              </b>
              <em>Folio {request.requestFolio}</em>
            </span>
          </div>
          <div className="location-stock-grid">
            {locations.map((l) => {
              const used = scans.filter(
                (s) => s.location === l.location,
              ).length;
              return (
                <button
                  className={location === l.location ? "selected" : ""}
                  key={l.location}
                  aria-pressed={location === l.location}
                  onClick={() => setLocation(l.location)}
                >
                  <small>UBICACIÓN</small>
                  <b>{l.location}</b>
                  <span>Disponible: {l.qty}</span>
                  <em>Nueva existencia: {l.qty - used}</em>
                  {location === l.location && (
                    <i className="location-selection-check">✓ Seleccionada</i>
                  )}
                </button>
              );
            })}
          </div>
          <label className="repair-scan-input">
            Escaneo de etiqueta de solicitud
            <div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    scan();
                  }
                }}
                placeholder={request.requestFolio}
              />
              <button
                onClick={() => {
                  setLabel(request.requestFolio);
                  setTimeout(scan, 0);
                }}
                disabled={!location}
              >
                ▥ Simular escaneo
              </button>
            </div>
            <small>
              Cada lectura válida registra una pieza, ubicación, hora y folio.
            </small>
          </label>
          <div
            className={
              scans.length === request.requestedQty
                ? "scan-ledger complete"
                : "scan-ledger"
            }
          >
            {scans.map((s, i) => (
              <span key={i}>
                <i>✓</i>
                <b>Pieza {i + 1}</b>
                <em>{s.location}</em>
                <small>
                  {request.requestFolio} · {s.scannedAt}
                </small>
              </span>
            ))}
            {!scans.length && (
              <p>
                Selecciona una ubicación y escanea la etiqueta para iniciar el
                retiro.
              </p>
            )}
          </div>
          <button
            className="primario transfer-confirm"
            disabled={scans.length !== request.requestedQty}
            onClick={confirm}
          >
            Confirmar transferencia al técnico
          </button>
        </div>
      ) : (
        <div className="warehouse-query-empty compact">
          <i>⌁</i>
          <b>Selecciona una solicitud</b>
          <p>
            La cantidad a transferir quedará bloqueada conforme al folio
            elegido.
          </p>
        </div>
      )}
    </section>
  );
}

function ProviderTransferWorkspace({
  requests,
  onTransfer,
  avisar,
  stock,
}: {
  requests: ProviderOutboundRequest[];
  onTransfer: (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => void;
  avisar: (message: string) => void;
  stock: typeof inventoryRows;
}) {
  const pending = requests.filter((request) => request.status === "Solicitada"),
    [folio, setFolio] = useState(""),
    [location, setLocation] = useState(""),
    [label, setLabel] = useState(""),
    [scans, setScans] = useState<{ location: string; scannedAt: string }[]>([]);
  const request = pending.find((item) => item.requestFolio === folio),
    locations = request
      ? stock.filter(
          (row) =>
            row.sku === request.sku && row.type === "Proveedor" && row.qty > 0,
        )
      : [],
    locationStock = locations.find((row) => row.location === location)?.qty || 0,
    fromLocation = scans.filter((scan) => scan.location === location).length;
  const scan = (simulatedValue?: string) => {
    if (!request || !location) return;
    const value = (simulatedValue ?? label).trim().toUpperCase();
    if (value && value !== request.requestFolio) {
      avisar("La etiqueta no corresponde al folio de Salida Proveedor");
      return;
    }
    if (scans.length >= request.requestedQty) {
      avisar("Ya se alcanzó la cantidad solicitada");
      return;
    }
    if (fromLocation >= locationStock) {
      avisar("No hay existencia adicional en la ubicación seleccionada");
      return;
    }
    setScans((current) => [
      ...current,
      {
        location,
        scannedAt: new Date().toLocaleTimeString("es-MX", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      },
    ]);
    setLabel("");
  };
  const confirm = async () => {
    if (
      !request ||
      scans.length !== request.requestedQty ||
      !(await askQuestion(
        `¿Confirmas la salida de ${request.requestedQty} pieza(s) del folio ${request.requestFolio} hacia ${request.provider}?`,
      ))
    )
      return;
    onTransfer(request.requestFolio, scans);
    setFolio("");
    setLocation("");
    setScans([]);
  };
  return (
    <section className="panel repair-transfer-work provider-transfer-work">
      <div className="trace-head">
        <div>
          <h2>Salida a proveedor</h2>
          <p>
            Selecciona una solicitud y retira cada pieza del Almacén de proveedor
            mediante el escaneo de su etiqueta.
          </p>
        </div>
        <span>
          {pending.reduce((sum, item) => sum + item.requestedQty, 0)} piezas solicitadas
        </span>
      </div>
      <div className="repair-request-list">
        {pending.map((item) => (
          <button
            className={folio === item.requestFolio ? "selected" : ""}
            key={item.requestFolio}
            onClick={() => {
              setFolio(item.requestFolio);
              setLocation("");
              setScans([]);
            }}
          >
            <span>
              <small>FOLIO DE SOLICITUD</small>
              <b>{item.requestFolio}</b>
              <em>{item.sku} · {item.product}</em>
            </span>
            <span className="repair-request-date">
              <small>FECHA DE SOLICITUD</small>
              <b>{item.requestedAt}</b>
            </span>
            <strong>{item.requestedQty}<small> piezas</small></strong>
            <i>{item.provider}</i>
          </button>
        ))}
      </div>
      {request ? (
        <div className="controlled-transfer">
          <div className="transfer-fixed">
            <span>
              <small>CANTIDAD A TRANSFERIR</small>
              <b>{request.requestedQty} piezas</b>
              <em>Definida por la solicitud de Calidad</em>
            </span>
            <span>
              <small>ESCANEADAS</small>
              <b>{scans.length} de {request.requestedQty}</b>
              <em>Folio {request.requestFolio}</em>
            </span>
          </div>
          <div className="location-stock-grid">
            {locations.map((row) => {
              const used = scans.filter(
                (scanItem) => scanItem.location === row.location,
              ).length;
              return (
                <button
                  className={location === row.location ? "selected" : ""}
                  key={row.location}
                  aria-pressed={location === row.location}
                  onClick={() => setLocation(row.location)}
                >
                  <small>UBICACIÓN</small>
                  <b>{row.location}</b>
                  <span>Disponible: {row.qty}</span>
                  <em>Nueva existencia: {row.qty - used}</em>
                  {location === row.location && (
                    <i className="location-selection-check">✓ Seleccionada</i>
                  )}
                </button>
              );
            })}
          </div>
          <label className="repair-scan-input">
            Escaneo de etiqueta de solicitud
            <div>
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    scan();
                  }
                }}
                placeholder={request.requestFolio}
              />
              <button
                onClick={() => scan(request.requestFolio)}
                disabled={!location}
              >
                ▥ Simular escaneo
              </button>
            </div>
            <small>Cada lectura registra pieza, ubicación, hora y folio.</small>
          </label>
          <div
            className={
              scans.length === request.requestedQty
                ? "scan-ledger complete"
                : "scan-ledger"
            }
          >
            {scans.map((scanItem, index) => (
              <span key={`${scanItem.location}-${index}`}>
                <i>✓</i><b>Pieza {index + 1}</b><em>{scanItem.location}</em>
                <small>{request.requestFolio} · {scanItem.scannedAt}</small>
              </span>
            ))}
            {!scans.length && (
              <p>Selecciona una ubicación y escanea la etiqueta para iniciar el retiro.</p>
            )}
          </div>
          <button
            className="primario transfer-confirm"
            disabled={scans.length !== request.requestedQty}
            onClick={confirm}
          >
            Confirmar transferencia a proveedor
          </button>
        </div>
      ) : (
        <div className="warehouse-query-empty compact">
          <i>↗</i><b>Selecciona una solicitud</b>
          <p>La cantidad quedará controlada conforme al folio elegido.</p>
        </div>
      )}
    </section>
  );
}

function GroupedInventoryView({ stock }: { stock: typeof inventoryRows }) {
  const [scope, setScope] = useState<"Ambos" | "Reparación" | "Proveedor">(
      "Ambos",
    ),
    [query, setQuery] = useState("");
  const money = (n: number) =>
      n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    filtered = stock.filter(
      (r) =>
        (scope === "Ambos" || r.type === scope) &&
        (!query ||
          `${r.sku} ${r.product} ${r.provider}`
            .toLowerCase()
            .includes(query.toLowerCase())),
    ),
    groups = Object.values(
      filtered.reduce(
        (a, r) => {
          const g = (a[r.sku] ??= {
            sku: r.sku,
            product: r.product,
            provider: r.provider,
            total: 0,
            repair: 0,
            providerQty: 0,
            cost: r.cost,
            locations: [] as string[],
          });
          g.total += r.qty;
          if (r.type === "Reparación") g.repair += r.qty;
          else g.providerQty += r.qty;
          g.locations.push(`${r.location} · ${r.qty}`);
          return a;
        },
        {} as Record<
          string,
          {
            sku: string;
            product: string;
            provider: string;
            total: number;
            repair: number;
            providerQty: number;
            cost: number;
            locations: string[];
          }
        >,
      ),
    );
  return (
    <section className="panel grouped-inventory">
      <div className="trace-head">
        <div>
          <h2>Consulta de inventario</h2>
          <p>Existencia y costo consolidados por código.</p>
        </div>
        <span>
          {groups.reduce((s, g) => s + g.total, 0)} piezas ·{" "}
          {money(groups.reduce((s, g) => s + g.total * g.cost, 0))}
        </span>
      </div>
      <div className="inventory-scope">
        <label>
          Visualizar almacén
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as typeof scope)}
          >
            <option>Ambos</option>
            <option>Reparación</option>
            <option>Proveedor</option>
          </select>
        </label>
        <label>
          Buscar
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Código, producto o proveedor"
          />
        </label>
      </div>
      <div className="grouped-inventory-table with-cost">
        <header>
          <span>Código y producto</span>
          <span>Proveedor</span>
          <span>Almacén reparación</span>
          <span>Almacén proveedor</span>
          <span>Total</span>
          <span>Costo unitario</span>
          <span>Valor total</span>
          <span>Ubicaciones</span>
        </header>
        {groups.map((g) => (
          <article key={g.sku}>
            <span>
              <b>{g.sku}</b>
              <small>{g.product}</small>
            </span>
            <span>{g.provider}</span>
            <strong>{g.repair}</strong>
            <strong>{g.providerQty}</strong>
            <b>{g.total} piezas</b>
            <span className="inventory-unit-cost">{money(g.cost)}</span>
            <b className="inventory-total-cost">{money(g.total * g.cost)}</b>
            <span className="location-pills">
              {g.locations.map((l) => (
                <small key={l}>{l}</small>
              ))}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
function IntegratedWarehouseHub({
  items,
  onStored,
  avisar,
  requests,
  providerRequests,
  onTransfer,
  onProviderTransfer,
  stock,
}: {
  items: RoutedDiagnosis[];
  onStored: (folios: string[]) => void;
  avisar: (s: string) => void;
  requests: RepairRequest[];
  providerRequests: ProviderOutboundRequest[];
  onTransfer: (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => void;
  onProviderTransfer: (
    folio: string,
    scans: { location: string; scannedAt: string }[],
  ) => void;
  stock: typeof inventoryRows;
}) {
  const [workspace, setWorkspace] = useState<WarehouseWorkspace>("in-repair"),
    [category, setCategory] = useState<"entries" | "exits" | "control">(
      "entries",
    ),
    repairIn = items.filter((i) => i.destination === "A reparación").length,
    providerIn = items.filter(
      (i) => i.destination === "Almacén Proveedor",
    ).length,
    pendingRepair = requests
      .filter((r) => r.status === "Solicitada")
      .reduce((s, r) => s + r.requestedQty, 0),
    providerAvailable = providerRequests
      .filter((request) => request.status === "Solicitada")
      .reduce((sum, request) => sum + request.requestedQty, 0),
    totalStock = stock.reduce((s, r) => s + r.qty, 0);
  const chooseCategory = (next: typeof category) => {
    setCategory(next);
    setWorkspace(
      next === "entries"
        ? "in-repair"
        : next === "exits"
          ? "out-repair"
          : "inventory",
    );
  };
  return (
    <section className="warehouse-hub">
      <div className="warehouse-navigation">
        <div className="warehouse-category-tabs" role="tablist" aria-label="Operaciones de almacén">
          <button
            className={category === "entries" ? "active" : ""}
            onClick={() => chooseCategory("entries")}
          >
            <i>↓</i>
            <span><b>Entradas</b><small>Recepción y ubicación</small></span>
          </button>
          <button
            className={category === "exits" ? "active" : ""}
            onClick={() => chooseCategory("exits")}
          >
            <i>↗</i>
            <span><b>Salidas</b><small>Movimientos desde almacén</small></span>
          </button>
          <button
            className={category === "control" ? "active" : ""}
            onClick={() => chooseCategory("control")}
          >
            <i>▦</i>
            <span><b>Control</b><small>Inventario y ubicaciones</small></span>
          </button>
        </div>
        <div className="warehouse-option-tabs">
          {category === "entries" ? (
            <>
            <button
              className={workspace === "in-repair" ? "active repair" : "repair"}
              onClick={() => setWorkspace("in-repair")}
            >
              <i>↓</i>
              <span>
                <small>ALMACÉN DE REPARACIÓN</small>
                <b>{repairIn}</b>
                <em>tareas por almacenar</em>
              </span>
            </button>
            <button
              className={
                workspace === "in-provider" ? "active provider" : "provider"
              }
              onClick={() => setWorkspace("in-provider")}
            >
              <i>↓</i>
              <span>
                <small>ALMACÉN PROVEEDOR</small>
                <b>{providerIn}</b>
                <em>tareas por almacenar</em>
              </span>
            </button>
            </>
          ) : category === "exits" ? (
            <>
            <button
              className={
                workspace === "out-repair" ? "active repair" : "repair"
              }
              onClick={() => setWorkspace("out-repair")}
            >
              <i>⌁</i>
              <span>
                <small>SALIDA A REPARACIÓN</small>
                <b>{pendingRepair}</b>
                <em>piezas solicitadas</em>
              </span>
            </button>
            <button
              className={
                workspace === "out-provider" ? "active provider" : "provider"
              }
              onClick={() => setWorkspace("out-provider")}
            >
              <i>↗</i>
              <span>
                <small>SALIDA A PROVEEDOR</small>
                <b>{providerAvailable}</b>
                <em>piezas disponibles</em>
              </span>
            </button>
            </>
          ) : (
            <>
            <button
              className={workspace === "inventory" ? "active" : ""}
              onClick={() => setWorkspace("inventory")}
            >
              <i>▦</i>
              <span>
                <small>INVENTARIO</small>
                <b>{totalStock}</b>
                <em>piezas registradas</em>
              </span>
            </button>
            <button
              className={workspace === "queries" ? "active" : ""}
              onClick={() => setWorkspace("queries")}
            >
              <i>⌕</i>
              <span>
                <small>CONSULTAS</small>
                <em>consulta por criterio</em>
              </span>
            </button>
            <button
              className={workspace === "relocate" ? "active" : ""}
              onClick={() => setWorkspace("relocate")}
            >
              <i>⇄</i>
              <span>
                <small>CAMBIAR UBICACIÓN</small>
                <b>↔</b>
                <em>movimiento interno</em>
              </span>
            </button>
            </>
          )}
        </div>
      </div>
      <div className="warehouse-active-work">
        <div className="workspace-label">
          <small>ÁREA DE TRABAJO</small>
          <b>
            {workspace === "out-repair"
              ? "Salida · Reparación"
              : workspace === "out-provider"
                ? "Salida · Proveedor"
                : workspace === "in-repair"
                  ? "Entrada · Almacén de reparación"
                  : workspace === "in-provider"
                    ? "Entrada · Almacén proveedor"
                    : workspace === "inventory"
                      ? "Inventario"
                      : workspace === "queries"
                        ? "Consultas"
                        : "Cambiar ubicación"}
          </b>
        </div>
        {workspace === "out-repair" ? (
          <RepairTransferWorkspace
            requests={requests}
            stock={stock}
            onTransfer={onTransfer}
            avisar={avisar}
          />
        ) : workspace === "out-provider" ? (
          <ProviderTransferWorkspace
            requests={providerRequests}
            stock={stock}
            onTransfer={onProviderTransfer}
            avisar={avisar}
          />
        ) : workspace === "in-repair" || workspace === "in-provider" ? (
          <EnhancedWarehouse
            key={workspace}
            items={items}
            onStored={onStored}
            avisar={avisar}
            initialDest={
              workspace === "in-repair" ? "A reparación" : "Almacén Proveedor"
            }
          />
        ) : workspace === "inventory" ? (
          <GroupedInventoryView stock={stock} />
        ) : (
          <WarehouseControl mode={workspace} stock={stock} avisar={avisar} />
        )}
      </div>
    </section>
  );
}

function IntegratedRepairView({
  avisar,
  requests,
  pieces,
  stock,
  onRequest,
  onCancelRequest,
  onUpdatePiece,
}: {
  avisar: (s: string) => void;
  requests: RepairRequest[];
  pieces: RepairPiece[];
  stock: typeof inventoryRows;
  onRequest: (
    input: Omit<
      RepairRequest,
      "requestFolio" | "status" | "requestedAt" | "warrantyFolios"
    >,
  ) => void;
  onCancelRequest: (folio: string) => void;
  onUpdatePiece: (id: string, u: Partial<RepairPiece>) => void;
}) {
  const [tab, setTab] = useState<"inventory" | "tracking" | "requests">(
      "tracking",
    ),
    [query, setQuery] = useState(""),
    [requestSku, setRequestSku] = useState(""),
    [qty, setQty] = useState(1),
    [technician, setTechnician] = useState("Carlos Méndez"),
    [trace, setTrace] = useState<RepairPiece | null>(null),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!pieces.some((p) => p.status === "En reparación")) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pieces]);
  const money = (n: number) =>
      n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    source = stock.filter((r) => r.type === "Reparación"),
    grouped = Object.values(
      source
        .filter(
          (r) =>
            !query ||
            `${r.sku} ${r.product} ${r.provider}`
              .toLowerCase()
              .includes(query.toLowerCase()),
        )
        .reduce(
          (a, r) => {
            const g = (a[r.sku] ??= {
              sku: r.sku,
              product: r.product,
              provider: r.provider,
              total: 0,
              cost: r.cost,
              locations: [] as { location: string; qty: number }[],
            });
            g.total += r.qty;
            g.locations.push({ location: r.location, qty: r.qty });
            return a;
          },
          {} as Record<
            string,
            {
              sku: string;
              product: string;
              provider: string;
              total: number;
              cost: number;
              locations: { location: string; qty: number }[];
            }
          >,
        ),
    ),
    allGroups = Object.values(
      source.reduce(
        (a, r) => {
          const g = (a[r.sku] ??= {
            sku: r.sku,
            product: r.product,
            provider: r.provider,
            total: 0,
          });
          g.total += r.qty;
          return a;
        },
        {} as Record<
          string,
          { sku: string; product: string; provider: string; total: number }
        >,
      ),
    ),
    selected = allGroups.find((g) => g.sku === requestSku);
  const pendingFor = (sku: string) =>
      requests
        .filter((r) => r.sku === sku && r.status === "Solicitada")
        .reduce((s, r) => s + r.requestedQty, 0),
    selectedPending = selected ? pendingFor(selected.sku) : 0,
    selectedAvailable = selected
      ? Math.max(0, selected.total - selectedPending)
      : 0,
    visiblePieces = pieces.filter(
      (p) =>
        !["En calidad", "Calidad aprobada", "Rechazada por calidad"].includes(
          p.status,
        ),
    ),
    returns = visiblePieces.filter((p) => p.qualityReturn);
  const submit = async () => {
    if (!selected || qty < 1 || qty > selectedAvailable) return;
    if (
      !(await askQuestion(
        `¿Confirmas solicitar ${qty} pieza(s) de ${selected.sku} para ${technician}? Quedarán ${selectedAvailable - qty} pieza(s) disponibles.`,
      ))
    )
      return;
    onRequest({
      sku: selected.sku,
      product: selected.product,
      provider: selected.provider,
      requestedQty: qty,
      technician,
    });
    setRequestSku("");
    setQty(1);
  };
  const start = async (p: RepairPiece) => {
    if (
      !(await askQuestion(
        `¿Confirmas ${p.qualityReturn ? "reanudar" : "iniciar"} la reparación de ${p.warrantyFolio}?`,
      ))
    )
      return;
    onUpdatePiece(p.pieceId, {
      status: "En reparación",
      startedAt: Date.now(),
      elapsedSeconds: p.qualityReturn ? p.elapsedSeconds || 0 : 0,
    });
    avisar(
      `${p.warrantyFolio}: cronómetro ${p.qualityReturn ? "reanudado" : "iniciado"} desde ${Math.floor((p.elapsedSeconds || 0) / 60)} min acumulados`,
    );
  };
  const finish = async (p: RepairPiece) => {
    if (
      !p.startedAt ||
      !(await askQuestion(
        `¿Confirmas finalizar la reparación de ${p.warrantyFolio}?`,
      ))
    )
      return;
    const accumulated =
      (p.elapsedSeconds || 0) +
      Math.max(1, Math.floor((Date.now() - p.startedAt) / 1000));
    onUpdatePiece(p.pieceId, {
      status: "Reparación finalizada",
      elapsedSeconds: accumulated,
      startedAt: undefined,
      finishedAt: "26 ago 2026 · Ahora",
    });
    avisar(`${p.warrantyFolio}: reparación finalizada con tiempo acumulado`);
  };
  const quality = async (p: RepairPiece) => {
    if (
      !(await askQuestion(
        `¿Confirmas transferir ${p.warrantyFolio} al área de Calidad?`,
      ))
    )
      return;
    onUpdatePiece(p.pieceId, {
      status: "En calidad",
      qualityAt: "25 ago 2026 · Ahora",
    });
    avisar(`${p.warrantyFolio}: pieza transferida individualmente a Calidad`);
  };
  const duration = (p: RepairPiece) => {
    const seconds =
      (p.elapsedSeconds || 0) +
      (p.status === "En reparación" && p.startedAt
        ? Math.floor((now - p.startedAt) / 1000)
        : 0);
    return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  };
  return (
    <section className="integrated-repair">
      <nav className="repair-tabs">
        <button
          className={tab === "tracking" ? "active" : ""}
          onClick={() => setTab("tracking")}
        >
          <i>⌁</i>
          <span>
            <b>Seguimiento de reparaciones</b>
            <small>
              {visiblePieces.length} piezas · {returns.length} devoluciones de
              Calidad
            </small>
          </span>
        </button>
        <button
          className={tab === "inventory" ? "active" : ""}
          onClick={() => setTab("inventory")}
        >
          <i>▦</i>
          <span>
            <b>Consulta de inventario</b>
            <small>Existencias y solicitud de mercancía</small>
          </span>
        </button>
        <button
          className={tab === "requests" ? "active" : ""}
          onClick={() => setTab("requests")}
        >
          <i>▤</i>
          <span>
            <b>Solicitudes de mercancía</b>
            <small>
              {requests.filter((r) => r.status === "Solicitada").length} activas
            </small>
          </span>
        </button>
      </nav>
      {tab === "inventory" ? (
        <section className="panel repair-inventory">
          <div className="trace-head">
            <div>
              <h2>Consulta de inventario</h2>
              <p>
                Existencias, costos y disponibilidad comprometida por código.
              </p>
            </div>
            <span>
              {grouped.reduce((s, g) => s + g.total, 0)} piezas ·{" "}
              {money(grouped.reduce((s, g) => s + g.total * g.cost, 0))}
            </span>
          </div>
          <label className="outbound-search">
            ⌕
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar código, producto o proveedor"
            />
          </label>
          <div className="repair-inventory-grid controlled-stock">
            {grouped.map((g) => {
              const requested = pendingFor(g.sku),
                available = Math.max(0, g.total - requested);
              return (
                <article key={g.sku}>
                  <span className="repair-product">
                    <small>CÓDIGO Y PRODUCTO</small>
                    <b>{g.sku}</b>
                    <em>{g.product}</em>
                    <i>{g.provider}</i>
                  </span>
                  <span className="inventory-column">
                    <small>INVENTARIO</small>
                    <b>{g.total}</b>
                    <em>piezas</em>
                  </span>
                  <span className="inventory-column requested">
                    <small>SOLICITADAS</small>
                    <b>{requested}</b>
                    <em>piezas</em>
                  </span>
                  <span className="inventory-column available">
                    <small>DISPONIBLES</small>
                    <b>{available}</b>
                    <em>piezas</em>
                  </span>
                  <span className="inventory-column unit-cost">
                    <small>COSTO UNITARIO</small>
                    <b>{money(g.cost)}</b>
                  </span>
                  <span className="inventory-column total-cost">
                    <small>VALOR TOTAL</small>
                    <b>{money(g.total * g.cost)}</b>
                  </span>
                  <span className="inventory-locations">
                    {g.locations.map((l) => (
                      <small key={l.location}>
                        {l.location} · {l.qty}
                      </small>
                    ))}
                  </span>
                  <div className="inventory-request-action">
                    {requested > 0 && (
                      <small className="existing-request-note">
                        Ya existe una solicitud por {requested} pieza(s).
                      </small>
                    )}
                    <button
                      className="primario"
                      disabled={available === 0}
                      onClick={() => {
                        setRequestSku(g.sku);
                        setQty(1);
                      }}
                    >
                      {available === 0
                        ? "Inventario comprometido"
                        : "Solicitar mercancía"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : tab === "requests" ? (
        <section className="panel active-merchandise-requests requests-workspace">
          <div className="trace-head">
            <div>
              <h2>Solicitudes de mercancía activas</h2>
              <p>
                Consulta las piezas comprometidas o cancela una solicitud
                pendiente para liberar inventario.
              </p>
            </div>
            <span>
              {requests.filter((r) => r.status === "Solicitada").length} activas
            </span>
          </div>
          {requests.filter((r) => r.status === "Solicitada").length ? (
            requests
              .filter((r) => r.status === "Solicitada")
              .map((r) => (
                <article key={r.requestFolio}>
                  <span>
                    <small>FOLIO</small>
                    <b>{r.requestFolio}</b>
                    <em>
                      {r.sku} · {r.product}
                    </em>
                  </span>
                  <span>
                    <small>CANTIDAD / TÉCNICO</small>
                    <b>{r.requestedQty} piezas</b>
                    <em>{r.technician}</em>
                  </span>
                  <span>
                    <small>FECHA DE SOLICITUD</small>
                    <b>{r.requestedAt}</b>
                  </span>
                  <button
                    className="cancel-request"
                    onClick={() => onCancelRequest(r.requestFolio)}
                  >
                    Cancelar solicitud
                  </button>
                </article>
              ))
          ) : (
            <div className="trace-empty">
              <i>✓</i>
              <strong>Sin solicitudes activas</strong>
              <p>No existen piezas comprometidas pendientes de transferencia.</p>
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="repair-summary-cards">
            <article>
              <small>PENDIENTES DE ALMACÉN</small>
              <b>{requests.filter((r) => r.status === "Solicitada").length}</b>
              <span>Solicitudes por transferir</span>
            </article>
            <article>
              <small>EN REPARACIÓN</small>
              <b>
                {
                  visiblePieces.filter(
                    (p) =>
                      p.status === "En reparación" ||
                      p.status === "Asignada al técnico",
                  ).length
                }
              </b>
              <span>Registros individuales</span>
            </article>
            <article className="rework-card">
              <small>DEVOLUCIONES DE CALIDAD</small>
              <b>{returns.length}</b>
              <span>Piezas para volver a reparar</span>
            </article>
          </div>
          <section className="panel piece-tracking">
            <div className="trace-head">
              <div>
                <h2>Seguimiento de reparaciones</h2>
                <p>
                  Los artículos enviados a Calidad dejan de aparecer en esta
                  lista.
                </p>
              </div>
              <span>{visiblePieces.length} piezas</span>
            </div>
            <div className="piece-grid">
              <header>
                <span>Solicitud / producto</span>
                <span>Origen / técnico</span>
                <span>Transferencia</span>
                <span>Estado y tiempo</span>
                <span>Acciones</span>
              </header>
              {visiblePieces.map((p) => (
                <article
                  className={p.qualityReturn ? "quality-return" : ""}
                  key={p.pieceId}
                >
                  <span>
                    <b>{p.warrantyFolio}</b>
                    <small>
                      {p.sku} · {p.product}
                    </small>
                    <em>{p.requestFolio}</em>
                    {p.qualityReturn && (
                      <>
                        <i>DEVOLUCIÓN DE CALIDAD</i>
                        <small className="quality-return-reason">
                          {p.qualityReason}
                        </small>
                      </>
                    )}
                  </span>
                  <span>
                    <b>{p.originLocation}</b>
                    <small>{p.technician}</small>
                  </span>
                  <span>
                    <b>{p.transferredAt}</b>
                    <small>{p.pieceId}</small>
                  </span>
                  <span>
                    <i
                      className={`piece-status ${p.status.toLowerCase().replaceAll(" ", "-")}`}
                    >
                      {p.status}
                    </i>
                    <strong>{duration(p)}</strong>
                  </span>
                  <span className="piece-actions">
                    {p.status === "Asignada al técnico" && (
                      <button className="primario" onClick={() => start(p)}>
                        {p.qualityReturn
                          ? "Reanudar reparación"
                          : "Iniciar reparación"}
                      </button>
                    )}
                    {p.status === "En reparación" && (
                      <button className="primario" onClick={() => finish(p)}>
                        Finalizar reparación
                      </button>
                    )}
                    {p.status === "Reparación finalizada" && (
                      <button
                        className="quality-button"
                        onClick={() => quality(p)}
                      >
                        Transferir a Calidad
                      </button>
                    )}
                    <button onClick={() => setTrace(p)}>Trazabilidad</button>
                  </span>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
      {requestSku && selected && (
        <div className="repair-request-modal">
          <section>
            <header>
              <div>
                <small>SOLICITUD DE MERCANCÍA</small>
                <h2>
                  {selected.sku} · {selected.product}
                </h2>
                <p>Se generará un folio único para controlar el retiro.</p>
              </div>
              <button onClick={() => setRequestSku("")}>×</button>
            </header>
            <main>
              <div className="request-availability">
                <span>
                  <small>INVENTARIO</small>
                  <b>{selected.total}</b>
                </span>
                <span>
                  <small>YA SOLICITADAS</small>
                  <b>{selectedPending}</b>
                </span>
                <span className="available">
                  <small>DISPONIBLES</small>
                  <b>{selectedAvailable}</b>
                </span>
              </div>
              {selectedPending > 0 && (
                <p className="existing-request-modal-note">
                  Ya existe una solicitud activa por {selectedPending} pieza(s).
                  Puedes solicitar únicamente las {selectedAvailable} pieza(s)
                  restantes.
                </p>
              )}
              <label>
                Cantidad requerida
                <input
                  type="number"
                  min="1"
                  max={selectedAvailable}
                  value={qty}
                  onChange={(e) =>
                    setQty(
                      Math.min(selectedAvailable, Math.max(0, +e.target.value)),
                    )
                  }
                />
                <small>
                  No puede exceder las {selectedAvailable} piezas disponibles.
                </small>
              </label>
              <label>
                Técnico solicitante
                <select
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                >
                  <option>Carlos Méndez</option>
                  <option>Laura Ramírez</option>
                  <option>José Salgado</option>
                </select>
              </label>
            </main>
            <footer>
              <button onClick={() => setRequestSku("")}>Cancelar</button>
              <button
                className="primario"
                disabled={qty < 1 || qty > selectedAvailable}
                onClick={submit}
              >
                Confirmar solicitud
              </button>
            </footer>
          </section>
        </div>
      )}
      {trace && (
        <div className="repair-request-modal">
          <section className="trace-dialog">
            <header>
              <div>
                <small>TRAZABILIDAD COMPLETA</small>
                <h2>{trace.warrantyFolio}</h2>
                <p>{trace.pieceId}</p>
              </div>
              <button onClick={() => setTrace(null)}>×</button>
            </header>
            <main>
              <ol>
                <li>
                  <i>✓</i>
                  <span>
                    <b>Solicitud de mercancía</b>
                    <small>{trace.requestFolio}</small>
                  </span>
                </li>
                <li>
                  <i>✓</i>
                  <span>
                    <b>Transferencia desde almacén</b>
                    <small>
                      {trace.originLocation} · {trace.transferredAt}
                    </small>
                  </span>
                </li>
                <li>
                  <i>{trace.finishedAt ? "✓" : "○"}</i>
                  <span>
                    <b>Reparación</b>
                    <small>{trace.finishedAt || "Pendiente"}</small>
                  </span>
                </li>
                <li>
                  <i>{trace.qualityAt ? "✓" : "○"}</i>
                  <span>
                    <b>Transferencia a Calidad</b>
                    <small>{trace.qualityAt || "Pendiente"}</small>
                  </span>
                </li>
                {trace.qualityReturn && (
                  <li>
                    <i>↩</i>
                    <span>
                      <b>Devolución de Calidad</b>
                      <small>
                        {trace.qualityReason ||
                          "Retornada al técnico para retrabajo"}{" "}
                        · Tiempo acumulado conservado: {duration(trace)}
                      </small>
                    </span>
                  </li>
                )}
              </ol>
            </main>
            <footer>
              <button className="primario" onClick={() => setTrace(null)}>
                Cerrar
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
type AssemblyPallet = {
  id: string;
  name: string;
  pieces: RepairPiece[];
  status: "Armada" | "Transferida a CEDIS";
  folio?: string;
  createdAt: string;
};
function AssemblyWorkspace({
  pieces,
  avisar,
}: {
  pieces: RepairPiece[];
  avisar: (s: string) => void;
}) {
  const [mode, setMode] = useState<"pending" | "pallets">("pending"),
    [code, setCode] = useState(""),
    [checked, setChecked] = useState<string[]>([]),
    [pallets, setPallets] = useState<AssemblyPallet[]>([]),
    [detail, setDetail] = useState<AssemblyPallet | null>(null),
    [palletSearch, setPalletSearch] = useState(""),
    [palletStatus, setPalletStatus] = useState("Todos");
  const used = pallets.flatMap((p) => p.pieces.map((i) => i.pieceId)),
    pending = pieces.filter((p) => !used.includes(p.pieceId)),
    detailGroups = detail
      ? Object.values(
          detail.pieces.reduce(
            (a, p) => {
              const g = (a[p.sku] ??= {
                sku: p.sku,
                product: p.product,
                qty: 0,
              });
              g.qty++;
              a[p.sku] = g;
              return a;
            },
            {} as Record<string, { sku: string; product: string; qty: number }>,
          ),
        )
      : [],
    filteredPallets = pallets.filter(
      (p) =>
        (palletStatus === "Todos" || p.status === palletStatus) &&
        (!palletSearch.trim() ||
          [p.name, p.id, p.folio || "", p.createdAt].some((v) =>
            v.toLowerCase().includes(palletSearch.toLowerCase()),
          )),
    );
  const scan = (value = code) => {
    const v = value.trim().toUpperCase(),
      p = pending.find(
        (x) =>
          !checked.includes(x.pieceId) &&
          [x.warrantyFolio, x.pieceId, x.sku].some(
            (y) => y.toUpperCase() === v,
          ),
      );
    if (!p) {
      avisar("Código no encontrado o ya escaneado");
      return;
    }
    setChecked((x) => [...x, p.pieceId]);
    setCode("");
    avisar(`${p.warrantyFolio}: escaneo confirmado`);
  };
  const assemble = async () => {
    const selected = pending.filter((p) => checked.includes(p.pieceId));
    if (
      !selected.length ||
      !(await askQuestion(
        `¿Confirmas armar una tarima con ${selected.length} producto(s) escaneado(s)?`,
      ))
    )
      return;
    setPallets((current) => {
      const sequence = current.length + 1;
      return [
        {
          id: `TAR-${String(sequence).padStart(4, "0")}`,
          name: `Tarima ${sequence}`,
          pieces: selected,
          status: "Armada",
          createdAt: "26 ago 2026 · Ahora",
        },
        ...current,
      ];
    });
    setChecked([]);
    setMode("pallets");
    avisar("Tarima creada correctamente");
  };
  const transfer = async (p: AssemblyPallet) => {
    if (
      !(await askQuestion(
        `¿Confirmas generar el traspaso a CEDIS de ${p.name}?`,
      ))
    )
      return;
    const folio = `TR-CEDIS-${String(261 + pallets.length).padStart(4, "0")}`;
    setPallets((x) =>
      x.map((i) =>
        i.id === p.id ? { ...i, status: "Transferida a CEDIS", folio } : i,
      ),
    );
    setDetail((current) =>
      current?.id === p.id
        ? { ...current, status: "Transferida a CEDIS", folio }
        : current,
    );
    avisar(`Se generó correctamente el folio ${folio} de traspaso a AL1`);
    setTimeout(() => window.print(), 150);
  };
  return (
    <section className="assembly-workspace">
      <nav className="assembly-subtabs">
        <button
          className={mode === "pending" ? "active" : ""}
          onClick={() => setMode("pending")}
        >
          Pendientes <b>{pending.length}</b>
        </button>
        <button
          className={mode === "pallets" ? "active" : ""}
          onClick={() => setMode("pallets")}
        >
          Tarimas <b>{pallets.length}</b>
        </button>
      </nav>
      {mode === "pending" ? (
        <section className="panel assembly-panel">
          <div className="trace-head">
            <div>
              <h2>Armado de tarima</h2>
              <p>
                Escanea solicitudes aprobadas. La tarima puede armarse
                parcialmente.
              </p>
            </div>
            <span>{checked.length} confirmadas</span>
          </div>
          <div className="assembly-scan">
            <label>
              Código de barras
              <div>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      scan();
                    }
                  }}
                  placeholder="Folio, etiqueta o código"
                />
                <button onClick={() => scan()}>Confirmar escaneo</button>
                <button
                  onClick={() => {
                    const p = pending.find((x) => !checked.includes(x.pieceId));
                    if (p) scan(p.warrantyFolio);
                  }}
                >
                  ▥ Simular
                </button>
              </div>
            </label>
            <button
              className="primario"
              disabled={!checked.length}
              onClick={assemble}
            >
              Armar tarima ({checked.length})
            </button>
          </div>
          <div className="assembly-list">
            <header>
              <span>Check</span>
              <span>Solicitud</span>
              <span>Producto</span>
              <span>Técnico / sucursal</span>
              <span>Calidad</span>
            </header>
            {pending.map((p) => (
              <article
                className={checked.includes(p.pieceId) ? "scanned" : ""}
                key={p.pieceId}
              >
                <i>{checked.includes(p.pieceId) ? "✓" : ""}</i>
                <span>
                  <b>{p.warrantyFolio}</b>
                  <small>{p.pieceId}</small>
                </span>
                <span>
                  <b>{p.sku}</b>
                  <small>{p.product}</small>
                </span>
                <span>
                  <b>{p.technician}</b>
                  <small>{p.branch || "GDL Centro"}</small>
                </span>
                <em>Aprobado</em>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel pallet-list">
          <div className="trace-head">
            <div>
              <h2>Tarimas armadas</h2>
              <p>Visualiza cada tarima y consulta el estado de su traspaso.</p>
            </div>
            <span>
              {filteredPallets.length} de {pallets.length}
            </span>
          </div>
          <div className="pallet-filters">
            <label>
              Buscar por folio, fecha o tarima
              <input
                value={palletSearch}
                onChange={(e) => setPalletSearch(e.target.value)}
                placeholder="Ej. TR-CEDIS, TAR-0001 o 26 ago"
              />
            </label>
            <label>
              Estado
              <select
                value={palletStatus}
                onChange={(e) => setPalletStatus(e.target.value)}
              >
                <option>Todos</option>
                <option>Armada</option>
                <option>Transferida a CEDIS</option>
              </select>
            </label>
            <button
              onClick={() => {
                setPalletSearch("");
                setPalletStatus("Todos");
              }}
            >
              Limpiar
            </button>
          </div>
          {filteredPallets.length ? (
            filteredPallets.map((p) => (
              <article key={p.id}>
                <i>▦</i>
                <span>
                  <b>{p.name}</b>
                  <small>
                    {p.id} · {p.createdAt} · {p.pieces.length} pieza(s)
                  </small>
                  <em>{p.pieces.map((x) => x.warrantyFolio).join(" · ")}</em>
                </span>
                <strong>{p.status}</strong>
                <button onClick={() => setDetail(p)}>Ver tarima</button>
                <div
                  className={`pallet-transfer-status ${p.folio ? "completed" : "pending"}`}
                >
                  <small>ESTADO DEL TRASPASO</small>
                  <b>{p.folio ? "Realizado" : "Pendiente"}</b>
                  {p.folio && <em>{p.folio}</em>}
                </div>
              </article>
            ))
          ) : (
            <div className="warehouse-query-empty">
              <i>▦</i>
              <b>No se encontraron tarimas</b>
              <p>Ajusta los filtros o arma una nueva tarima.</p>
            </div>
          )}
        </section>
      )}
      {detail && (
        <div className="repair-request-modal pallet-detail-modal">
          <section>
            <header>
              <div>
                <small>DETALLE DE TARIMA</small>
                <h2>{detail.name}</h2>
                <p>{detail.id}</p>
              </div>
              <button onClick={() => setDetail(null)}>×</button>
            </header>
            <main>
              <div className="pallet-detail-groups">
                <header>
                  <span>Código y producto</span>
                  <span>Cantidad</span>
                </header>
                {detailGroups.map((group) => (
                  <article key={group.sku}>
                    <span>
                      <b>{group.sku}</b>
                      <small>{group.product}</small>
                    </span>
                    <strong>{group.qty} pieza(s)</strong>
                  </article>
                ))}
              </div>
              <div className="pallet-detail-total">
                <span>Total de piezas en la tarima</span>
                <b>{detail.pieces.length}</b>
              </div>
            </main>
            <footer>
              <button onClick={() => setDetail(null)}>Cerrar</button>
              {detail.status === "Armada" ? (
                <button className="primario" onClick={() => transfer(detail)}>
                  Generar traspaso a CEDIS
                </button>
              ) : (
                <div className="pallet-modal-transfer-state">
                  <small>TRASPASO REALIZADO</small>
                  <b>{detail.folio}</b>
                </div>
              )}
            </footer>
            <aside className="pallet-transfer-print">
              <header>
                <h1>Reporte de traspaso a CEDIS</h1>
                <p>Folio: {detail.folio || "Pendiente de generación"}</p>
              </header>
              <dl>
                <div>
                  <dt>Origen</dt>
                  <dd>Garantías Central · Área de Armado</dd>
                </div>
                <div>
                  <dt>Destino</dt>
                  <dd>AL1 · CEDIS</dd>
                </div>
                <div>
                  <dt>Tarima</dt>
                  <dd>
                    {detail.name} · {detail.id}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{detail.pieces.length} piezas</dd>
                </div>
              </dl>
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th>Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {detailGroups.map((group) => (
                    <tr key={group.sku}>
                      <td>{group.sku}</td>
                      <td>{group.product}</td>
                      <td>{group.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </aside>
          </section>
        </div>
      )}
    </section>
  );
}
type QualityGeneratedIncident = {
  id: string;
  sku: string;
  product: string;
  branch: string;
  detail: string;
  date: string;
  technician?: string;
  diagnosis?: string;
  action?: string;
};
type ProductReviewRow = {
  sku: string;
  product: string;
  signal: string;
  action: string;
  status: string;
  diagnosis?: string;
  technician?: string;
  determination?: string;
  followUp?: string;
};
type ProviderBlockRow = {
  id: string;
  name: string;
  signal: string;
  status: string;
  observations?: string;
  response?: string;
  reason: string;
  impact: string;
};
function QualityAlertsWorkspace({
  avisar,
  onCreateIncident,
}: {
  avisar: (s: string) => void;
  onCreateIncident: (i: QualityGeneratedIncident) => void;
}) {
  const [products, setProducts] = useState<ProductReviewRow[]>([
      {
        sku: "DE-2341",
        product: "Sensor de oxígeno Denso",
        signal: "18 solicitudes en 7 días · 6.4% de ventas",
        action: "Analizar producto",
        status: "Pendiente de revisión",
      },
      {
        sku: "FR-D1287",
        product: "Juego de balatas Fritec",
        signal: "9 solicitudes en 14 días · 3.2% de ventas",
        action: "Analizar producto",
        status: "Pendiente de revisión",
      },
    ]),
    [providers, setProviders] = useState<ProviderBlockRow[]>([
      {
        id: "PRV-1028",
        name: "Denso México",
        signal: "Recurrencia crítica en 3 códigos · $284,600 pendientes",
        status: "Sin solicitud",
        reason: "Recurrencia crítica y producto fuera de especificación",
        impact: "$284,600 pendientes de recuperación",
      },
      {
        id: "PRV-0842",
        name: "Bosch Autopartes",
        signal: "2 códigos sobre umbral · $186,240 pendientes",
        status: "Sin solicitud",
        reason: "Dos códigos exceden el umbral de garantía",
        impact: "$186,240 pendientes de recuperación",
      },
      {
        id: "PRV-0615",
        name: "LTH / Clarios",
        signal: "Reincidencia en baterías H-47 · $98,900 pendientes",
        status: "Sin solicitud",
        reason: "Reincidencia en baterías H-47",
        impact: "$98,900 pendientes de recuperación",
      },
    ]),
    [review, setReview] = useState<ProductReviewRow | null>(null),
    [providerRequest, setProviderRequest] = useState<ProviderBlockRow | null>(
      null,
    ),
    [unlock, setUnlock] = useState<{
      kind: "product" | "provider";
      id: string;
      label: string;
    } | null>(null),
    [decision, setDecision] = useState(""),
    [followUp, setFollowUp] = useState("");
  const saveReview = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!review) return;
    const f = new FormData(e.currentTarget),
      diagnosis = String(f.get("diagnosis")),
      technician = String(f.get("technician")),
      failure = decision === "No funciona";
    if (failure && !followUp) {
      avisar("Selecciona la acción a realizar");
      return;
    }
    if (
      !(await askQuestion(
        "¿Confirmas registrar el diagnóstico y la determinación final de Calidad?",
      ))
    )
      return;
    setReview(null);
    if (!failure) {
      setProducts((rows) => rows.filter((r) => r.sku !== review.sku));
      setDecision("");
      avisar(
        review.sku + ": producto funcional; registro eliminado de la revisión",
      );
      return;
    }
    const determination = `Producto bloqueado · ${followUp}`;
    setProducts((rows) =>
      rows.map((r) =>
        r.sku === review.sku
          ? {
              ...r,
              status: "Producto bloqueado",
              diagnosis,
              technician,
              determination,
              followUp,
            }
          : r,
      ),
    );
    onCreateIncident({
      id: `INC-NC-${review.sku}`,
      sku: review.sku,
      product: review.product,
      branch: "Garantías Central",
      detail: `${review.product} · Técnico: ${technician} · Diagnóstico: ${diagnosis} · Acción: ${followUp}`,
      technician,
      diagnosis,
      action: followUp,
      date: "26 ago 2026 · Ahora",
    });
    setDecision("");
    setFollowUp("");
    avisar(review.sku + ": producto bloqueado e incidencia generada");
  };
  const requestProvider = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!providerRequest) return;
    const observations = String(
      new FormData(e.currentTarget).get("observations"),
    );
    if (
      !(await askQuestion(
        "¿Confirmas enviar la solicitud de bloqueo a Dirección General?",
      ))
    )
      return;
    setProviders((rows) =>
      rows.map((r) =>
        r.id === providerRequest.id
          ? { ...r, status: "Enviada a Dirección General", observations }
          : r,
      ),
    );
    setProviderRequest(null);
    avisar("Solicitud enviada a Dirección General; pendiente de respuesta");
  };
  const registerResponse = async (
    row: ProviderBlockRow,
    response: "Aprobada" | "Rechazada",
  ) => {
    if (
      !(await askQuestion(
        "¿Confirmas registrar la respuesta " +
          response.toLowerCase() +
          " de Dirección General?",
      ))
    )
      return;
    if (response === "Rechazada")
      setProviders((rows) => rows.filter((r) => r.id !== row.id));
    else
      setProviders((rows) =>
        rows.map((r) =>
          r.id === row.id
            ? { ...r, status: "Proveedor bloqueado", response }
            : r,
        ),
      );
    avisar(row.id + ": respuesta " + response.toLowerCase() + " registrada");
  };
  const confirmUnlock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!unlock) return;
    const f = new FormData(e.currentTarget);
    if (
      String(f.get("user")) !== "agonzalez" ||
      String(f.get("password")) !== "0000"
    ) {
      showInfo(
        "Usuario no autorizado. Verifica las credenciales e intenta nuevamente.",
      );
      return;
    }
    if (!(await askQuestion(`¿Confirmas desbloquear ${unlock.label}?`))) return;
    if (unlock.kind === "product")
      setProducts((rows) => rows.filter((r) => r.sku !== unlock.id));
    else
      setProviders((rows) =>
        rows.map((r) =>
          r.id === unlock.id ? { ...r, status: "Desbloqueado" } : r,
        ),
      );
    avisar(unlock.label + ": desbloqueo autorizado");
    setUnlock(null);
  };
  return (
    <section className="quality-alert-workspace">
      <div className="panel product-review-panel">
        <Cab
          t="Revisión de producto por Calidad"
          s="Diagnóstico obligatorio antes de bloquear o liberar el producto"
        />
        <div className="quality-product-alerts">
          {products.map((row) => (
            <article
              key={row.sku}
              className={row.status.includes("bloqueado") ? "blocked" : ""}
            >
              <div>
                <small>PRODUCTO EN ALERTA</small>
                <b>
                  {row.sku} · {row.product}
                </b>
                <span>{row.signal}</span>
              </div>
              <em>{row.status}</em>
              {row.diagnosis ? (
                <>
                  <dl>
                    <div>
                      <dt>Técnico</dt>
                      <dd>{row.technician}</dd>
                    </div>
                    <div>
                      <dt>Diagnóstico</dt>
                      <dd>{row.diagnosis}</dd>
                    </div>
                    <div>
                      <dt>Determinación final</dt>
                      <dd>{row.determination}</dd>
                    </div>
                  </dl>
                  <button
                    className="unlock-button"
                    onClick={() =>
                      setUnlock({
                        kind: "product",
                        id: row.sku,
                        label: `el producto ${row.sku}`,
                      })
                    }
                  >
                    Desbloquear producto
                  </button>
                </>
              ) : (
                <button
                  className="primario compact-action-button"
                  onClick={() => setReview(row)}
                >
                  {row.action}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
      <div className="panel provider-review-panel">
        <Cab
          t="Solicitudes de bloqueo de proveedor"
          s="Cada proveedor requiere autorización expresa de Dirección General"
        />
        <div className="provider-block-list">
          {providers.map((row) => (
            <article key={row.id}>
              <div>
                <small>PROVEEDOR</small>
                <b>
                  {row.id} · {row.name}
                </b>
                <span>{row.signal}</span>
                {row.observations && <p>Observaciones: {row.observations}</p>}
              </div>
              <em
                className={
                  row.status === "Proveedor bloqueado" ? "approved" : ""
                }
              >
                {row.status}
              </em>
              {row.status === "Sin solicitud" ? (
                <button onClick={() => setProviderRequest(row)}>
                  Solicitar bloqueo
                </button>
              ) : row.status === "Enviada a Dirección General" ? (
                <div className="provider-response-actions">
                  <button onClick={() => registerResponse(row, "Aprobada")}>
                    Registrar aprobación
                  </button>
                  <button onClick={() => registerResponse(row, "Rechazada")}>
                    Registrar rechazo
                  </button>
                </div>
              ) : row.status === "Proveedor bloqueado" ? (
                <button
                  className="unlock-button"
                  onClick={() =>
                    setUnlock({
                      kind: "provider",
                      id: row.id,
                      label: `el proveedor ${row.name}`,
                    })
                  }
                >
                  Desbloquear proveedor
                </button>
              ) : (
                <strong>Proveedor desbloqueado</strong>
              )}
            </article>
          ))}
        </div>
      </div>
      {review && (
        <div className="repair-request-modal quality-alert-modal">
          <form onSubmit={saveReview}>
            <header>
              <div>
                <small>REVISIÓN TÉCNICA DE CALIDAD</small>
                <h2>
                  {review.sku} · {review.product}
                </h2>
                <p>
                  Registra la prueba, el responsable y la determinación final.
                </p>
              </div>
              <button type="button" onClick={() => setReview(null)}>
                ×
              </button>
            </header>
            <main>
              <label>
                Técnico responsable
                <select name="technician" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar técnico
                  </option>
                  <option>Carlos Méndez</option>
                  <option>Laura Ramírez</option>
                  <option>José Salgado</option>
                </select>
              </label>
              <label>
                Diagnóstico
                <textarea
                  name="diagnosis"
                  required
                  rows={5}
                  placeholder="Describe pruebas realizadas, lecturas y conclusión técnica…"
                />
              </label>
              <label>
                Resultado técnico
                <select
                  required
                  value={decision}
                  onChange={(e) => {
                    setDecision(e.target.value);
                    if (e.target.value !== "No funciona") setFollowUp("");
                  }}
                >
                  <option value="" disabled>
                    Seleccionar resultado
                  </option>
                  <option>Funciona correctamente</option>
                  <option>No funciona</option>
                </select>
              </label>
              {decision === "No funciona" && (
                <label>
                  Acción a realizar
                  <select
                    required
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                  >
                    <option value="" disabled>
                      Seleccionar acción
                    </option>
                    <option>Solicitar traspasos de sucursales</option>
                    <option>Solicitar aclaración con el proveedor</option>
                    <option>Escalar con el comprador</option>
                    <option>Recuperación preventiva nacional</option>
                  </select>
                </label>
              )}
              <div className="quality-decision-note">
                <b>Funciona:</b> el registro se elimina. <b>No funciona:</b> se
                bloquea y se ejecuta la acción seleccionada.
              </div>
            </main>
            <footer>
              <button type="button" onClick={() => setReview(null)}>
                Cancelar
              </button>
              <button className="primario">Registrar determinación</button>
            </footer>
          </form>
        </div>
      )}
      {providerRequest && (
        <div className="repair-request-modal quality-alert-modal">
          <form onSubmit={requestProvider}>
            <header>
              <div>
                <small>SOLICITUD A DIRECCIÓN GENERAL</small>
                <h2>
                  {providerRequest.id} · {providerRequest.name}
                </h2>
                <p>Información precargada para revisión y autorización.</p>
              </div>
              <button type="button" onClick={() => setProviderRequest(null)}>
                ×
              </button>
            </header>
            <main>
              <label>
                Proveedor
                <input
                  value={`${providerRequest.id} · ${providerRequest.name}`}
                  readOnly
                />
              </label>
              <label>
                Motivo
                <input value={providerRequest.reason} readOnly />
              </label>
              <label>
                Impacto
                <input value={providerRequest.impact} readOnly />
              </label>
              <label>
                Acción solicitada
                <input value="Bloqueo preventivo de proveedor" readOnly />
              </label>
              <label>
                Observaciones y justificación
                <textarea
                  name="observations"
                  required
                  rows={5}
                  defaultValue={`Se solicita revisión por ${providerRequest.reason.toLowerCase()}. Validar códigos afectados, recuperaciones pendientes y continuidad de compra.`}
                />
              </label>
            </main>
            <footer>
              <button type="button" onClick={() => setProviderRequest(null)}>
                Cancelar
              </button>
              <button className="primario">Enviar solicitud</button>
            </footer>
          </form>
        </div>
      )}
      {unlock && (
        <div className="repair-request-modal quality-alert-modal unlock-modal">
          <form onSubmit={confirmUnlock}>
            <header>
              <div>
                <small>AUTORIZACIÓN REQUERIDA</small>
                <h2>Desbloquear registro</h2>
                <p>Captura las credenciales de un usuario autorizado.</p>
              </div>
              <button type="button" onClick={() => setUnlock(null)}>
                ×
              </button>
            </header>
            <main>
              <label>
                Usuario
                <input
                  name="user"
                  autoComplete="off"
                  required
                  placeholder="Usuario autorizado"
                />
              </label>
              <label>
                Contraseña
                <input
                  name="password"
                  type="password"
                  required
                  placeholder="Contraseña"
                />
              </label>
            </main>
            <footer>
              <button type="button" onClick={() => setUnlock(null)}>
                Cancelar
              </button>
              <button className="primario">Autorizar desbloqueo</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function QualityView({
  pieces,
  onResolve,
  avisar,
  approved,
  setApproved,
  stock,
  providerRequests,
  onProviderRequest,
  onCancelProviderRequest,
  onCreateIncident,
}: {
  pieces: RepairPiece[];
  onResolve: (
    piece: RepairPiece,
    action: "approved" | "return" | "rejected",
    reason?: string,
  ) => void;
  avisar: (s: string) => void;
  approved: boolean;
  setApproved: (v: boolean) => void;
  stock: typeof inventoryRows;
  providerRequests: ProviderOutboundRequest[];
  onProviderRequest: (input: {
    sku: string;
    product: string;
    provider: string;
    requestedQty: number;
  }) => void;
  onCancelProviderRequest: (folio: string) => void;
  onCreateIncident: (i: QualityGeneratedIncident) => void;
}) {
  const [tab, setTab] = useState<
      | "validation"
      | "assembly"
      | "alerts"
      | "provider-inventory"
      | "provider-requests"
    >("validation"),
    [decision, setDecision] = useState<{
      piece: RepairPiece;
      action: "return" | "rejected";
    } | null>(null),
    [reason, setReason] = useState(""),
    [providerQuery, setProviderQuery] = useState(""),
    [providerSku, setProviderSku] = useState(""),
    [providerQty, setProviderQty] = useState(1);
  const validation = pieces.filter((p) => p.status === "En calidad"),
    assembly = pieces.filter((p) => p.status === "Calidad aprobada");
  const money = (n: number) =>
      n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
    providerGroups = Object.values(
      stock
        .filter(
          (row) =>
            row.type === "Proveedor" &&
            (!providerQuery ||
              `${row.sku} ${row.product} ${row.provider}`
                .toLowerCase()
                .includes(providerQuery.toLowerCase())),
        )
        .reduce(
          (groups, row) => {
            const group = (groups[row.sku] ??= {
              sku: row.sku,
              product: row.product,
              provider: row.provider,
              total: 0,
              cost: row.cost,
              locations: [] as { location: string; qty: number }[],
            });
            group.total += row.qty;
            group.locations.push({ location: row.location, qty: row.qty });
            return groups;
          },
          {} as Record<
            string,
            {
              sku: string;
              product: string;
              provider: string;
              total: number;
              cost: number;
              locations: { location: string; qty: number }[];
            }
          >,
        ),
    ),
    providerPendingFor = (sku: string) =>
      providerRequests
        .filter(
          (request) =>
            request.sku === sku && request.status === "Solicitada",
        )
        .reduce((total, request) => total + request.requestedQty, 0),
    selectedProvider = providerGroups.find(
      (group) => group.sku === providerSku,
    ),
    selectedProviderAvailable = selectedProvider
      ? Math.max(
          0,
          selectedProvider.total - providerPendingFor(selectedProvider.sku),
        )
      : 0;
  const submitProviderRequest = async () => {
    if (
      !selectedProvider ||
      providerQty < 1 ||
      providerQty > selectedProviderAvailable ||
      !(await askQuestion(
        `¿Confirmas solicitar ${providerQty} pieza(s) de ${selectedProvider.sku} para Salida a proveedor?`,
      ))
    )
      return;
    onProviderRequest({
      sku: selectedProvider.sku,
      product: selectedProvider.product,
      provider: selectedProvider.provider,
      requestedQty: providerQty,
    });
    setProviderSku("");
    setProviderQty(1);
  };
  const confirmReason = () => {
    if (!decision || !reason.trim()) return;
    onResolve(decision.piece, decision.action, reason.trim());
    setDecision(null);
    setReason("");
  };
  return (
    <section className="quality-workspace">
      <nav className="quality-tabs quality-tabs-five">
        <button
          className={tab === "validation" ? "active" : ""}
          onClick={() => setTab("validation")}
        >
          <i>✓</i>
          <span>
            <b>Validaciones posteriores a reparación</b>
            <small>{validation.length} piezas pendientes</small>
          </span>
        </button>
        <button
          className={tab === "assembly" ? "active" : ""}
          onClick={() => setTab("assembly")}
        >
          <i>▦</i>
          <span>
            <b>Armado</b>
            <small>{assembly.length} solicitudes aprobadas</small>
          </span>
        </button>
        <button
          className={tab === "alerts" ? "active" : ""}
          onClick={() => setTab("alerts")}
        >
          <i>!</i>
          <span>
            <b>Alertas de recurrencia</b>
            <small>Producto y proveedor</small>
          </span>
        </button>
        <button
          className={tab === "provider-inventory" ? "active" : ""}
          onClick={() => setTab("provider-inventory")}
        >
          <i>⌕</i>
          <span>
            <b>Consulta de inventario proveedor</b>
            <small>
              {providerRequests.filter((request) => request.status === "Solicitada").length} solicitudes de salida activas
            </small>
          </span>
        </button>
        <button
          className={tab === "provider-requests" ? "active" : ""}
          onClick={() => setTab("provider-requests")}
        >
          <i>↗</i>
          <span>
            <b>Solicitudes de salida a proveedor</b>
            <small>Seguimiento y cancelación</small>
          </span>
        </button>
      </nav>
      {tab === "provider-requests" ? (
        <section className="panel active-merchandise-requests requests-workspace">
          <div className="trace-head">
            <div>
              <h2>Solicitudes de salida a proveedor</h2>
              <p>
                Consulta el estado de cada solicitud o cancela las pendientes
                antes de su transferencia.
              </p>
            </div>
            <span>
              {providerRequests.filter((request) => request.status === "Solicitada").length} activas
            </span>
          </div>
          {providerRequests.length ? (
            providerRequests.map((request) => (
              <article key={request.requestFolio}>
                <span>
                  <small>FOLIO</small><b>{request.requestFolio}</b>
                  <em>{request.sku} · {request.product}</em>
                </span>
                <span>
                  <small>CANTIDAD / PROVEEDOR</small>
                  <b>{request.requestedQty} piezas</b><em>{request.provider}</em>
                </span>
                <span>
                  <small>FECHA / ESTADO</small><b>{request.requestedAt}</b>
                  <em>{request.status}</em>
                </span>
                {request.status === "Solicitada" ? (
                  <button
                    className="cancel-request"
                    onClick={() => onCancelProviderRequest(request.requestFolio)}
                  >
                    Cancelar solicitud
                  </button>
                ) : (
                  <em className="request-transferred-status">✓ Transferida</em>
                )}
              </article>
            ))
          ) : (
            <div className="trace-empty">
              <i>✓</i><strong>Sin solicitudes registradas</strong>
              <p>Las solicitudes creadas desde la consulta aparecerán aquí.</p>
            </div>
          )}
        </section>
      ) : tab === "provider-inventory" ? (
        <section className="provider-quality-inventory">
          <section className="panel repair-inventory">
            <div className="trace-head">
              <div>
                <h2>Consulta de inventario proveedor</h2>
                <p>
                  Existencias del Almacén de proveedor y disponibilidad para
                  generar solicitudes de Salida a proveedor.
                </p>
              </div>
              <span>
                {providerGroups.reduce((sum, group) => sum + group.total, 0)} piezas ·{" "}
                {money(
                  providerGroups.reduce(
                    (sum, group) => sum + group.total * group.cost,
                    0,
                  ),
                )}
              </span>
            </div>
            <label className="outbound-search">
              ⌕
              <input
                value={providerQuery}
                onChange={(event) => setProviderQuery(event.target.value)}
                placeholder="Buscar código, producto o proveedor"
              />
            </label>
            <div className="repair-inventory-grid controlled-stock">
              {providerGroups.map((group) => {
                const requested = providerPendingFor(group.sku),
                  available = Math.max(0, group.total - requested);
                return (
                  <article key={group.sku}>
                    <span className="repair-product">
                      <small>CÓDIGO Y PRODUCTO</small>
                      <b>{group.sku}</b>
                      <em>{group.product}</em>
                      <i>{group.provider}</i>
                    </span>
                    <span className="inventory-column">
                      <small>INVENTARIO</small><b>{group.total}</b><em>piezas</em>
                    </span>
                    <span className="inventory-column requested">
                      <small>SOLICITADAS</small><b>{requested}</b><em>piezas</em>
                    </span>
                    <span className="inventory-column available">
                      <small>DISPONIBLES</small><b>{available}</b><em>piezas</em>
                    </span>
                    <span className="inventory-column unit-cost">
                      <small>COSTO UNITARIO</small><b>{money(group.cost)}</b>
                    </span>
                    <span className="inventory-column total-cost">
                      <small>VALOR TOTAL</small><b>{money(group.total * group.cost)}</b>
                    </span>
                    <span className="inventory-locations">
                      {group.locations.map((location) => (
                        <small key={location.location}>
                          {location.location} · {location.qty}
                        </small>
                      ))}
                    </span>
                    <div className="inventory-request-action">
                      {requested > 0 && (
                        <small className="existing-request-note">
                          Ya existe una solicitud por {requested} pieza(s).
                        </small>
                      )}
                      <button
                        className="primario"
                        disabled={available === 0}
                        onClick={() => {
                          setProviderSku(group.sku);
                          setProviderQty(1);
                        }}
                      >
                        {available === 0
                          ? "Inventario comprometido"
                          : "Solicitar Salida Proveedor"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel active-merchandise-requests requests-workspace provider-inline-requests">
            <div className="trace-head">
              <div>
                <h2>Solicitudes de Salida Proveedor</h2>
                <p>Consulta o cancela solicitudes pendientes para liberar existencia.</p>
              </div>
              <span>{providerRequests.length} activas</span>
            </div>
            {providerRequests.length ? (
              providerRequests.map((request) => (
                <article key={request.requestFolio}>
                  <span><small>FOLIO</small><b>{request.requestFolio}</b><em>{request.sku} · {request.product}</em></span>
                  <span><small>CANTIDAD / PROVEEDOR</small><b>{request.requestedQty} piezas</b><em>{request.provider}</em></span>
                  <span><small>FECHA DE SOLICITUD</small><b>{request.requestedAt}</b></span>
                  <button className="cancel-request" onClick={() => onCancelProviderRequest(request.requestFolio)}>
                    Cancelar solicitud
                  </button>
                </article>
              ))
            ) : (
              <div className="trace-empty"><i>✓</i><strong>Sin solicitudes activas</strong><p>El inventario de proveedor no tiene piezas comprometidas.</p></div>
            )}
          </section>
        </section>
      ) : tab === "validation" ? (
        <section className="panel quality-repair-queue">
          <div className="trace-head">
            <div>
              <h2>Validación posterior a reparación</h2>
              <p>
                Revisa cada pieza terminada y determina su resultado de Calidad.
              </p>
            </div>
            <span>{validation.length} solicitudes</span>
          </div>
          {validation.length ? (
            <div className="quality-records">
              {validation.map((p) => (
                <article key={p.pieceId}>
                  <div className="quality-product">
                    <small>SOLICITUD</small>
                    <b>{p.warrantyFolio}</b>
                    <strong>
                      {p.sku} · {p.product}
                    </strong>
                    <em>Folio de abastecimiento: {p.requestFolio}</em>
                  </div>
                  <dl>
                    <div>
                      <dt>Técnico</dt>
                      <dd>{p.technician}</dd>
                    </div>
                    <div>
                      <dt>Cantidad</dt>
                      <dd>1 pieza</dd>
                    </div>
                    <div>
                      <dt>Sucursal</dt>
                      <dd>{p.branch || "GDL Centro"}</dd>
                    </div>
                    <div>
                      <dt>Fecha reparación</dt>
                      <dd>{p.finishedAt || "25 ago 2026 · Ahora"}</dd>
                    </div>
                    <div>
                      <dt>Fecha solicitud</dt>
                      <dd>{p.requestedAt || "24 ago 2026 · 09:18"}</dd>
                    </div>
                  </dl>
                  <div className="quality-actions">
                    <button
                      className="approve"
                      onClick={() => onResolve(p, "approved")}
                    >
                      <i>✓</i>
                      <span>
                        <b>Aprobado</b>
                        <small>Producto funciona correctamente</small>
                      </span>
                    </button>
                    <button
                      className="return"
                      onClick={() => {
                        setDecision({ piece: p, action: "return" });
                        setReason("");
                      }}
                    >
                      <i>↩</i>
                      <span>
                        <b>Devolución</b>
                        <small>Capturar motivo y retornar</small>
                      </span>
                    </button>
                    <button
                      className="reject"
                      onClick={() => {
                        setDecision({ piece: p, action: "rejected" });
                        setReason("");
                      }}
                    >
                      <i>×</i>
                      <span>
                        <b>Rechazado</b>
                        <small>Capturar motivo y destruir</small>
                      </span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="warehouse-query-empty">
              <i>✓</i>
              <b>No hay piezas pendientes de Calidad</b>
              <p>Las reparaciones finalizadas aparecerán aquí.</p>
            </div>
          )}
        </section>
      ) : tab === "assembly" ? (
        <AssemblyWorkspace pieces={assembly} avisar={avisar} />
      ) : (
        <QualityAlertsWorkspace
          avisar={avisar}
          onCreateIncident={onCreateIncident}
        />
      )}
      {decision && (
        <div className="repair-request-modal quality-decision-modal">
          <section>
            <header>
              <div>
                <small>DECISIÓN DE CALIDAD</small>
                <h2>
                  {decision.action === "return"
                    ? "Devolver a reparación"
                    : "Rechazar y enviar a destrucción"}
                </h2>
                <p>
                  {decision.piece.warrantyFolio} · {decision.piece.sku}
                </p>
              </div>
              <button onClick={() => setDecision(null)}>×</button>
            </header>
            <main>
              <label className="quality-reason-field">
                <span>Motivo obligatorio</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  placeholder={
                    decision.action === "return"
                      ? "Describe la falla encontrada y las pruebas que deberá repetir el técnico…"
                      : "Describe la condición por la que la pieza no puede continuar…"
                  }
                />
                <small>
                  El motivo formará parte de la trazabilidad de la pieza.
                </small>
              </label>
            </main>
            <footer>
              <button onClick={() => setDecision(null)}>Cancelar</button>
              <button
                className={
                  decision.action === "rejected" ? "peligro" : "primario"
                }
                disabled={!reason.trim()}
                onClick={confirmReason}
              >
                Confirmar
              </button>
            </footer>
          </section>
        </div>
      )}
      {selectedProvider && (
        <div className="repair-request-modal">
          <section>
            <header>
              <div>
                <small>SOLICITUD DE SALIDA PROVEEDOR</small>
                <h2>{selectedProvider.sku} · {selectedProvider.product}</h2>
                <p>{selectedProvider.provider}</p>
              </div>
              <button onClick={() => setProviderSku("")}>×</button>
            </header>
            <main>
              <div className="request-stock-summary">
                <span><small>INVENTARIO</small><b>{selectedProvider.total}</b></span>
                <span><small>COMPROMETIDO</small><b>{providerPendingFor(selectedProvider.sku)}</b></span>
                <span><small>DISPONIBLE</small><b>{selectedProviderAvailable}</b></span>
              </div>
              <label>
                Cantidad a solicitar
                <input
                  type="number"
                  min={1}
                  max={selectedProviderAvailable}
                  value={providerQty}
                  onChange={(event) => setProviderQty(Number(event.target.value))}
                />
              </label>
            </main>
            <footer>
              <button onClick={() => setProviderSku("")}>Cancelar</button>
              <button
                className="primario"
                disabled={providerQty < 1 || providerQty > selectedProviderAvailable}
                onClick={submitProviderRequest}
              >
                Generar solicitud
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
type IncidentStatus = "Abierto" | "En aclaración" | "Resuelto";
type Incident = {
  id: string;
  box: string;
  branch: string;
  code: string;
  type: string;
  detail: string;
  status: IncidentStatus;
  date: string;
  response?: string;
  resolution?: string;
  resolutionDate?: string;
  resolutionUser?: string;
  requests?: string[];
};
const incidentData: Incident[] = [
  {
    id: "INC-0268",
    box: "GX-ZPN-008",
    branch: "Zapopan Norte",
    code: "FR-D1287",
    type: "Producto faltante",
    detail: "No se recibió GE-260824-1838",
    status: "Abierto",
    date: "24 ago · 10:21",
  },
  {
    id: "INC-0264",
    box: "GX-GDL-012",
    branch: "GDL Centro",
    code: "BO-AL394",
    type: "Producto incorrecto",
    detail: "SKU físico distinto al declarado",
    status: "En aclaración",
    date: "23 ago · 16:48",
    response:
      "Sucursal confirma que el producto correcto permanece en caja abierta y solicita guía de retorno.",
  },
  {
    id: "INC-0259",
    box: "GX-LEO-002",
    branch: "León Torres",
    code: "MO-7281",
    type: "Daño durante traslado",
    detail: "Empaque y carcasa dañados",
    status: "Resuelto",
    date: "22 ago · 12:06",
    response:
      "La sucursal adjuntó evidencia del empaque previo a la recolección.",
    resolution:
      "Se confirmó daño atribuible al traslado. La pieza fue ingresada a diagnóstico y se notificó a Logística para seguimiento con la paquetería.",
  },
];
function IncidentsView({
  avisar,
  branchOnly = false,
  externalFolios = [],
  externalQualityIncidents = [],
}: {
  avisar: (s: string) => void;
  branchOnly?: boolean;
  externalFolios?: string[];
  externalQualityIncidents?: QualityGeneratedIncident[];
}) {
  const [items, setItems] = useState(() => [
      ...externalQualityIncidents
        .filter((i) => !branchOnly || i.branch !== "Garantías Central")
        .map((i) => ({
          id: i.id,
          box: "Folio estándar",
          branch: i.branch,
          code: i.sku,
          type: "Producto no conforme",
          detail: i.detail,
          status: "Abierto" as IncidentStatus,
          date: i.date,
          requests: [i.sku],
        })),
      ...externalFolios.map((folio, n) => ({
        id: `INC-RX-${String(n + 1).padStart(3, "0")}`,
        box: "Caja en conciliación",
        branch: "Sucursal origen",
        code: data.find((c) => c.id === folio)?.sku || "Sin código",
        type: "Diferencia de recepción",
        detail: `Solicitud ${folio} retirada de la bandeja operativa por incidencia`,
        status: "Abierto" as IncidentStatus,
        date: "26 ago · Ahora",
        requests: [folio],
      })),
      ...incidentData,
    ]),
    [modal, setModal] = useState<{
      kind: "new" | "clarify" | "respond" | "resolution";
      incident?: Incident;
    } | null>(null),
    [sourceType, setSourceType] = useState<"box" | "request" | "code">("box"),
    [sourceKey, setSourceKey] = useState(""),
    [identified, setIdentified] = useState(false),
    [affected, setAffected] = useState<string[]>([]),
    [incidentQuery, setIncidentQuery] = useState(""),
    [incidentStatus, setIncidentStatus] = useState<"Todos" | IncidentStatus>(
      "Todos",
    ),
    [resolutionPending, setResolutionPending] = useState<Incident | null>(null),
    [resolutionComment, setResolutionComment] = useState("");
  useEffect(() => {
    const incoming = externalQualityIncidents
      .filter((i) => !branchOnly || i.branch !== "Garantías Central")
      .map((i) => ({
        id: i.id,
        box: "Folio estándar",
        branch: i.branch,
        code: i.sku,
        type: "Producto no conforme",
        detail: i.detail,
        status: "Abierto" as IncidentStatus,
        date: i.date,
        requests: [i.sku],
      }));
    setItems((current) => [
      ...incoming.filter(
        (item) => !current.some((existing) => existing.id === item.id),
      ),
      ...current,
    ]);
  }, [externalQualityIncidents, branchOnly]);
  const box100 = [
      {
        folio: "GE-260824-1842",
        sku: "BO-AL394",
        product: "Alternador Bosch 12V",
        branch: "GDL Centro",
      },
      {
        folio: "GE-260824-1841",
        sku: "LTH-H47",
        product: "Batería LTH H-47",
        branch: "GDL Centro",
      },
      {
        folio: "GE-260824-1839",
        sku: "GMB-1256",
        product: "Bomba de agua GMB",
        branch: "GDL Centro",
      },
    ],
    request1842 = [box100[0]],
    normalizedSource = sourceKey.trim().toUpperCase(),
    sourceRows = !identified
      ? []
      : sourceType === "box" && ["100", "GX-GDL-100"].includes(normalizedSource)
        ? box100
        : sourceType === "request" && normalizedSource === "GE-260824-1842"
          ? request1842
          : sourceType === "code"
            ? box100.filter((r) => r.sku.includes(normalizedSource))
            : [];
  const locate = () => {
    setIdentified(true);
    setAffected([]);
    const found =
      sourceType === "box"
        ? ["100", "GX-GDL-100"].includes(normalizedSource)
        : sourceType === "request"
          ? normalizedSource === "GE-260824-1842"
          : box100.some((r) => r.sku.includes(normalizedSource));
    if (!found) showInfo("No se encontró un producto con el código ingresado.");
  };
  const changeStatus = async (id: string, status: IncidentStatus) => {
    const incident = items.find((i) => i.id === id),
      current = incident?.status;
    if (current === status || !incident) return;
    if (status === "Resuelto") {
      setResolutionPending(incident);
      setResolutionComment("");
      return;
    }
    if (
      !(await askQuestion(
        `¿Confirmas cambiar la incidencia ${id} de “${current}” a “${status}”?`,
      ))
    )
      return;
    setItems((x) => x.map((i) => (i.id === id ? { ...i, status } : i)));
    avisar(`Incidencia ${id}: ${status}`);
  };
  const confirmResolution = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resolutionPending || !resolutionComment.trim()) return;
    const date = new Date().toLocaleString("es-MX"),
      user = "Andrea Martínez";
    setItems((x) =>
      x.map((i) =>
        i.id === resolutionPending.id
          ? {
              ...i,
              status: "Resuelto",
              resolution: resolutionComment.trim(),
              resolutionDate: date,
              resolutionUser: user,
            }
          : i,
      ),
    );
    avisar(`Incidencia ${resolutionPending.id} resuelta · ${user} · ${date}`);
    setResolutionPending(null);
    setResolutionComment("");
  };
  const openNew = () => {
    setSourceType("box");
    setSourceKey("");
    setIdentified(false);
    setAffected([]);
    setModal({ kind: "new" });
  };
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (
      modal?.kind === "new" &&
      !(await askQuestion(
        `¿Confirmas crear la incidencia con ${affected.length} solicitud(es) afectada(s)? El registro iniciará con estado Abierto.`,
      ))
    )
      return;
    if (
      modal?.kind === "respond" &&
      !(await askQuestion(
        "¿Confirmas que deseas enviar esta respuesta a Garantías Central?",
      ))
    )
      return;
    const f = new FormData(e.currentTarget);
    if (modal?.kind === "new") {
      const selectedRows = sourceRows.filter((r) => affected.includes(r.folio)),
        n: Incident = {
          id: `INC-${String(269 + items.length).padStart(4, "0")}`,
          box:
            sourceType === "box"
              ? sourceKey.trim().toUpperCase()
              : "Solicitud individual",
          branch: selectedRows[0]?.branch || "Por identificar",
          code: selectedRows[0]?.sku || "Sin código",
          type: String(f.get("type")),
          detail: String(f.get("detail")),
          status: "Abierto",
          date: "25 ago · Ahora",
          requests: affected,
        };
      setItems((x) => [n, ...x]);
      avisar(`Incidencia ${n.id} creada para ${affected.length} solicitud(es)`);
    } else if (modal?.incident) {
      const text = String(f.get("message"));
      setItems((x) =>
        x.map((i) =>
          i.id === modal.incident?.id
            ? { ...i, status: "En aclaración", response: text }
            : i,
        ),
      );
      avisar(
        modal.kind === "respond"
          ? "Respuesta enviada a Garantías Central"
          : "Solicitud de aclaración enviada a la sucursal",
      );
    }
    setModal(null);
  };
  return (
    <section className="panel incidents-view">
      <div className="trace-head">
        <div>
          <h2>
            {branchOnly
              ? "Aclaraciones con Garantías Central"
              : "Aclaraciones de recepción"}
          </h2>
          <p>
            {branchOnly
              ? "Consulta y responde diferencias reportadas sobre tus cajas."
              : "Da seguimiento a las diferencias con las sucursales emisoras."}
          </p>
        </div>
        {!branchOnly && (
          <button className="primario" onClick={openNew}>
            ＋ Nueva incidencia
          </button>
        )}
      </div>
      <div className="incident-filters">
        <label>
          Buscar por fecha o código
          <input
            value={incidentQuery}
            onChange={(e) => setIncidentQuery(e.target.value)}
            placeholder="Ej. 24 ago, FR-D1287 o INC-0268"
          />
        </label>
        <label>
          Estado
          <select
            value={incidentStatus}
            onChange={(e) =>
              setIncidentStatus(e.target.value as "Todos" | IncidentStatus)
            }
          >
            <option>Todos</option>
            <option>Abierto</option>
            <option>En aclaración</option>
            <option>Resuelto</option>
          </select>
        </label>
        <button
          onClick={() => {
            setIncidentQuery("");
            setIncidentStatus("Todos");
          }}
        >
          Limpiar filtros
        </button>
      </div>
      <div className="incident-list">
        {items
          .filter(
            (i) =>
              (incidentStatus === "Todos" || i.status === incidentStatus) &&
              (!incidentQuery.trim() ||
                [i.date, i.code, i.id, i.box, i.branch, i.status].some((v) =>
                  v.toLowerCase().includes(incidentQuery.toLowerCase()),
                )),
          )
          .map((i) => (
            <article key={i.id}>
              <i
                className={
                  i.status === "Abierto"
                    ? "open"
                    : i.status === "Resuelto"
                      ? "resolved"
                      : "working"
                }
              >
                !
              </i>
              <div>
                <small>
                  {i.id} · {i.date}
                </small>
                <strong>{i.type}</strong>
                <p>
                  <b className="incident-code">{i.code}</b> · {i.detail}
                  {i.requests?.length
                    ? ` · ${i.requests.length} solicitud(es) afectadas`
                    : ""}
                </p>
              </div>
              <span>
                <small>CAJA / SUCURSAL</small>
                <b>{i.box}</b>
                <em>{i.branch}</em>
              </span>
              {branchOnly ? (
                <span
                  className={`incident-status ${i.status.replace(" ", "-").toLowerCase()}`}
                >
                  {i.status}
                </span>
              ) : (
                <select
                  className={`incident-status status-select ${i.status.replace(" ", "-").toLowerCase()}`}
                  value={i.status}
                  onChange={(e) =>
                    changeStatus(i.id, e.target.value as IncidentStatus)
                  }
                >
                  <option>Abierto</option>
                  <option>En aclaración</option>
                  <option>Resuelto</option>
                </select>
              )}
              <button
                onClick={() =>
                  setModal({
                    kind:
                      i.status === "Resuelto"
                        ? "resolution"
                        : branchOnly
                          ? "respond"
                          : "clarify",
                    incident: i,
                  })
                }
              >
                {i.status === "Resuelto"
                  ? "Ver resolución"
                  : branchOnly
                    ? "Responder"
                    : "Solicitar aclaración"}
              </button>
            </article>
          ))}
      </div>
      {modal && (
        <div className="incident-sheet incident-action">
          <form onSubmit={submit}>
            <button type="button" onClick={() => setModal(null)}>
              ×
            </button>
            <small>
              {modal.kind === "new"
                ? "NUEVO REGISTRO"
                : modal.kind === "resolution"
                  ? "INCIDENCIA RESUELTA"
                  : branchOnly
                    ? "RESPUESTA DE SUCURSAL"
                    : "SOLICITUD A SUCURSAL"}
            </small>
            <h2>
              {modal.kind === "new"
                ? "Nueva incidencia"
                : modal.kind === "resolution"
                  ? "Resolución de la incidencia"
                  : branchOnly
                    ? "Responder aclaración"
                    : "Solicitar aclaración"}
            </h2>
            {modal.incident && (
              <div className="incident-context">
                <b>
                  {modal.incident.id} · {modal.incident.type}
                </b>
                <span>
                  {modal.incident.box} · {modal.incident.branch}
                </span>
                <p>{modal.incident.detail}</p>
              </div>
            )}
            {modal.kind === "new" ? (
              <>
                <div className="incident-source">
                  <strong>1. Identifica el origen de la incidencia</strong>
                  <div className="source-toggle">
                    <button
                      type="button"
                      className={sourceType === "box" ? "active" : ""}
                      onClick={() => {
                        setSourceType("box");
                        setSourceKey("");
                        setIdentified(false);
                        setAffected([]);
                      }}
                    >
                      Número de caja
                    </button>
                    <button
                      type="button"
                      className={sourceType === "request" ? "active" : ""}
                      onClick={() => {
                        setSourceType("request");
                        setSourceKey("");
                        setIdentified(false);
                        setAffected([]);
                      }}
                    >
                      Folio de solicitud
                    </button>
                    <button
                      type="button"
                      className={sourceType === "code" ? "active" : ""}
                      onClick={() => {
                        setSourceType("code");
                        setSourceKey("");
                        setIdentified(false);
                        setAffected([]);
                      }}
                    >
                      Código de producto
                    </button>
                  </div>
                  <label>
                    {sourceType === "box"
                      ? "Número de caja"
                      : sourceType === "request"
                        ? "Folio de solicitud"
                        : "Código de producto"}
                    <div className="source-search">
                      <input
                        value={sourceKey}
                        onChange={(e) => {
                          setSourceKey(e.target.value);
                          setIdentified(false);
                          setAffected([]);
                        }}
                        placeholder={
                          sourceType === "box"
                            ? "Ej. 100"
                            : sourceType === "request"
                              ? "Ej. GE-260824-1842"
                              : "Ej. BO-AL394"
                        }
                      />
                      <button
                        type="button"
                        className="primario"
                        disabled={!sourceKey.trim()}
                        onClick={locate}
                      >
                        Consultar
                      </button>
                    </div>
                  </label>
                </div>
                {identified &&
                  (sourceRows.length ? (
                    <div className="incident-products">
                      <div>
                        <strong>
                          {sourceType === "box"
                            ? `Contenido de la caja ${sourceKey}`
                            : sourceType === "request"
                              ? "Detalle de la solicitud"
                              : `Resultados para ${sourceKey.toUpperCase()}`}
                        </strong>
                        <small>
                          Selecciona uno o varios productos con incidencia.
                        </small>
                      </div>
                      {sourceRows.map((r) => (
                        <label
                          className={
                            affected.includes(r.folio) ? "selected" : ""
                          }
                          key={r.folio}
                        >
                          <input
                            type="checkbox"
                            checked={affected.includes(r.folio)}
                            onChange={(e) => {
                              if (
                                e.target.checked &&
                                items.some((i) => i.code === r.sku)
                              ) {
                                showInfo(
                                  `Ya existe una incidencia registrada para el producto ${r.sku}. No es posible crear otra.`,
                                );
                                return;
                              }
                              setAffected((x) =>
                                e.target.checked
                                  ? [...x, r.folio]
                                  : x.filter((v) => v !== r.folio),
                              );
                            }}
                          />
                          <i>{affected.includes(r.folio) ? "✓" : ""}</i>
                          <span>
                            <b>{r.folio}</b>
                            <small>
                              {r.sku} · {r.product}
                            </small>
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="incident-no-results">
                      <i>!</i>
                      <span>
                        <b>No se encontraron datos</b>
                        <small>
                          Prueba con la caja 100, el folio GE-260824-1842 o el
                          código BO-AL394.
                        </small>
                      </span>
                    </div>
                  ))}
                <fieldset disabled={!affected.length}>
                  <label>
                    Tipo de incidencia
                    <select name="type" required>
                      <option>Producto faltante</option>
                      <option>Producto adicional</option>
                      <option>Producto incorrecto</option>
                      <option>Daño durante traslado</option>
                      <option>Diferencia de cantidades</option>
                    </select>
                  </label>
                  <label>
                    Descripción
                    <textarea
                      name="detail"
                      required
                      rows={3}
                      placeholder="Describe la diferencia y la evidencia disponible…"
                    />
                  </label>
                </fieldset>
              </>
            ) : modal.kind === "resolution" ? (
              <div className="resolution-detail">
                <span>
                  <small>RESPUESTA DE SUCURSAL</small>
                  <p>
                    {modal.incident?.response ||
                      "Sin respuesta adicional registrada."}
                  </p>
                </span>
                <span>
                  <small>RESOLUCIÓN FINAL</small>
                  <p>{modal.incident?.resolution}</p>
                </span>
                <em>✓ Expediente cerrado y trazabilidad actualizada</em>
                {modal.incident?.resolutionDate && (
                  <small>
                    Resuelto el {modal.incident.resolutionDate} por{" "}
                    {modal.incident.resolutionUser}
                  </small>
                )}
              </div>
            ) : (
              <label>
                {branchOnly
                  ? "Respuesta y evidencia"
                  : "Información requerida a la sucursal"}
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder={
                    branchOnly
                      ? "Describe la aclaración, ubicación del producto y evidencia disponible…"
                      : "Indica qué información o evidencia debe proporcionar la sucursal…"
                  }
                />
              </label>
            )}
            <footer>
              <button type="button" onClick={() => setModal(null)}>
                {modal.kind === "resolution" ? "Cerrar" : "Cancelar"}
              </button>
              {modal.kind !== "resolution" && (
                <button
                  className="primario"
                  disabled={modal.kind === "new" && !affected.length}
                >
                  {modal.kind === "new"
                    ? `Crear incidencia (${affected.length})`
                    : branchOnly
                      ? "Enviar respuesta"
                      : "Enviar solicitud"}
                </button>
              )}
            </footer>
          </form>
        </div>
      )}
      {resolutionPending && (
        <div className="incident-resolution-modal">
          <form onSubmit={confirmResolution}>
            <header>
              <div>
                <small>RESOLUCIÓN FINAL</small>
                <h2>Resolver {resolutionPending.id}</h2>
                <p>La observación quedará registrada con fecha y usuario.</p>
              </div>
              <button type="button" onClick={() => setResolutionPending(null)}>
                ×
              </button>
            </header>
            <main>
              <label>
                Observación o comentario de resolución
                <textarea
                  autoFocus
                  required
                  rows={4}
                  value={resolutionComment}
                  onChange={(e) => setResolutionComment(e.target.value)}
                  placeholder="Describe la resolución final de la incidencia…"
                />
              </label>
              <div>
                <span>Usuario</span>
                <b>Andrea Martínez</b>
              </div>
              <div>
                <span>Fecha</span>
                <b>{new Date().toLocaleString("es-MX")}</b>
              </div>
            </main>
            <footer>
              <button type="button" onClick={() => setResolutionPending(null)}>
                Cancelar
              </button>
              <button className="primario" disabled={!resolutionComment.trim()}>
                Guardar resolución
              </button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}

function CustodyMonitor() {
  const [stage, setStage] = useState("Todas"),
    [alertsOnly, setAlertsOnly] = useState(false),
    rows = [
      {
        id: "GE-260824-1846",
        product: "Módulo de encendido Delphi",
        sku: "DE-ME441",
        branch: "Querétaro Norte",
        holder: "Con el cliente",
        since: "18 ago · 12:10",
        next: "Recolección vencida por 3 días",
        tone: "critical",
        alert: "Vencida",
      },
      {
        id: "GE-260824-1844",
        product: "Amortiguador Monroe",
        sku: "MO-7281",
        branch: "León Torres",
        holder: "Con el cliente",
        since: "23 ago · 15:26",
        next: "Entrega estimada mañana",
        tone: "warning",
        alert: "Por vencer",
      },
      {
        id: "GE-260824-1842",
        product: "Alternador Bosch 12V",
        sku: "BO-AL394",
        branch: "GDL Centro",
        holder: "Garantías Central",
        since: "25 ago · 09:42",
        next: "Diagnóstico técnico",
        tone: "central",
        alert: "En tiempo",
      },
      {
        id: "GE-260824-1841",
        product: "Batería LTH H-47",
        sku: "LTH-H47",
        branch: "Zapopan Norte",
        holder: "En tránsito",
        since: "24 ago · 17:18",
        next: "Arribo estimado hoy",
        tone: "warning",
        alert: "Por vencer",
      },
      {
        id: "GE-260824-1839",
        product: "Bomba de agua GMB",
        sku: "GMB-1256",
        branch: "León Torres",
        holder: "En caja de Garantías",
        since: "23 ago · 14:06",
        next: "Capturar datos logísticos",
        tone: "box",
        alert: "En tiempo",
      },
      {
        id: "GE-260824-1836",
        product: "Sensor de oxígeno Denso",
        sku: "DE-2341",
        branch: "Aguascalientes Sur",
        holder: "En sucursal",
        since: "20 ago · 11:30",
        next: "Vencida por 2 días",
        tone: "critical",
        alert: "Vencida",
      },
      {
        id: "GE-260824-1831",
        product: "Juego de balatas Fritec",
        sku: "FR-D1287",
        branch: "GDL Centro",
        holder: "Con el asesor",
        since: "25 ago · 08:15",
        next: "Entrega física en sucursal",
        tone: "advisor",
        alert: "En tiempo",
      },
    ];
  const filtered = rows.filter(
    (r) =>
      (stage === "Todas" || r.holder === stage) &&
      (!alertsOnly || r.alert !== "En tiempo"),
  );
  return (
    <section className="custody-monitor">
      <div className="custody-kpis">
        <article>
          <i>⌖</i>
          <span>
            <small>PIEZAS EN CUSTODIA</small>
            <b>29</b>
            <em>6 etapas activas</em>
          </span>
        </article>
        <article className="client">
          <i>♙</i>
          <span>
            <small>CON EL CLIENTE</small>
            <b>6</b>
            <em>2 requieren seguimiento</em>
          </span>
        </article>
        <article className="warning">
          <i>!</i>
          <span>
            <small>POR VENCER</small>
            <b>4</b>
            <em>Dentro de próximas 24 h</em>
          </span>
        </article>
        <article className="critical">
          <i>×</i>
          <span>
            <small>VENCIDAS</small>
            <b>3</b>
            <em>Atención inmediata</em>
          </span>
        </article>
      </div>
      <div className="custody-alert-banner">
        <i>!</i>
        <div>
          <strong>3 productos excedieron su fecha objetivo</strong>
          <p>
            Prioriza las piezas con el cliente y en sucursal para evitar
            retrasos en recuperación física.
          </p>
        </div>
        <button onClick={() => setAlertsOnly(!alertsOnly)}>
          {alertsOnly ? "Ver todos" : "Mostrar alertas"}
        </button>
      </div>
      <div className="panel custody-table">
        <div className="custody-toolbar">
          <div>
            <h2>Custodia punta a punta</h2>
            <p>
              Ubicación responsable, antigüedad y siguiente acción de cada
              producto.
            </p>
          </div>
          <label>
            Etapa
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              <option>Todas</option>
              <option>Con el cliente</option>
              <option>Con el asesor</option>
              <option>En sucursal</option>
              <option>En caja de Garantías</option>
              <option>En tránsito</option>
              <option>Garantías Central</option>
            </select>
          </label>
          <label>
            Buscar
            <input placeholder="Folio, SKU o sucursal" />
          </label>
        </div>
        <div className="custody-row custody-th">
          <span>Solicitud / producto</span>
          <span>Sucursal origen</span>
          <span>Custodia actual</span>
          <span>Desde</span>
          <span>Siguiente acción</span>
        </div>
        {filtered.map((r) => (
          <article
            className={`custody-row ${r.alert === "Vencida" ? "custody-overdue" : r.alert === "Por vencer" ? "custody-due" : ""}`}
            key={r.id}
          >
            <span>
              <b>{r.id}</b>
              <small>
                {r.sku} · {r.product}
              </small>
            </span>
            <span>
              <b>{r.branch}</b>
              <small>Sucursal de origen</small>
            </span>
            <span>
              <em className={r.tone}>● {r.holder}</em>
            </span>
            <span>
              <b>{r.since}</b>
              <small>Último movimiento</small>
            </span>
            <span>
              <b className={r.alert === "Vencida" ? "text-red" : ""}>
                {r.next}
              </b>
              <small
                className={`custody-alert ${r.alert === "Vencida" ? "overdue" : r.alert === "Por vencer" ? "due" : "ok"}`}
              >
                {r.alert === "Vencida"
                  ? "● VENCIDA"
                  : r.alert === "Por vencer"
                    ? "● POR VENCER"
                    : "● EN TIEMPO"}
              </small>
            </span>
          </article>
        ))}
      </div>
      <div className="custody-legend">
        <strong>Cadena de custodia:</strong>
        <span>Con el cliente</span>
        <i>→</i>
        <span>Con el asesor</span>
        <i>→</i>
        <span>En sucursal</span>
        <i>→</i>
        <span>En caja</span>
        <i>→</i>
        <span>En tránsito</span>
        <i>→</i>
        <span>Garantías Central</span>
      </div>
    </section>
  );
}
function PortalSelector({
  onSelect,
}: {
  onSelect: (p: "central" | "sucursal" | "mostrador") => void;
}) {
  const modules = [
    {
      i: "⌂",
      n: "Garantías Central",
      tag: "OPERACIÓN CORPORATIVA",
      d: "Solicitudes, diagnóstico, almacén y custodia.",
      action: "central" as const,
    },
    {
      i: "▤",
      n: "Garantías Sucursal",
      tag: "TRAZABILIDAD FÍSICA",
      d: "Recepción, inventario y cajas para envío.",
      action: "sucursal" as const,
    },
    {
      i: "⎘",
      n: "Registro de devoluciones y garantías",
      tag: "MOSTRADOR",
      d: "Captura devoluciones y garantías directamente en mostrador.",
      action: "mostrador" as const,
    },
    {
      i: "↗",
      n: "Logística",
      tag: "OPERACIÓN",
      d: "Rutas, guías y seguimiento de embarques.",
    },
    {
      i: "▦",
      n: "Inventarios",
      tag: "OPERACIÓN",
      d: "Existencias y ubicaciones operativas.",
    },
    {
      i: "▣",
      n: "Recepción",
      tag: "OPERACIÓN",
      d: "Arribos, conteos y diferencias.",
    },
    {
      i: "⌁",
      n: "Compras",
      tag: "ABASTECIMIENTO",
      d: "Órdenes y relación con proveedores.",
    },
    {
      i: "$",
      n: "Finanzas",
      tag: "ADMINISTRACIÓN",
      d: "Notas de crédito y recuperaciones.",
    },
    {
      i: "△",
      n: "Calidad",
      tag: "CONTROL",
      d: "Alertas, recurrencias y bloqueos.",
    },
  ];
  return (
    <main className="portal portal-blue">
      <header>
        <div className="portal-brand">
          <b>GX</b>
          <span>
            <strong>Garantías Express</strong>
            <small>Plataforma integral de operación</small>
          </span>
        </div>
        <div className="portal-user">
          <span>Andrea Martínez</span>
          <b>AM</b>
        </div>
      </header>
      <section>
        <div className="portal-copy">
          <small>PLATAFORMA OPERATIVA</small>
          <h1>¿Dónde deseas trabajar?</h1>
          <p>
            Selecciona el módulo de acuerdo con las actividades que realizarás.
          </p>
        </div>
        <div className="module-grid">
          {modules.map((m) => (
            <button
              key={m.n}
              className={m.action ? "enabled" : "example"}
              disabled={!m.action}
              onClick={() => m.action && onSelect(m.action)}
            >
              <i
                className={
                  m.action === "central"
                    ? "central-icon"
                    : m.action === "sucursal"
                      ? "branch-icon"
                      : m.action === "mostrador"
                        ? "mostrador-icon"
                        : ""
                }
              >
                {m.i}
              </i>
              <span className="tag">{m.tag}</span>
              <h2>{m.n}</h2>
              <p>{m.d}</p>
              <strong>
                {m.action ? "Ingresar al módulo　→" : "Próximamente"}
              </strong>
            </button>
          ))}
        </div>
        <p className="portal-note">
          Los módulos ilustrativos no tienen funcionalidad habilitada. Tu acceso
          y permisos se aplicarán automáticamente.
        </p>
      </section>
    </main>
  );
}

function SucursalPortal({
  casos,
  onBack,
  qualityIncidents,
  devoluciones,
  onRecibirDevolucion,
}: {
  casos: Caso[];
  onBack: () => void;
  qualityIncidents: QualityGeneratedIncident[];
  devoluciones: Devolucion[];
  onRecibirDevolucion: (folio: string) => void;
}) {
  const [tab, setTab] = useState<"garantias" | "incidencias" | "devoluciones">(
      "garantias",
    ),
    [collapsed, setCollapsed] = useState(false),
    [mensaje, setMensaje] = useState(""),
    [recepcion, setRecepcion] = useState<Devolucion | null>(null),
    [verDetalle, setVerDetalle] = useState<Devolucion | null>(null);
  const devolucionesArribo = devoluciones.filter(
      (d) => d.estado !== "Capturada",
    ),
    pendientesMostrador = devoluciones.filter(
      (d) => d.estado === "Capturada",
    );
  const avisar = (m: string) => {
    setMensaje(m);
    setTimeout(() => setMensaje(""), 2500);
  };
  return (
    <div className={`branch-app-layout ${collapsed ? "collapsed" : ""}`}>
      <aside className="branch-side-menu">
        <button
          className="side-collapse"
          onClick={() => setCollapsed((x) => !x)}
          aria-label={collapsed ? "Expandir menú" : "Contraer menú"}
        >
          {collapsed ? "›" : "‹"}
        </button>
        <div className="branch-side-brand">
          <b>GX</b>
          <span>
            <strong>Garantías</strong>
            <small>Sucursal 014</small>
          </span>
        </div>
        <nav>
          <small>GARANTÍAS SUCURSAL</small>
          <button
            className={tab === "garantias" ? "active" : ""}
            onClick={() => setTab("garantias")}
          >
            <i>↓</i>
            <span>Arribo de garantías</span>
          </button>
          <button
            className={tab === "devoluciones" ? "active" : ""}
            onClick={() => setTab("devoluciones")}
          >
            <i>↩</i>
            <span>Arribo de devoluciones</span>
            {devolucionesArribo.length > 0 && (
              <em>{devolucionesArribo.length}</em>
            )}
          </button>
          <button
            className={tab === "incidencias" ? "active" : ""}
            onClick={() => setTab("incidencias")}
          >
            <i>!</i>
            <span>Incidencias</span>
            <em>2</em>
          </button>
        </nav>
        <button className="branch-side-switch" onClick={onBack}>
          <i>⇄</i>
          <span>Cambiar módulo</span>
        </button>
      </aside>
      <section className="branch-app-content">
        {tab === "garantias" && (
          <SucursalTracePortal casos={casos} onBack={onBack} />
        )}
        {tab === "devoluciones" && (
          <div className="branch-shell branch-incidents-view">
            <header>
              <div className="portal-brand">
                <b>GX</b>
                <span>
                  <strong>Garantías Sucursal</strong>
                  <small>Zapopan Norte · Sucursal 014</small>
                </span>
              </div>
              <div className="branch-actions">
                <button onClick={onBack}>⇄ Cambiar módulo</button>
                <b>LM</b>
              </div>
            </header>
            <main>
              <div className="titulo branch-title">
                <div>
                  <small>TRAZABILIDAD FÍSICA · SUCURSAL 014</small>
                  <h1>Arribo de devoluciones</h1>
                  <p>
                    Recibe en almacén las devoluciones entregadas desde
                    Mostrador.
                  </p>
                </div>
              </div>
              {pendientesMostrador.length > 0 && (
                <div className="pendientes-mostrador">
                  <h3>Pendientes en Mostrador</h3>
                  <p>
                    Devoluciones capturadas que aún no se entregan a almacén.
                  </p>
                  <ul>
                    {pendientesMostrador.map((d) => (
                      <li key={d.folio}>
                        <span>
                          <b>
                            {d.folio} · {d.clienteNombre}
                          </b>
                          {d.items.filter((i) => i.cantidad > 0).length}{" "}
                          producto(s) · {formatMoney(d.total)}
                        </span>
                        <span>{d.creadaEn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="lista lista-espaciada arribo-devoluciones">
                {devolucionesArribo.length === 0 && (
                  <div className="fila th">
                    <span>No hay devoluciones pendientes de recibir.</span>
                  </div>
                )}
                {devolucionesArribo.map((d) => (
                  <div
                    key={d.folio}
                    onClick={() =>
                      d.estado === "Entregada a almacén"
                        ? setRecepcion(d)
                        : setVerDetalle(d)
                    }
                  >
                    <i>↩</i>
                    <span>
                      <strong>
                        {d.folio} · {d.clienteNombre}
                      </strong>
                      <small>
                        {d.items.length} producto(s) · {formatMoney(d.total)} ·
                        Serie {d.serie}
                      </small>
                      <small>
                        {d.creadaEn} · {d.usuario}
                      </small>
                    </span>
                    <em className={d.custodia === "En almacén" ? "ok" : "warn"}>
                      {d.custodia}
                    </em>
                    {d.estado === "Entregada a almacén" ? (
                      <button className="primario">Recibir</button>
                    ) : (
                      <button disabled>Recibida</button>
                    )}
                  </div>
                ))}
              </div>
            </main>
            {mensaje && <div className="toast">✓　{mensaje}</div>}
            {recepcion && (
              <RecepcionDevolucionModal
                devolucion={recepcion}
                onClose={() => setRecepcion(null)}
                onConfirmar={(folio) => {
                  onRecibirDevolucion(folio);
                  setRecepcion(null);
                }}
              />
            )}
            {verDetalle && (
              <DevolucionDetalleModal
                devolucion={verDetalle}
                onClose={() => setVerDetalle(null)}
              />
            )}
          </div>
        )}
        {tab === "incidencias" && (
          <div className="branch-shell branch-incidents-view">
            <header>
              <div className="portal-brand">
                <b>GX</b>
                <span>
                  <strong>Garantías Sucursal</strong>
                  <small>Zapopan Norte · Sucursal 014</small>
                </span>
              </div>
              <div className="branch-actions">
                <button onClick={onBack}>⇄ Cambiar módulo</button>
                <b>LM</b>
              </div>
            </header>
            <main>
              <div className="titulo branch-title">
                <div>
                  <small>TRAZABILIDAD FÍSICA · SUCURSAL 014</small>
                  <h1>Incidencias</h1>
                  <p>
                    Atiende las aclaraciones de diferencias reportadas por
                    Garantías Central.
                  </p>
                </div>
              </div>
              <IncidentsView
                branchOnly
                avisar={avisar}
                externalQualityIncidents={qualityIncidents}
              />
            </main>
            {mensaje && <div className="toast">✓　{mensaje}</div>}
          </div>
        )}
      </section>
    </div>
  );
}

function MostradorPortal({
  casos,
  devoluciones,
  stock,
  onCrearGarantia,
  onCrearDevolucion,
  onEntregarGarantia,
  onEntregarDevolucion,
  onBack,
}: {
  casos: Caso[];
  devoluciones: Devolucion[];
  stock: Record<string, number>;
  onCrearGarantia: (e: FormEvent<HTMLFormElement>) => void;
  onCrearDevolucion: (
    input: Omit<
      Devolucion,
      "folio" | "notaCredito" | "estado" | "custodia" | "creadaEn" | "usuario"
    >,
  ) => void;
  onEntregarGarantia: (id: string) => void;
  onEntregarDevolucion: (folio: string) => void;
  onBack: () => void;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false),
    [flow, setFlow] = useState<"garantia" | "devolucion" | null>(null),
    [detalleDevolucion, setDetalleDevolucion] = useState<Devolucion | null>(
      null,
    ),
    [buscarTexto, setBuscarTexto] = useState(""),
    [fechaDesde, setFechaDesde] = useState(""),
    [fechaHasta, setFechaHasta] = useState("");
  const misGarantias = casos.filter((c) => c.origenMostrador);
  const dentroDeFecha = (fechaTexto?: string) => {
    const fecha = requestDate(fechaTexto);
    return (
      (!fechaDesde || !fecha || fecha >= fechaDesde) &&
      (!fechaHasta || !fecha || fecha <= fechaHasta)
    );
  };
  const devolucionesFiltradas = devoluciones.filter(
      (d) =>
        dentroDeFecha(d.creadaEn) &&
        `${d.folio} ${d.documento} ${d.clienteNombre} ${d.items.map((i) => i.sku).join(" ")}`
          .toLowerCase()
          .includes(buscarTexto.toLowerCase()),
    ),
    misGarantiasFiltradas = misGarantias.filter(
      (c) =>
        dentroDeFecha(c.fechaSolicitud) &&
        `${c.id} ${c.cliente} ${c.sku} ${c.producto}`
          .toLowerCase()
          .includes(buscarTexto.toLowerCase()),
    );
  return (
    <div className="branch-shell">
      <header>
        <div className="portal-brand">
          <b>GX</b>
          <span>
            <strong>Registro de devoluciones y garantías</strong>
            <small>Mostrador · Zapopan Norte</small>
          </span>
        </div>
        <div className="branch-actions">
          <button onClick={onBack}>⇄ Cambiar módulo</button>
          <b>LM</b>
        </div>
      </header>
      <main>
        <div className="titulo branch-title">
          <div>
            <small>MOSTRADOR · SUCURSAL 014</small>
            <h1>Registro de devoluciones y garantías</h1>
            <p>Captura devoluciones y garantías directamente en mostrador.</p>
          </div>
          <button className="primario" onClick={() => setSelectorOpen(true)}>
            ＋ Nuevo registro
          </button>
        </div>

        <div className="mostrador-filtros">
          <label>
            <span>Buscar</span>
            <div>
              ⌕{" "}
              <input
                value={buscarTexto}
                onChange={(e) => setBuscarTexto(e.target.value)}
                placeholder="Folio, cliente o código…"
              />
            </div>
          </label>
          <label>
            <span>Fecha desde</span>
            <input
              type="date"
              value={fechaDesde}
              max={fechaHasta || undefined}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </label>
          <label>
            <span>Fecha hasta</span>
            <input
              type="date"
              value={fechaHasta}
              min={fechaDesde || undefined}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </label>
        </div>

        <div className="panel">
          <div className="cab">
            <div>
              <strong>Solicitudes de devolución</strong>
              <small>{devolucionesFiltradas.length} registro(s)</small>
            </div>
          </div>
          <div className="lista lista-espaciada">
            {devolucionesFiltradas.length === 0 && (
              <div className="fila th">
                <span>
                  {devoluciones.length === 0
                    ? "Aún no hay devoluciones capturadas."
                    : "Ninguna devolución coincide con el filtro."}
                </span>
              </div>
            )}
            {devolucionesFiltradas.map((d) => (
              <div key={d.folio} onClick={() => setDetalleDevolucion(d)}>
                <i>↩</i>
                <span>
                  <strong>
                    {d.folio} · {d.clienteNombre}
                  </strong>
                  <small>
                    {d.items.filter((i) => i.cantidad > 0).length} producto(s)
                    · {formatMoney(d.total)} · {d.tipoAplicacion}
                  </small>
                  <small>
                    {d.creadaEn} · {d.usuario}
                  </small>
                </span>
                <em className={d.custodia === "En almacén" ? "ok" : "warn"}>
                  {d.custodia}
                </em>
                {d.estado === "Capturada" ? (
                  <button
                    className="primario"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEntregarDevolucion(d.folio);
                    }}
                  >
                    Entregar a almacén
                  </button>
                ) : (
                  <button disabled>{d.estado}</button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="cab">
            <div>
              <strong>Solicitudes de garantía</strong>
              <small>{misGarantiasFiltradas.length} registro(s)</small>
            </div>
          </div>
          <div className="lista lista-espaciada">
            {misGarantiasFiltradas.length === 0 && (
              <div className="fila th">
                <span>
                  {misGarantias.length === 0
                    ? "Aún no hay garantías capturadas."
                    : "Ninguna garantía coincide con el filtro."}
                </span>
              </div>
            )}
            {misGarantiasFiltradas.map((c) => {
              const custodia = custodyOperation(c, []),
                noProcede = c.resultado === "No procede";
              return (
                <div key={c.id}>
                  <i>◎</i>
                  <span>
                    <strong>
                      {c.id} · {c.cliente}
                    </strong>
                    <small>
                      {c.sku} · {c.producto} · {custodia.holder}
                    </small>
                    <small>
                      {c.fechaSolicitud} · {c.usuario}
                    </small>
                  </span>
                  <em className={c.resultado === "Procede" ? "ok" : "warn"}>
                    {c.resultado || "En diagnóstico"}
                  </em>
                  {noProcede ? null : !c.entregadoAlmacen ? (
                    <button
                      className="primario"
                      onClick={() => onEntregarGarantia(c.id)}
                    >
                      Entregar a almacén
                    </button>
                  ) : (
                    <button disabled>Entregada</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {selectorOpen && (
        <div className="fondo" onMouseDown={() => setSelectorOpen(false)}>
          <div
            className="modal tipo-movimiento-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div>
              <small>NUEVO REGISTRO</small>
              <button type="button" onClick={() => setSelectorOpen(false)}>
                ×
              </button>
              <h2>¿Qué deseas registrar?</h2>
              <p>Elige el tipo de movimiento a realizar.</p>
            </div>
            <section className="tipo-movimiento-opciones">
              <button
                type="button"
                className="tipo-movimiento-opcion"
                onClick={() => {
                  setSelectorOpen(false);
                  setFlow("devolucion");
                }}
              >
                <i>↩</i>
                <strong>Devolución</strong>
                <small>
                  Captura un documento de venta y sus productos a devolver.
                </small>
              </button>
              <button
                type="button"
                className="tipo-movimiento-opcion"
                onClick={() => {
                  setSelectorOpen(false);
                  setFlow("garantia");
                }}
              >
                <i>◎</i>
                <strong>Garantía</strong>
                <small>
                  Abre el flujo de Garantía Express con inspección visual.
                </small>
              </button>
            </section>
            <footer>
              <button type="button" onClick={() => setSelectorOpen(false)}>
                Cancelar
              </button>
            </footer>
          </div>
        </div>
      )}

      {flow === "garantia" && (
        <NewRequestModal
          onClose={() => setFlow(null)}
          onSubmit={(e) => {
            onCrearGarantia(e);
            setFlow(null);
          }}
          stock={stock}
        />
      )}
      {flow === "devolucion" && (
        <DevolucionModal
          onClose={() => setFlow(null)}
          onSubmit={(input) => {
            onCrearDevolucion(input);
            setFlow(null);
          }}
          stock={stock}
        />
      )}
      {detalleDevolucion && (
        <DevolucionDetalleModal
          devolucion={detalleDevolucion}
          onClose={() => setDetalleDevolucion(null)}
        />
      )}
    </div>
  );
}
function DevolucionDetalleModal({
  devolucion,
  onClose,
}: {
  devolucion: Devolucion;
  onClose: () => void;
}) {
  return (
    <div className="fondo" onMouseDown={onClose}>
      <div
        className="modal devolucion-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div>
          <small>REGISTRO DE DEVOLUCIONES Y GARANTÍAS</small>
          <button type="button" onClick={onClose}>
            ×
          </button>
          <h2>Detalle de la devolución</h2>
          <p>
            {devolucion.folio} · {devolucion.creadaEn} · {devolucion.usuario}
          </p>
        </div>
        <section>
          <label>
            Cliente
            <input value={devolucion.clienteNombre} disabled />
          </label>
          <label>
            Sucursal
            <input value={devolucion.sucursal} disabled />
          </label>
          <label>
            Documento / Serie
            <input
              value={`${devolucion.documento} · ${devolucion.serie}`}
              disabled
            />
          </label>
          <label>
            Nota de crédito
            <input value={devolucion.notaCredito} disabled />
          </label>
        </section>
        <div className="devolucion-lineas">
          <div className="devolucion-linea detalle-linea th">
            <span>Código</span>
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio</span>
            <span>Descuento (%)</span>
            <span>Motivo</span>
            <span>Importe</span>
          </div>
          {devolucion.items
            .filter((i) => i.cantidad > 0)
            .map((i) => (
              <div className="devolucion-linea detalle-linea" key={i.sku}>
                <span>{i.sku}</span>
                <span>{i.descripcion}</span>
                <span>{i.cantidad}</span>
                <span>{formatMoney(i.precio)}</span>
                <span>{i.descuento}%</span>
                <span>{i.motivo}</span>
                <span>
                  {formatMoney(i.cantidad * i.precio * (1 - i.descuento / 100))}
                </span>
              </div>
            ))}
        </div>
        <div className="devolucion-totales">
          <span>
            Subtotal <b>{formatMoney(devolucion.subtotal)}</b>
          </span>
          <span>
            IVA <b>{formatMoney(devolucion.iva)}</b>
          </span>
          <span>
            Total <b>{formatMoney(devolucion.total)}</b>
          </span>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}
function RecepcionDevolucionModal({
  devolucion,
  onClose,
  onConfirmar,
}: {
  devolucion: Devolucion;
  onClose: () => void;
  onConfirmar: (folio: string) => void;
}) {
  const items = devolucion.items.filter((i) => i.cantidad > 0);
  const [recibido, setRecibido] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((i) => [i.sku, 0])),
  );
  const [scanCode, setScanCode] = useState("");
  const registrarPieza = (skuCrudo: string) => {
    const sku = skuCrudo.trim().toUpperCase();
    const item = items.find((i) => i.sku === sku);
    if (!item) {
      showInfo(`El código "${sku}" no corresponde a esta devolución.`);
      return;
    }
    if ((recibido[sku] || 0) >= item.cantidad) {
      showInfo(`Ya se registró la cantidad completa de ${item.descripcion}.`);
      return;
    }
    setRecibido((x) => ({ ...x, [sku]: (x[sku] || 0) + 1 }));
  };
  const escanear = () => {
    const codigo = scanCode.trim();
    setScanCode("");
    if (!codigo) return;
    registrarPieza(codigo);
  };
  const simularEscaneo = () => {
    const pendiente = items.find((i) => (recibido[i.sku] || 0) < i.cantidad);
    if (!pendiente) {
      showInfo("Todas las piezas de esta devolución ya fueron registradas.");
      return;
    }
    registrarPieza(pendiente.sku);
  };
  const actualizarManual = (sku: string, valor: number, max: number) => {
    setRecibido((x) => ({ ...x, [sku]: Math.max(0, Math.min(valor || 0, max)) }));
  };
  const completo = items.every((i) => (recibido[i.sku] || 0) >= i.cantidad);
  const confirmar = async () => {
    if (
      !(await askQuestion(
        `¿Confirmas la recepción de la devolución ${devolucion.folio} en el almacén de la sucursal?`,
      ))
    )
      return;
    onConfirmar(devolucion.folio);
  };
  return (
    <div className="fondo" onMouseDown={onClose}>
      <div
        className="modal devolucion-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div>
          <small>ARRIBO DE DEVOLUCIONES</small>
          <button type="button" onClick={onClose}>
            ×
          </button>
          <h2>Recepción de devolución</h2>
          <p>
            {devolucion.folio} · {devolucion.clienteNombre} · {devolucion.creadaEn}
          </p>
        </div>
        <div className="recepcion-lineas">
          <div className="recepcion-linea th">
            <span>Código</span>
            <span>Descripción</span>
            <span>Esperado</span>
            <span>Recibido</span>
            <span>Estado</span>
          </div>
          {items.map((i) => {
            const cantidad = recibido[i.sku] || 0,
              ok = cantidad >= i.cantidad;
            return (
              <div className="recepcion-linea" key={i.sku}>
                <span>{i.sku}</span>
                <span>{i.descripcion}</span>
                <span>{i.cantidad}</span>
                <span>
                  <input
                    type="number"
                    min={0}
                    max={i.cantidad}
                    value={cantidad}
                    onChange={(e) =>
                      actualizarManual(i.sku, Number(e.target.value), i.cantidad)
                    }
                  />
                </span>
                <em className={ok ? "ok" : "warn"}>
                  {ok ? "Completo" : "Pendiente"}
                </em>
              </div>
            );
          })}
        </div>
        <div className="devolucion-scan">
          <label>
            Escanear código de barras
            <input
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  escanear();
                }
              }}
              placeholder="Escanea o captura el código y presiona Enter"
            />
          </label>
          <button type="button" onClick={simularEscaneo}>
            ▥ Escanear
          </button>
        </div>
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            disabled={!completo}
            onClick={confirmar}
          >
            Marcar como recibida
          </button>
        </footer>
      </div>
    </div>
  );
}
function DevolucionModal({
  onClose,
  onSubmit,
  stock,
}: {
  onClose: () => void;
  onSubmit: (
    input: Omit<
      Devolucion,
      "folio" | "notaCredito" | "estado" | "custodia" | "creadaEn" | "usuario"
    >,
  ) => void;
  stock: Record<string, number>;
}) {
  const [documento, setDocumento] = useState(""),
    [serie, setSerie] = useState(""),
    [buscado, setBuscado] = useState(false),
    [factura, setFactura] = useState<(typeof facturas)[number] | null>(null),
    [lineas, setLineas] = useState<DevolucionLinea[]>([]),
    [scanDocumento, setScanDocumento] = useState(""),
    [scanCode, setScanCode] = useState(""),
    [paso, setPaso] = useState<"captura" | "movimiento">("captura"),
    [applicationType, setApplicationType] = useState<Aplicacion>(
      "Aplicado a factura",
    );
  const cliente = factura
    ? clientes.find((c) => c.id === factura.clienteId)
    : null;
  const buscar = () => {
    setBuscado(true);
    const encontrada = facturas.find(
      (f) =>
        f.folio.toUpperCase() === documento.trim().toUpperCase() &&
        f.serie.toUpperCase() === serie.trim().toUpperCase(),
    );
    setFactura(encontrada || null);
    setLineas(encontrada ? lineasDeFactura(encontrada, stock) : []);
  };
  const buscarPorFolio = (folioCrudo: string) => {
    const folio = folioCrudo.trim().toUpperCase();
    const encontrada = facturas.find((f) => f.folio.toUpperCase() === folio);
    if (!encontrada) {
      showInfo(`No se encontró ningún documento con el folio "${folioCrudo}".`);
      return;
    }
    setDocumento(encontrada.folio);
    setSerie(encontrada.serie);
    setBuscado(true);
    setFactura(encontrada);
    setLineas(lineasDeFactura(encontrada, stock));
  };
  const escanearDocumento = () => {
    const codigo = scanDocumento.trim();
    setScanDocumento("");
    if (!codigo) return;
    buscarPorFolio(codigo);
  };
  const simularEscaneoDocumento = () => buscarPorFolio(facturas[0].folio);
  const actualizarCantidad = (sku: string, cantidad: number) => {
    setLineas((x) =>
      x.map((l) =>
        l.sku === sku
          ? {
              ...l,
              cantidad: Math.max(
                0,
                Math.min(cantidad || 0, l.cantidadDisponible),
              ),
            }
          : l,
      ),
    );
  };
  const actualizarDescuento = (sku: string, descuento: number) => {
    setLineas((x) =>
      x.map((l) =>
        l.sku === sku
          ? { ...l, descuento: Math.max(0, Math.min(100, descuento || 0)) }
          : l,
      ),
    );
  };
  const actualizarMotivo = (sku: string, motivo: string) => {
    setLineas((x) => x.map((l) => (l.sku === sku ? { ...l, motivo } : l)));
  };
  const registrarEscaneo = (codigoCrudo: string) => {
    const codigo = codigoCrudo.trim().toUpperCase();
    const linea = lineas.find((l) => l.sku === codigo);
    if (!linea) {
      showInfo(
        `El código "${codigoCrudo}" no corresponde a ningún producto de esta factura.`,
      );
      return;
    }
    if (linea.cantidad >= linea.cantidadDisponible) {
      showInfo(`Ya se alcanzó la cantidad disponible de ${linea.descripcion}.`);
      return;
    }
    actualizarCantidad(codigo, linea.cantidad + 1);
  };
  const escanear = () => {
    const codigo = scanCode.trim();
    setScanCode("");
    if (!codigo) return;
    registrarEscaneo(codigo);
  };
  const simularEscaneoLinea = () => {
    const pendiente = lineas.find((l) => l.cantidad < l.cantidadDisponible);
    if (!pendiente) {
      showInfo("No hay más piezas disponibles para escanear en esta factura.");
      return;
    }
    registrarEscaneo(pendiente.sku);
  };
  const subtotal = lineas.reduce(
      (acc, l) => acc + l.cantidad * l.precio * (1 - l.descuento / 100),
      0,
    ),
    iva = subtotal * 0.16,
    total = subtotal + iva,
    listo =
      lineas.some((l) => l.cantidad > 0) &&
      lineas.every((l) => l.cantidad === 0 || l.motivo !== "");
  const mensaje =
    applicationType === "Anticipo"
      ? "Se generará un anticipo en la cuenta del cliente."
      : applicationType === "Aplicado a factura"
        ? `Se generará la nota de crédito y aplicará a la factura ${factura?.folio}.`
        : "Se generará la nota de crédito y la devolución se entregará mediante un código QR de un solo uso.";
  const aceptar = async () => {
    if (!(await askQuestion("¿Confirmas la captura de esta devolución?")))
      return;
    setPaso("movimiento");
  };
  const confirmarMovimiento = async () => {
    if (
      !(await askQuestion(
        `¿Confirmas aplicar el movimiento y generar la nota de crédito por ${formatMoney(total)}?`,
      ))
    )
      return;
    if (!factura || !cliente) return;
    onSubmit({
      documento: factura.folio,
      serie: factura.serie,
      clienteId: cliente.id,
      clienteNombre: cliente.nombre,
      vendedorId: cliente.vendedorId,
      sucursal: factura.sucursal,
      items: lineas,
      subtotal,
      iva,
      total,
      tipoAplicacion: applicationType,
    });
  };
  return (
    <div className="fondo" onMouseDown={onClose}>
      <div
        className="modal devolucion-modal"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div>
          <small>REGISTRO DE DEVOLUCIONES Y GARANTÍAS</small>
          <button type="button" onClick={onClose}>
            ×
          </button>
          <h2>Nueva devolución</h2>
          <p>Identifica el documento de venta y los productos a devolver.</p>
        </div>
        {paso === "captura" && (
          <>
            <div className="escaneo-documento">
              <label>
                Escanear documento (factura o ticket)
                <input
                  value={scanDocumento}
                  onChange={(e) => setScanDocumento(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      escanearDocumento();
                    }
                  }}
                  placeholder="Escanea o captura el folio y presiona Enter"
                />
              </label>
              <button type="button" onClick={simularEscaneoDocumento}>
                ▥ Escanear
              </button>
            </div>
            <section>
              <label>
                Documento (factura o ticket)
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="FA-847219"
                />
              </label>
              <div className="serie-buscar">
                <label>
                  Serie
                  <input
                    value={serie}
                    onChange={(e) => setSerie(e.target.value)}
                    placeholder="A"
                  />
                </label>
                <button
                  type="button"
                  className="primario buscar-documento-btn"
                  onClick={buscar}
                  disabled={!documento || !serie}
                >
                  Buscar
                </button>
              </div>
            </section>
            {buscado && !factura && (
              <p className="modal-error">
                No se encontró un documento válido con ese folio y serie.
                Verifica los datos e intenta nuevamente.
              </p>
            )}
            {factura && cliente && (
              <>
                <section>
                  <label>
                    Cliente
                    <input value={cliente.nombre} disabled />
                  </label>
                  <label>
                    Sucursal
                    <input value={factura.sucursal} disabled />
                  </label>
                  <label>
                    ClienteID
                    <input value={cliente.id} disabled />
                  </label>
                  <label>
                    VendedorID
                    <input value={cliente.vendedorId} disabled />
                  </label>
                </section>
                <div className="devolucion-lineas">
                  <div className="devolucion-linea th">
                    <span>Código</span>
                    <span>Descripción</span>
                    <span>Disponible</span>
                    <span>Cantidad</span>
                    <span>Precio</span>
                    <span>Descuento (%)</span>
                    <span>Motivo</span>
                    <span>Importe</span>
                  </div>
                  {lineas.map((l) => (
                    <div className="devolucion-linea" key={l.sku}>
                      <span>{l.sku}</span>
                      <span>{l.descripcion}</span>
                      <span>{l.cantidadDisponible - l.cantidad}</span>
                      <span>
                        <input
                          type="number"
                          min={0}
                          max={l.cantidadDisponible}
                          value={l.cantidad}
                          onChange={(e) =>
                            actualizarCantidad(l.sku, Number(e.target.value))
                          }
                        />
                      </span>
                      <span>{formatMoney(l.precio)}</span>
                      <span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={l.descuento}
                          onChange={(e) =>
                            actualizarDescuento(l.sku, Number(e.target.value))
                          }
                        />
                      </span>
                      <span>
                        <select
                          value={l.motivo}
                          onChange={(e) =>
                            actualizarMotivo(l.sku, e.target.value)
                          }
                        >
                          <option value="">Selecciona un motivo</option>
                          {motivosDevolucion.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </span>
                      <span>
                        {formatMoney(
                          l.cantidad * l.precio * (1 - l.descuento / 100),
                        )}
                      </span>
                    </div>
                  ))}
                  <div className="devolucion-scan">
                    <label>
                      Escanear código de barras
                      <input
                        value={scanCode}
                        onChange={(e) => setScanCode(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            escanear();
                          }
                        }}
                        placeholder="Escanea o captura el código y presiona Enter"
                      />
                    </label>
                    <button type="button" onClick={simularEscaneoLinea}>
                      ▥ Escanear
                    </button>
                  </div>
                </div>
                <div className="devolucion-totales">
                  <span>
                    Subtotal <b>{formatMoney(subtotal)}</b>
                  </span>
                  <span>
                    IVA <b>{formatMoney(iva)}</b>
                  </span>
                  <span>
                    Total <b>{formatMoney(total)}</b>
                  </span>
                </div>
              </>
            )}
          </>
        )}
        {paso === "movimiento" && factura && cliente && (
          <>
            <section>
              <label className="doble">
                Tipo de movimiento
                <select
                  value={applicationType}
                  onChange={(e) =>
                    setApplicationType(e.target.value as Aplicacion)
                  }
                >
                  <option>Anticipo</option>
                  <option>Aplicado a factura</option>
                  <option>Devolución de efectivo</option>
                </select>
              </label>
            </section>
            <div className="application-message">{mensaje}</div>
            {applicationType === "Devolución de efectivo" && (
              <div className="qr-notice">
                <i>▦</i>
                <span>
                  <b>Se generará un código QR de un solo uso</b>
                  <small>
                    El código quedará integrado en la nota de crédito y se
                    invalidará al realizar la devolución. Valida la identidad
                    del beneficiario antes de aplicarlo.
                  </small>
                </span>
              </div>
            )}
          </>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          {paso === "captura" ? (
            <button
              type="button"
              className="primario"
              disabled={!listo}
              onClick={aceptar}
            >
              Aceptar
            </button>
          ) : (
            <button
              type="button"
              className="primario"
              onClick={confirmarMovimiento}
            >
              Sí, aplicar movimiento
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
function LegacySucursalTracePortal({
  casos,
  onBack,
}: {
  casos: Caso[];
  onBack: () => void;
}) {
  const inicial = casos.slice(0, 4),
    [pendientes, setPendientes] = useState(inicial),
    [inventario, setInventario] = useState<Caso[]>([]),
    [caja, setCaja] = useState<Caso[]>([]),
    [entregados, setEntregados] = useState<Caso[]>([]),
    [tab, setTab] = useState<"pendientes" | "inventario" | "entregados">(
      "pendientes",
    ),
    [seleccionada, setSeleccionada] = useState<Caso | null>(inicial[0] || null),
    [mensaje, setMensaje] = useState("");
  const [logistics, setLogistics] = useState(false),
    [shipment, setShipment] = useState<{
      carrier: string;
      tracking: string;
      driver: string;
      plates: string;
      date: string;
    } | null>(null);
  const avisar = (m: string) => {
    setMensaje(m);
    setTimeout(() => setMensaje(""), 2500);
  };
  const destino = (c: Caso): "Inventario" | "Caja" =>
    c.bateria || c.id.endsWith("1842") ? "Inventario" : "Caja";
  const recibir = (c: Caso) => {
    const d = destino(c);
    setPendientes((x) => x.filter((i) => i.id !== c.id));
    if (d === "Inventario")
      setInventario((x) => [{ ...c, recibido: true }, ...x]);
    else setCaja((x) => [...x, { ...c, recibido: true }]);
    setSeleccionada(null);
    avisar(
      d === "Inventario"
        ? "Recepción confirmada; producto agregado al Inventario"
        : "Recepción confirmada; producto agregado a la caja GX-ZPN-008",
    );
  };
  const entregarCaja = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setShipment({
      carrier: String(f.get("carrier")),
      tracking: String(f.get("tracking")),
      driver: String(f.get("driver")),
      plates: String(f.get("plates")),
      date: String(f.get("date")),
    });
    setEntregados((x) => [...caja, ...x]);
    setCaja([]);
    setLogistics(false);
    setTab("entregados");
    avisar(
      "Envío confirmado; relación pendiente creada en Recepción y arribo de Garantías Central",
    );
  };
  const items =
    tab === "pendientes"
      ? pendientes
      : tab === "inventario"
        ? inventario
        : caja.length
          ? caja
          : entregados;
  return (
    <div className="branch-shell">
      <header>
        <div className="portal-brand">
          <b>GX</b>
          <span>
            <strong>Garantías Sucursal</strong>
            <small>Zapopan Norte · Sucursal 014</small>
          </span>
        </div>
        <nav>
          <button
            className={tab === "pendientes" ? "activo" : ""}
            onClick={() => setTab("pendientes")}
          >
            Por recibir
          </button>
          <button
            className={tab === "inventario" ? "activo" : ""}
            onClick={() => setTab("inventario")}
          >
            Inventario
          </button>
          <button
            className={tab === "entregados" ? "activo" : ""}
            onClick={() => setTab("entregados")}
          >
            Envío a Garantías
          </button>
        </nav>
        <div className="branch-actions">
          <button onClick={onBack}>⇄ Cambiar módulo</button>
          <b>LM</b>
        </div>
      </header>
      <main>
        <div className="titulo branch-title">
          <div>
            <small>TRAZABILIDAD FÍSICA · SUCURSAL 014</small>
            <h1>Arribo de garantías</h1>
            <p>
              Confirma la recepción y conserva la custodia punta a punta de cada
              producto.
            </p>
          </div>
        </div>
        {tab === "pendientes" && seleccionada && (
          <CustodyBar caso={seleccionada} />
        )}
        <section className="branch-metrics">
          <article>
            <i>↓</i>
            <span>
              <small>Pendientes de recibir</small>
              <b>{pendientes.length}</b>
              <em>Solicitudes capturadas en Central</em>
            </span>
          </article>
          <article>
            <i>▧</i>
            <span>
              <small>Inventario de garantías</small>
              <b>{inventario.length}</b>
              <em>Destino final: resguardo en sucursal</em>
            </span>
          </article>
          <article>
            <i>✓</i>
            <span>
              <small>Envío a Garantías</small>
              <b>{entregados.length}</b>
              <em>Productos entregados a recolección</em>
            </span>
          </article>
        </section>
        {tab === "entregados" && shipment && (
          <div className="shipment-banner">
            <i>✓</i>
            <div>
              <small>RELACIÓN PENDIENTE DE ARRIBO EN GARANTÍAS CENTRAL</small>
              <strong>GX-ZPN-008 · {shipment.carrier}</strong>
              <p>
                Guía {shipment.tracking} · Operador {shipment.driver} · Placas{" "}
                {shipment.plates} · Salida {shipment.date}
              </p>
            </div>
            <span>Pendiente de recepción</span>
          </div>
        )}
        <section className="trace-grid">
          <div className="panel">
            <div className="trace-head">
              <div>
                <h2>
                  {tab === "pendientes"
                    ? "Productos pendientes de recepción"
                    : tab === "inventario"
                      ? "Inventario de garantías"
                      : "Envío a Garantías"}
                </h2>
                <p>
                  {tab === "pendientes"
                    ? "Selecciona una solicitud para consultar su custodia y confirmar el destino indicado."
                    : tab === "inventario"
                      ? "Productos cuyo destino autorizado es el resguardo en inventario."
                      : "Productos incluidos en la relación logística enviada a Garantías Central."}
                </p>
              </div>
              {tab === "entregados" && caja.length ? (
                <button className="primario" onClick={() => setLogistics(true)}>
                  Enviar a Garantías
                </button>
              ) : (
                <span>{items.length} productos</span>
              )}
            </div>
            <div className="trace-list">
              {items.length ? (
                items.map((c) => (
                  <article
                    className={
                      seleccionada?.id === c.id && tab === "pendientes"
                        ? "selected"
                        : ""
                    }
                    key={c.id}
                    onClick={() => tab === "pendientes" && setSeleccionada(c)}
                  >
                    <i>
                      {tab === "entregados"
                        ? "✓"
                        : tab === "inventario"
                          ? "▧"
                          : "↓"}
                    </i>
                    <div>
                      <small>
                        {c.id} · {c.sucursal}
                      </small>
                      <strong>{c.producto}</strong>
                      <p>
                        {c.sku} · {c.cliente}
                      </p>
                    </div>
                    <span>
                      <small>
                        {tab === "pendientes"
                          ? "DESTINO AUTORIZADO"
                          : "UNIDADES"}
                      </small>
                      <b>
                        {tab === "pendientes"
                          ? `Agregar a ${destino(c)}`
                          : "1 pieza"}
                      </b>
                    </span>
                    {tab === "pendientes" && (
                      <button
                        className="primario"
                        onClick={(e) => {
                          e.stopPropagation();
                          recibir(c);
                        }}
                      >
                        Recibir y agregar a {destino(c)}
                      </button>
                    )}
                    {tab === "inventario" && <em>En inventario</em>}
                    {tab === "entregados" && <em>Pendiente de arribo</em>}
                  </article>
                ))
              ) : (
                <div className="trace-empty">
                  <i>✓</i>
                  <strong>No hay productos en esta sección</strong>
                  <p>
                    Los movimientos aparecerán aquí conforme se confirme su
                    trazabilidad.
                  </p>
                </div>
              )}
            </div>
          </div>
          <aside className="panel box-panel">
            <div className="box-title">
              <i>▣</i>
              <div>
                <small>CAJA ABIERTA</small>
                <h2>GX-ZPN-008</h2>
              </div>
              <span>{caja.length}/12</span>
            </div>
            <div className="box-progress">
              <i style={{ width: `${(caja.length / 12) * 100}%` }} />
            </div>
            <p>Sólo se agregan productos cuyo destino autorizado es Caja.</p>
            <div className="box-items">
              {caja.length ? (
                caja.map((c) => (
                  <div key={c.id}>
                    <span>1</span>
                    <p>
                      <b>{c.sku}</b>
                      <small>{c.id}</small>
                    </p>
                  </div>
                ))
              ) : (
                <div className="box-empty">
                  Los productos aparecerán al confirmar su recepción.
                </div>
              )}
            </div>
            <button
              className="primario"
              disabled={!caja.length}
              onClick={() => setLogistics(true)}
            >
              Enviar a Garantías
            </button>
            <small>
              Se solicitarán los datos logísticos antes de generar la relación.
            </small>
          </aside>
        </section>
      </main>
      {logistics && (
        <div className="logistics-modal">
          <form onSubmit={entregarCaja}>
            <div className="logistics-head">
              <span>
                <small>CAJA GX-ZPN-008</small>
                <h2>Datos logísticos del envío</h2>
                <p>
                  Esta información generará una relación pendiente de arribo en
                  Garantías Central.
                </p>
              </span>
              <button type="button" onClick={() => setLogistics(false)}>
                ×
              </button>
            </div>
            <section>
              <label>
                Transportista
                <select name="carrier" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar transportista
                  </option>
                  <option>Paquetexpress</option>
                  <option>Castores</option>
                  <option>Transportes internos APYMSA</option>
                </select>
              </label>
              <label>
                Número de guía
                <input
                  name="tracking"
                  required
                  placeholder="Ej. PQX-78452196"
                />
              </label>
              <label>
                Nombre del operador
                <input name="driver" required placeholder="Nombre completo" />
              </label>
              <label>
                Placas de la unidad
                <input name="plates" required placeholder="Ej. JT-42-816" />
              </label>
              <label>
                Fecha y hora de salida
                <input name="date" type="datetime-local" required />
              </label>
              <label>
                Número de productos
                <input value={caja.length} readOnly />
              </label>
              <label className="logistics-wide">
                Observaciones
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Condiciones de entrega o indicaciones adicionales…"
                />
              </label>
            </section>
            <footer>
              <button type="button" onClick={() => setLogistics(false)}>
                Cancelar
              </button>
              <button className="primario">Aceptar y generar relación</button>
            </footer>
          </form>
        </div>
      )}
      {mensaje && <div className="toast">✓　{mensaje}</div>}
    </div>
  );
}

function PreviousSucursalTracePortal({
  casos,
  onBack,
}: {
  casos: Caso[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"pending" | "inventory" | "shipping">(
      "pending",
    ),
    [pending, setPending] = useState(casos.slice(0, 4)),
    [openBox, setOpenBox] = useState<Caso[]>([]),
    [boxes, setBoxes] = useState<
      {
        id: string;
        items: Caso[];
        status: "Lista" | "Enviada";
        logistics?: string;
      }[]
    >([]),
    [selected, setSelected] = useState<Caso | null>(casos[0] || null),
    [logistics, setLogistics] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const notify = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 2500);
    },
    receive = (c: Caso) => {
      setPending((x) => x.filter((i) => i.id !== c.id));
      setOpenBox((x) => [...x, c]);
      setSelected(null);
      notify("Producto agregado a Caja Abierta");
    },
    generateBox = () => {
      const id = `GX-ZPN-${String(boxes.length + 8).padStart(3, "0")}`;
      setBoxes((x) => [{ id, items: openBox, status: "Lista" }, ...x]);
      setOpenBox([]);
      setTab("shipping");
      notify(`${id} generada y disponible para envío`);
    },
    send = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget),
        id = logistics || "";
      setBoxes((x) =>
        x.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "Enviada",
                logistics: `${f.get("carrier")} · ${f.get("tracking")}`,
              }
            : b,
        ),
      );
      setLogistics(null);
      notify("Relación enviada a Garantías Central; reporte generado");
      setTimeout(() => window.print(), 200);
    };
  return (
    <div className="branch-shell">
      <header>
        <div className="portal-brand">
          <b>GX</b>
          <span>
            <strong>Garantías Sucursal</strong>
            <small>Zapopan Norte · Sucursal 014</small>
          </span>
        </div>
        <nav>
          <button
            className={tab === "pending" ? "activo" : ""}
            onClick={() => setTab("pending")}
          >
            Por recibir
          </button>
          <button
            className={tab === "inventory" ? "activo" : ""}
            onClick={() => setTab("inventory")}
          >
            Inventario
          </button>
          <button
            className={tab === "shipping" ? "activo" : ""}
            onClick={() => setTab("shipping")}
          >
            Envío a Garantías
          </button>
        </nav>
        <div className="branch-actions">
          <button onClick={onBack}>⇄ Cambiar módulo</button>
          <b>LM</b>
        </div>
      </header>
      <main>
        <div className="titulo branch-title">
          <div>
            <small>TRAZABILIDAD FÍSICA · SUCURSAL 014</small>
            <h1>
              {tab === "pending"
                ? "Arribo de garantías"
                : tab === "inventory"
                  ? "Inventario de garantías"
                  : "Concentrado de cajas"}
            </h1>
            <p>
              {tab === "shipping"
                ? "Genera la relación logística y envía cajas completas a Garantías Central."
                : "Confirma la custodia física de los productos en sucursal."}
            </p>
          </div>
        </div>
        {tab === "pending" && selected && <CustodyBar caso={selected} />}{" "}
        {tab === "pending" && (
          <section className="trace-grid">
            <div className="panel">
              <div className="trace-head">
                <div>
                  <h2>Productos por recibir</h2>
                  <p>Selecciona un registro y confirma su ingreso a la caja.</p>
                </div>
                <span>{pending.length} pendientes</span>
              </div>
              <div className="trace-list">
                {pending.map((c) => (
                  <article
                    className={selected?.id === c.id ? "selected" : ""}
                    key={c.id}
                    onClick={() => setSelected(c)}
                  >
                    <i>↓</i>
                    <div>
                      <small>{c.id}</small>
                      <strong>{c.producto}</strong>
                      <p>
                        {c.sku} · {c.cliente}
                      </p>
                    </div>
                    <span>
                      <small>DESTINO</small>
                      <b>Caja Abierta</b>
                    </span>
                    <button
                      className="primario"
                      onClick={(e) => {
                        e.stopPropagation();
                        receive(c);
                      }}
                    >
                      Recibir y agregar a caja
                    </button>
                  </article>
                ))}
              </div>
            </div>
            <aside className="panel box-panel">
              <div className="box-title">
                <i>▣</i>
                <div>
                  <small>CAJA ABIERTA</small>
                  <h2>Sin folio</h2>
                </div>
                <span>{openBox.length}/12</span>
              </div>
              <div className="box-items">
                {openBox.length ? (
                  openBox.map((c) => (
                    <div key={c.id}>
                      <span>1</span>
                      <p>
                        <b>{c.sku}</b>
                        <small>{c.id}</small>
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="box-empty">
                    Agrega productos antes de generar la caja.
                  </div>
                )}
              </div>
              <button
                className="primario"
                disabled={!openBox.length}
                onClick={generateBox}
              >
                Generar caja
              </button>
              <small>
                El folio se asignará y aparecerá en Envío a Garantías.
              </small>
            </aside>
          </section>
        )}
        {tab === "inventory" && (
          <div className="panel arrival-empty">
            <i>▤</i>
            <h2>Inventario de sucursal</h2>
            <p>No hay productos en inventario.</p>
          </div>
        )}
        {tab === "shipping" && (
          <section className="panel boxes-concentrate">
            <div className="trace-head">
              <div>
                <h2>Cajas generadas</h2>
                <p>Captura los datos logísticos desde cada caja lista.</p>
              </div>
              <span>{boxes.length} cajas</span>
            </div>
            {boxes.length ? (
              boxes.map((b) => (
                <article key={b.id}>
                  <i>▣</i>
                  <div>
                    <small>CAJA</small>
                    <strong>{b.id}</strong>
                    <p>{b.items.length} productos · Generada hoy</p>
                  </div>
                  <span className={b.status === "Enviada" ? "sent" : "ready"}>
                    {b.status}
                  </span>
                  <button
                    className="primario"
                    disabled={b.status === "Enviada"}
                    onClick={() => setLogistics(b.id)}
                  >
                    {b.status === "Enviada"
                      ? "✓ Enviada"
                      : "Enviar a Garantías"}
                  </button>
                  {b.logistics && <small>{b.logistics}</small>}
                </article>
              ))
            ) : (
              <div className="trace-empty">
                <i>▣</i>
                <strong>No hay cajas generadas</strong>
                <p>Genera una caja desde la opción Por recibir.</p>
              </div>
            )}
          </section>
        )}
      </main>
      {logistics && (
        <div className="logistics-modal">
          <form onSubmit={send}>
            <div className="logistics-head">
              <span>
                <small>{logistics}</small>
                <h2>Datos logísticos del envío</h2>
                <p>Al aceptar se imprimirá el reporte detallado de la caja.</p>
              </span>
              <button type="button" onClick={() => setLogistics(null)}>
                ×
              </button>
            </div>
            <section>
              <label>
                Transportista
                <select name="carrier" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar transportista
                  </option>
                  <option>Paquetexpress</option>
                  <option>Castores</option>
                  <option>Transportes internos APYMSA</option>
                </select>
              </label>
              <label>
                Número de guía
                <input
                  name="tracking"
                  required
                  placeholder="Ej. PQX-78452196"
                />
              </label>
              <label>
                Operador
                <input name="driver" required />
              </label>
              <label>
                Placas
                <input name="plates" required />
              </label>
              <label>
                Fecha y hora de salida
                <input name="date" type="datetime-local" required />
              </label>
              <label className="logistics-wide">
                Observaciones
                <textarea rows={3} />
              </label>
            </section>
            <footer>
              <button type="button" onClick={() => setLogistics(null)}>
                Cancelar
              </button>
              <button className="primario">Aceptar e imprimir reporte</button>
            </footer>
            <article className="shipping-print">
              <h1>Relación de envío a Garantías Central</h1>
              <h2>{logistics}</h2>
              {boxes
                .find((b) => b.id === logistics)
                ?.items.map((i) => (
                  <p key={i.id}>
                    {i.id} · {i.sku} · {i.producto} · 1 pieza
                  </p>
                ))}
            </article>
          </form>
        </div>
      )}
      {toast && <div className="toast">✓　{toast}</div>}
    </div>
  );
}

function SucursalTracePortal({
  casos,
  onBack,
}: {
  casos: Caso[];
  onBack: () => void;
}) {
  const casosArribo = casos.filter((c) => c.resultado !== "No procede");
  const seeded = [
    ...casosArribo.slice(0, 4).map((caso, index) => ({
      ...caso,
      custodia: index === 2 ? "Con el cliente" : "Con el asesor",
    })),
    {
      ...casosArribo[0],
      id: "GE-260824-1851",
      producto: "Amortiguador Monroe",
      sku: "MO-7281",
      cliente: "Taller El Pistón",
      bateria: true,
      custodia: "Con el cliente",
    },
    {
      ...casosArribo[1],
      id: "GE-260824-1850",
      producto: "Marcha Bosch",
      sku: "BO-MA810",
      cliente: "Refacciones Colón",
      bateria: true,
      custodia: "Con el asesor",
    },
    {
      ...casosArribo[2],
      id: "GE-260824-1847",
      producto: "Kit de balero de rueda SKF",
      sku: "SKF-VKBA",
      cliente: "Autopartes Camino Real",
      custodia: "Con el cliente",
    },
    {
      ...casosArribo[3],
      id: "GE-260824-1846",
      producto: "Filtro de aceite Valeo",
      sku: "VA-SF123",
      cliente: "Taller Mecánico Vallarta",
      custodia: "Con el cliente",
    },
  ];
  const [tab, setTab] = useState<"pending" | "inventory" | "shipping">(
      "pending",
    ),
    [pending, setPending] = useState(seeded),
    [openBox, setOpenBox] = useState<Caso[]>([]),
    [inventory, setInventory] = useState<Caso[]>([]),
    [boxes, setBoxes] = useState<
      {
        id: string;
        items: Caso[];
        status: "Lista" | "Enviada";
        date?: string;
        tracking?: string;
        carrier?: string;
      }[]
    >([]),
    [selected, setSelected] = useState<Caso | null>(seeded[0]),
    [logistics, setLogistics] = useState<string | null>(null),
    [detail, setDetail] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [dueFilter, setDueFilter] = useState<
      "all" | "expired" | "today" | "upcoming"
    >("all");
  useEffect(() => {
    setPending((x) => {
      const yaListado = new Set([
        ...x.map((p) => p.id),
        ...openBox.map((p) => p.id),
        ...inventory.map((p) => p.id),
      ]);
      const entrantes = casos.filter(
        (c) =>
          c.origenMostrador &&
          c.entregadoAlmacen &&
          c.resultado !== "No procede" &&
          !yaListado.has(c.id),
      );
      return entrantes.length ? [...entrantes, ...x] : x;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casos]);
  const notify = (m: string) => {
      setToast(m);
      setTimeout(() => setToast(""), 2400);
    },
    returnToPending = async (c: Caso) => {
      if (
        !(await askQuestion(
          `¿Confirmas devolver ${c.id} al listado general de solicitudes pendientes?`,
        ))
      )
        return;
      setOpenBox((x) => x.filter((i) => i.id !== c.id));
      setPending((x) => (x.some((i) => i.id === c.id) ? x : [...x, c]));
      setSelected(c);
      notify(`${c.id} regresó a Solicitudes pendientes`);
    },
    toBox = async (c: Caso) => {
      if (
        !(await askQuestion(
          `¿Confirmas recibir ${c.id} y agregarlo a la Caja Abierta?`,
        ))
      )
        return;
      setPending((x) => x.filter((i) => i.id !== c.id));
      setOpenBox((x) => [...x, c]);
      notify("Producto agregado a Caja Abierta");
    },
    toInventory = async (c: Caso) => {
      if (
        !(await askQuestion(
          `¿Confirmas recibir ${c.id} y moverlo al almacén de la sucursal?`,
        ))
      )
        return;
      setPending((x) => x.filter((i) => i.id !== c.id));
      setInventory((x) => [...x, c]);
      notify("Producto recibido y movido a almacén");
    },
    generate = async () => {
      if (
        !(await askQuestion(
          `¿Confirmas generar una caja con ${openBox.length} solicitud(es)?`,
        ))
      )
        return;
      const id = `GX-ZPN-${String(boxes.length + 8).padStart(3, "0")}`;
      setBoxes((x) => [{ id, items: [...openBox], status: "Lista" }, ...x]);
      setOpenBox([]);
      setTab("shipping");
      notify(`${id} generada con ${openBox.length} solicitudes`);
    },
    send = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.currentTarget,
        f = new FormData(form),
        id = logistics || "";
      if (
        !(await askQuestion(
          `¿Confirmas aceptar los datos logísticos y enviar la caja ${id} a Garantías Central?`,
        ))
      )
        return;
      setBoxes((x) =>
        x.map((b) =>
          b.id === id
            ? {
                ...b,
                status: "Enviada",
                date: String(f.get("date")),
                tracking: String(f.get("tracking")),
                carrier: String(f.get("carrier")),
              }
            : b,
        ),
      );
      setLogistics(null);
      notify("Información logística registrada; caja enviada");
    };
  const dueTone = (c: Caso) =>
      c.id.endsWith("1842")
        ? "expired"
        : c.id.endsWith("1841")
          ? "today"
          : "upcoming",
    visiblePending = pending.filter(
      (c) => dueFilter === "all" || dueTone(c) === dueFilter,
    );
  return (
    <div className="branch-shell">
      <header>
        <div className="portal-brand">
          <b>GX</b>
          <span>
            <strong>Garantías Sucursal</strong>
            <small>Zapopan Norte · Sucursal 014</small>
          </span>
        </div>
        <nav>
          <button
            className={tab === "pending" ? "activo" : ""}
            onClick={() => setTab("pending")}
          >
            Por recibir <em>{pending.length}</em>
          </button>
          <button
            className={tab === "inventory" ? "activo" : ""}
            onClick={() => setTab("inventory")}
          >
            Inventario <em>{inventory.length}</em>
          </button>
          <button
            className={tab === "shipping" ? "activo" : ""}
            onClick={() => setTab("shipping")}
          >
            Envío a Garantías <em>{boxes.length}</em>
          </button>
        </nav>
        <div className="branch-actions">
          <button onClick={onBack}>⇄ Cambiar módulo</button>
          <b>LM</b>
        </div>
      </header>
      <main>
        <div className="titulo branch-title">
          <div>
            <small>SUCURSAL 014 · ZAPOPAN NORTE</small>
            <h1>
              {tab === "pending"
                ? "Arribo de garantías"
                : tab === "inventory"
                  ? "Inventario de sucursal"
                  : "Concentrado de cajas"}
            </h1>
            <p>
              {tab === "shipping"
                ? "Consulta, imprime o registra el envío de cada caja."
                : "Cada solicitud conserva su destino autorizado."}
            </p>
          </div>
        </div>
        <section className="branch-stage-counts">
          <article className={tab === "pending" ? "active" : ""}>
            <i>↓</i>
            <span>
              <small>POR RECIBIR</small>
              <b>{pending.length}</b>
            </span>
          </article>
          <article className={tab === "inventory" ? "active" : ""}>
            <i>▤</i>
            <span>
              <small>INVENTARIO</small>
              <b>{inventory.length}</b>
            </span>
          </article>
          <article className={tab === "shipping" ? "active" : ""}>
            <i>▣</i>
            <span>
              <small>ENVÍO A GARANTÍAS</small>
              <b>{boxes.length}</b>
            </span>
          </article>
        </section>
        {tab === "pending" && (
          <section className="trace-grid">
            <div className="panel">
              <div className="trace-head">
                <div>
                  <h2>Solicitudes pendientes</h2>
                  <p>
                    Las solicitudes no procesadas permanecerán en esta bandeja.
                  </p>
                </div>
                <div className="due-filter">
                  <label>
                    Vencimiento
                    <select
                      value={dueFilter}
                      onChange={(e) =>
                        setDueFilter(e.target.value as typeof dueFilter)
                      }
                    >
                      <option value="all">Todos ({pending.length})</option>
                      <option value="expired">Vencidas</option>
                      <option value="today">Vencen hoy</option>
                      <option value="upcoming">Próximas</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="trace-list">
                {visiblePending.map((c, i) => (
                  <article
                    className={selected?.id === c.id ? "selected" : ""}
                    key={c.id}
                    onClick={() => setSelected(c)}
                  >
                    <i>{i % 3 === 2 ? "▤" : "↓"}</i>
                    <div>
                      <small>
                        {c.id} · {c.origenMostrador ? "Mostrador" : "Garantías Central"}
                        {c.usuario ? ` · ${c.usuario}` : ""}
                      </small>
                      <strong>{c.producto}</strong>
                      <p>
                        {c.sku} · {c.cliente}
                      </p>
                      <em className={`due-alert ${dueTone(c)}`}>
                        {dueTone(c) === "expired"
                          ? "Vencida · Entrega estimada 10 ago 2026"
                          : dueTone(c) === "today"
                            ? "Vence hoy · Entrega estimada 24 ago 2026"
                            : `Entrega estimada ${["05 sep", "12 sep", "18 sep", "23 sep"][i % 4]} 2026`}
                      </em>
                    </div>
                    <span
                      className={`branch-custody-state ${c.custodia === "Con el cliente" ? "client" : ""}`}
                    >
                      <small>ESTADO DE CUSTODIA</small>
                      <b>{c.custodia || "Con el asesor"}</b>
                      <em>{custodyDates(c)[1]}</em>
                    </span>
                    <span>
                      <small>DESTINO</small>
                      <b>{i % 3 === 2 ? "Almacén" : "Caja Abierta"}</b>
                    </span>
                    <button
                      className="primario"
                      onClick={(e) => {
                        e.stopPropagation();
                        i % 3 === 2 ? toInventory(c) : toBox(c);
                      }}
                    >
                      {i % 3 === 2
                        ? "Recibir y mover a almacén"
                        : "Recibir y agregar a caja"}
                    </button>
                  </article>
                ))}
              </div>
            </div>
            <aside className="panel box-panel">
              <div className="box-title">
                <i>▣</i>
                <div>
                  <small>CAJA ABIERTA</small>
                  <h2>Pendiente de folio</h2>
                </div>
                <span>{openBox.length}/12</span>
              </div>
              <div className="box-items">
                {openBox.length ? (
                  openBox.map((c) => (
                    <div key={c.id}>
                      <span>1</span>
                      <p>
                        <b>{c.sku}</b>
                        <small>{c.id}</small>
                      </p>
                      <button
                        className="box-return-icon"
                        type="button"
                        title="Devolver al listado general"
                        aria-label={`Devolver ${c.id} al listado general`}
                        onClick={() => returnToPending(c)}
                      >
                        ↩
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="box-empty">
                    Agrega solicitudes para formar una caja.
                  </div>
                )}
              </div>
              <button
                className="primario"
                disabled={!openBox.length}
                onClick={generate}
              >
                Generar caja
              </button>
              <small>Sólo agrupa las solicitudes agregadas actualmente.</small>
            </aside>
          </section>
        )}
        {tab === "inventory" && (
          <section className="panel boxes-concentrate branch-inventory-list">
            <div className="trace-head">
              <div>
                <h2>Productos en almacén</h2>
                <p>Recibidos directamente desde la bandeja Por recibir.</p>
              </div>
              <span>{inventory.length}</span>
            </div>
            {inventory.map((c) => (
              <article key={c.id}>
                <i>▤</i>
                <div>
                  <small>{c.id}</small>
                  <strong>{c.producto}</strong>
                  <p>{c.sku}</p>
                </div>
                <span className="branch-custody-state stored custody-card">
                  <i>⌖</i>
                  <span>
                    <small>ESTADO DE CUSTODIA</small>
                    <b>En sucursal</b>
                    <em>Recepción confirmada</em>
                  </span>
                </span>
                <span className="sent stored-status">
                  <i>✓</i> Almacenado
                </span>
              </article>
            ))}
          </section>
        )}
        {tab === "shipping" && (
          <section className="panel boxes-concentrate">
            <div className="trace-head">
              <div>
                <h2>Cajas generadas</h2>
                <p>
                  El detalle y la impresión se gestionan independientemente del
                  envío.
                </p>
              </div>
              <span>{boxes.length} cajas</span>
            </div>
            {boxes.length ? (
              boxes.map((b) => (
                <article className="box-row-rich" key={b.id}>
                  <i>▣</i>
                  <div>
                    <small>CAJA</small>
                    <strong>{b.id}</strong>
                    <p>{b.items.length} solicitudes</p>
                  </div>
                  <div className="box-logistics">
                    <small>FECHA DE ENVÍO</small>
                    <b>{b.date ? b.date.replace("T", " · ") : "Pendiente"}</b>
                    <small>
                      {b.carrier || "Paquetería pendiente"} ·{" "}
                      {b.tracking || "Sin guía"}
                    </small>
                  </div>
                  <span className={b.status === "Enviada" ? "sent" : "ready"}>
                    {b.status}
                  </span>
                  <div className="box-actions">
                    <button onClick={() => setDetail(b.id)}>Ver detalle</button>
                    <button
                      className="primario"
                      disabled={b.status === "Enviada"}
                      onClick={async () => {
                        if (
                          await askQuestion(
                            `¿Deseas iniciar el envío de la caja ${b.id} a Garantías Central?`,
                          )
                        )
                          setLogistics(b.id);
                      }}
                    >
                      {b.status === "Enviada"
                        ? "✓ Enviada"
                        : "Enviar a Garantías"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="trace-empty">
                <i>▣</i>
                <strong>No hay cajas generadas</strong>
                <p>Procesa solicitudes desde Por recibir.</p>
              </div>
            )}
          </section>
        )}
      </main>
      {logistics && (
        <div className="logistics-modal">
          <form onSubmit={send}>
            <div className="logistics-head">
              <span>
                <small>{logistics}</small>
                <h2>Información logística</h2>
                <p>Estos datos acompañarán la relación pendiente de arribo.</p>
              </span>
              <button type="button" onClick={() => setLogistics(null)}>
                ×
              </button>
            </div>
            <section>
              <label>
                Paquetería
                <select name="carrier" required defaultValue="">
                  <option value="" disabled>
                    Seleccionar
                  </option>
                  <option>Paquetexpress</option>
                  <option>Castores</option>
                  <option>Transportes internos APYMSA</option>
                </select>
              </label>
              <label>
                Guía
                <input name="tracking" required />
              </label>
              <label>
                Operador
                <input name="driver" required />
              </label>
              <label>
                Placas
                <input name="plates" required />
              </label>
              <label>
                Fecha de envío
                <input name="date" type="datetime-local" required />
              </label>
            </section>
            <footer>
              <button type="button" onClick={() => setLogistics(null)}>
                Cancelar
              </button>
              <button className="primario">Aceptar</button>
            </footer>
          </form>
        </div>
      )}
      {detail && (
        <div className="box-detail-modal">
          <section>
            <button onClick={() => setDetail(null)}>×</button>
            <small>DETALLE DE CAJA</small>
            <h2>{detail}</h2>
            <p>
              {boxes.find((b) => b.id === detail)?.items.length} solicitudes
              incluidas
            </p>
            <div>
              {boxes
                .find((b) => b.id === detail)
                ?.items.map((c) => (
                  <article key={c.id}>
                    <span>
                      <b>{c.producto}</b>
                      <small>
                        {c.id} · {c.sku}
                      </small>
                    </span>
                    <span className="branch-custody-state">
                      <small>ESTADO DE CUSTODIA</small>
                      <b>
                        {boxes.find((b) => b.id === detail)?.status ===
                        "Enviada"
                          ? "Con Paquetería"
                          : "En caja de Garantías"}
                      </b>
                    </span>
                    <em>1 pieza</em>
                  </article>
                ))}
            </div>
            <footer>
              <button onClick={() => setDetail(null)}>Cerrar</button>
              <button className="primario" onClick={() => window.print()}>
                ▤ Imprimir reporte
              </button>
            </footer>
            <aside className="shipping-print">
              <h1>Relación detallada de caja</h1>
              <h2>{detail}</h2>
              {boxes
                .find((b) => b.id === detail)
                ?.items.map((c) => (
                  <p key={c.id}>
                    {c.id} · {c.sku} · {c.producto} · 1 pieza
                  </p>
                ))}
            </aside>
          </section>
        </div>
      )}
      {toast && <div className="toast">✓　{toast}</div>}
    </div>
  );
}

function CustodyBar({ caso }: { caso: Caso }) {
  const pasos = [
      "Con el Cliente",
      "Con el Asesor",
      "En Sucursal",
      "En Caja de Garantías",
      "Con el Recolector",
      "Garantías Central",
    ],
    dates = custodyDates(caso);
  return (
    <section className="custody">
      <div className="custody-head">
        <div>
          <small>ESTADO DE CUSTODIA</small>
          <strong>
            {caso.id} · {caso.producto}
          </strong>
        </div>
        <span>
          Custodia actual: <b>Con el Asesor</b>
        </span>
      </div>
      <div className="custody-track">
        {pasos.map((p, i) => (
          <div
            className={i < 2 ? "complete" : i === 2 ? "current" : ""}
            key={p}
          >
            <i>{i < 2 ? "✓" : i + 1}</i>
            <span>
              {p}
              <small>{i <= 2 ? dates[i] : "Pendiente"}</small>
            </span>
            {i < pasos.length - 1 && <em />}
          </div>
        ))}
      </div>
    </section>
  );
}

const clientes = [
  {
    id: "1",
    nombre: "CLIENTE MOSTRADOR",
    sucursal: "Zapopan Norte",
    canal: "Retail" as const,
    vendedorId: "V-014",
  },
  {
    id: "30214",
    nombre: "REFACCIONARIA EL VOLANTE",
    sucursal: "GDL Centro",
    canal: "No Retail" as const,
    vendedorId: "V-002",
  },
  {
    id: "10872",
    nombre: "TALLER AUTOMOTRIZ RÍOS",
    sucursal: "León Torres",
    canal: "No Retail" as const,
    vendedorId: "V-007",
  },
  {
    id: "41590",
    nombre: "GRUPO MOTOR PLUS",
    sucursal: "Aguascalientes Sur",
    canal: "No Retail" as const,
    vendedorId: "V-011",
  },
];
const motivosDevolucion = [
  "Producto defectuoso",
  "Producto incompleto",
  "Error en la venta",
  "Cliente cambió de opinión",
  "No corresponde al pedido",
];
function parseMoney(v: string): number {
  return Number(v.replace(/[^0-9.-]/g, "")) || 0;
}
function formatMoney(v: number): string {
  return v.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
type DevolucionLinea = {
  sku: string;
  descripcion: string;
  precio: number;
  cantidadDisponible: number;
  cantidad: number;
  descuento: number;
  motivo: string;
};
type Devolucion = {
  folio: string;
  documento: string;
  serie: string;
  clienteId: string;
  clienteNombre: string;
  vendedorId: string;
  sucursal: string;
  items: { sku: string; descripcion: string; cantidad: number; precio: number; descuento: number; motivo: string }[];
  subtotal: number;
  iva: number;
  total: number;
  tipoAplicacion: Aplicacion;
  notaCredito: string;
  estado: "Capturada" | "Entregada a almacén" | "Recibida en almacén";
  custodia: "En mostrador" | "En almacén";
  creadaEn: string;
  usuario: string;
};
const productos = [
  { sku: "BO-AL394", descripcion: "ALTERNADOR BOSCH 12V 90A", bateria: false },
  { sku: "LTH-H47", descripcion: "BATERÍA LTH H-47 600 CCA", bateria: true },
  { sku: "GMB-1256", descripcion: "BOMBA DE AGUA GMB", bateria: false },
  { sku: "DE-2341", descripcion: "SENSOR DE OXÍGENO DENSO", bateria: false },
];
const facturas: {
  folio: string;
  fecha: string;
  sucursal: string;
  cantidad: number;
  precio: string;
  clienteId: string;
  sku: string;
  serie: string;
  items?: { sku: string; cantidadDisponible: number }[];
}[] = [
  {
    folio: "FA-847219",
    fecha: "18 ago 2026",
    sucursal: "GDL Centro",
    cantidad: 1,
    precio: "$3,840.00",
    clienteId: "30214",
    sku: "BO-AL394",
    serie: "A",
    items: [
      { sku: "BO-AL394", cantidadDisponible: 1 },
      { sku: "DE-2341", cantidadDisponible: 2 },
    ],
  },
  {
    folio: "FA-842716",
    fecha: "30 jul 2026",
    sucursal: "GDL Centro",
    cantidad: 2,
    precio: "$3,790.00",
    clienteId: "30214",
    sku: "BO-AL394",
    serie: "A",
  },
  {
    folio: "FA-819044",
    fecha: "11 may 2026",
    sucursal: "Zapopan Norte",
    cantidad: 1,
    precio: "$3,925.00",
    clienteId: "30214",
    sku: "BO-AL394",
    serie: "B",
  },
  {
    folio: "FA-832604",
    fecha: "02 jul 2026",
    sucursal: "Zapopan Norte",
    cantidad: 1,
    precio: "$2,650.00",
    clienteId: "1",
    sku: "LTH-H47",
    serie: "B",
  },
  {
    folio: "FA-825118",
    fecha: "08 jun 2026",
    sucursal: "Zapopan Norte",
    cantidad: 1,
    precio: "$2,720.00",
    clienteId: "1",
    sku: "LTH-H47",
    serie: "B",
  },
  {
    folio: "FA-814502",
    fecha: "19 abr 2026",
    sucursal: "GDL Centro",
    cantidad: 2,
    precio: "$2,590.00",
    clienteId: "1",
    sku: "LTH-H47",
    serie: "A",
    items: [
      { sku: "LTH-H47", cantidadDisponible: 2 },
      { sku: "GMB-1256", cantidadDisponible: 1 },
    ],
  },
  {
    folio: "FA-801173",
    fecha: "21 mar 2026",
    sucursal: "León Torres",
    cantidad: 2,
    precio: "$1,890.00",
    clienteId: "10872",
    sku: "GMB-1256",
    serie: "C",
  },
];
function claveStock(folio: string, sku: string): string {
  return `${folio}__${sku}`;
}
function lineasDeFactura(
  f: (typeof facturas)[number],
  stock: Record<string, number>,
): DevolucionLinea[] {
  const base = f.items || [{ sku: f.sku, cantidadDisponible: f.cantidad }];
  return base.map((it) => {
    const prod = productos.find((p) => p.sku === it.sku);
    const precioRef =
      it.sku === f.sku ? parseMoney(f.precio) : parseMoney(f.precio) * 0.6;
    return {
      sku: it.sku,
      descripcion: prod?.descripcion || it.sku,
      precio: precioRef,
      cantidadDisponible:
        stock[claveStock(f.folio, it.sku)] ?? it.cantidadDisponible,
      cantidad: 0,
      descuento: 0,
      motivo: "",
    };
  });
}
const obsProcede =
  "SE DIAGNOSTICA QUE ESTE PRODUCTO PROCEDE COMO GARANTÍA EXPRESS, TOMANDO EN CUENTA QUE NO SE OBSERVAN MANIPULACIONES, GOLPES POR MALA INSTALACIÓN, ADEMÁS DE QUE PERTENECE A LA FAMILIA DE APYMSA. ESPERAMOS PRONTO LA REALIZACIÓN DE SU NUEVO PEDIDO.";
const obsNoProcede =
  "SE DIAGNOSTICA QUE ESTE PRODUCTO NO PROCEDE COMO GARANTÍA EXPRESS, DEBIDO A QUE SE OBSERVAN SIGNOS DE MANIPULACIÓN, GOLPES O DAÑOS ASOCIADOS A UNA INSTALACIÓN INCORRECTA. EL PRODUCTO NO CUMPLE CON LAS CONDICIONES DE GARANTÍA ESTABLECIDAS. PARA CUALQUIER ACLARACIÓN, FAVOR DE CONTACTAR AL DEPARTAMENTO DE GARANTÍAS.";
function NewRequestModal({
  onClose,
  onSubmit,
  stock,
}: {
  onClose: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  stock: Record<string, number>;
}) {
  const [clienteTexto, setClienteTexto] = useState(""),
    [cliente, setCliente] = useState<(typeof clientes)[number] | null>(null),
    [branch, setBranch] = useState(""),
    [skuTexto, setSkuTexto] = useState(""),
    [producto, setProducto] = useState<(typeof productos)[number] | null>(null),
    [factura, setFactura] = useState(""),
    [diagnostico, setDiagnostico] = useState(false),
    [resultado, setResultado] = useState<"Procede" | "No procede">("Procede"),
    [observacion, setObservacion] = useState(obsProcede),
    [batteryBase, setBatteryBase] = useState(2650),
    [batteryMonths, setBatteryMonths] = useState(19),
    [batteryApplied, setBatteryApplied] = useState(false),
    [ncConfirm, setNcConfirm] = useState(false),
    [checks, setChecks] = useState([false, false, false]),
    [applicationType, setApplicationType] = useState<
      "Anticipo" | "Aplicado a factura" | "Devolución de efectivo"
    >("Aplicado a factura");
  const inspeccionCompleta = checks.every(Boolean);
  const cambiarResultado = (r: "Procede" | "No procede") => {
    setResultado(r);
    setObservacion(r === "Procede" ? obsProcede : obsNoProcede);
  };
  const elegirCliente = (valor: string) => {
    setClienteTexto(valor);
    const limpio = valor.trim().toUpperCase();
    const encontrado = clientes.find(
      (c) =>
        c.id === limpio ||
        c.nombre === limpio ||
        `${c.id} — ${c.nombre}` === limpio,
    );
    setCliente(encontrado || null);
    setBranch(encontrado?.id === "1" ? "" : encontrado?.sucursal || "");
    setSkuTexto("");
    setProducto(null);
    setFactura("");
    setBatteryBase(2650);
    setBatteryMonths(19);
    setBatteryApplied(false);
    setDiagnostico(false);
    setChecks([false, false, false]);
  };
  const elegirProducto = (valor: string) => {
    setSkuTexto(valor);
    const limpio = valor.trim().toUpperCase();
    const encontrado = productos.find(
      (p) => p.sku === limpio || `${p.sku} — ${p.descripcion}` === limpio,
    );
    setProducto(encontrado || null);
    setFactura("");
  };
  const disponibles =
      cliente && producto
        ? facturas.filter(
            (f) =>
              f.clienteId === cliente.id &&
              f.sku === producto.sku &&
              (stock[claveStock(f.folio, f.sku)] || 0) > 0,
          )
        : [],
    listo = Boolean(cliente && producto && factura),
    batteryPct =
      batteryMonths <= 12
        ? 0
        : batteryMonths <= 18
          ? 20
          : batteryMonths <= 24
            ? 35
            : batteryMonths <= 30
              ? 50
              : 65,
    batteryCredit = Math.max(0, batteryBase * (1 - batteryPct / 100));
  return (
    <div className="fondo" onMouseDown={onClose}>
      <form
        className="modal request-modal"
        onSubmit={onSubmit}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="request-head">
          <small>GARANTÍA EXPRESS</small>
          <button type="button" onClick={onClose}>
            ×
          </button>
          <h2>Nueva solicitud</h2>
          <p>Identifica al cliente y la venta que origina la garantía.</p>
          <div className="steps">
            <span className="active">
              <b>1</b> Cliente
            </span>
            <i />
            <span className={cliente ? "active" : ""}>
              <b>2</b> Producto
            </span>
            <i />
            <span className={listo ? "active" : ""}>
              <b>3</b> Factura
            </span>
          </div>
        </div>
        <section className="request-fields">
          <label className="doble">
            ClienteID o nombre del cliente
            <div className="search-field">
              ⌕
              <input
                list="clientes"
                value={clienteTexto}
                onChange={(e) => elegirCliente(e.target.value)}
                placeholder="Ej. 30214 o Refaccionaria El Volante"
                autoFocus
                required
              />
            </div>
            <datalist id="clientes">
              {clientes.map((c) => (
                <option key={c.id} value={`${c.id} — ${c.nombre}`} />
              ))}
            </datalist>
            {cliente && (
              <small className="validated">
                ✓ Cliente {cliente.id} identificado
              </small>
            )}
          </label>
          <input type="hidden" name="cliente" value={cliente?.nombre || ""} />
          <label>
            Sucursal asignada
            <select
              name={cliente?.id === "1" ? "sucursal" : undefined}
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={!cliente || cliente.id !== "1"}
              required={cliente?.id === "1"}
            >
              <option value="">
                {cliente?.id === "1"
                  ? "Seleccionar sucursal"
                  : "Selecciona un cliente"}
              </option>
              <option>GDL Centro</option>
              <option>Zapopan Norte</option>
              <option>León Torres</option>
              <option>Aguascalientes Sur</option>
            </select>
            {cliente && cliente.id !== "1" && (
              <input type="hidden" name="sucursal" value={branch} />
            )}
            <small>
              {cliente?.id === "1"
                ? "Selecciona manualmente la sucursal de atención."
                : cliente
                  ? "Asignada automáticamente según la sucursal del cliente."
                  : "Identifica primero al cliente para asignar la sucursal."}
            </small>
          </label>
          <label>
            Canal
            <input
              className="readonly"
              value={cliente?.canal || ""}
              placeholder="Automático"
              readOnly
            />
            <input type="hidden" name="canal" value={cliente?.canal || ""} />
            <small>
              {cliente?.id === "1"
                ? "ClienteID 1 corresponde a CLIENTE MOSTRADOR."
                : "Determinado por la clasificación del cliente."}
            </small>
          </label>
          <label>
            SKU
            <div className="search-field">
              ⌕
              <input
                list="productos"
                value={skuTexto}
                onChange={(e) => elegirProducto(e.target.value)}
                placeholder="Ingresa el SKU"
                disabled={!cliente}
                required
              />
            </div>
            <datalist id="productos">
              {productos.map((p) => (
                <option key={p.sku} value={`${p.sku} — ${p.descripcion}`} />
              ))}
            </datalist>
          </label>
          <label>
            Producto
            <input
              className="readonly"
              name="producto"
              value={producto?.descripcion || ""}
              placeholder="La descripción se cargará automáticamente"
              readOnly
            />
          </label>
          <input type="hidden" name="sku" value={producto?.sku || ""} />
          <input
            type="hidden"
            name="bateria"
            value={producto?.bateria ? "on" : ""}
          />
        </section>
        {cliente && producto ? (
          disponibles.length ? (
            <section className="invoice-section">
              <div>
                <h3>Facturas disponibles con este producto</h3>
                <p>Cada solicitud consume 1 pieza del saldo disponible.</p>
              </div>
              <div className="invoice-list">
                {disponibles.map((f) => (
                  <label
                    className={factura === f.folio ? "selected" : ""}
                    key={f.folio}
                  >
                    <input
                      type="radio"
                      name="factura"
                      value={f.folio}
                      checked={factura === f.folio}
                      onChange={() => setFactura(f.folio)}
                      required
                    />
                    <span>
                      <b>{f.folio}</b>
                      <small>
                        {f.fecha} · {f.sucursal}
                      </small>
                    </span>
                    <span>
                      <b>{f.precio}</b>
                      <small>
                        {stock[claveStock(f.folio, f.sku)]}{" "}
                        {stock[claveStock(f.folio, f.sku)] === 1
                          ? "pieza disponible"
                          : "piezas disponibles"}
                      </small>
                    </span>
                    <em>{factura === f.folio ? "✓" : ""}</em>
                  </label>
                ))}
              </div>
              <div className="one-piece-rule">
                <b>1</b>
                <span>
                  <strong>Cantidad de la solicitud: 1 pieza</strong>
                  <small>
                    Al crearla se descontará automáticamente del saldo de la
                    factura.
                  </small>
                </span>
              </div>
            </section>
          ) : (
            <div className="invoice-empty no-results">
              <i>!</i>
              <strong>
                No se encontraron facturas disponibles con el producto ingresado
              </strong>
              <p>
                Verifica el cliente y el SKU o consulta la venta con el área
                correspondiente.
              </p>
            </div>
          )
        ) : (
          <div className="invoice-empty">
            <i>▤</i>
            <strong>Historial de facturas</strong>
            <p>
              Completa el cliente y el SKU para consultar las últimas ventas
              relacionadas.
            </p>
          </div>
        )}
        {producto?.bateria && (
          <section className="battery-inline">
            <div className="battery-inline-head">
              <span>
                <h3>Garantía de batería</h3>
                <p>Bonificación proporcional</p>
              </span>
              <em className={batteryApplied ? "battery-ok" : "battery-pending"}>
                {batteryApplied
                  ? "✓ Aplicado al dictamen"
                  : "Cálculo pendiente"}
              </em>
            </div>
            <div className="battery-inline-fields">
              <label>
                Base elegible
                <input
                  type="number"
                  value={batteryBase}
                  onChange={(e) => {
                    setBatteryBase(+e.target.value);
                    setBatteryApplied(false);
                  }}
                />
              </label>
              <label>
                Meses de uso
                <input
                  type="number"
                  value={batteryMonths}
                  onChange={(e) => {
                    setBatteryMonths(+e.target.value);
                    setBatteryApplied(false);
                  }}
                />
              </label>
            </div>
            <div className="battery-inline-result">
              <span>
                Descuento por uso <b>{batteryPct}%</b>
              </span>
              <strong>
                {batteryCredit.toLocaleString("es-MX", {
                  style: "currency",
                  currency: "MXN",
                })}
              </strong>
              <small>Importe de nota de crédito</small>
            </div>
            <button
              type="button"
              className="primario"
              onClick={() => setBatteryApplied(true)}
            >
              {batteryApplied
                ? "✓ Bonificación aplicada"
                : "Aplicar al dictamen"}
            </button>
            <p className="battery-note">
              Tabla demostrativa. Los porcentajes y fecha inicial deben
              parametrizarse.
            </p>
            <input type="hidden" name="batteryCredit" value={batteryCredit} />
          </section>
        )}
        {diagnostico && (
          <div className="diagnosis-layer">
            <section>
              <div className="diagnosis-head">
                <span>
                  <small>INSPECCIÓN COMPLETADA</small>
                  <h2>Diagnóstico de garantía</h2>
                  <p>
                    Determina si la solicitud procede como Garantía Express.
                  </p>
                </span>
                <button type="button" onClick={() => setDiagnostico(false)}>
                  ×
                </button>
              </div>
              <div className="diagnosis-options">
                <button
                  type="button"
                  className={resultado === "Procede" ? "chosen proceed" : ""}
                  onClick={() => cambiarResultado("Procede")}
                >
                  <i>✓</i>
                  <span>
                    <strong>Procede</strong>
                    <small>Cumple las condiciones de Garantía Express.</small>
                  </span>
                </button>
                <button
                  type="button"
                  className={resultado === "No procede" ? "chosen reject" : ""}
                  onClick={() => cambiarResultado("No procede")}
                >
                  <i>×</i>
                  <span>
                    <strong>No procede</strong>
                    <small>
                      Presenta condiciones que invalidan la garantía.
                    </small>
                  </span>
                </button>
              </div>
              <label>
                Observaciones del diagnóstico
                <textarea
                  name="observacion"
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                  rows={7}
                />
              </label>
              <input type="hidden" name="resultado" value={resultado} />
              <div className="diagnosis-note">
                El dictamen se generará con la resolución y observaciones
                capturadas.
              </div>
              <footer>
                <button type="button" onClick={() => setDiagnostico(false)}>
                  Regresar
                </button>
                <button
                  type={resultado === "Procede" ? "button" : "submit"}
                  className={
                    resultado === "Procede" ? "primario" : "reject-btn"
                  }
                  onClick={() =>
                    resultado === "Procede"
                      ? setNcConfirm(true)
                      : setTimeout(() => window.print(), 100)
                  }
                >
                  {resultado === "Procede"
                    ? "Confirmar"
                    : "Rechazar y generar PDF"}
                </button>
                {ncConfirm && (
                  <div className="nc-confirm diagnosis-nc">
                    <div>
                      <i>!</i>
                      <h3>Confirmar nota de crédito</h3>
                      <p>
                        ¿Deseas aplicar la solicitud y generar la nota de
                        crédito? Al confirmar se generará el PDF del diagnóstico
                        aprobado.
                      </p>
                      <dl>
                        <div>
                          <dt>Cliente</dt>
                          <dd>{cliente?.nombre}</dd>
                        </div>
                        <div>
                          <dt>Producto</dt>
                          <dd>{producto?.sku}</dd>
                        </div>
                        <div>
                          <dt>Importe</dt>
                          <dd>
                            {producto?.bateria
                              ? batteryCredit.toLocaleString("es-MX", {
                                  style: "currency",
                                  currency: "MXN",
                                })
                              : facturas.find((f) => f.folio === factura)
                                  ?.precio || "$0.00"}
                          </dd>
                        </div>
                        <div className="application-row">
                          <dt>Tipo de aplicación</dt>
                          <dd>
                            <select
                              value={applicationType}
                              onChange={(e) =>
                                setApplicationType(
                                  e.target.value as typeof applicationType,
                                )
                              }
                            >
                              <option>Anticipo</option>
                              <option>Aplicado a factura</option>
                              <option>Devolución de efectivo</option>
                            </select>
                          </dd>
                        </div>
                      </dl>
                      <div className="application-message">
                        {applicationType === "Anticipo"
                          ? "La bonificación fue aplicada como anticipo en su cuenta"
                          : applicationType === "Aplicado a factura"
                            ? `La bonificación fue aplicada a la Factura ${factura}`
                            : "La bonificación será entregada mediante un código QR de un solo uso"}
                      </div>
                      {applicationType === "Devolución de efectivo" && (
                        <div className="qr-notice">
                          <i>▦</i>
                          <span>
                            <b>Se generará un código QR de un solo uso</b>
                            <small>
                              El código quedará integrado en el dictamen y se
                              invalidará al realizar la devolución.
                            </small>
                          </span>
                        </div>
                      )}
                      <footer>
                        <button
                          type="button"
                          onClick={() => setNcConfirm(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="primario"
                          onClick={(e) => {
                            const importe = producto?.bateria
                                ? batteryCredit.toLocaleString("es-MX", {
                                    style: "currency",
                                    currency: "MXN",
                                  })
                                : facturas.find((f) => f.folio === factura)
                                    ?.precio || "$0.00",
                              form = e.currentTarget.closest("form");
                            askQuestion(
                              `¿Confirmas la aprobación, la nota de crédito por ${importe} y la generación del dictamen PDF?`,
                              () => {
                                setNcConfirm(false);
                                form?.requestSubmit();
                              },
                            );
                          }}
                        >
                          Sí, aplicar nota de crédito
                        </button>
                      </footer>
                    </div>
                  </div>
                )}
              </footer>
            </section>
            <DictamenPrint
              cliente={cliente}
              producto={producto}
              factura={factura}
              resultado={resultado}
              observacion={observacion}
              applicationType={applicationType}
            />
          </div>
        )}
        {listo && (
          <div className="inspeccion-visual">
            <h3>Inspección visual</h3>
            {[
              "El producto corresponde al SKU y factura seleccionados",
              "No presenta manipulación, golpes o mala instalación",
              "La evidencia y condición física fueron revisadas",
            ].map((x, i) => (
              <label className={checks[i] ? "checked" : ""} key={x}>
                <input
                  type="checkbox"
                  checked={checks[i]}
                  onChange={() =>
                    setChecks((a) => a.map((v, j) => (j === i ? !v : v)))
                  }
                />
                <i>{checks[i] ? "✓" : ""}</i>
                <span>{x}</span>
              </label>
            ))}
          </div>
        )}
        <footer>
          <button type="button" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primario"
            disabled={
              !listo ||
              (Boolean(producto?.bateria) && !batteryApplied) ||
              !inspeccionCompleta
            }
            onClick={() => setDiagnostico(true)}
          >
            Confirmar inspección　→
          </button>
        </footer>
      </form>
    </div>
  );
}

function DictamenPrint({
  cliente,
  producto,
  factura,
  resultado,
  observacion,
  applicationType,
}: {
  cliente: (typeof clientes)[number] | null;
  producto: (typeof productos)[number] | null;
  factura: string;
  resultado: "Procede" | "No procede";
  observacion: string;
  applicationType: string;
}) {
  return (
    <article className="print-dictamen">
      <header>
        <div className="doc-brand">
          <b>APYMSA</b>
          <small>GRUPO APYMSA</small>
        </div>
        <div>
          <span>DICTAMEN TÉCNICO</span>
          <h1>Diagnóstico de Garantía Express</h1>
          <p>Documento de resolución y trazabilidad</p>
        </div>
      </header>
      <section className="doc-meta">
        <div>
          <small>FOLIO DE SOLICITUD</small>
          <strong>GE-260824-NUEVA</strong>
        </div>
        <div>
          <small>FECHA DE EMISIÓN</small>
          <strong>24/08/2026 · 11:14</strong>
        </div>
        <div>
          <small>RESOLUCIÓN</small>
          <strong className={resultado === "Procede" ? "approved" : "rejected"}>
            {resultado === "Procede" ? "APROBADA" : "RECHAZADA"}
          </strong>
        </div>
      </section>
      <section className="doc-data">
        <div>
          <small>FACTURA</small>
          <strong>{factura}</strong>
        </div>
        <div>
          <small>CLIENTE ID</small>
          <strong>{cliente?.id}</strong>
        </div>
        <div className="wide">
          <small>CLIENTE</small>
          <strong>{cliente?.nombre}</strong>
        </div>
        <div>
          <small>SKU</small>
          <strong>{producto?.sku}</strong>
        </div>
        <div className="wide">
          <small>PRODUCTO</small>
          <strong>{producto?.descripcion}</strong>
        </div>
        <div>
          <small>CANTIDAD</small>
          <strong>1 pieza</strong>
        </div>
      </section>
      <section className="doc-resolution">
        <span className={resultado === "Procede" ? "approved" : "rejected"}>
          {resultado === "Procede"
            ? "✓ GARANTÍA APROBADA"
            : "× GARANTÍA RECHAZADA"}
        </span>
        <h2>Diagnóstico técnico</h2>
        <p>{observacion}</p>
        {resultado === "Procede" &&
          applicationType !== "Devolución de efectivo" && (
            <p className="application-observation">
              {applicationType === "Anticipo"
                ? "La bonificación fue aplicada como anticipo en su cuenta."
                : `La bonificación fue aplicada a la Factura ${factura}.`}
            </p>
          )}
      </section>
      {resultado === "Procede" && (
        <section className="doc-application">
          <h2>Aplicación de la nota de crédito</h2>
          <div>
            <span>
              <small>TIPO DE APLICACIÓN</small>
              <strong>{applicationType}</strong>
            </span>
            {applicationType === "Devolución de efectivo" && (
              <aside>
                <div className="qr-code" />
                <p>
                  <b>QR-NC-0000-U1</b>
                  <small>
                    Código de un solo uso para devolución de efectivo.
                  </small>
                </p>
              </aside>
            )}
          </div>
        </section>
      )}
      <section className="doc-trace">
        <h2>Trazabilidad del proceso</h2>
        <div>
          <span className="done">
            <i>✓</i>Solicitud
          </span>
          <em />
          <span className="done">
            <i>✓</i>Inspección
          </span>
          <em />
          <span className="done">
            <i>✓</i>Diagnóstico
          </span>
          <em />
          <span>
            <i>4</i>Recepción
          </span>
          <em />
          <span>
            <i>5</i>Custodia
          </span>
        </div>
      </section>
      <footer>
        <div>
          <strong>Departamento de Garantías</strong>
          <small>Grupo APYMSA</small>
        </div>
        <p>
          Este documento fue generado electrónicamente por Garantías Express y
          forma parte del expediente de la solicitud.
        </p>
      </footer>
    </article>
  );
}
