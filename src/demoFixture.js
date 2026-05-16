// Demo-mode fixture data. Loaded when the app is opened with ?demo=1.
// 8 songs deliberately span every state the catalog tracks so the tour
// can show off the full operational range:
//   - Live on Spotify
//   - Submitted to DistroKid, awaiting release date
//   - Checklist-complete, ready to submit
//   - In review
//   - Generated on Suno, not yet reviewed
//   - Lyrics written, not yet generated
//
// All lyrics, titles, and prompts are fictional — not real songs from the catalog.

export const DEMO_MASTERS = [
  // 1. LIVE on Spotify — every checklist item done, DistroKid filed, Spotify URL set
  {
    id: 'demo-m-1',
    title: 'Long Way Home',
    lyrics:
      "Five hundred miles of dust and prayer\nThe road don't ask me where I'm going\nJust takes me there\n\nMomma kept a candle by the window\nFor every son the road took in\nThe long way home, the long way home\nIs the only way back to your kin\n\nI traded years for crooked dreams\nNow I'm trading dreams for dirt\nAnd the only church I've found out here\nIs the steeple on the back of her shirt\n\nThe long way home, the long way home\nWhere everything you lost gets found\nThe long way home, the long way home\nIs the only road that brings me round",
    notes:
      'Written on a long drive back from Nashville. The "candle in the window" line came first; everything else built around it.',
    addedAt: '2026-03-08T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-1',
        label: 'Americana — Lead Single',
        persona: 'long-way-home',
        genre: 'Americana / Folk',
        themes: ['Journey', 'Family', 'Redemption', 'Faith'],
        mood: 'Contemplative',
        instrumentalMood: 'Acoustic',
        targetAudience: 'General',
        duration: 'Standard (2-4 min)',
        runtime: '3:42',
        bpm: '82',
        musicalKey: 'D Major',
        syncAvailable: 'Available',
        proStatus: 'Registered',
        versionSummary:
          "A road song about coming home the hard way — fingerpicked acoustic guitar, a baritone vocal that sits just behind the beat, and a chorus built for the second-to-last song of the night. Mid-tempo Americana with one foot in country.",
        albumNote:
          'Opens the record. Sets the tone before anything else gets a word in.',
        addedAt: '2026-03-08T12:00:00.000Z',
        releaseChecklist: { listened: true, coverArt: true, audioDownloaded: true },
        distrokid: {
          submittedDate: '2026-04-22',
          releaseDate: '2026-05-09',
          hyperFollowUrl: 'https://distrokid.com/hyperfollow/longwayhome/long-way-home',
          spotifyUrl: 'https://open.spotify.com/track/demo-long-way-home',
        },
        takes: [
          {
            id: 'demo-t-1',
            label: 'Lead — Take 1',
            stylePrompt: 'americana folk, fingerpicked guitar, warm baritone vocal, brushed snare, hammond organ in the chorus, dusty studio reverb',
            sunoUrl: 'https://suno.com/s/demo-long-way-home',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-03-08',
            stage: 'final',
            releaseStatus: 'released',
            isPrimary: true,
            isrc: 'USRC12500001',
            notes: '',
            addedAt: '2026-03-08T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 2. SUBMITTED to DistroKid, awaiting release date (5/23)
  {
    id: 'demo-m-2',
    title: 'Crimson Hands',
    lyrics:
      "I came in with crimson hands\nAnd you took them just the same\nWashed them down with the river running\nBetween me and my name\n\nGrace don't ask what you've done\nGrace just asks what you'll do next\nThis old preacher in my chest\nKnows the word but not the text\n\nCrimson hands, crimson hands\nMade clean before the band starts up\nCrimson hands, crimson hands\nLifting up the second cup",
    notes: 'For the chapter on the long road from violence to mercy.',
    addedAt: '2026-03-15T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-2',
        label: 'Gospel Soul',
        persona: 'crimson-gold',
        genre: 'Gospel Soul',
        themes: ['Grace', 'Redemption', 'Worship'],
        mood: 'Triumphant',
        instrumentalMood: 'Choir-led',
        targetAudience: 'Congregation',
        duration: 'Standard (2-4 min)',
        runtime: '4:08',
        bpm: '92',
        musicalKey: 'F Major',
        versionSummary:
          'Big gospel-soul arrangement built around a Hammond B3, a choir on the second chorus, and a male lead vocal that climbs into a falsetto break before the bridge. Built for Sunday-morning radio and Saturday-night clubs.',
        albumNote: 'Track three. Lands right after the doubt song, before the hope songs take over.',
        addedAt: '2026-03-15T12:00:00.000Z',
        releaseChecklist: { listened: true, coverArt: true, audioDownloaded: true },
        distrokid: {
          submittedDate: '2026-05-05',
          releaseDate: '2026-05-23',
          hyperFollowUrl: 'https://distrokid.com/hyperfollow/crimsongold/crimson-hands',
          spotifyUrl: '',
        },
        takes: [
          {
            id: 'demo-t-2',
            label: 'Master',
            stylePrompt: 'gospel soul, B3 organ, choir backing vocals, soulful male lead with falsetto break, brass section in the bridge',
            sunoUrl: 'https://suno.com/s/demo-crimson-hands',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-03-15',
            stage: 'final',
            releaseStatus: 'ready',
            isPrimary: true,
            isrc: 'USRC12500002',
            notes: '',
            addedAt: '2026-03-15T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 3. CHECKLIST READY but not yet submitted
  {
    id: 'demo-m-3',
    title: 'Glass Cathedral',
    lyrics:
      "Built it out of glass\nSo I could see the sky\nForgot that everyone could see right in\nAnd they all watched me cry\n\nI thought transparency was honesty\nTurns out it's just exposure\nLord build me walls that let the light in\nWithout the world's full closure",
    notes: 'The "transparency vs exposure" line is the whole song.',
    addedAt: '2026-04-02T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-3',
        label: 'Cinematic Build',
        persona: 'crest-fall',
        genre: 'Cinematic Pop',
        themes: ['Doubt', 'Identity', 'Surrender'],
        mood: 'Tender',
        instrumentalMood: 'Cinematic',
        targetAudience: 'Young Adults',
        duration: 'Extended (4+ min)',
        runtime: '4:31',
        bpm: '76',
        musicalKey: 'A Minor',
        versionSummary:
          "Cinematic pop with a piano-driven verse, strings entering halfway through, and a final chorus that drops to just vocal and piano before the swell. Built for film placement and the back half of a coming-of-age record.",
        albumNote: 'The breakdown song. Comes after the celebration tracks to bring the record back down.',
        addedAt: '2026-04-02T12:00:00.000Z',
        releaseChecklist: { listened: true, coverArt: true, audioDownloaded: true },
        distrokid: { submittedDate: '', releaseDate: '', hyperFollowUrl: '', spotifyUrl: '' },
        takes: [
          {
            id: 'demo-t-3',
            label: 'Take 1',
            stylePrompt: 'cinematic pop, piano-driven, building strings, breathy female lead vocal, dropout to just vocal and piano before the final chorus',
            sunoUrl: 'https://suno.com/s/demo-glass-cathedral',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-04-02',
            stage: 'final',
            releaseStatus: 'ready',
            isPrimary: true,
            isrc: '',
            notes: '',
            addedAt: '2026-04-02T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 4. IN REVIEW — partial checklist, still iterating
  {
    id: 'demo-m-4',
    title: 'Streets of Mercy',
    lyrics:
      "Same block where I learned to fight\nNow I'm learning how to forgive\nStreets of mercy ain't on the map\nIt's the choice to let your enemy live\n\nGrace got a baseline\nSounds a lot like home\nStreets of mercy got my back\nAnd I'm never walking alone",
    notes: '',
    addedAt: '2026-04-12T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-4',
        label: 'Boom Bap',
        persona: 'chain-verse',
        genre: 'Hip Hop',
        themes: ['Grace', 'Justice', 'Identity'],
        mood: 'Defiant',
        instrumentalMood: 'Rhythm-heavy',
        targetAudience: 'Young Adults',
        duration: 'Standard (2-4 min)',
        runtime: '3:18',
        bpm: '94',
        musicalKey: 'G Minor',
        versionSummary:
          "Boom-bap hip hop with a soul sample on the chorus and a tight pocket drum loop. Verses go hard on autobiographical narrative; the hook lifts. The kind of track that earns trust on a first listen.",
        albumNote: '',
        addedAt: '2026-04-12T12:00:00.000Z',
        releaseChecklist: { listened: true, coverArt: false, audioDownloaded: false },
        distrokid: { submittedDate: '', releaseDate: '', hyperFollowUrl: '', spotifyUrl: '' },
        takes: [
          {
            id: 'demo-t-4',
            label: 'Mix A',
            stylePrompt: 'boom bap hip hop, soul sample hook, tight drum loop, gritty male MC, vinyl crackle texture',
            sunoUrl: 'https://suno.com/s/demo-streets-of-mercy',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-04-12',
            stage: 'reviewing',
            releaseStatus: 'draft',
            isPrimary: true,
            isrc: '',
            notes: '',
            addedAt: '2026-04-12T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 5. CHECKLIST READY, DistroKid SUBMITTED with future release date
  {
    id: 'demo-m-5',
    title: 'Light On The Hill',
    lyrics:
      "There's a light on the hill that don't go out\nWhen the night gets long and the bills come due\nThere's a light on the hill that don't go out\nAnd it shines because of you\n\nWe sing because the silence costs too much\nWe lift our hands because they were made to lift\nWe walk by faith and not by sight\nBecause sight is the smaller gift",
    notes: 'Congregational. Built to be sung by the whole room.',
    addedAt: '2026-04-19T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-5',
        label: 'Choir Anthem',
        persona: 'first-light',
        genre: 'Gospel',
        themes: ['Faith', 'Hope', 'Community', 'Worship'],
        mood: 'Triumphant',
        instrumentalMood: 'Choir-led',
        targetAudience: 'Congregation',
        duration: 'Extended (4+ min)',
        runtime: '4:52',
        bpm: '78',
        musicalKey: 'G Major',
        versionSummary:
          'Full gospel choir arrangement with a piano-and-organ foundation, handclaps from the second verse, and a bridge that modulates a whole step up before the final chorus. Designed for live worship and Sunday-morning radio.',
        albumNote: 'Closer. Album-end singalong.',
        addedAt: '2026-04-19T12:00:00.000Z',
        releaseChecklist: { listened: true, coverArt: true, audioDownloaded: true },
        distrokid: {
          submittedDate: '2026-05-10',
          releaseDate: '2026-05-30',
          hyperFollowUrl: 'https://distrokid.com/hyperfollow/firstlight/light-on-the-hill',
          spotifyUrl: '',
        },
        takes: [
          {
            id: 'demo-t-5',
            label: 'Choir Master',
            stylePrompt: 'gospel choir, piano and organ foundation, handclaps, key change before final chorus, congregational singalong feel',
            sunoUrl: 'https://suno.com/s/demo-light-on-the-hill',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-04-19',
            stage: 'final',
            releaseStatus: 'ready',
            isPrimary: true,
            isrc: 'USRC12500005',
            notes: '',
            addedAt: '2026-04-19T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 6. GENERATED stage — Suno URL exists but not yet reviewed
  {
    id: 'demo-m-6',
    title: 'Ash & Embers',
    lyrics:
      "I came up out of ash and embers\nWith the smoke still on my tongue\nEvery scar a story\nEvery story a song\n\nThey said the fire would unmake me\nIt did exactly that\nAnd then it made me over\nFrom the place I crawled back",
    notes: '',
    addedAt: '2026-05-01T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-6',
        label: 'Heavy Rock',
        persona: 'stone-prophet',
        genre: 'Heavy Metal',
        themes: ['Spiritual Warfare', 'Perseverance', 'Resurrection'],
        mood: 'Defiant',
        instrumentalMood: 'Driving',
        targetAudience: 'Young Adults',
        duration: 'Standard (2-4 min)',
        runtime: '3:55',
        bpm: '124',
        musicalKey: 'E Minor',
        versionSummary:
          'Drop-tuned hard rock with a clean intro and a full-band entry at the first verse. Vocal sits clean over the chorus, doubled and screamed on the bridge.',
        albumNote: '',
        addedAt: '2026-05-01T12:00:00.000Z',
        releaseChecklist: { listened: false, coverArt: false, audioDownloaded: false },
        distrokid: { submittedDate: '', releaseDate: '', hyperFollowUrl: '', spotifyUrl: '' },
        takes: [
          {
            id: 'demo-t-6',
            label: 'Generated',
            stylePrompt: 'heavy metal, drop-tuned guitar, clean intro to full band entry, screamed bridge vocals, hard-hitting drums',
            sunoUrl: 'https://suno.com/s/demo-ash-embers',
            sunoVersion: 'v4',
            sunoCreatedAt: '2026-05-01',
            stage: 'generated',
            releaseStatus: 'draft',
            isPrimary: true,
            isrc: '',
            notes: '',
            addedAt: '2026-05-01T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 7. PROMPT-READY — has style prompt but no Suno URL yet
  {
    id: 'demo-m-7',
    title: 'The Quieter Side',
    lyrics:
      "I used to think the quieter side\nWas the side that lost the fight\nNow I know it's the side that stayed up\nAnd held the candle through the night\n\nLoud is what you do when you don't know what to say\nQuiet is what you choose when the words are in the way",
    notes: 'For the loss / grief chapter.',
    addedAt: '2026-05-08T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-7',
        label: 'Spoken Word',
        persona: 'true-north',
        genre: 'Acoustic / Spoken Word',
        themes: ['Loss', 'Healing', 'Surrender'],
        mood: 'Tender',
        instrumentalMood: 'Sparse',
        targetAudience: 'General',
        duration: 'Standard (2-4 min)',
        runtime: '',
        bpm: '',
        musicalKey: '',
        versionSummary:
          'Sparse acoustic guitar and a near-whispered vocal. Reads more like a letter than a song. Built for the back half of a quiet record.',
        albumNote: 'Late track. The exhale.',
        addedAt: '2026-05-08T12:00:00.000Z',
        releaseChecklist: { listened: false, coverArt: false, audioDownloaded: false },
        distrokid: { submittedDate: '', releaseDate: '', hyperFollowUrl: '', spotifyUrl: '' },
        takes: [
          {
            id: 'demo-t-7',
            label: 'Take 1',
            stylePrompt: 'sparse acoustic guitar, near-whispered male vocal, letter-like delivery, intimate room sound',
            sunoUrl: '',
            sunoVersion: '',
            sunoCreatedAt: '',
            stage: 'prompt',
            releaseStatus: 'draft',
            isPrimary: true,
            isrc: '',
            notes: '',
            addedAt: '2026-05-08T12:00:00.000Z',
          },
        ],
      },
    ],
  },

  // 8. LYRICS-ONLY — newest song, just lyrics written
  {
    id: 'demo-m-8',
    title: 'Sunday at the Diner',
    lyrics:
      "The waitress knows my order\nBefore I sit down\nAnd I know hers too\nBecause that's how it is in this town\n\nThere's a kind of love\nThat doesn't ask for much\nA second cup of coffee\nAnd a knowing kind of touch",
    notes: 'Saturday afternoon. Bella Notte vibes.',
    addedAt: '2026-05-14T12:00:00.000Z',
    versions: [
      {
        id: 'demo-v-8',
        label: 'Italian Crooner',
        persona: 'bella-notte',
        genre: 'Italian / Orchestral Ballad',
        themes: ['Love', 'Celebration', 'Community'],
        mood: 'Tender',
        instrumentalMood: 'Orchestral',
        targetAudience: 'General',
        duration: 'Standard (2-4 min)',
        runtime: '',
        bpm: '',
        musicalKey: '',
        versionSummary:
          'Bilingual Italian-English ballad. Strings, brushed snare, classic crooner phrasing — for the slow-dance moment at the end of the night.',
        albumNote: '',
        addedAt: '2026-05-14T12:00:00.000Z',
        releaseChecklist: { listened: false, coverArt: false, audioDownloaded: false },
        distrokid: { submittedDate: '', releaseDate: '', hyperFollowUrl: '', spotifyUrl: '' },
        takes: [
          {
            id: 'demo-t-8',
            label: 'Idea',
            stylePrompt: '',
            sunoUrl: '',
            sunoVersion: '',
            sunoCreatedAt: '',
            stage: 'idea',
            releaseStatus: 'draft',
            isPrimary: true,
            isrc: '',
            notes: '',
            addedAt: '2026-05-14T12:00:00.000Z',
          },
        ],
      },
    ],
  },
];
