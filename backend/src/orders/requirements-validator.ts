import { BadRequestException } from '@nestjs/common';
import type { RequirementField } from '../listings/service-details.entity';

// Validates a buyer's submitted answers against a service listing's seller-defined requirements
// form at purchase time. Only checks presence/non-emptiness of required fields — field-type-
// specific validation (e.g. a 'number' field actually being numeric, a 'dropdown' value being one
// of its options) is deliberately not enforced here yet; add it if sellers report bad data, don't
// pre-build it speculatively.
export function validateRequirementsAnswers(
  schema: RequirementField[],
  answers: Record<string, unknown> | undefined,
): void {
  const missing = schema
    .filter((field) => field.required)
    .filter((field) => {
      const value = answers?.[field.key];
      return value === undefined || value === null || value === '';
    })
    .map((field) => field.label);

  if (missing.length > 0) {
    throw new BadRequestException(`Missing required fields: ${missing.join(', ')}`);
  }
}
