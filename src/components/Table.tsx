import { useEffect, useMemo, useRef, useState } from "react";
import {
  where,
  type DocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { FirestoreService } from "../firebase/firestore";

type Decision = {
  year: string;
  day: string;
  exp: string;
  id: string;
  month: string;
  sala: string;
  sala_num: number;
  url: string;
};

type WithId<T> = T & { id: string };

const COLLECTION = "sentencias";
const PAGE_SIZE = 50;

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const SALA_OPTIONS = [
  { label: "Sala Plena", value: "0" },
  { label: "Sala Constitucional", value: "1" },
  { label: "Sala Politico-Administrativa", value: "2" },
  { label: "Sala Electoral", value: "3" },
  { label: "Sala Civil", value: "4" },
  { label: "Sala Penal", value: "5" },
  { label: "Sala Social", value: "6" },
  { label: "Comision Judicial", value: "7" },
  { label: "Sala Habilitada", value: "8" },
  { label: "Vice Presidencia", value: "9" },
  { label: "Sala Especial Primera", value: "10" },
  { label: "JDS - Sala Plena", value: "11" },
  { label: "JDS - Sala Constitucional", value: "12" },
  { label: "JDS - Sala Politico-Administrativa", value: "13" },
  { label: "JDS - Sala Electorial", value: "14" },
  { label: "JDS - Sala Civil", value: "15" },
  { label: "JDS - Sala Social", value: "16" },
  { label: "Sala Especial Segunda", value: "17" },
  { label: "Sala Especial Primera", value: "18" },
  { label: "Presidencia", value: "19" },
  { label: "Sala Especial", value: "20" },
] as const;

const tableHeaders: { label: string; field: keyof Decision | "createdAt" }[] = [
  { label: "Año", field: "year" },
  { label: "Mes", field: "month" },
  { label: "Día", field: "day" },
  { label: "Sala", field: "sala" },
  { label: "#", field: "sala_num" },
  { label: "Expediente", field: "exp" },
  { label: "Identificador", field: "id" },
  { label: "URL", field: "url" },
];

export default function Table() {
  const [rows, setRows] = useState<WithId<Decision>[]>([]);
  const orderByField = useRef<keyof Decision | "createdAt">("year");
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  // Filtros
  const [year, setYear] = useState("");
  const [salaNum, setSalaNum] = useState("");
  const [expPrefix, setExpPrefix] = useState("");
  const [monthFilter, setMonthFilter] = useState("");

  const [cursorStack, setCursorStack] = useState<
    DocumentSnapshot<DocumentData>[]
  >([]);
  const [nextCursor, setNextCursor] =
    useState<DocumentSnapshot<DocumentData> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const constraints = useMemo(() => {
    const c = [];
    if (year) c.push(where("year", "==", year));
    if (salaNum) c.push(where("sala_num", "==", Number(salaNum)));
    if (monthFilter) c.push(where("month", "==", monthFilter.toLowerCase()));
    if (expPrefix) {
      c.push(where("exp", ">=", expPrefix));
      c.push(where("exp", "<=", expPrefix + "\uf8ff"));
    }
    return c;
  }, [year, salaNum, monthFilter, expPrefix]);

  useEffect(() => {
    void fetchPage(true);
  }, [orderByField, order, constraints]);

  async function fetchPage(
    reset = false,
    startAfterSnapshot?: DocumentSnapshot<DocumentData>
  ) {
    try {
      setLoading(true);
      setErr(null);

      let obField: string = orderByField.current as string;
      if (expPrefix) {
        obField = "exp";
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
  const selectedSalaLabel =
    SALA_OPTIONS.find((option) => option.value === salaNum)?.label ?? salaNum;

  const activeFilters = [
    year && { label: "Año", value: year, clear: () => setYear("") },
    monthFilter && {
      label: "Mes",
      value: monthFilter,
      clear: () => setMonthFilter(""),
    },
    salaNum && {
      label: "Sala",
      value: selectedSalaLabel,
      clear: () => setSalaNum(""),
    },
    expPrefix && {
      label: "Expediente",
      value: expPrefix,
      clear: () => setExpPrefix(""),
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    clear: () => void;
  }>;

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-3xl font-bold text-slate-900">
            Decisiones TSJ
          </h1>
          <p className="text-slate-600 mt-1">
            Consulta y filtra las sentencias del Tribunal Supremo
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <input
                className="w-full pl-4 pr-10 py-2.5 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Año (ej. 2009)"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                📅
              </span>
            </div>
            <div className="relative">
              <select
                aria-label="Month"
                className="w-full pl-4 pr-10 py-2.5 border cursor-pointer border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="">Mes</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                🗓️
              </span>
            </div>
            <div className="relative">
              <select
                aria-label="Sala"
                className="w-full pl-4 pr-10 py-2.5 border cursor-pointer border-slate-300 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition appearance-none"
                value={salaNum}
                onChange={(e) => setSalaNum(e.target.value)}
              >
                <option value="">Sala</option>
                {SALA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                🏛️
              </span>
            </div>
            <button
              className="px-2.5 py-2.5 border border-slate-300 rounded-lg text-slate-900 hover:text-slate-600 font-medium hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition bg-white flex items-center justify-center gap-2"
              onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
              aria-label="toggle order direction"
            >
              <span>{order === "desc" ? "↓" : "↑"}</span>
              {order === "desc" ? "Descendente" : "Ascendente"}
            </button>
          </div>

          {activeFilters.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="text-sm text-slate-600">Filtros activos:</span>
              {activeFilters.map((filter) => (
                <span
                  key={filter.label}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
                >
                  {filter.label}: {filter.value}
                  <button
                    onClick={filter.clear}
                    className="text-white hover:text-blue-300"
                  >
                    ✕
                  </button>
                </span>
              ))}
              <button
                onClick={() => {
                  setYear("");
                  setMonthFilter("");
                  setSalaNum("");
                  setExpPrefix("");
                }}
                className="text-sm text-white hover:text-blue-300 "
              >
                Limpiar todos
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="hidden md:block overflow-x-auto max-h-[600px]">
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
                        {r.year}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r.month}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-900">
                        {r.day}
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
                        {r.exp}
                      </td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-600 max-w-xs truncate">
                        {r.id}
                      </td>
                      <td className="px-6 py-4">
                        <a
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition"
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Ver <span className="text-xs">↗</span>
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {loading && (
              <div className="divide-y divide-slate-100">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="p-4 space-y-3 animate-pulse">
                    <div className="h-4 bg-slate-200 rounded w-1/3" />
                    <div className="h-3 bg-slate-200 rounded w-2/3" />
                    <div className="h-3 bg-slate-200 rounded w-full" />
                  </div>
                ))}
              </div>
            )}

            {!loading && rows.length === 0 && (
              <div className="px-4 py-8 text-center text-slate-500">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-4xl">📋</span>
                  <span className="text-lg font-medium">Sin resultados</span>
                  <span className="text-sm">Intenta ajustar los filtros</span>
                </div>
              </div>
            )}

            {!loading && rows.length > 0 && (
              <div className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <article key={r.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Fecha
                        </p>
                        <p className="text-base font-semibold text-slate-900">
                          {r.day} de {r.month} {r.year}
                        </p>
                      </div>
                      <span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 text-slate-700 text-sm font-semibold">
                        {r.sala_num}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Sala
                        </p>
                        <p className="text-slate-900">{r.sala}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500">
                          Expediente
                        </p>
                        <p className="font-mono text-slate-700 break-all">
                          {r.exp}
                        </p>
                      </div>
                    </div>

                    <div className="text-sm">
                      <p className="text-xs uppercase text-slate-500">
                        Identificador
                      </p>
                      <p className="font-mono text-slate-600 break-all">
                        {r.id}
                      </p>
                    </div>

                    <a
                      className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition"
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver sentencia <span className="text-xs">↗</span>
                    </a>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between bg-white rounded-xl shadow-md border border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-black hover:text-blue-300 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
              disabled={!canPrev || loading}
              onClick={onPrev}
            >
              <span>←</span>
              Anterior
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-black hover:text-blue-300 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
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
