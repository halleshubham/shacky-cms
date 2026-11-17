/**
 * Content for samvidhanjagar.org expressed in Shacky CMS page-builder blocks.
 * Asset URLs point at the live WordPress uploads so the seed works before the media
 * migration has run; once media is imported, swap the base URL (see UPLOADS below).
 */

const UPLOADS = 'https://samvidhanjagar.org/wp-content/uploads/';
const up = (path: string) => UPLOADS + path;

let n = 0;
const id = (p: string) => `${p}-${++n}`;

type Block = { id: string; type: string; config: Record<string, unknown> };
const block = (type: string, config: Record<string, unknown>): Block => ({ id: id(type), type, config });

const heading = (text: string, o: Record<string, unknown> = {}) =>
  block('heading_block', { text, level: 2, align: 'left', ...o });
const richText = (html: string) => block('rich_text', { html });
const files = (title: string, list: Record<string, unknown>[], o: Record<string, unknown> = {}) =>
  block('file_downloads', { title, files: list, layout: 'list', ...o });
const nested = (b: Block) => ({ contentType: b.type, nestedConfig: b.config });
const columns = (cols: Record<string, unknown>[], perRow: 1 | 2 | 3 | 4 = 2) =>
  block('columns_block', { columns: cols, columnsPerRow: perRow, textAlign: 'left' });

// ── Navigation ──────────────────────────────────────────────────────────────────
export const NAV_PRIMARY = [
  { label: 'होम', type: 'url', value: '/' },
  { label: 'विविध उपक्रम', type: 'page', value: 'activities' },
  {
    label: 'साहित्य', type: 'dropdown', value: '', children: [
      { label: 'पोस्टर्स आणि बॅनर', type: 'page', value: 'posters' },
      { label: 'पत्रक', type: 'page', value: 'publication' },
      { label: 'पुस्तिका', type: 'page', value: '%e0%a4%aa%e0%a5%81%e0%a4%b8%e0%a5%8d%e0%a4%a4%e0%a4%bf%e0%a4%95%e0%a4%be' },
      { label: 'स्टिकर्स', type: 'page', value: '%e0%a4%b8%e0%a5%8d%e0%a4%9f%e0%a4%bf%e0%a4%95%e0%a4%b0%e0%a5%8d%e0%a4%b8' },
    ],
  },
  {
    label: 'शिक्षकांसाठी साहित्य', type: 'dropdown', value: '', children: [
      { label: 'खेळ', type: 'page', value: 'games' },
      { label: 'व्हिडिओ', type: 'page', value: 'videos' },
      { label: 'संविधान दिन', type: 'page', value: 'samvidhan-din-2' },
      { label: 'स्वातंत्र्य दिन', type: 'page', value: 'independence-day' },
    ],
  },
  { label: 'सामील व्हा', type: 'url', value: 'https://tiny.cc/join-campaign' },
  { label: 'संपर्क करा', type: 'page', value: 'contact' },
];

export const SETTINGS: Record<string, string> = {
  site_title: 'संविधान जागर अभियान',
  site_description: 'संविधानातील मूल्ये, हक्क आणि अधिकार यांचा जागर करणारे महाराष्ट्र राज्यव्यापी अभियान',
  site_theme: 'samvidhan',
  site_lang: 'mr',
  header_show_title: 'true',
  header_show_tagline: 'false',
  header_show_editors: 'false',
  footer_show_publication: 'false',
  footer_text: '© संविधान जागर अभियान · संविधानाचा विचार घराघरात, मनामनात',
  social_facebook: 'https://facebook.com/samvidhan.jagar',
  social_instagram: 'https://instagram.com/samvidhan.jagar',
  social_whatsapp: 'https://chat.whatsapp.com/GNKC6HBg9UnDgqbg3KwDNS',
  social_telegram: 'https://t.me/Samvidhanjagar',
  translation_enabled: 'false',
  nav_primary: JSON.stringify(NAV_PRIMARY),
  nav_secondary: JSON.stringify([
    { label: 'पोस्टर्स आणि बॅनर', type: 'page', value: 'posters' },
    { label: 'सामील व्हा', type: 'url', value: 'https://tiny.cc/join-campaign' },
    { label: 'संपर्क करा', type: 'page', value: 'contact' },
  ]),
};

const COMMITTEE =
  'मा. न्या. बी. जी. कोळसे पाटील, मा. न्या. अभय ठिपसे, तुषार गांधी, डॉ. राम पुनियानी, डॉ. नितीन राऊत, धनाजी गुरव, नीरज जैन';

const contactCard = () => ({
  contentType: 'rich_text',
  nestedConfig: {
    html: `<h3>संविधान जागर अभियान निमंत्रक समिती</h3><p>${COMMITTEE}</p>
<h3>अधिक माहितीसाठी संपर्क</h3>
<ul><li>स्वप्निल फुसे: <a href="tel:+917972345764">79723 45764</a></li>
<li>डॉ. श्याम मुडे: <a href="tel:+919404708852">94047 08852</a></li>
<li>श्रद्धा रेखा राजेंद्र: <a href="tel:+919270478335">92704 78335</a></li>
<li>राजाभाऊ करवाडे: <a href="tel:+919822202739">98222 02739</a></li></ul>`,
  },
});

// ── Homepage ────────────────────────────────────────────────────────────────────
export const HOMEPAGE_SECTIONS: Block[] = [
  heading('संविधान जागर अभियान', {
    level: 1, align: 'center',
    subtext: 'संविधानातील मूल्ये, हक्क आणि अधिकार यांचा जागर करणारे महाराष्ट्र राज्यव्यापी अभियान — संविधानाचा विचार घराघरात पोहोचवूया!',
  }),
  block('button_row', {
    align: 'center',
    buttons: [
      { label: 'अभियानात सामील व्हा', url: 'https://tiny.cc/join-campaign', variant: 'primary', newTab: true },
      { label: 'साहित्य डाउनलोड करा', url: '/posters', variant: 'outline' },
    ],
  }),

  columns([
    {
      contentType: 'rich_text',
      nestedConfig: {
        html: `<h2>ऑगस्ट महिन्यातील प्रस्ताव</h2>
<h3>स्वातंत्र्य सप्ताह – 9 ऑगस्ट, क्रांती दिन ते 15 ऑगस्ट, स्वातंत्र्य दिन</h3>
<p>या निमित्ताने शैक्षणिक संस्था, मित्र-मंडळांना, सोसायट्यांमध्ये विविध उपक्रम राबवले जाऊ शकतात:</p>
<ol><li>स्वातंत्र्य लढा आणि संविधान समितीमधील महिलांवरील पोस्टर्सचे प्रदर्शन आणि चर्चा</li>
<li>दररोज एक स्वातंत्र्य सैनिकांची माहिती</li>
<li>स्वातंत्र्य सैनिकांचा स्थानिक इतिहास सांगणे, त्यांच्या स्मारकाला भेट देऊन अभिवादन करणे</li>
<li>देशभक्ती आणि स्वातंत्र्य लढ्याची गाणी</li>
<li>संविधान प्रभात फेरी</li>
<li>झेंडावंदन कार्यक्रमात स्वातंत्र्य शपथ</li></ol>`,
      },
    },
    nested(files('अज्ञात स्वातंत्र्य सैनिकांच्या कथा', [
      { label: 'मराठी', url: up('2025/08/गुमनाम-स्वातंत्र्यसैनिक-10-ऑगस्ट-मराठी-1-combined.pdf'), lang: 'mr', fileType: 'pdf' },
      { label: 'हिन्दी', url: up('2025/08/गुमनाम-स्वतंत्रता-सेनानी-10-अगस्त-हिन्दी-1-combined.pdf'), lang: 'hi', fileType: 'pdf' },
      { label: 'इंग्रजी', url: up('2025/08/Unsung-Freedom-Fighters-10-Aug-English-1-combined.pdf'), lang: 'en', fileType: 'pdf' },
    ], { description: 'डाउनलोड करण्यासाठी खालील लिंक्सवर क्लिक करा.' })),
  ]),

  heading('स्वातंत्र्य दिन शपथ', { subtext: 'झेंडावंदन कार्यक्रमात घेण्यासाठी — फोटोवर क्लिक करून डाउनलोड करा.' }),
  block('image_gallery', {
    columns: 3, showCaptions: true,
    images: [
      { src: up('2026/01/Samvidhan_Shapath_marathi.webp'), alt: 'स्वातंत्र्यदिन शपथ (मराठी)', caption: 'मराठी', linkUrl: up('2026/01/Samvidhan_Shapath_marathi.webp'), linkNewTab: true },
      { src: up('2026/01/Samvidhan_Shapath_hindi.webp'), alt: 'स्वतंत्रता दिवस शपथ (हिन्दी)', caption: 'हिन्दी', linkUrl: up('2026/01/Samvidhan_Shapath_hindi.webp'), linkNewTab: true },
      { src: up('2025/02/patra-sanvidhan-campaign.png'), alt: 'संविधान पत्र', caption: 'पत्र', linkUrl: up('2025/02/patra-sanvidhan-campaign.png'), linkNewTab: true },
    ],
  }),

  heading('संविधान घराघरात पोहचवूया!', {
    subtext: 'देऊन गोडवा चमचाभर साखरेचा, करू जागर भारतीय संविधानाचा. घरोघरी जाऊन, साखर देऊन, तोंड गोड करा आणि लोकांशी संविधानाबद्दल संवाद करा.',
  }),
  columns([
    nested(files('पत्रक', [
      { label: 'मराठी पत्रक (PDF)', url: up('2026/01/pamphlet-samvidhan-jagar-abhiyan.pdf'), lang: 'mr', fileType: 'pdf' },
      { label: 'मराठी पत्रक (DOCX)', url: up('2026/01/pamphlet-samvidhan-jagar-abhiyan.doc'), lang: 'mr', fileType: 'docx' },
      { label: 'हिंदी पत्रक (PDF)', url: up('2026/01/pamphlet-samvidhan-jagar-abhiyan-hindi-A4-full-v1-28jan26.pdf'), lang: 'hi', fileType: 'pdf' },
      { label: 'हिंदी पत्रक (DOCX)', url: up('2026/01/pamphlet-samvidhan-jagar-abhiyan-hindi-A4-full-v1-28jan26.doc'), lang: 'hi', fileType: 'docx' },
    ], { description: 'संविधानावरील पत्रक लोकांना देऊ शकता.' })),
    nested(files('आपलं संविधान – चित्रमय पुस्तिका', [
      { label: 'मराठी', url: up('2025/09/Pocket-Booklet-Sanvidhan-Sep-25.pdf'), lang: 'mr', fileType: 'pdf' },
      { label: 'हिंदी', url: up('2025/09/Pocket-Booklet-Hamara-Samvidhan-Sep-25.pdf'), lang: 'hi', fileType: 'pdf' },
      { label: 'इंग्रजी', url: up('2025/09/Pocket-Booklet-Constitution-Sep-25.pdf'), lang: 'en', fileType: 'pdf' },
    ], { description: 'साध्या सोप्या भाषेत संविधान समजून देणारी चित्रमय पुस्तिका वाटप करू शकता.' })),
  ]),

  heading('शाळा आणि संस्थांसाठी उपक्रम'),
  columns([
    nested(files('संविधान उद्देशिका समजावून सांगूयात', [
      { label: 'संविधान उद्देशिका सत्र (PPT)', url: up('2026/01/Consitution-Preamble-Session.pdf'), fileType: 'ppt' },
      { label: 'संविधान उद्देशिका सत्र (Notes)', url: up('2026/01/SJA-Sanvidhan-Prastavika-Notes-_Marathi.pdf'), lang: 'mr', fileType: 'pdf' },
    ], { description: 'संविधान उद्देशिकेतील शब्दांची व संविधान मूल्यांची सोप्या उदाहरणांनी संवादात्मक भाषेत मुलांना सांगणे.' })),
    nested(files('संविधान खेळ', [
      { label: 'संविधान सापशिडी', url: up('2025/11/sapshidi-banner.pdf'), fileType: 'pdf' },
    ], { description: 'समता, बंधुता या मूल्यांना खेळाच्या माध्यमातून हसत खेळत समजून घेणे.' })),
    nested(files('संविधान ज्ञान परीक्षा', [
      { label: 'लहान गट – इयत्ता 4थी, 5वी', url: up('2025/02/संविधान-ज्ञान-परीक्षा-लहान-गट-class-4-5.pdf'), fileType: 'pdf' },
      { label: 'मोठा गट – इयत्ता 6, 7, 8वी', url: up('2025/02/संविधान-ज्ञान-परीक्षा-मोठा-गट-class-6-7-8.pdf'), fileType: 'pdf' },
    ], { description: 'पॉकेट पुस्तिकेवर आधारित प्रश्नपत्रिका. प्रमाणपत्रासाठी आम्हाला संपर्क साधू शकता.' })),
    {
      title: 'संविधान शपथ',
      text: 'संविधान दिनी आपण संविधानावरील शपथ शाळा-कॉलेजमध्ये घेऊ शकता.',
      buttonLabel: 'शपथ (मराठी)', buttonUrl: up('2026/01/Samvidhan_Shapath_marathi.webp'), buttonVariant: 'primary', buttonNewTab: true,
    },
    {
      title: 'संविधान दालन',
      text: 'A2/A3 साईझचे पोस्टर छापून आपल्या शाळेच्या-संस्थेच्या आवारात लावू शकता.',
      buttonLabel: 'पोस्टर्स पाहा', buttonUrl: '/posters', buttonVariant: 'primary',
    },
    {
      title: 'संविधान पत्र वाचन',
      text: 'विद्यार्थ्यांमार्फत "संविधानाने मला काय दिले" सांगणारे पत्र आपल्या घरी-शेजारी वाचू शकतात.',
      buttonLabel: 'पत्र डाउनलोड करा', buttonUrl: up('2025/02/patra-sanvidhan-campaign.png'), buttonVariant: 'outline', buttonNewTab: true,
    },
  ], 3),

  heading('पोस्टर प्रदर्शन', { subtext: 'प्रदर्शन डाउनलोड करण्यासाठी फोटोवर क्लिक करा.' }),
  block('image_gallery', {
    columns: 3, showCaptions: true,
    images: [
      { src: up('2025/07/women_in_freedom_struggle_posters-724x1024.webp'), alt: 'स्वातंत्र्य लढ्यातील महिला', caption: 'स्वातंत्र्य लढ्यातील महिला', linkUrl: up('2025/07/Women_In_freedom_struggle_Poster_Exhibition.pdf'), linkNewTab: true },
      { src: up('2025/07/Women_in_Constituent_Assembly_posters.webp'), alt: 'संविधान सभेतील महिला', caption: 'संविधान सभेतील महिला', linkUrl: up('2025/07/Poster_Exhibition_Women_in_Constituent_Assembly.pdf'), linkNewTab: true },
      { src: up('2026/01/Consitution_Completion.webp'), alt: 'संविधान निर्मिती', caption: 'संविधान निर्मिती', linkUrl: up('2026/01/Constitution-Poster-Exhibition-3-by-4-feet-3.pdf'), linkNewTab: true },
    ],
  }),

  block('download_banner', {
    title: 'अभियानात सहभागी व्हा!',
    description: 'आपल्या गावात, शाळेत, मित्रमंडळात संविधान जागर अभियान राबवण्यासाठी आमच्याशी जोडले जा.',
    buttonLabel: 'सामील व्हा',
    buttonUrl: 'https://tiny.cc/join-campaign',
  }),

  columns([
    {
      contentType: 'rich_text',
      nestedConfig: {
        html: `<h2>अभियानाबद्दल</h2>
<p>भारतीय संविधान म्हणजे एक करुणेचा, मानवतेचा व प्रगतीचा प्रकाशदीप आहे. संविधानाने सर्व प्रौढ नागरिकांना <strong>मतदानाचा हक्क</strong> दिला. <strong>स्त्री-पुरुष समानतेचे मूल्य</strong> दिले. गरीबांना, वंचितांना पुढे जाण्याची संधी दिली. या देशातील <strong>विविधतेचा सन्मान</strong> केला.</p>
<p>व्यक्ती कोणत्याही धर्म, जात, लिंग, प्रांताचा असो, प्रत्येक भारतीयाचा भारतावर आणि संविधानावर <strong>समान हक्क</strong> आहे.</p>
<blockquote><p>सामाजिक चेतना हीच आपल्या हक्कांची खात्री असते.</p><p>— डॉ. बाबासाहेब आंबेडकर</p></blockquote>`,
      },
    },
    contactCard(),
  ]),
];

// ── Posters & banners page ───────────────────────────────────────────────────────
const poster = (caption: string, img: string, pdf: string) =>
  ({ src: up(img), alt: caption, caption, linkUrl: up(pdf), linkNewTab: true });

export const POSTERS_PAGE = {
  title: 'पोस्टर्स आणि बॅनर',
  slug: 'posters',
  excerpt: 'डाउनलोड करण्यासाठी फोटोवर क्लिक करा',
  sections: [
    heading('पोस्टर्स आणि बॅनर', { level: 1, align: 'center', subtext: 'डाउनलोड करण्यासाठी फोटोवर क्लिक करा' }),
    heading('पोस्टर्स'),
    block('image_gallery', {
      columns: 4, showCaptions: false,
      images: [
        poster('महात्मा बसवण्णा', '2025/07/Posters-Basavanna.webp', '2025/07/Basavanna_posters.pdf'),
        poster('संत विचार', '2025/07/Sant-Vichar-Poster-Exhibition-3-by-4-feet.webp', '2025/07/Sant-Vichar-Poster-Exhibition-3-by-4-feet.pdf'),
        poster('छत्रपती शिवाजी महाराज', '2025/07/poster-1.webp', '2025/07/Chatrapati_Shivaji_Maharaj_posters.pdf'),
        poster('राजर्षी शाहू महाराज', '2025/07/Shahu-Maharaj-Poster.webp', '2025/07/Shahu-Maharaj-Poster.pdf'),
        poster('राष्ट्रसंत तुकडोजी महाराज', '2025/07/SJA-Poster-Tukadoji-A3.webp', '2025/07/Rashtrasant_Tukdoji_maharaj_posters.pdf'),
        poster('डॉ. बाबासाहेब आंबेडकर', '2025/07/Posters-Babasaheb-3x4-1.webp', '2025/07/Dr-Babasaheb-Ambedkar-Posters.pdf'),
        poster('संविधान सभेतील महिला', '2025/07/SJA-Poster-Sanvidhan-Samiti-Mahila-A2.webp', '2025/07/SJA-Poster-Sanvidhan-Samiti-Mahila-A2.pdf'),
      ],
    }),
    heading('पोस्टर प्रदर्शन'),
    block('image_gallery', {
      columns: 4, showCaptions: false,
      images: [
        poster('स्वातंत्र्य लढ्यातील महिला', '2025/07/women_in_freedom_struggle_posters.webp', '2025/07/Women_In_freedom_struggle_Poster_Exhibition.pdf'),
        poster('संविधान सभेतील महिला', '2025/07/Women_in_Constituent_Assembly_posters.webp', '2025/07/Poster_Exhibition_Women_in_Constituent_Assembly.pdf'),
        poster('नवरात्र उत्सव', '2025/09/kartrutvaan-mahila.webp', '2025/09/Posters-Navratra-Utsav-SJA.pdf'),
        poster('संविधान निर्मिती', '2026/01/poster_exhibition_making_of_constitution.webp', '2026/01/Constitution-Poster-Exhibition-3-by-4-feet-3.pdf'),
      ],
    }),
    heading('बॅनर'),
    block('image_gallery', {
      columns: 4, showCaptions: false,
      images: [
        poster('छत्रपती शिवाजी महाराज', '2026/02/Banners-Chatrapati-Shivaji-Maharaj-3x6-1.webp', '2026/02/Banners-Chatrapati-Shivaji-Maharaj-3x6-1.pdf'),
        poster('राजमाता जिजाऊ', '2026/02/Banners-Rajmata-Jijau-3x6-1.webp', '2026/02/Banners-Rajmata-Jijau-3x6-1.pdf'),
        poster('महात्मा फुले', '2026/02/Banners-Mahatma-Phule3x6-1.webp', '2026/02/Banners-Mahatma-Phule-3x6-1.pdf'),
        poster('सावित्रीबाई फुले', '2026/02/Banners-Savitribai-Phule-3x6-1.webp', '2026/02/Banners-Savitribai-Phule3x6-1.pdf'),
      ],
    }),
    heading('सेल्फी पॉईंट'),
    block('image_gallery', {
      columns: 4, showCaptions: false,
      images: [poster('सेल्फी पॉईंट', '2026/01/selfie_point.webp', '2026/01/Selfie-Point-3x6-1.pdf')],
    }),
  ] as Block[],
};

export const CONTACT_PAGE = {
  title: 'संपर्क करा',
  slug: 'contact',
  excerpt: 'संविधान जागर अभियान निमंत्रक समिती',
  sections: [
    heading('संपर्क करा', { level: 1, align: 'center' }),
    columns([contactCard(), {
      title: 'अभियानात सहभागी व्हा!',
      text: 'आपल्या परिसरात संविधान जागर अभियान राबवण्यासाठी फॉर्म भरा, आम्ही आपल्याशी संपर्क करू.',
      buttonLabel: 'सामील व्हा', buttonUrl: 'https://tiny.cc/join-campaign', buttonVariant: 'primary', buttonNewTab: true,
    }]),
  ] as Block[],
};
