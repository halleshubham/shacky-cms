// Tiny UI-chrome translation table for the public site. Content is authored in the
// CMS in whatever language the site uses; this only covers fixed labels in the shell
// (header, footer, search). Unknown languages fall back to English.

export type UiLang = 'en' | 'mr' | 'hi';

const STRINGS = {
  en: {
    toggleSearch: 'Toggle search',
    toggleMenu: 'Toggle menu',
    searchPlaceholder: 'Search articles, authors, topics…',
    publication: 'Publication',
    home: 'Home',
    allIssues: 'All Issues',
    links: 'Links',
    sections: 'Sections',
    followUs: 'Follow Us',
    rightsReserved: 'All rights reserved.',
    skipToContent: 'Skip to content',
    notFoundTitle: 'Page not found',
    notFoundText: 'The page you are looking for does not exist or has moved.',
    backHome: 'Back to home',
  },
  mr: {
    toggleSearch: 'शोध उघडा/बंद करा',
    toggleMenu: 'मेनू उघडा/बंद करा',
    searchPlaceholder: 'लेख, लेखक, विषय शोधा…',
    publication: 'प्रकाशन',
    home: 'मुख्यपृष्ठ',
    allIssues: 'सर्व अंक',
    links: 'दुवे',
    sections: 'विभाग',
    followUs: 'आम्हाला फॉलो करा',
    rightsReserved: 'सर्व हक्क राखीव.',
    skipToContent: 'मजकुराकडे जा',
    notFoundTitle: 'पान सापडले नाही',
    notFoundText: 'आपण शोधत असलेले पान अस्तित्वात नाही किंवा हलवले गेले आहे.',
    backHome: 'मुख्यपृष्ठावर परत जा',
  },
  hi: {
    toggleSearch: 'खोज खोलें/बंद करें',
    toggleMenu: 'मेनू खोलें/बंद करें',
    searchPlaceholder: 'लेख, लेखक, विषय खोजें…',
    publication: 'प्रकाशन',
    home: 'मुख्य पृष्ठ',
    allIssues: 'सभी अंक',
    links: 'लिंक',
    sections: 'अनुभाग',
    followUs: 'हमें फ़ॉलो करें',
    rightsReserved: 'सर्वाधिकार सुरक्षित।',
    skipToContent: 'मुख्य सामग्री पर जाएँ',
    notFoundTitle: 'पृष्ठ नहीं मिला',
    notFoundText: 'आप जो पृष्ठ खोज रहे हैं वह मौजूद नहीं है या स्थानांतरित हो गया है।',
    backHome: 'मुख्य पृष्ठ पर लौटें',
  },
} as const;

export type UiKey = keyof (typeof STRINGS)['en'];

export function uiStrings(lang?: string): Record<UiKey, string> {
  const code = (lang || 'en').toLowerCase().split('-')[0] as UiLang;
  return STRINGS[code] ?? STRINGS.en;
}
