// Reshuffle-lifecycle golden generator. Run: node tests/generate-reshuffle-goldens.mjs
//
// PROTECTED OUTPUT — same rule as generate-goldens.mjs: re-running this once the
// file exists is a gate-weakening event needing a human decision in ROADMAP.
// This generator ADDS a second golden file; it never touches qm0-selection.json.

import { writeFileSync } from 'node:fs';
import {
  createNoiseTable,
  reshuffleFull,
  reshufflePartial,
  serializeNoiseTable,
  selectAssignment,
} from '../engine/index.mjs';
import { RESHUFFLE_CASE, buildSlots } from './reshuffle-case.mjs';

const slots = buildSlots();

const probe = (noise) =>
  RESHUFFLE_CASE.probe.map(([x, y]) => ({
    x,
    y,
    a: Array.from(
      selectAssignment({
        slots,
        x,
        y,
        T: RESHUFFLE_CASE.T,
        coupling: RESHUFFLE_CASE.coupling,
        noise,
      }),
    ),
  }));

let table = createNoiseTable({
  slotCount: RESHUFFLE_CASE.slotCount,
  cornerCount: RESHUFFLE_CASE.cornerCount,
  moduleCount: RESHUFFLE_CASE.moduleCount,
  seed: RESHUFFLE_CASE.seed,
});

const steps = [{ op: 'create', epoch: table.epoch, noise: serializeNoiseTable(table), probe: probe(table) }];

for (const step of RESHUFFLE_CASE.script) {
  table = step.op === 'full' ? reshuffleFull(table, step.seed) : reshufflePartial(table, step.d);
  steps.push({ ...step, epoch: table.epoch, noise: serializeNoiseTable(table), probe: probe(table) });
}

const out = new URL('./goldens/qm0-reshuffle.json', import.meta.url);
writeFileSync(
  out,
  `${JSON.stringify({
    _comment:
      'QM-0 §7 reshuffle lifecycle, pinned. Protected: regenerating is a gate-weakening event (CLAUDE.md §Domain).',
    spec: 'QM-0 §7, §8.2',
    generated: '2026-08-08',
    case: RESHUFFLE_CASE,
    steps,
  })}\n`,
);
console.log(`wrote ${out.pathname}: ${steps.length} steps, final epoch ${table.epoch}`);
