'use client';

/*
 * Fills the table with empty rows so its height stays stable when the
 * current page has fewer rows than the page size. Mirrors the helper
 * used in the tenant-app users page.
 */
export function TablePadRows({
  currentRows,
  minRows = 10,
  colSpan,
  rowHeightClassName = 'h-[48px]',
}: {
  currentRows: number;
  minRows?: number;
  colSpan: number;
  rowHeightClassName?: string;
}) {
  const missing = Math.max(0, minRows - currentRows);
  if (missing === 0) return null;

  return (
    <>
      {Array.from({ length: missing }).map((_, i) => (
        <tr
          key={`pad-row-${i}`}
          aria-hidden="true"
          className="pointer-events-none"
        >
          <td colSpan={colSpan} className={`px-4 ${rowHeightClassName}`}>
            &nbsp;
          </td>
        </tr>
      ))}
    </>
  );
}
