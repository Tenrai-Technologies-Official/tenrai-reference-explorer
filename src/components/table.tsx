import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { still } from "../drip.ts";

export interface Column<Row> {
  label: string;
  cell: (row: Row) => ReactNode;
}

export function Table<Row>({
  columns,
  rows,
  rowKey,
  empty,
  short = false,
  fold,
  fresh,
  glide = 0,
  hold = false,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  empty: string;
  short?: boolean;
  fold?: number;
  fresh?: ReadonlySet<string>;
  glide?: number;
  hold?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (rows.length === 0) {
    return <p className="notice">{empty}</p>;
  }
  const folded = fold !== undefined && !open && rows.length > fold;
  const table = <Rows columns={columns} rows={folded ? rows.slice(0, fold) : rows} rowKey={rowKey} short={short} fresh={fresh} glide={glide} hold={hold} />;
  if (!folded) {
    return table;
  }
  return (
    <div className="folded">
      {table}
      <div className="pager">
        <button type="button" className="page-button" onClick={() => setOpen(true)}>
          Show all {rows.length.toLocaleString("en-US")}
        </button>
      </div>
    </div>
  );
}

/** Preserve height when a live list shrinks. */
export function Steady({ children }: { children: ReactNode }) {
  const node = useRef<HTMLDivElement>(null);
  const tallest = useRef(0);
  useLayoutEffect(() => {
    const element = node.current;
    if (!element) return;
    tallest.current = Math.max(tallest.current, element.getBoundingClientRect().height);
    element.style.minHeight = `${tallest.current}px`;
  });
  return <div ref={node}>{children}</div>;
}

function Rows<Row>({
  columns,
  rows,
  rowKey,
  short,
  fresh,
  glide,
  hold,
}: {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  short: boolean;
  fresh?: ReadonlySet<string>;
  glide: number;
  hold: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [widths, setWidths] = useState<string[] | null>(null);
  const body = useRef<HTMLTableSectionElement>(null);
  const duration = useRef(glide);
  duration.current = glide;
  const first = rows[0] === undefined ? "" : rowKey(rows[0]);
  const previous = useRef(first);

  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = first;
    const tbody = body.current;
    const wrapper = wrap.current;
    const entering = rows.findIndex((row) => rowKey(row) === before);
    const top = tbody?.rows[0];
    const old = tbody?.rows[entering];
    if (!duration.current || !wrapper || !tbody || !top || !old || entering < 1 || still()) return;
    const shift = old.getBoundingClientRect().top - top.getBoundingClientRect().top;
    wrapper.style.height = `${wrapper.getBoundingClientRect().height - shift}px`;
    wrapper.classList.add("sliding");
    const moving = tbody.animate([{ transform: `translateY(${-shift}px)` }, { transform: "none" }], {
      duration: duration.current,
      easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
    });
    if (entering === 1) top.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration.current, easing: "ease-out" });
    const settle = () => {
      wrapper.classList.remove("sliding");
      wrapper.style.height = "";
    };
    moving.finished.then(settle, settle);
    return () => moving.finish();
  }, [first]);

  // Keep the first column widths while live rows update.
  useLayoutEffect(() => {
    const node = table.current;
    if (!hold || !node) return;
    const total = node.getBoundingClientRect().width;
    const cells = Array.from(node.tHead?.rows[0]?.cells ?? [], (cell) => cell.getBoundingClientRect().width);
    // The mobile layout uses cards without table headers.
    if (!total || cells.length === 0 || cells.some((width) => !width)) return;
    setWidths(cells.map((width) => `${(width / total) * 100}%`));
  }, [hold]);

  return (
    <div ref={wrap} className={short ? "table-wrap short" : "table-wrap"}>
      <table ref={table} className={widths ? "held" : undefined}>
        {widths && (
          <colgroup>
            {widths.map((width, index) => (
              <col key={index} style={{ width }} />
            ))}
          </colgroup>
        )}
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.label}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody ref={body}>
          {rows.map((row) => (
            <tr key={rowKey(row)} className={fresh?.has(rowKey(row)) ? "fresh" : undefined}>
              {columns.map((column) => (
                <td key={column.label} data-label={column.label}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
