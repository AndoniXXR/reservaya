export interface LaneItem<T> {
  item: T;
  /** Carril (columna) dentro de su grupo de solapadas */
  lane: number;
  /** Número total de carriles del grupo: el ancho es 1/lanes */
  lanes: number;
}

/**
 * Reparte intervalos que se solapan en carriles paralelos (como un calendario).
 * Los intervalos que no se tocan comparten el carril 0 y ocupan todo el ancho.
 */
export function layoutLanes<T>(
  items: T[],
  bounds: (item: T) => { start: number; end: number },
): LaneItem<T>[] {
  const sorted = [...items].sort((a, b) => bounds(a).start - bounds(b).start);
  const result: LaneItem<T>[] = [];
  let group: { entries: LaneItem<T>[]; laneEnds: number[]; end: number } | null = null;

  for (const item of sorted) {
    const { start, end } = bounds(item);
    if (!group || start >= group.end) {
      // Nuevo grupo: cerrar el anterior fijando el número total de carriles
      if (group) for (const entry of group.entries) entry.lanes = group.laneEnds.length;
      group = { entries: [], laneEnds: [], end };
    }
    let lane = group.laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = group.laneEnds.length;
      group.laneEnds.push(end);
    } else {
      group.laneEnds[lane] = end;
    }
    group.end = Math.max(group.end, end);
    const entry = { item, lane, lanes: 1 };
    group.entries.push(entry);
    result.push(entry);
  }
  if (group) for (const entry of group.entries) entry.lanes = group.laneEnds.length;
  return result;
}
