import { BadRequestException } from '@nestjs/common';
import type { RequirementField } from '../listings/service-details.entity';
import { validateRequirementsAnswers } from './requirements-validator';

describe('validateRequirementsAnswers', () => {
  const schema: RequirementField[] = [
    { key: 'currentRank', label: 'Current Rank', type: 'text', required: true },
    { key: 'desiredRank', label: 'Desired Rank', type: 'text', required: true },
    { key: 'notes', label: 'Additional Notes', type: 'textarea', required: false },
  ];

  it('passes when all required fields are present', () => {
    expect(() =>
      validateRequirementsAnswers(schema, { currentRank: 'Gold', desiredRank: 'Diamond' }),
    ).not.toThrow();
  });

  it('passes when an optional field is omitted', () => {
    expect(() =>
      validateRequirementsAnswers(schema, { currentRank: 'Gold', desiredRank: 'Diamond' }),
    ).not.toThrow();
  });

  it('throws listing every missing required field when answers is undefined', () => {
    expect(() => validateRequirementsAnswers(schema, undefined)).toThrow(BadRequestException);
    try {
      validateRequirementsAnswers(schema, undefined);
    } catch (err) {
      expect((err as BadRequestException).message).toContain('Current Rank');
      expect((err as BadRequestException).message).toContain('Desired Rank');
    }
  });

  it('throws when a required field is an empty string', () => {
    expect(() =>
      validateRequirementsAnswers(schema, { currentRank: '', desiredRank: 'Diamond' }),
    ).toThrow('Current Rank');
  });

  it('passes with an empty schema regardless of answers', () => {
    expect(() => validateRequirementsAnswers([], undefined)).not.toThrow();
  });
});
