import { computeWaveRank } from './community.service';

describe('computeWaveRank', () => {
  it('starts a brand-new account at Starter, level 1', () => {
    const rank = computeWaveRank({ listings: 0, sold: 0, bought: 0, reviews: 0, recentEvents: 0 });
    expect(rank).toMatchObject({ score: 0, tierIndex: 0, name: 'Starter', nextName: 'Bronze Core', level: 1, progressToNext: 0 });
  });

  it('uses the activity weights with three-times-harder tier thresholds', () => {
    // 2*15 + 1*60 + 1*20 + 1*25 = 135 progress, + 1*75 activity = 210 -> Bronze Core (210..419)
    const rank = computeWaveRank({ listings: 2, sold: 1, bought: 1, reviews: 1, recentEvents: 1 });
    expect(rank.score).toBe(210);
    expect(rank.name).toBe('Bronze Core');
    expect(rank.level).toBe(2);
    expect(rank.progressToNext).toBe(0);
  });

  it('caps progress and activity at 1500 each and the score at 3000 (WaveHub Apex)', () => {
    const rank = computeWaveRank({ listings: 100, sold: 100, bought: 100, reviews: 100, recentEvents: 100 });
    expect(rank.score).toBe(3000);
    expect(rank.name).toBe('WaveHub Apex');
    expect(rank.nextName).toBe('WaveHub Apex');
    expect(rank.progressToNext).toBe(100);
  });
});
