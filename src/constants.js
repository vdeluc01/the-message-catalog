export const CLIENT_ID    = '570203299840-k1s7vgnpbbilj627tfld8q0olmgsqebh.apps.googleusercontent.com';
export const REDIRECT_URI = 'https://the-message-catalog.netlify.app/auth/callback';
export const SCOPES       = 'https://www.googleapis.com/auth/drive.file';
export const CATALOG_FILENAME = 'the-message-catalog.json';
export const PERSONAS_KEY = 'the-message-personas-v1';
export const APIKEY_KEY   = 'tmsg-apikey';
export const DATA_KEY     = 'tmsg-catalog-v5';
export const DATA_KEY_V4  = 'tmsg-catalog-v4';
export const FID_KEY      = 'tmsg-gdrive-fid';
export const TOMBSTONES_KEY = 'tmsg-deleted-master-ids';
export const VAULT_STAMP_KEY = 'tmsg-vault-last-stamp';

export const PERSONA_COLORS = ['#C8942A','#C84A4A','#5B8DD9','#8B5CF6','#D97706','#6B7280','#34D399','#60A5FA','#FCD34D','#F87171','#A855F7','#E67E22'];

export const DEFAULT_PERSONAS = [
  { id:'long-way-home',   name:'Long Way Home',     genre:'Country / Folk',         color:'#C8942A', desc:'Americana and folk storytelling rooted in the open road, dusty backroads, and the quiet ache of home — acoustic guitars, honest vocals, and narratives that find the sacred in the ordinary, the strength in the struggle, and the beauty in the long way around' },
  { id:'crimson-gold',    name:'Crimson & Gold',    genre:'Soul / R&B',             color:'#C84A4A', desc:'Gospel-rooted soul and R&B with the fire of faith and the warmth of community — rich vocal layering, organ-driven grooves, and lyrics that carry the weight of spiritual longing and praise, bridging the sacred and the street with dignity and grace' },
  { id:'crest-fall',      name:'Crest & Fall',      genre:'Cinematic Pop',          color:'#5B8DD9', desc:'Cinematic anthemic pop built on emotional architecture — sweeping arrangements, soaring melodies, and reflective lyrics that chart the full arc of human experience from breakdown to breakthrough, scored for the moments that define us' },
  { id:'chain-verse',     name:'Chain & Verse',     genre:'Rap / Hip Hop',          color:'#8B5CF6', desc:'Hip hop and rap with the intensity of spoken word and the precision of street-level storytelling — hard beats, layered verses, and unfiltered truth-telling that confronts injustice, wrestles with identity, and finds redemption in the rhythm' },
  { id:'new-vintage',     name:'New Vintage',       genre:'Swing / Crooner',        color:'#D97706', desc:'Classic big band swing and velvet-voiced crooner artistry reimagined for a new era — warm brass, brushed percussion, and sophisticated lyricism delivered with timeless charm and the kind of easy confidence that never goes out of style' },
  { id:'stone-prophet',   name:'Stone Prophet',     genre:'Heavy Metal',            color:'#6B7280', desc:'Heavy metal and hard rock forged in spiritual fire — crushing riffs, dynamic surges, and lyrics that name the darkness head-on, waging war with melody and power in the tradition of bands who believed that heavy music could carry transcendent weight' },
  { id:'between-lines',   name:'Between the Lines', genre:'Indie / Alt',            color:'#34D399', desc:'Indie and alternative art rooted in the underground — unconventional arrangements, introspective lyricism, and a restless creative spirit that refuses easy categories, finding truth in texture, silence, and the spaces between the expected' },
  { id:'true-north',      name:'True North',        genre:'Acoustic / Spoken Word', color:'#60A5FA', desc:'Stripped-to-the-bone acoustic and spoken word — just a voice, a guitar, and the unvarnished truth. Intimate, prophetic, and unflinching in its vulnerability, these are songs that sound like letters written in the dark and read aloud with nothing to hide' },
  { id:'first-light',     name:'First Light',       genre:'Gospel',                 color:'#FCD34D', desc:'Pure, unashamed gospel — massed voices, thundering choirs, piano runs, and handclaps that fill sanctuaries and living rooms alike with praise. Congregational at its core, these songs are built to be sung together, a communal cry of faith rising as one' },
  { id:'broken-crown',    name:'Broken Crown',      genre:'Classic Rock',           color:'#F87171', desc:'Classic rock with a spiritual spine — drawing from the full Van Halen to Pink Floyd range, these are arena-ready anthems and deep-cut journeys built on electric guitars, powerful drums, and lyrics that grapple with faith, doubt, and the search for meaning with every riff' },
  { id:'soul-street',     name:'Soul Street',        genre:'Motown / 60s Pop',       color:'#E67E22', desc:'Motown grooves and 60s pop sensibility, piano-driven melodies, lush vocal harmonies, socially conscious storytelling rooted in human dignity and hope' },
  { id:'red-dirt-revival',name:'Red Dirt Revival',   genre:'Country Rock',           color:'#B45309', desc:'Modern country and country-rock fusion with raspy vocals, electric guitars, stadium-ready Southern production, faith-forward lyrics built for radio and arena audiences' },
  { id:'shadow-silk',     name:'Shadow & Silk',      genre:'1960s Spy Pop',          color:'#7C3AED', desc:'Groovy 1960s-inspired cinematic sound blending spy-film brass, lush orchestration, male-female vocal interplay, and progressive soul — think James Bond meets Shirley Bassey' },
  { id:'muddy-road',      name:'Muddy Road',         genre:'Blues',                  color:'#78350F', desc:'Delta and Chicago blues with raw guitar work, confessional lyricism, and the aching weight of regret — songs that bleed truth one note at a time' },
  { id:'deep-current',    name:'Deep Current',       genre:'Deep House / Soul',      color:'#0E7490', desc:'Soulful deep house with emotive vocals, blending electronic warmth with raw human confession — intimate, groove-driven, and emotionally resonant' },
  { id:'open-harmony',    name:'Open Harmony',       genre:'A Cappella / Choral',    color:'#BE185D', desc:'Pure vocal artistry through four-part harmony and choral arrangement — intimate yet expansive, sacred yet universally human, unaccompanied voices carrying the full emotional weight' },
  { id:'sol-urbano',      name:'Sol Urbano',         genre:'Latin / Reggaeton',      color:'#DC2626', desc:'Spanish-language urban Latin artist blending reggaeton rhythms with heartfelt poetic lyricism — capturing street-level emotion, hope, and human connection through a Latin lens' },
  { id:'bella-notte',     name:'Bella Notte',        genre:'Italian / Orchestral Ballad', color:'#9D174D', desc:'Romantic, bilingual orchestral ballads weaving between Italian and English — European elegance with universal emotional storytelling rooted in love, memory, and longing, in the tradition of Dean Martin' },
  { id:'sunlit-simple',   name:'Sunlit & Simple',    genre:"Children's / Family",   color:'#65A30D', desc:'Bright wholesome acoustic pop for kids and families — ukulele-driven melodies, handclaps, innocent storytelling, and sweet vocals celebrating everyday childhood moments with warmth and charm' },
  { id:'glorious-ruins',  name:'Glorious Ruins',     genre:'Cinematic Indie Folk',   color:'#0F766E', desc:'Orchestral indie folk rock with cinematic builds, literary lyricism, and raw theological honesty — bridging Mumford & Sons intensity with film score grandeur, rooted in faith, doubt, and resurrection' },
  { id:'blue-note-prophet',name:'Blue Note Prophet', genre:'Jazz / Spoken Word',     color:'#1D4ED8', desc:'Jazz-infused spoken word blending improvisational cool with prophetic lyricism — beat poetry over brushed snares, walking bass lines, and smoky introspection rooted in spiritual questioning' },
];

export const STAGES = [
  { id:'idea',      label:'Idea',          icon:'💡', color:'#6B7280' },
  { id:'lyrics',    label:'Lyrics Written',icon:'✍️',  color:'#8B5CF6' },
  { id:'prompt',    label:'Prompt Ready',  icon:'🎛',  color:'#D97706' },
  { id:'generated', label:'Suno Generated',icon:'🎵',  color:'#5B8DD9' },
  { id:'reviewing', label:'Reviewing',     icon:'🔍',  color:'#C8942A' },
  { id:'final',     label:'Final',         icon:'✅',  color:'#34D399' },
];

export const RELEASE_STATUSES = [
  { id:'draft',    label:'Draft',               color:'#bbb' },
  { id:'ready',    label:'Ready to Release',    color:'#C8942A' },
  { id:'released', label:'Released on Spotify', color:'#34D399' },
];


export const THEMES = [
  'Faith','Hope','Redemption','Love','Worship','Justice','Identity',
  'Journey','Loss','Celebration','Doubt','Community','Spiritual Warfare',
  'Grace','Healing','Purpose','Surrender','Family','Perseverance','Resurrection'
];

export const VIEWS = ['By Persona','By Status','By Audience','By Theme','By Stage','Alphabetical','Release Calendar','EPs','Personas'];

export const EP_STATUSES = [
  { id:'upcoming',  label:'Upcoming',   color:'#5B8DD9' },
  { id:'submitted', label:'Submitted',  color:'#C8942A' },
  { id:'live',      label:'Live',       color:'#34D399' },
];

export const PITCH_PLATFORMS = [
  { id:'submithub',         label:'SubmitHub',         color:'#A855F7', usesCredits:true  },
  { id:'spotify-editorial', label:'Spotify Editorial', color:'#34D399', usesCredits:false },
  { id:'podcast',           label:'Podcast',           color:'#5B8DD9', usesCredits:false },
  { id:'press',             label:'Press',             color:'#C8942A', usesCredits:false },
  { id:'other',             label:'Other',             color:'#888',    usesCredits:false },
];

export const PITCH_RESULTS = [
  { id:'pending',     label:'Pending',     color:'#C8942A' },
  { id:'accepted',    label:'Accepted',    color:'#34D399' },
  { id:'rejected',    label:'Rejected',    color:'#C84A4A' },
  { id:'no-response', label:'No Response', color:'#666'    },
  { id:'booked',      label:'Booked',      color:'#34D399' },
];
