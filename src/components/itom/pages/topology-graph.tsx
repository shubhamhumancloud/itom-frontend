'use client';

import { useEffect, useRef } from 'react';
import cytoscape, { type Core, type ElementDefinition } from 'cytoscape';
// cytoscape-fcose ships JS without types — declare a thin shim inline
// rather than dragging in another @types package. The library only
// exposes a default export that we pass to cytoscape.use().
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import fcose from 'cytoscape-fcose';
import type { DiscoveryTopology } from '@/lib/api';
import { InlineLoader } from '@/components/ui/loaders';

// Register the fcose layout once. Cytoscape's `use` is idempotent.
if (typeof window !== 'undefined') {
  cytoscape.use(fcose as unknown as cytoscape.Ext);
}

/**
 * Cytoscape-based topology renderer. The graph re-layouts whenever the
 * data shape changes (new node count); we keep the same Core instance
 * across mounts so view state (zoom + pan) survives data refreshes.
 *
 * Styling rationale:
 *   - One colour per device kind. Quick visual scan ("where are the
 *     firewalls?") is more useful than fancy icons at this resolution.
 *   - Edges are kind-coloured: LLDP = solid, CDP = dashed (vendor
 *     hint), L3/IPsec are dashed-double — matches the chapter doc.
 *   - Selected node grows + glows; matched search nodes show a halo.
 */
export interface TopologyGraphProps {
  data?: DiscoveryTopology;
  loading?: boolean;
  selectedDeviceId: string | null;
  onSelect: (id: string | null) => void;
  highlightDeviceIds?: Set<string>;
}

const KIND_COLORS: Record<string, string> = {
  firewall: '#dc2626',
  router: '#2563eb',
  switch: '#0891b2',
  server: '#16a34a',
  workstation: '#7c3aed',
  printer: '#9333ea',
  camera: '#ea580c',
  iot: '#facc15',
  unknown: '#64748b',
};

const AVAIL_STROKE: Record<string, string> = {
  up: '#22c55e',
  down: '#ef4444',
  unknown: '#94a3b8',
  maintenance: '#3b82f6',
};

export function TopologyGraph({
  data,
  loading,
  selectedDeviceId,
  onSelect,
  highlightDeviceIds,
}: TopologyGraphProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  // Build / update the graph when data changes.
  useEffect(() => {
    if (!containerRef.current || !data) return;
    const elements: ElementDefinition[] = [
      ...data.nodes.map((n) => ({ data: n.data, group: 'nodes' as const })),
      ...data.edges
        // Cytoscape rejects edges whose endpoints are missing — filter
        // defensively so a stale edge from another snapshot doesn't
        // blow up the render.
        .filter((e) =>
          data.nodes.some((n) => n.data.id === e.data.source) &&
          data.nodes.some((n) => n.data.id === e.data.target),
        )
        .map((e) => ({ data: e.data, group: 'edges' as const })),
    ];

    if (cyRef.current) {
      cyRef.current.elements().remove();
      cyRef.current.add(elements);
    } else {
      cyRef.current = cytoscape({
        container: containerRef.current,
        elements,
        style: graphStyle(),
        layout: { name: 'fcose', animate: true, randomize: false } as any,
        wheelSensitivity: 0.2,
      });
      cyRef.current.on('tap', 'node', (evt) => {
        const id = evt.target.id();
        onSelect(id);
      });
      cyRef.current.on('tap', (evt) => {
        if (evt.target === cyRef.current) onSelect(null);
      });
    }
    cyRef.current.layout({ name: 'fcose', animate: true, randomize: false } as any).run();
  }, [data, onSelect]);

  // Selection + highlight.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass('selected highlighted');
    if (selectedDeviceId) {
      cy.$id(selectedDeviceId).addClass('selected');
    }
    if (highlightDeviceIds && highlightDeviceIds.size > 0) {
      cy.nodes().forEach((n) => {
        if (highlightDeviceIds.has(n.id())) n.addClass('highlighted');
      });
    }
  }, [selectedDeviceId, highlightDeviceIds]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/40">
          <InlineLoader label="Loading graph…" size="md" />
        </div>
      )}
    </div>
  );
}

// Stylesheet typing in @types/cytoscape is fussy across versions; the
// runtime is forgiving — keep the cast loose so library upgrades don't
// constantly nudge this file.
function graphStyle(): any[] {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'background-color': (ele: any) =>
          KIND_COLORS[ele.data('kind')] ?? KIND_COLORS.unknown,
        'border-color': (ele: any) =>
          AVAIL_STROKE[ele.data('availability')] ?? AVAIL_STROKE.unknown,
        'border-width': 3,
        color: '#0f172a',
        'font-size': 10,
        'text-margin-y': -6,
        'text-valign': 'bottom',
        'text-halign': 'center',
        width: 36,
        height: 36,
      } as any,
    },
    {
      selector: 'node.selected',
      style: {
        width: 52,
        height: 52,
        'border-width': 5,
        'overlay-color': '#3b82f6',
        'overlay-opacity': 0.18,
        'overlay-padding': 6,
        'z-index': 99,
      } as any,
    },
    {
      selector: 'node.highlighted',
      style: {
        'border-color': '#f59e0b',
        'border-width': 5,
      } as any,
    },
    {
      selector: 'edge',
      style: {
        width: 2,
        'line-color': '#94a3b8',
        'curve-style': 'bezier',
        'target-arrow-shape': 'none',
        opacity: 0.7,
      } as any,
    },
    {
      selector: 'edge[kind = "cdp"]',
      style: {
        'line-style': 'dashed',
        'line-color': '#0ea5e9',
      } as any,
    },
    {
      selector: 'edge[kind = "lldp"]',
      style: {
        'line-color': '#475569',
      } as any,
    },
    {
      selector: 'edge[kind = "l3_adjacency"]',
      style: {
        'line-style': 'dotted',
        'line-color': '#7c3aed',
      } as any,
    },
    {
      selector: 'edge[kind = "ipsec_tunnel"]',
      style: {
        'line-style': 'dashed',
        'line-color': '#16a34a',
        width: 3,
      } as any,
    },
  ];
}
