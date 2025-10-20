import { useEffect, useMemo, useState } from "react";
import {
  where,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { FirestoreService } from "../firebase/firestore";

type Decision = {
  año: string;
  día: string;
  expediente: string;
  identificador: string;
  mes: string;
  sala: string;
  sala_num: number;
  url: string;
};

type WithId<T> = T & { id: string };

const COLLECTION = "sentencias";
const PAGE_SIZE = 50;

const tableHeaders: { label: string; field: keyof Decision | "createdAt" }[] = [
  { label: "Año", field: "año" },
  { label: "Mes", field: "mes" },
  { label: "Día", field: "día" },
  { label: "Sala", field: "sala" },
  { label: "#", field: "sala_num" },
  { label: "Expediente", field: "expediente" },
  { label: "Identificador", field: "identificador" },
  { label: "URL", field: "url" },
];

export default function Table() {
  const [rows, setRows] = useState<WithId<Decision>[]>([]);
  const [orderByField, setOrderByField] = useState<
    keyof Decision | "createdAt"
  >("sala_num");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const [activeFilterType, setActiveFilterType] = useState<
    "year" | "sala" | "exp" | null
  >(null);
  const [year, setYear] = useState("");
  const [salaNum, setSalaNum] = useState("");
  const [expPrefix, setExpPrefix] = useState("");

  const [cursorStack, setCursorStack] = useState<
    DocumentSnapshot<DocumentData>[]
  >([]);
  const [nextCursor, setNextCursor] =
    useState<DocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const constraints = useMemo(() => {
    const c = [];
    // Solo aplicar el filtro activo
    if (activeFilterType === "year" && year) {
      c.push(where("año", "==", year));
    } else if (activeFilterType === "sala" && salaNum) {
      c.push(where("sala_num", "==", Number(salaNum)));
    } else if (activeFilterType === "exp" && expPrefix) {
      c.push(where("expediente", ">=", expPrefix));
      c.push(where("expediente", "<=", expPrefix + "\uf8ff"));
    }
    return c;
  }, [activeFilterType, year, salaNum, expPrefix]);

  useEffect(() => {
    void fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderByField, order, constraints]);

  async function fetchPage(
    reset = false,
    startAfterSnapshot?: DocumentSnapshot<DocumentData>
  ) {
    try {
      setLoading(true);
      setErr(null);

      let obField: string = orderByField as string;
      if (activeFilterType === "sala") {
        obField = "sala_num";
      } else if (activeFilterType === "year") {
        obField = "año";
      } else if (activeFilterType === "exp") {
        obField = "expediente";
      }

      const { data, nextCursor } = await FirestoreService.getPaged<Decision>(
        COLLECTION,
        PAGE_SIZE,
        {
          orderByField: obField,
          order,
          startAfterSnapshot,
          constraints,
        }
      );

      setRows(data);
      setNextCursor(nextCursor);

      if (reset) {
        setCursorStack(startAfterSnapshot ? [startAfterSnapshot] : []);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error cargando datos";
      setErr(message);
      console.error("Error fetching page:", e);
    } finally {
      setLoading(false);
    }
  }

  async function onNext() {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, nextCursor]);
    await fetchPage(false, nextCursor);
  }

  async function onPrev() {
    setCursorStack((s) => {
      if (s.length === 0) return s;
      const newStack = s.slice(0, -1);
      const newStartAfter = newStack.at(-1) ?? undefined;
      void fetchPage(false, newStartAfter);
      return newStack;
    });
  }

  const canPrev = cursorStack.length > 0;
  const canNext = !!nextCursor;

  const activeFilter =
    activeFilterType === "year" && year
      ? { label: "Año", value: year }
      : activeFilterType === "sala" && salaNum
      ? { label: "Sala", value: salaNum }
      : activeFilterType === "exp" && expPrefix
      ? { label: "Expediente", value: expPrefix }
      : null;

  return (
    <div className="min-h-screen bg-linear-to-br rounded-lg from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Decisiones TSJ
            </h1>
            <p className="text-slate-600 mt-1">
              Consulta y filtra las sentencias del Tribunal Supremo
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Filtrar por:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeFilterType === "year"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-white hover:bg-slate-200"
                }`}
                onClick={() => {
                  setActiveFilterType("year");
                  setSalaNum("");
                  setExpPrefix("");
                }}
              >
                📅 Año
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeFilterType === "sala"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-white hover:bg-slate-200"
                }`}
                onClick={() => {
                  setActiveFilterType("sala");
                  setYear("");
                  setExpPrefix("");
                }}
              >
                #️⃣ Sala
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeFilterType === "exp"
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-slate-100 text-white hover:bg-slate-200"
                }`}
                onClick={() => {
                  setActiveFilterType("exp");
                  setYear("");
                  setSalaNum("");
                }}
              >
                📄 Expediente
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  !activeFilterType
                    ? "bg-slate-600 text-white shadow-md"
                    : "bg-slate-100 text-white hover:bg-slate-200"
                }`}
                onClick={() => {
                  setActiveFilterType(null);
                  setYear("");
                  setSalaNum("");
                  setExpPrefix("");
                }}
              >
                🔄 Sin filtro
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Input de Año */}
            {activeFilterType === "year" && (
              <div className="relative">
                <input
                  className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Año (ej. 2009)"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
            )}

            {/* Input de Sala */}
            {activeFilterType === "sala" && (
              <div className="relative">
                <input
                  className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Sala num (ej. 2)"
                  value={salaNum}
                  onChange={(e) => setSalaNum(e.target.value)}
                />
              </div>
            )}

            {/* Input de Expediente */}
            {activeFilterType === "exp" && (
              <div className="relative">
                <input
                  className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="Prefijo expediente"
                  value={expPrefix}
                  onChange={(e) => setExpPrefix(e.target.value)}
                />
              </div>
            )}

            {/* Ordenamiento */}
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none bg-white"
                value={order}
                onChange={(e) => setOrder(e.target.value as "asc" | "desc")}
                aria-label="select order direction"
              >
                <option value="desc">↓ Desc</option>
                <option value="asc">↑ Asc</option>
              </select>
              <button
                className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => fetchPage(true)}
                disabled={loading}
              >
                Aplicar
              </button>
            </div>
          </div>

          {/* Active Filter Badge */}
          {activeFilter && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-slate-600">Filtro activo:</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                {activeFilter.label}: {activeFilter.value}
                <button
                  onClick={() => {
                    setActiveFilterType(null);
                    setYear("");
                    setSalaNum("");
                    setExpPrefix("");
                  }}
                  className="hover:text-blue-900"
                >
                  ✕
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Table Card */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="overflow-auto max-h-[600px]">
            <table className="min-w-full">
              <thead className="bg-linear-to-r from-slate-100 to-slate-50 sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  {tableHeaders.map((hdr) => (
                    <th
                      key={hdr.field}
                      className="text-left px-6 py-4 text-xs font-semibold text-slate-700 uppercase tracking-wider"
                    >
                      {hdr.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-6 py-4">
                          <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                        </td>
                      ))}
                    </tr>
                  ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-12 text-center text-slate-500"
                      colSpan={8}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">📋</span>
                        <span className="text-lg font-medium">
                          Sin resultados
                        </span>
                        <span className="text-sm">
                          Intenta ajustar los filtros
                        </span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50 transition-colors duration-150"
                    >
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r["año"]}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r.mes}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r["día"]}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r.sala}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full">
                          {r.sala_num}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-700">
                        {r.expediente}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600 max-w-xs truncate">
                        {r.identificador}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver
                          <span className="text-xs">↗</span>
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between bg-white rounded-xl shadow-md border border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-white font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              disabled={!canPrev || loading}
              onClick={onPrev}
            >
              <span>←</span>
              Anterior
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-white font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              disabled={!canNext || loading}
              onClick={onNext}
            >
              Siguiente
              <span>→</span>
            </button>
          </div>

          {err && (
            <div className="flex items-center gap-2 text-red-600 text-sm font-medium">
              <span>⚠️</span>
              {err}
            </div>
          )}

          {!err && !loading && rows.length > 0 && (
            <span className="text-sm text-slate-600">
              Mostrando <span className="font-semibold">{rows.length}</span>{" "}
              resultados
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
