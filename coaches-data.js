(function () {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function addDays(days) {
    const date = new Date(today);
    date.setDate(today.getDate() + days);
    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function shortDateLabel(days) {
    const date = new Date(today);
    date.setDate(today.getDate() + days);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      weekday: 'long',
    });
  }

  window.wavehubCoaches = [
    {
      id: 'gg-pubg-mobile',
      name: 'GG',
      game: 'PUBG Mobile',
      games: ['PUBG Mobile', 'COD Mobile', 'Valorant'],
      service: 'Diamond Coach',
      rank: 'Conqueror',
      tier: 'ace',
      rating: 4.9,
      reviews: 127,
      price: 15,
      priceText: '$15 /hour',
      availability: 'now',
      language: 'EN',
      languages: ['English', 'ქართული'],
      tags: ['Fast Responder', 'Verified Coach', 'Top 1%'],
      image: 'assets/pubg-photo.jpeg',
      verified: true,
      specialty: 'PUBG Mobile Specialist',
      bio: 'Competitive player and coach with 4+ years of experience. I help players improve their skills, reach higher ranks and achieve their gaming goals.',
      about: 'I am a competitive PUBG Mobile player and full-time coach with over 4 years of experience. I reached Conqueror multiple seasons and have helped 2000+ players improve and climb the ranks. My coaching focuses on personalized training based on your gameplay, mistakes and goals.',
      quote: "Hi, I'm GG. I've been a Conqueror player for multiple seasons. In our sessions, we will focus on your gameplay, decision making, aim and positioning to help you reach your dream rank!",
      waveScore: 96,
      waveScoreLabel: 'Excellent',
      sessions: 812,
      successRate: 98,
      responseTime: '~4 min',
      videoDuration: '00:42',
      watched: 1248,
      helpful: 96,
      timezone: 'GMT+4',
      style: [
        'Personalized training plan',
        'Focus on improvement & consistency',
        'Detailed feedback & analysis',
        'Patient and friendly approach',
        'Live gameplay & real-time tips',
      ],
      expertise: [
        { label: 'Rank Push', value: 95 },
        { label: 'Game Sense', value: 92 },
        { label: 'Close Combat', value: 90 },
        { label: 'Sniper & Aim', value: 88 },
        { label: 'Strategy & IGL', value: 94 },
      ],
      achievements: [
        { icon: 'TW', value: '12', label: 'Tournament Wins' },
        { icon: 'YE', value: '4+', label: 'Years of Experience' },
        { icon: 'CS', value: '2021', label: 'Coaching Since' },
      ],
      badges: ['PRO', 'SAFE', 'TOP'],
      reviewItems: [
        { author: 'Nika', rating: 5, text: 'Very clear coaching. I fixed my rotations and reached Crown faster than expected.' },
        { author: 'Mariam', rating: 5, text: 'GG explains mistakes without pressure and gives practical drills after every session.' },
        { author: 'Dato', rating: 4.8, text: 'Great aim review and positioning tips. The session felt professional and focused.' },
      ],
      availableTimes: [
        { date: addDays(0), label: 'Today', tone: 'green', times: ['18:00', '20:00', '22:00'] },
        { date: addDays(1), label: 'Tomorrow', tone: 'gold', times: ['16:00', '19:00', '21:00'] },
        { date: addDays(2), label: shortDateLabel(2), tone: 'cyan', times: ['17:00', '18:00', '20:00'] },
      ],
    },
  ];
}());
