/**
 * Arabic localization.
 *
 * Footballdata.io accepts a `lang` parameter but still returns English content,
 * so every Arabic string here is ours. Names with no entry fall back to the
 * provider's original spelling rather than a machine transliteration, which
 * keeps the UI honest instead of inventing bad Arabic.
 */

import { matchesLeagueId, POPULAR_LEAGUES } from "./config";
import { countryNameArOrNull } from "./countries";

export const t = {
  appName: "جدول",
  appTagline: "نتائج مباشرة",
  /**
   * Logo alt text. A real description, not a keyword dump — it names the brand
   * in all three spellings the site is known by (jdwal / jdwel / jadwal) and the
   * core Arabic term, which is what an alt attribute legitimately contributes to
   * search. Keyword-stuffing here would hurt both accessibility and ranking.
   */
  logoAlt: "jdwal جدول - جدول مباريات اليوم ونتائج مباشرة (jdwel, jadwal)",

  allMatches: "جميع المباريات",
  search: "بحث",
  searchPlaceholder: "ابحث عن فريق أو مسابقة",
  clearSearch: "إلغاء البحث",

  yesterday: "أمس",
  today: "اليوم",
  tomorrow: "غداً",
  previousDay: "اليوم السابق",
  nextDay: "اليوم التالي",

  filterAll: "الكل",
  filterTop: "الأهم",

  live: "مباشر",
  liveCount: "مباشر",
  finished: "انتهت",
  /** Provider hasn't published the result yet; never show a fabricated 0-0. */
  awaitingResult: "بانتظار النتيجة",
  /** Short form for the fixed-width centre cell in a fixture row. */
  awaitingResultShort: "بانتظار",
  halfTime: "بين الشوطين",
  scheduled: "لم تبدأ",
  postponed: "مؤجلة",
  cancelled: "ملغاة",

  noMatches: "لا توجد مباريات في هذا اليوم",
  noLiveMatches: "لا توجد مباريات مباشرة الآن",
  noMatchesTop: "لا توجد مباريات في المسابقات الكبرى في هذا اليوم",
  noResults: "لا توجد نتائج مطابقة",

  navMatches: "جدول مباريات",
  navTeams: "الفرق",
  navScorers: "الهدافون",
  navLeagues: "الدوريات",
  scorersHint: "اختر مسابقة لعرض هدافيها",

  back: "رجوع",
  matchInfo: "معلومات المباراة",
  matchNotFound: "المباراة غير متاحة",
  matchNotFoundHint: "قد يكون الرابط قديماً. عُد إلى قائمة المباريات وحدّث الصفحة.",
  competition: "المسابقة",
  date: "التاريخ",
  kickoff: "توقيت البداية",
  venue: "الملعب",
  referee: "الحكم",
  stage: "الدور",
  channel: "القناة الناقلة",
  /**
   * Used when only the rights-holding NETWORK is known, not the specific channel
   * — the normal case for a competition whose matches kick off in parallel. The
   * label has to change with the value, or "beIN SPORTS" under "القناة الناقلة"
   * reads as a channel name and the distinction is lost.
   */
  network: "الشبكة الناقلة",
  commentator: "المعلق",
  attendance: "الحضور",

  stats: "الإحصائيات",
  overview: "نظرة عامة",
  goals: "الأهداف",
  assist: "صناعة",
  ownGoal: "هدف عكسي",
  penalty: "ركلة جزاء",
  possession: "الاستحواذ",
  shotsTotal: "التسديدات",
  shotsOnTarget: "تسديدات على الهدف",
  yellowCards: "بطاقات صفراء",
  redCards: "بطاقات حمراء",
  corners: "الركنيات",
  fouls: "الأخطاء",
  offsides: "التسلل",
  noStats: "لا تتوفر إحصائيات لهذه المباراة",

  upcomingFixtures: "المباريات القادمة",
  recentResults: "النتائج الأخيرة",
  results: "النتائج",
  matches: "المباريات",
  knockoutBracket: "الأدوار الإقصائية",
  noUpcoming: "لا توجد مباريات قادمة",
  noRecent: "لا توجد نتائج سابقة",
  /** Tabs on the league page. */
  tabStandings: "الترتيب",
  tabMatches: "المباريات",
  seasonLabel: "الموسم",
  seasonScrapeNote:
    "مصدر البيانات الحالي يعرض ترتيب الموسم الجاري فقط. اختيار موسم آخر متاح عند تفعيل مصدر يدعم المواسم السابقة.",
  founded: "سنة التأسيس",
  position: "المركز",

  standings: "جدول الترتيب",
  standingsSeason: "الموسم",
  standingsLeaguePhase: "دور المجموعات",
  standingsComputedNote:
    "يُحسب هذا الجدول من نتائج مباريات دور المجموعات فقط، ولا يشمل الأدوار التمهيدية. الفرق التي لم تلعب بعد تظهر بصفر.",
  standingsNotStarted: "لم تبدأ مباريات دور المجموعات بعد",
  standingsFixturesPending:
    "لم يتم إعلان مباريات دور المجموعات بعد. سيظهر الجدول تلقائياً عند توفر المباريات، ولا تُحتسب الأدوار التمهيدية فيه.",
  colPosition: "#",
  colTeam: "الفريق",
  colPlayed: "لعب",
  colWins: "فاز",
  colDraws: "تعادل",
  colLosses: "خسر",
  colGoalsFor: "له",
  colGoalsAgainst: "عليه",
  colGoalDiff: "+/-",
  colPoints: "نقاط",
  noStandings: "لا يتوفر جدول ترتيب لهذه المسابقة",
  viewStandings: "جدول الترتيب",
  viewTeams: "الفرق",
  scorersUnavailable: "ترتيب الهدافين وصناع الأهداف",
  scorersUnavailableWhy:
    "لا يوفر مزود البيانات جدول هدافين جاهزاً لكل مسابقة. تظهر أهداف كل مباراة وصنّاعها داخل صفحة تفاصيل المباراة.",
  topScorers: "ترتيب الهدافين",
  noScorers: "لا يتوفر ترتيب هدافين لهذه المسابقة بعد",
  colPlayer: "اللاعب",
  colGoals: "أهداف",
  colAssists: "صناعة",
  colAppearances: "مباريات",
  /** Group or phase heading inside a multi-table competition. */
  standingsGroup: "المجموعة",

  teamsTitle: "الفرق",
  leaguesTitle: "الدوريات",
  playersTitle: "اللاعبون",
  playersHint: "ابحث عن لاعب بالاسم لعرض ملفه",
  playerSearchPlaceholder: "اكتب اسم اللاعب",
  /** The active backend has no player directory (not "no match found"). */
  playerSearchUnavailable:
    "لا يوفر مصدر البيانات الحالي بحثاً عن اللاعبين. تظهر أسماء اللاعبين مع أهداف كل مباراة داخل صفحة تفاصيل المباراة.",
  searchPlayers: "بحث اللاعبين",
  teamsHint: "اختر مسابقة لعرض فرقها",
  leaguesAvailable: "المسابقات المتاحة",
  /** Shown when the league list is capped for performance. */
  leaguesTruncated: (shown: number, total: number) =>
    `تُعرض ${shown} مسابقة من أصل ${total}`,

  loadFailed: "تعذّر تحميل البيانات",
  notOnPlanTitle: "غير متاح في خطتك الحالية",
  notOnPlanBody:
    "هذه البيانات موجودة لدى مزود الخدمة لكن مسابقتها غير مشمولة في خطة الاشتراك الحالية. قم بترقية الخطة للوصول إليها.",
  retry: "إعادة المحاولة",
  quotaNotice: "تم الوصول إلى حد الطلبات، تُعرض بيانات محفوظة",
  quotaTitle: "تم الوصول إلى حد الطلبات اليومي",
  quotaBody:
    "لقد بلغت الخطة الحالية حد الطلبات المسموح. تُعرض البيانات المحفوظة، وستعود التحديثات تلقائياً عند تجدد الحصة.",
  updatedJustNow: "تم التحديث الآن",
  loading: "جارٍ التحميل…",
  minuteShort: "د",
  vs: "ضد",

  // -------------------------------------------------------------------------
  // Search copy
  //
  // Ordinary Arabic prose that happens to contain the terms the site is looked
  // up by. It is written to be read: a visitor who scrolls to the bottom of the
  // fixture list gets a plain description of what the site covers, and Google
  // gets body text about football instead of having to build a snippet out of
  // UI labels. The brand's spellings appear once each, in a sentence — a list of
  // repeated keywords would read as spam to both audiences.
  // -------------------------------------------------------------------------
  /** The homepage h1. Short enough for the header bar, and the primary term. */
  seoHeadingShort: "جدول مباريات اليوم",
  seoHeading: "جدول مباريات اليوم ونتائج مباشرة",
  /**
   * Mentions the day's real fixture count, so the paragraph is specific to this
   * render rather than boilerplate repeated on every crawl.
   */
  seoIntro: (matchCount: number, date: string) =>
    matchCount > 0
      ? `يعرض جدول مباريات اليوم (${date}) ${matchCount} مباراة بمواعيدها بتوقيتك المحلي، ` +
        `مع النتائج المباشرة لحظة بلحظة وأهداف كل مباراة وترتيب الدوريات وقائمة الهدافين. ` +
        `تشمل التغطية الدوريات الأوروبية الكبرى ودوري أبطال أوروبا والدوري الأوروبي ` +
        `والدوريات العربية من السعودي والمصري والمغربي والإماراتي والقطري والتونسي والجزائري.`
      : `جدول مباريات كرة القدم بمواعيدها بتوقيتك المحلي، مع النتائج المباشرة وأهداف ` +
        `كل مباراة وترتيب الدوريات وقائمة الهدافين — الدوريات الأوروبية الكبرى ` +
        `ودوري أبطال أوروبا والدوريات العربية.`,
  seoBrands:
    "جدول (jdwal) موقع عربي لمتابعة مواعيد المباريات والنتائج المباشرة، " +
    "ويُكتب اسمه أيضاً jadwal أو jdwel. لا حاجة لتسجيل الدخول، والمواعيد تُحوَّل " +
    "تلقائياً إلى توقيت بلدك.",
  seoLinksLabel: "أقسام الموقع",
  seoLinkLeagues: "ترتيب الدوريات",
  seoLinkScorers: "ترتيب الهدافين",
  seoLinkPlayers: "بحث اللاعبين",
  /** Shared by the page description and the WebPage structured data. */
  seoMetaDescription:
    "جدول مباريات اليوم والغد ونتائج مباشرة لكرة القدم: الدوريات الكبرى " +
    "ودوري أبطال أوروبا والدوريات العربية مع الترتيب والهدافين.",
} as const;

/** Arabic names for leagues outside the pinned popular list. */
const LEAGUE_NAMES_AR: Record<string, string> = {
  "world cup": "كأس العالم",
  "fifa world cup": "كأس العالم",
  "uefa nations league": "دوري الأمم الأوروبية",
  "uefa conference league": "دوري المؤتمر الأوروبي",
  "uefa europa conference league": "دوري المؤتمر الأوروبي",
  "uefa super cup": "كأس السوبر الأوروبي",
  "euro championship": "كأس أمم أوروبا",
  "european championship": "كأس أمم أوروبا",
  eredivisie: "الدوري الهولندي",
  "primeira liga": "الدوري البرتغالي",
  "liga portugal": "الدوري البرتغالي",
  "jupiler pro league": "الدوري البلجيكي",
  "belgian pro league": "الدوري البلجيكي",
  "super lig": "الدوري التركي",
  "süper lig": "الدوري التركي",
  "scottish premiership": "الدوري الإسكتلندي",
  "swiss super league": "الدوري السويسري",
  "austrian bundesliga": "الدوري النمساوي",
  "danish superliga": "الدوري الدنماركي",
  eliteserien: "الدوري النرويجي",
  allsvenskan: "الدوري السويدي",
  "greek super league": "الدوري اليوناني",
  "super league greece": "الدوري اليوناني",
  ekstraklasa: "الدوري البولندي",
  "czech liga": "الدوري التشيكي",
  "russian premier league": "الدوري الروسي",
  "ukrainian premier league": "الدوري الأوكراني",
  championship: "دوري الدرجة الأولى الإنجليزي",
  "efl championship": "دوري الدرجة الأولى الإنجليزي",
  // Longer keys win over shorter ones, so these stop a generic key above from
  // claiming another country's competition of the same name.
  "scottish championship": "الدوري الإسكتلندي للدرجة الأولى",
  "brazilian serie a": "الدوري البرازيلي",
  "brasileirao serie a": "الدوري البرازيلي",
  "brazilian serie b": "الدوري البرازيلي الدرجة الثانية",
  "italian serie b": "الدوري الإيطالي الدرجة الثانية",
  "spanish segunda division": "الدوري الإسباني الدرجة الثانية",
  "german 2. bundesliga": "الدوري الألماني الدرجة الثانية",
  // Competitions BBC lists that the other sources name differently.
  "irish premiership": "الدوري الأيرلندي الشمالي",
  "finnish veikkausliiga": "الدوري الفنلندي",
  "conmebol libertadores": "كأس ليبرتادوريس",
  "conmebol sudamericana": "كأس سودأمريكانا",
  "national league": "دوري الدرجة الخامسة الإنجليزي",
  "national league cup": "كأس دوري الدرجة الخامسة الإنجليزي",
  "national league n / s": "دوري الدرجة السادسة الإنجليزي",
  "english football league trophy": "كأس الرابطة الإنجليزية للأندية الصغرى",
  "scottish challenge cup": "كأس التحدي الإسكتلندي",
  "english league cup": "كأس الرابطة الإنجليزية",
  "fa cup": "كأس الاتحاد الإنجليزي",
  "efl cup": "كأس الرابطة الإنجليزية",
  "carabao cup": "كأس الرابطة الإنجليزية",
  "copa del rey": "كأس ملك إسبانيا",
  "supercopa de espana": "كأس السوبر الإسباني",
  "coppa italia": "كأس إيطاليا",
  "dfb pokal": "كأس ألمانيا",
  "coupe de france": "كأس فرنسا",
  "serie b": "الدوري الإيطالي الدرجة الثانية",
  "2. bundesliga": "الدوري الألماني الدرجة الثانية",
  "ligue 2": "الدوري الفرنسي الدرجة الثانية",
  "la liga 2": "الدوري الإسباني الدرجة الثانية",
  segunda: "الدوري الإسباني الدرجة الثانية",
  "afc champions league": "دوري أبطال آسيا",
  "caf champions league": "دوري أبطال أفريقيا",
  "africa cup of nations": "كأس الأمم الأفريقية",
  afcon: "كأس الأمم الأفريقية",
  "copa libertadores": "كأس ليبرتادوريس",
  "club world cup": "كأس العالم للأندية",
  "egyptian premier league": "الدوري المصري",
  "qatar stars league": "دوري نجوم قطر",
  "uae pro league": "دوري الإمارات",
  "botola pro": "الدوري المغربي",
  "ligue professionnelle 1": "الدوري التونسي",
  "j1 league": "الدوري الياباني",
  "k league 1": "الدوري الكوري",
  "liga mx": "الدوري المكسيكي",
  "brasileirao": "الدوري البرازيلي",
  "serie a brazil": "الدوري البرازيلي",
  "liga profesional argentina": "الدوري الأرجنتيني",
};

/** Arabic club names. Unmapped clubs display their original name. */
const TEAM_NAMES_AR: Record<string, string> = {
  // --- Premier League ---
  arsenal: "آرسنال",
  "aston villa": "أستون فيلا",
  bournemouth: "بورنموث",
  brentford: "برينتفورد",
  "brighton & hove albion": "برايتون",
  brighton: "برايتون",
  burnley: "بيرنلي",
  chelsea: "تشيلسي",
  "crystal palace": "كريستال بالاس",
  everton: "إيفرتون",
  fulham: "فولهام",
  "leeds united": "ليدز يونايتد",
  liverpool: "ليفربول",
  "manchester city": "مانشستر سيتي",
  "manchester united": "مانشستر يونايتد",
  "newcastle united": "نيوكاسل يونايتد",
  "nottingham forest": "نوتنغهام فورست",
  sunderland: "سندرلاند",
  "tottenham hotspur": "توتنهام",
  tottenham: "توتنهام",
  "west ham united": "وست هام",
  "wolverhampton wanderers": "وولفرهامبتون",
  wolves: "وولفرهامبتون",
  "ipswich town": "إيبسويتش تاون",
  "leicester city": "ليستر سيتي",
  southampton: "ساوثهامبتون",
  "sheffield united": "شيفيلد يونايتد",
  "luton town": "لوتون تاون",
  "hull city": "هال سيتي",
  "coventry city": "كوفنتري سيتي",
  "west bromwich albion": "وست بروميتش",
  "norwich city": "نوريتش سيتي",
  watford: "واتفورد",
  middlesbrough: "ميدلسبره",
  millwall: "ميلوول",
  "swansea city": "سوانزي",
  "cardiff city": "كارديف سيتي",
  "stoke city": "ستوك سيتي",
  "preston north end": "بريستون",
  "blackburn rovers": "بلاكبيرن",
  "bristol city": "بريستول سيتي",
  "queens park rangers": "كوينز بارك رينجرز",
  "sheffield wednesday": "شيفيلد وينزداي",
  "derby county": "ديربي كاونتي",
  "portsmouth": "بورتسموث",
  "oxford united": "أوكسفورد يونايتد",
  "plymouth argyle": "بليموث",
  "wrexham": "ريكسهام",
  "birmingham city": "برمنغهام سيتي",
  "charlton athletic": "تشارلتون",

  // --- La Liga ---
  "real madrid": "ريال مدريد",
  barcelona: "برشلونة",
  "atletico madrid": "أتلتيكو مدريد",
  "atlético madrid": "أتلتيكو مدريد",
  "athletic club": "أتلتيك بيلباو",
  "athletic bilbao": "أتلتيك بيلباو",
  "real sociedad": "ريال سوسييداد",
  "real betis": "ريال بيتيس",
  betis: "ريال بيتيس",
  villarreal: "فياريال",
  valencia: "فالنسيا",
  sevilla: "إشبيلية",
  girona: "جيرونا",
  "celta vigo": "سيلتا فيغو",
  "celta de vigo": "سيلتا فيغو",
  osasuna: "أوساسونا",
  "rayo vallecano": "رايو فايكانو",
  mallorca: "مايوركا",
  getafe: "خيتافي",
  alaves: "ألافيس",
  "deportivo alaves": "ألافيس",
  espanyol: "إسبانيول",
  "las palmas": "لاس بالماس",
  levante: "ليفانتي",
  elche: "إلتشي",
  "real oviedo": "ريال أوفييدو",
  "real valladolid": "بلد الوليد",
  leganes: "ليغانيس",
  malaga: "ملقا",
  "racing santander": "راسينغ سانتاندير",
  "deportivo la coruna": "ديبورتيفو لاكورونيا",
  "sporting gijon": "سبورتينغ خيخون",
  "real zaragoza": "ريال سرقسطة",
  "real murcia": "ريال مورسيا",
  "cadiz": "قادش",
  "granada": "غرناطة",
  "almeria": "ألميريا",
  "eibar": "إيبار",
  "huesca": "هويسكا",
  "albacete": "ألباسيتي",
  "burgos": "بورغوس",
  "castellon": "كاستيون",
  "mirandes": "ميرانديس",
  "andorra": "أندورا",
  "cordoba": "قرطبة",

  // --- Germany ---
  "bayern munich": "بايرن ميونخ",
  "bayern münchen": "بايرن ميونخ",
  "borussia dortmund": "بوروسيا دورتموند",
  "rb leipzig": "لايبزيغ",
  "bayer leverkusen": "باير ليفركوزن",
  "vfb stuttgart": "شتوتغارت",
  "eintracht frankfurt": "آينتراخت فرانكفورت",
  hoffenheim: "هوفنهايم",
  "vfl wolfsburg": "فولفسبورغ",
  "sc freiburg": "فرايبورغ",
  "werder bremen": "فيردر بريمن",
  "union berlin": "يونيون برلين",
  mainz: "ماينز",
  "mainz 05": "ماينز",
  augsburg: "أوغسبورغ",
  "borussia monchengladbach": "بوروسيا مونشنغلادباخ",
  "borussia mönchengladbach": "بوروسيا مونشنغلادباخ",

  // --- Italy ---
  "inter milan": "إنتر ميلان",
  internazionale: "إنتر ميلان",
  "ac milan": "ميلان",
  milan: "ميلان",
  juventus: "يوفنتوس",
  napoli: "نابولي",
  roma: "روما",
  "as roma": "روما",
  lazio: "لاتسيو",
  atalanta: "أتالانتا",
  fiorentina: "فيورنتينا",
  bologna: "بولونيا",
  torino: "تورينو",
  genoa: "جنوى",
  udinese: "أودينيزي",
  como: "كومو",
  cagliari: "كالياري",
  sassuolo: "ساسولو",
  parma: "بارما",
  lecce: "ليتشي",
  verona: "هيلاس فيرونا",
  "hellas verona": "هيلاس فيرونا",
  pisa: "بيزا",
  cremonese: "كريمونيزي",

  // --- France ---
  "paris saint germain": "باريس سان جيرمان",
  "paris saint-germain": "باريس سان جيرمان",
  psg: "باريس سان جيرمان",
  marseille: "مارسيليا",
  "olympique marseille": "مارسيليا",
  monaco: "موناكو",
  "as monaco": "موناكو",
  lyon: "ليون",
  "olympique lyonnais": "ليون",
  lille: "ليل",
  nice: "نيس",
  rennes: "رين",
  nantes: "نانت",
  strasbourg: "ستراسبورغ",
  toulouse: "تولوز",
  brest: "بريست",
  lens: "لانس",
  auxerre: "أوكسير",
  "paris fc": "باريس إف سي",

  // --- Portugal / Netherlands / Belgium ---
  porto: "بورتو",
  "fc porto": "بورتو",
  benfica: "بنفيكا",
  "sporting cp": "سبورتينغ لشبونة",
  sporting: "سبورتينغ لشبونة",
  braga: "براغا",
  "sporting braga": "براغا",
  "vitoria guimaraes": "فيتوريا غيمارايش",
  ajax: "أياكس",
  psv: "آيندهوفن",
  "psv eindhoven": "آيندهوفن",
  feyenoord: "فاينورد",
  twente: "توينتي",
  "az alkmaar": "ألكمار",
  utrecht: "أوتريخت",
  "club brugge": "كلوب بروج",
  "club brugge kv": "كلوب بروج",
  anderlecht: "أندرلخت",
  gent: "غينت",
  genk: "غينك",
  antwerp: "أنتويرب",
  "union saint gilloise": "يونيون سان جيلواز",
  "union saint-gilloise": "يونيون سان جيلواز",

  // --- Rest of Europe ---
  galatasaray: "غلطة سراي",
  fenerbahce: "فنربخشة",
  "fenerbahçe": "فنربخشة",
  besiktas: "بشكتاش",
  "beşiktaş": "بشكتاش",
  trabzonspor: "طرابزون سبور",
  celtic: "سيلتيك",
  rangers: "رينجرز",
  "shakhtar donetsk": "شاختار دونيتسك",
  "dynamo kyiv": "دينامو كييف",
  "red star belgrade": "النجم الأحمر",
  "crvena zvezda": "النجم الأحمر",
  "dinamo zagreb": "دينامو زغرب",
  "red bull salzburg": "ريد بُل سالزبورغ",
  salzburg: "ريد بُل سالزبورغ",
  "sturm graz": "شتورم غراتس",
  "rapid vienna": "رابيد فيينا",
  "slavia prague": "سلافيا براغ",
  "sparta prague": "سبارتا براغ",
  "viktoria plzen": "فيكتوريا بلزن",
  copenhagen: "كوبنهاغن",
  "fc copenhagen": "كوبنهاغن",
  midtjylland: "ميتيولاند",
  "bodo glimt": "بودو غليمت",
  "bodø/glimt": "بودو غليمت",
  "fk bodo/glimt": "بودو غليمت",
  malmo: "مالمو",
  "malmö ff": "مالمو",
  "young boys": "يانغ بويز",
  "bsc young boys": "يانغ بويز",
  basel: "بازل",
  olympiacos: "أولمبياكوس",
  panathinaikos: "باناثينايكوس",
  "aek athens": "أيك أثينا",
  paok: "باوك",
  ferencvaros: "فيرينكفاروش",
  "maccabi tel aviv": "مكابي تل أبيب",
  qarabag: "قره باغ",
  "lask linz": "لاسك لينز",
  lask: "لاسك لينز",
  "legia warsaw": "ليغيا وارسو",
  "sk slovan bratislava": "سلوفان براتيسلافا",
  "slovan bratislava": "سلوفان براتيسلافا",
  pafos: "بافوس",
  "kairat almaty": "كايرات ألماتي",
  stuttgart: "شتوتغارت",
  viking: "فايكينغ",
  "viking stavanger": "فايكينغ",
  brann: "بران",
  molde: "مولده",
  rosenborg: "روزنبورغ",
  aarhus: "آرهوس",
  "aarhus gymnastikforening": "آرهوس",
  agf: "آرهوس",
  brondby: "بروندبي",
  silkeborg: "سيلكيبورغ",
  omonia: "أومونيا نيقوسيا",
  "omonia nicosia": "أومونيا نيقوسيا",
  apoel: "أبويل نيقوسيا",
  "aek larnaca": "أيك لارنكا",
  "sparta praha": "سبارتا براغ",
  "slavia praha": "سلافيا براغ",
  "sigma olomouc": "سيغما أولوموتس",
  breidablik: "بريدابليك",
  "valur reykjavik": "فالور",
  ludogorets: "لودوغوريتس",
  levski: "ليفسكي صوفيا",
  fcsb: "شتيوا بوخارست",
  steaua: "شتيوا بوخارست",
  "cfr cluj": "كلوج",
  cluj: "كلوج",
  rijeka: "ريييكا",
  "hajduk split": "هايدوك سبليت",
  "nk osijek": "أوسييك",
  jagiellonia: "ياغيلونيا",
  rakow: "راكوف",
  "lech poznan": "ليخ بوزنان",
  elfsborg: "إلفسبورغ",
  hacken: "هاكن",
  djurgarden: "ديورغاردن",
  "hammarby if": "همربي",
  "shamrock rovers": "شامروك روفرز",
  "st patricks athletic": "سانت باتريكس",
  linfield: "لينفيلد",
  "the new saints": "نيو ساينتس",
  hearts: "هارتس",
  aberdeen: "أبردين",
  "hibernian": "هيبرنيان",
  "zrinjski mostar": "زرينسكي موستار",
  "sabah baku": "صباح باكو",
  sabah: "صباح باكو",
  "hapoel beer sheva": "هبوعيل بئر السبع",
  "levski sofia": "ليفسكي صوفيا",
  "avan academy": "أفان أكاديمي",
  "u craiova": "كرايوفا",
  mjallby: "ميالبي",
  nec: "نيميخن",
  kups: "كوبس",
  thun: "تون",
  "gornik zabrze": "غورنيك زابجه",
  vardar: "فاردار",
  floriana: "فلوريانا",
  eto: "إيتو",
  "inter club descaldes": "إنتر إسكالديس",
  "borac banja luka": "بوراتس بانيا لوكا",
  "tre fiori": "تري فيوري",
  "atert bissen": "أتيرت بيسن",
  sutjeska: "سوتييسكا",
  "ml vitebsk": "فيتيبسك",
  saburtalo: "سابورتالو",
  celje: "تسيليه",
  "araz naxcivan": "أراز",
  "lincoln red imps": "لينكولن ريد إمبس",
  "hamrun spartans": "همرون سبارتانز",
  "drita": "دريتا",
  "ki klaksvik": "كي كلاكسفيك",
  "victoria guimaraes": "فيتوريا غيمارايش",
  "santa clara": "سانتا كلارا",
  "estoril praia": "إستوريل",
  "rio ave": "ريو آفي",
  nordsjaelland: "نوردشيلاند",
  "fc lugano": "لوغانو",
  "servette": "سيرفيت",
  "lausanne sport": "لوزان",
  "wolfsberger ac": "فولفسبرغر",
  "austria wien": "أوستريا فيينا",
  "lokomotiv plovdiv": "لوكوموتيف بلوفديف",
  "polissya": "بوليسيا",
  "zrinjski": "زرينسكي موستار",

  // --- Arab + selected world clubs ---
  "al hilal": "الهلال",
  "al nassr": "النصر",
  "al ittihad": "الاتحاد",
  "al ahli": "الأهلي",
  "al ahly": "الأهلي المصري",
  zamalek: "الزمالك",
  "al shabab": "الشباب",
  "al ettifaq": "الاتفاق",
  "al fateh": "الفتح",
  "al taawoun": "التعاون",
  "al raed": "الرائد",
  "al wehda": "الوحدة",
  "al fayha": "الفيحاء",
  "al khaleej": "الخليج",
  "al riyadh": "الرياض",
  "al okhdood": "الأخدود",
  "al orobah": "العروبة",
  "al kholood": "الخلود",
  "al qadsiah": "القادسية",
  "al najma": "النجمة",
  "al sadd": "السد",
  "al sadd sc": "السد",
  "al duhail": "الدحيل",
  "al ain": "العين",
  "al wasl": "الوصل",
  esperance: "الترجي",
  "esperance tunis": "الترجي",
  "raja casablanca": "الرجاء البيضاوي",
  "wydad casablanca": "الوداد البيضاوي",
  "inter miami": "إنتر ميامي",
  "la galaxy": "لوس أنجلوس غالاكسي",
  "los angeles fc": "لوس أنجلوس إف سي",
  flamengo: "فلامنغو",
  palmeiras: "بالميراس",
  "river plate": "ريفر بليت",
  "boca juniors": "بوكا جونيورز",
};

function normalize(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      // Fold diacritics so "Deportivo Alavés" and "Atlético" match their keys.
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[.'’]/g, "")
      .replace(/&/g, " and ")
      // Separators vary by feed ("Bodø/Glimt", "FK Bodo - Glimt"); flatten them
      // so one alias covers every spelling.
      .replace(/[-–—/]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Lookup tables built by running every key through `normalize`, so the literal
 * spelling of a key in the maps above can never silently fail to match.
 */
const TEAM_LOOKUP = new Map(
  Object.entries(TEAM_NAMES_AR).map(([key, value]) => [normalize(key), value]),
);

const LEAGUE_LOOKUP = new Map(
  Object.entries(LEAGUE_NAMES_AR).map(([key, value]) => [normalize(key), value]),
);

/** Keys ordered longest-first so the most specific alias wins. */
const TEAM_KEYS_BY_LENGTH = [...TEAM_LOOKUP.keys()].sort(
  (a, b) => b.length - a.length,
);

/**
 * Strip club-type noise so "Club Brugge KV", "Arsenal FC" and "1. FC Union
 * Berlin" all reach the same lookup key.
 */
function stripClubNoise(value: string): string {
  return normalize(value)
    .replace(/^\d+\s*/, "")
    .replace(
      /\b(fc|cf|sc|ac|as|ss|ssc|afc|rc|cd|ud|sd|kv|rcd|vfb|vfl|bsc|fk|sk|nk|hnk|gnk|if|bk|aik|club de futbol|futbol club)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Arabic league name, falling back to the provider's name. */
export function leagueNameAr(leagueId: number, original: string): string {
  // Matched in the ACTIVE provider's numbering only — see `matchesLeagueId`. The
  // cross-provider union this used to test is why the FA Cup was rendering as
  // "دوري أبطال أوروبا".
  for (const league of POPULAR_LEAGUES) {
    if (matchesLeagueId(league, leagueId)) return league.ar;
  }

  const name = normalize(original);

  let best: { ar: string; length: number } | null = null;
  for (const league of POPULAR_LEAGUES) {
    for (const alias of league.aliases) {
      if (name.includes(alias) && (!best || alias.length > best.length)) {
        best = { ar: league.ar, length: alias.length };
      }
    }
  }
  for (const [alias, ar] of LEAGUE_LOOKUP) {
    if (name.includes(alias) && (!best || alias.length > best.length)) {
      best = { ar, length: alias.length };
    }
  }

  return best?.ar ?? original;
}

/**
 * Arabic club name, falling back to the provider's name.
 *
 * Three passes, most exact first:
 *   1. exact normalized name           ("liverpool")
 *   2. name with club-type noise gone  ("Arsenal FC" -> "arsenal")
 *   3. leading/trailing city or suffix ("Feyenoord Rotterdam" -> "feyenoord")
 *
 * Pass 3 only accepts whole-word boundaries, so "Manchester City" can never
 * collapse onto a "manchester" style key.
 */
export function teamNameAr(original: string): string {
  const exact = TEAM_LOOKUP.get(normalize(original));
  if (exact) return exact;

  const stripped = stripClubNoise(original);
  if (!stripped) return original;

  const strippedHit = TEAM_LOOKUP.get(stripped);
  if (strippedHit) return strippedHit;

  for (const key of TEAM_KEYS_BY_LENGTH) {
    // Whole-word boundaries only, so "Manchester City" can never collapse onto
    // a shorter "manchester" style key.
    if (stripped.startsWith(`${key} `) || stripped.endsWith(` ${key}`)) {
      return TEAM_LOOKUP.get(key)!;
    }
  }

  // National teams (World Cup entrants) arrive as country names, not clubs.
  const asCountry = countryNameArOrNull(original) ?? countryNameArOrNull(stripped);
  if (asCountry) return asCountry;

  return original;
}

/** Arabic label for a stage / round. */
export function stageAr(
  gameWeek: number | null,
  leagueName: string,
): string | null {
  if (gameWeek == null) return null;
  const isCup = /champions league|europa league|conference league|world cup/i.test(
    leagueName,
  );
  if (isCup) return `دور المجموعات — الجولة ${gameWeek}`;
  return `الجولة ${gameWeek}`;
}
