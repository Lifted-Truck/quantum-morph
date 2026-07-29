// Golden-vector generator. Run: node tests/generate-goldens.mjs
//
// PROTECTED OUTPUT. `tests/goldens/` is a protected path (CLAUDE.md §Domain):
// re-running this after the goldens exist is a gate-weakening event and needs a
// human decision recorded in ROADMAP first. Goldens can only ever encode the
// behaviour of the code that produced them — their value is catching FUTURE
// drift, not proving present correctness. The non-circular checks live in
// selection.test.mjs (census vs. analytic weights, tie-breaking, monotonicity).

import { writeFileSync } from 'node:fs';
import {
  createNoiseTable,
  reshufflePartial,
  serializeNoiseTable,
  selectAssignment,
  MODE,
  CONTINUOUS_POLICY,
} from '../engine/index.mjs';
import { GOLDEN_CASE, buildSlots } from './golden-case.mjs';

const table0 = createNoiseTable({
  slotCount: GOLDEN_CASE.slotCount,
  cornerCount: GOLDEN_CASE.cornerCount,
  moduleCount: GOLDEN_CASE.moduleCount,
  seed: GOLDEN_CASE.seed,
});
const table1 = reshufflePartial(table0, GOLDEN_CASE.reshuffleDepth);
const slots = buildSlots();

const record = (noise) => {
  const rows = [];
  for (const [T, c] of GOLDEN_CASE.settings) {
    for (const [x, y] of GOLDEN_CASE.grid) {
      rows.push({
        T,
        c,
        x,
        y,
        a: Array.from(
          selectAssignment({
            slots,
            x,
            y,
            T,
            coupling: c,
            noise,
            continuousPolicy: CONTINUOUS_POLICY.GRADUAL,
          }),
        ),
      });
    }
  }
  return rows;
};

const golden = {
  _comment:
    'QM-0 pinned assignment vectors. Protected: regenerating is a gate-weakening event (CLAUDE.md §Domain).',
  spec: 'QM-0 §2–§5, §7',
  generated: '2026-07-24',
  case: GOLDEN_CASE,
  epochs: [
    { epoch: 0, noise: serializeNoiseTable(table0), rows: record(table0) },
    { epoch: 1, noise: serializeNoiseTable(table1), rows: record(table1) },
  ],
};

const out = new URL('./goldens/qm0-selection.json', import.meta.url);
writeFileSync(out, `${JSON.stringify(golden)}\n`);
console.log(
  `wrote ${out.pathname}: ${golden.epochs.length} epochs × ${golden.epochs[0].rows.length} rows`,
);
