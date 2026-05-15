"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * ITOM table primitives — match the tenant-app users-page design:
 *
 *   • Wrapped in Card by the consumer (no row dividers on the table itself)
 *   • Header has a 2px bottom border to separate it from the body — no
 *     background tint, no row dividers anywhere else
 *   • Header text is 12px / bold / uppercase / wide tracking / muted ink
 *   • Header is sticky-by-default (sticky top-0 z-10 bg-background), so
 *     when the table is inside a scroll container the header stays
 *     visible while the body scrolls underneath
 *   • Cells and header cells are pinned to 48px row height
 *   • No per-row border-b — relies on the header bar + hover state for
 *     scannability (mirrors the tenant-app users table)
 *
 * The outer <div data-slot="table-container"> intentionally does NOT
 * create a scroll context (no overflow-x-auto). If the consumer needs
 * an internal scroll area, they wrap <Table> in their own
 * `overflow-y-auto` container — then the sticky thead resolves to that
 * container as its scroll ancestor (instead of being trapped inside an
 * inner wrapper). Wide tables that need horizontal scroll should be
 * wrapped by the consumer too.
 *
 * Consumer pattern:
 *
 *   <Card>
 *     <Table>
 *       <TableHeader>
 *         <TableRow>
 *           <TableHead>Col</TableHead>
 *           ...
 *         </TableRow>
 *       </TableHeader>
 *       <TableBody>
 *         ...
 *         <TablePadRows currentRows={visible.length} minRows={pageSize} colSpan={N} />
 *       </TableBody>
 *     </Table>
 *   </Card>
 *
 * Internal-scroll pattern (sticky header sticks to top of the bordered box):
 *
 *   <div className="max-h-[480px] overflow-y-auto rounded-md border border-border/60">
 *     <Table>...</Table>
 *   </div>
 */

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full">
      <table
        data-slot="table"
        className={cn(
          // [&_*]:border-0 matches the tenant-app rule that strips all
          // intra-table borders so only the header keeps a divider. The
          // header's own !border-b-2 wins over [&_th]:border-0 via
          // !important.
          "w-full caption-bottom text-sm",
          "[&_tr]:border-0 [&_td]:border-0 [&_th]:border-0",
          "[&_td]:h-[48px] [&_th]:h-[54px]",
          className
        )}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        // Sticky-by-default: the header stays pinned to the top of the
        // nearest scroll ancestor. bg-background gives the header an
        // opaque backdrop so body rows scroll underneath cleanly.
        "sticky top-0 z-10 bg-background",
        "[&_tr]:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // No bg tint on the header row — separation comes from the
        // TableHead bottom border alone. Body rows get a hover state.
        "transition-colors data-[state=selected]:bg-muted",
        "[tbody_&]:hover:bg-muted/40 [tbody_&]:has-aria-expanded:bg-muted/40",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        // Tenant-app header spec: 12px bold uppercase wide-tracked, muted
        // ink, 2px bottom border, 48px tall (enforced by Table-level
        // rule). !border-b-2 / !border-border use !important to win over
        // the table-level `[&_th]:border-0` reset — same trick the
        // tenant users-page table uses.
        "px-[20px] py-[12px] text-left align-middle whitespace-nowrap",
        "text-[13px] font-bold leading-[24px] text-[#474747]",
        "!border-b-2 !border-border",
        "[&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        // 16px horizontal padding to match the head; vertical rhythm is
        // controlled by the table-level h-[48px] rule.
        "px-4 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
