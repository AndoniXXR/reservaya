import { describe, expect, it } from 'vitest';
import { layoutLanes } from './layoutLanes';

const bounds = (i: { s: number; e: number }) => ({ start: i.s, end: i.e });

describe('layoutLanes', () => {
  it('los intervalos que no se tocan ocupan todo el ancho', () => {
    const result = layoutLanes(
      [
        { s: 0, e: 30 },
        { s: 30, e: 60 },
      ],
      bounds,
    );
    expect(result.map((r) => [r.lane, r.lanes])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it('dos citas a la misma hora se reparten en dos carriles', () => {
    const result = layoutLanes(
      [
        { s: 600, e: 630 },
        { s: 600, e: 645 },
      ],
      bounds,
    );
    expect(result.map((r) => [r.lane, r.lanes])).toEqual([
      [0, 2],
      [1, 2],
    ]);
  });

  it('un solape en cadena forma un solo grupo y reutiliza carriles libres', () => {
    const result = layoutLanes(
      [
        { s: 0, e: 60 },
        { s: 30, e: 90 },
        { s: 60, e: 120 },
        { s: 200, e: 230 },
      ],
      bounds,
    );
    expect(result.map((r) => [r.lane, r.lanes])).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]);
  });
});
