import { BadRequestException } from '@nestjs/common';
import type { RequirementField } from '@wavehub/shared-types';

// A coach's pre-booking questions: unique keys, dropdowns need options.
export function assertBookingQuestions(fields: RequirementField[]): void {
  const keys = new Set<string>();
  for (const field of fields) {
    if (keys.has(field.key)) throw new BadRequestException(`Duplicate question key "${field.key}"`);
    keys.add(field.key);
    if (field.type === 'dropdown' && !field.options?.length) {
      throw new BadRequestException('A dropdown question needs at least one option');
    }
  }
}

const MAX_ANSWER = 1000;

// Checks the buyer's answers against the coach's questions and returns the clean map that is stored:
// only known keys, strings ≤1000 chars, required ones present, numbers numeric, dropdown values one
// of the options. Stricter than orders/requirements-validator.ts on purpose (answers are shown to
// the coach verbatim).
export function validateBookingAnswers(questions: RequirementField[], answers: Record<string, unknown> | undefined): Record<string, string> | null {
  const input = answers ?? {};
  const known = new Set(questions.map((q) => q.key));
  const unknown = Object.keys(input).filter((k) => !known.has(k));
  if (unknown.length) throw new BadRequestException(`Unknown answer "${unknown[0].slice(0, 40)}"`);
  const clean: Record<string, string> = {};
  for (const q of questions) {
    const raw = input[q.key];
    if (raw !== undefined && raw !== null && typeof raw !== 'string' && typeof raw !== 'number') {
      throw new BadRequestException(`"${q.label}" must be text`);
    }
    const value = raw === undefined || raw === null ? '' : String(raw).trim();
    if (!value) {
      if (q.required) throw new BadRequestException(`Please answer "${q.label}"`);
      continue;
    }
    if (value.length > MAX_ANSWER) throw new BadRequestException(`"${q.label}" is too long`);
    if (q.type === 'number' && !Number.isFinite(Number(value))) throw new BadRequestException(`"${q.label}" must be a number`);
    if (q.type === 'dropdown' && !(q.options ?? []).includes(value)) throw new BadRequestException(`"${q.label}" must be one of the options`);
    clean[q.key] = value;
  }
  return Object.keys(clean).length ? clean : null;
}
