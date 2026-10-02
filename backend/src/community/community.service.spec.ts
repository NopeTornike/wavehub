import { computeWaveRank } from './community.service';

describe('computeWaveRank', () => {
  it('starts a brand-new account at Starter, level 1', () => {
    const rank = computeWaveRank({ listings: 0, sold: 0, bought: 0, reviews: 0, recentEvents: 0 });
    expect(rank).toMatchObject({ score: 0, tierIndex: 0, name: 'Starter', nextName: 'Bronze Core', level: 1, progressToNext: 0 });
  });

  it('uses the prototype weights (listing 15, sold 60, bought 20, review 25, recent 75)', () => {
    // 2*15 + 1*60 + 1*20 + 1*25 = 135 progress, + 1*75 activity = 210 -> Silver Vanguard (140..219)
    const rank = computeWaveRank({ listings: 2, sold: 1, bought: 1, reviews: 1, recentEvents: 1 });
    expect(rank.score).toBe(210);
    expect(rank.name).toBe('Silver Vanguard');
    expect(rank.level).toBe(3);
    expect(rank.progressToNext).toBe(Math.round(((210 - 140) / (220 - 140)) * 100));
  });

  it('caps progress and activity at 500 each and the score at 1000 (WaveHub Apex)', () => {
    const rank = computeWaveRank({ listings: 100, sold: 100, bought: 100, reviews: 100, recentEvents: 100 });
    expect(rank.score).toBe(1000);
    expect(rank.name).toBe('WaveHub Apex');
    expect(rank.nextName).toBe('WaveHub Apex');
    expect(rank.progressToNext).toBe(100);
  });
});
