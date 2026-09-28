import { Fragment, type ReactNode } from "react";

export interface SlotGridRow {
  key: string;
  label: string;
  sub?: string;
  cells: ReactNode[];
}

interface SlotGridProps {
  /** Cabeceras de franja (12). Formato corto DRY: SLOT_LABELS_SHORT. */
  columns: string[];
  /** 7 filas Lun→Dom (o fechas): etiqueta + celdas ya construidas. */
  rows: SlotGridRow[];
  label?: string;
}

/** Shell visual único de matrices (días-Y × franjas-X, celdas pegaditas).
 *  El contenido y la interacción los pone el consumidor; el layout no se toca. */
export function SlotGrid({ columns, rows, label }: SlotGridProps) {
  return (
    <div
      role="img"
      aria-label={label ?? "Matriz de disponibilidad: días en filas, franjas en columnas"}
      className="grid gap-px"
      // Columnas dinámicas: excepción permitida (valor dinámico, como player-grid).
      style={{ gridTemplateColumns: `52px repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      <div />
      {columns.map((c) => (
        <div key={c} className="pb-1 text-center text-[9px] tabular-nums text-cypher-4-2-2">
          {c}
        </div>
      ))}
      {rows.map((row) => (
        <Fragment key={row.key}>
          <div className="pr-1 text-right leading-tight">
            <p className="text-[10px] font-semibold text-cypher-4-2">{row.label}</p>
            {row.sub && <p className="text-[9px] tabular-nums text-cypher-4-2-2">{row.sub}</p>}
          </div>
          {row.cells}
        </Fragment>
      ))}
    </div>
  );
}
