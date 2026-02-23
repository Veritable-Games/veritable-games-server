/**
 * Anarchist Tag Categories and Seeds
 *
 * Comprehensive categorization framework for anarchist/political literature
 * with keyword-based auto-tagging support
 */

export interface AnarchistTagCategory {
  name: string;
  type: string;
  description: string;
  color: string;
  display_order: number;
}

export interface AnarchistTag {
  name: string;
  category_type: string;
  keywords: string[]; // Used for auto-tagging
  description?: string;
}

/**
 * 8 Core Anarchist Categories
 */
export const ANARCHIST_TAG_CATEGORIES: AnarchistTagCategory[] = [
  {
    name: 'Political Theory',
    type: 'political_theory',
    description: 'Anarchism, political philosophy, and revolutionary theory',
    color: '#FF6B6B',
    display_order: 1,
  },
  {
    name: 'Economics & Labor',
    type: 'economics',
    description: 'Labor organizing, mutual aid, cooperative economics, anti-capitalism',
    color: '#4ECDC4',
    display_order: 2,
  },
  {
    name: 'Social Justice',
    type: 'social_justice',
    description: 'Feminism, racism, disability justice, intersectionality, class struggle',
    color: '#95E1D3',
    display_order: 3,
  },
  {
    name: 'Technology & Science',
    type: 'technology',
    description: 'Digital resistance, AI ethics, cybernetics, technical autonomy',
    color: '#A8E6CF',
    display_order: 4,
  },
  {
    name: 'History & Movements',
    type: 'history',
    description: 'Labor history, social movements, resistance movements, archival',
    color: '#FFD3B6',
    display_order: 5,
  },
  {
    name: 'Education & Culture',
    type: 'education',
    description: 'Critical pedagogy, philosophy, consciousness, cultural resistance',
    color: '#FFAAA5',
    display_order: 6,
  },
  {
    name: 'Environment & Ecology',
    type: 'environment',
    description: 'Permaculture, indigenous knowledge, climate justice, bioregionalism',
    color: '#76C7AD',
    display_order: 7,
  },
  {
    name: 'Community & Organization',
    type: 'community',
    description: 'Collective action, consensus, solidarity, mutual aid networks',
    color: '#FFDDC1',
    display_order: 8,
  },
];

/**
 * Comprehensive Anarchist Tags with Keywords for Auto-Tagging
 */
export const ANARCHIST_TAGS: AnarchistTag[] = [
  // Political Theory
  {
    name: 'Anarchism',
    category_type: 'political_theory',
    keywords: ['anarchism', 'anarchist', 'anarchy', 'libertarian', 'non-hierarchical'],
    description: 'Core anarchist political philosophy',
  },
  {
    name: 'Critiques of Authority',
    category_type: 'political_theory',
    keywords: ['authority', 'hierarchies', 'power', 'domination', 'coercion'],
    description: 'Analysis of power structures and authority',
  },
  {
    name: 'Revolutionary Theory',
    category_type: 'political_theory',
    keywords: ['revolution', 'insurrection', 'uprising', 'insurgent', 'rebellion'],
    description: 'Revolutionary and insurrectionary approaches',
  },
  {
    name: 'Direct Action',
    category_type: 'political_theory',
    keywords: ['direct action', 'civil disobedience', 'sabotage', 'resistance', 'protest'],
    description: 'Direct action and grassroots resistance tactics',
  },
  {
    name: 'Autonomy & Self-Determination',
    category_type: 'political_theory',
    keywords: ['autonomy', 'self-determination', 'self-governance', 'independence', 'sovereignty'],
    description: 'Autonomy, self-governance, and self-determination',
  },

  // Economics & Labor
  {
    name: 'Labor Organizing',
    category_type: 'economics',
    keywords: ['labor', 'labor organizing', 'workers', 'union', 'strike', 'workplace'],
    description: 'Worker organizing and labor movements',
  },
  {
    name: 'Mutual Aid',
    category_type: 'economics',
    keywords: ['mutual aid', 'cooperation', 'cooperative', 'solidarity economy'],
    description: 'Mutual aid and cooperative economics',
  },
  {
    name: 'Anti-Capitalism',
    category_type: 'economics',
    keywords: ['capitalism', 'capitalist', 'anti-capitalist', 'post-capitalist', 'anti-corporate'],
    description: 'Critique of capitalism and capitalist systems',
  },
  {
    name: 'Anarcho-Communism',
    category_type: 'economics',
    keywords: ['communism', 'communist', 'abolish currency', 'from each according to ability'],
    description: 'Anarcho-communist theory and practice',
  },
  {
    name: 'Syndicalism',
    category_type: 'economics',
    keywords: ['syndicalism', 'syndicalist', 'IWW', 'general strike', 'workers council'],
    description: 'Syndicalism and worker control',
  },
  {
    name: 'Commons & Shared Resources',
    category_type: 'economics',
    keywords: ['commons', 'common pool', 'shared resources', 'gift economy'],
    description: 'Commons, shared resources, and gift economies',
  },

  // Social Justice
  {
    name: 'Feminism & Gender',
    category_type: 'social_justice',
    keywords: ['feminism', 'feminist', 'gender', 'patriarchy', 'sexism', 'womens liberation'],
    description: 'Feminist theory and womens liberation',
  },
  {
    name: 'Anti-Racism',
    category_type: 'social_justice',
    keywords: ['racism', 'anti-racism', 'race', 'racial justice', 'decolonization'],
    description: 'Anti-racism and racial justice',
  },
  {
    name: 'Disability Justice',
    category_type: 'social_justice',
    keywords: ['disability', 'disabled', 'accessibility', 'neurodiversity', 'ableism'],
    description: 'Disability justice and accessibility',
  },
  {
    name: 'LGBTQ+ Liberation',
    category_type: 'social_justice',
    keywords: ['LGBTQ', 'queer', 'trans', 'homosexual', 'sexuality', 'gender identity'],
    description: 'LGBTQ+ and sexual liberation',
  },
  {
    name: 'Class Struggle',
    category_type: 'social_justice',
    keywords: ['class', 'class struggle', 'working class', 'poverty', 'inequality'],
    description: 'Class analysis and class struggle',
  },
  {
    name: 'Prison Abolition',
    category_type: 'social_justice',
    keywords: ['prison', 'abolition', 'incarceration', 'police', 'criminal justice'],
    description: 'Prison and police abolition',
  },
  {
    name: 'Intersectionality',
    category_type: 'social_justice',
    keywords: ['intersectionality', 'intersectional', 'oppression', 'liberation'],
    description: 'Intersectional analysis of oppressions',
  },

  // Technology & Science
  {
    name: 'Digital Resistance',
    category_type: 'technology',
    keywords: ['digital', 'technology', 'surveillance', 'privacy', 'hacking', 'cybernetics'],
    description: 'Digital resistance and privacy',
  },
  {
    name: 'AI Ethics',
    category_type: 'technology',
    keywords: ['AI', 'artificial intelligence', 'algorithm', 'automation', 'algorithms'],
    description: 'AI and algorithm ethics',
  },
  {
    name: 'Open Source',
    category_type: 'technology',
    keywords: ['open source', 'free software', 'FOSS', 'copyleft'],
    description: 'Open source and free software',
  },
  {
    name: 'Internet Freedom',
    category_type: 'technology',
    keywords: ['internet freedom', 'net neutrality', 'censorship', 'decentralization'],
    description: 'Internet freedom and decentralization',
  },

  // History & Movements
  {
    name: 'Labor History',
    category_type: 'history',
    keywords: ['labor history', 'labor movement', 'workers history', 'labor struggle'],
    description: 'History of labor movements',
  },
  {
    name: 'Social Movements',
    category_type: 'history',
    keywords: ['social movement', 'movements', 'grassroots', 'popular movements'],
    description: 'Social and political movements',
  },
  {
    name: 'Resistance & Rebellion',
    category_type: 'history',
    keywords: ['resistance', 'rebellion', 'struggle', 'insurgency', 'unrest'],
    description: 'Historical and contemporary resistance',
  },
  {
    name: 'Oral History & Archives',
    category_type: 'history',
    keywords: ['oral history', 'archive', 'archival', 'primary source', 'testimony'],
    description: 'Oral histories and archival materials',
  },

  // Education & Culture
  {
    name: 'Critical Pedagogy',
    category_type: 'education',
    keywords: ['pedagogy', 'education', 'learning', 'teaching', 'consciousness raising'],
    description: 'Critical pedagogy and transformative education',
  },
  {
    name: 'Philosophy',
    category_type: 'education',
    keywords: ['philosophy', 'philosophical', 'theory', 'epistemology', 'ontology'],
    description: 'Philosophical inquiry and theory',
  },
  {
    name: 'Cultural Resistance',
    category_type: 'education',
    keywords: ['culture', 'art', 'music', 'literature', 'cultural', 'creative'],
    description: 'Culture and artistic resistance',
  },
  {
    name: 'Media & Narrative',
    category_type: 'education',
    keywords: ['media', 'narrative', 'storytelling', 'representation', 'discourse'],
    description: 'Media critique and narrative analysis',
  },
  {
    name: 'Consciousness & Identity',
    category_type: 'education',
    keywords: ['consciousness', 'consciousness raising', 'identity', 'subjectivity'],
    description: 'Consciousness and identity formation',
  },

  // Environment & Ecology
  {
    name: 'Environmental Justice',
    category_type: 'environment',
    keywords: [
      'environment',
      'environmental',
      'ecology',
      'ecological',
      'climate',
      'sustainability',
    ],
    description: 'Environmental and ecological justice',
  },
  {
    name: 'Permaculture & Land',
    category_type: 'environment',
    keywords: ['permaculture', 'agriculture', 'land', 'farming', 'food sovereignty'],
    description: 'Permaculture and land-based practices',
  },
  {
    name: 'Indigenous Knowledge',
    category_type: 'environment',
    keywords: ['indigenous', 'native', 'bioregionalism', 'land stewardship', 'traditional'],
    description: 'Indigenous knowledge and practices',
  },
  {
    name: 'Deep Ecology',
    category_type: 'environment',
    keywords: ['deep ecology', 'biocentrism', 'ecocentrism', 'earth liberation'],
    description: 'Deep ecology and earth liberation',
  },

  // Community & Organization
  {
    name: 'Mutual Aid Networks',
    category_type: 'community',
    keywords: ['mutual aid', 'networks', 'community care', 'collective support'],
    description: 'Mutual aid networks and community care',
  },
  {
    name: 'Consensus & Assembly',
    category_type: 'community',
    keywords: ['consensus', 'assembly', 'participatory', 'democratic', 'collective decision'],
    description: 'Consensus and participatory decision-making',
  },
  {
    name: 'Solidarity',
    category_type: 'community',
    keywords: ['solidarity', 'solidarity economy', 'mutual support', 'aid'],
    description: 'Solidarity and mutual support',
  },
  {
    name: 'Prefigurative Politics',
    category_type: 'community',
    keywords: ['prefigurative', 'prefiguration', 'experimentation', 'living differently'],
    description: 'Prefigurative politics and alternatives',
  },
  {
    name: 'Decentralization',
    category_type: 'community',
    keywords: ['decentralization', 'decentralized', 'horizontal', 'federation', 'autonomy'],
    description: 'Decentralized and horizontal organization',
  },
];
