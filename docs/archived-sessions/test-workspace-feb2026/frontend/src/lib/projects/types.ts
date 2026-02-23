// Project-related type definitions

export interface ProjectMetadata {
  project_slug: string;
  status: 'In Development' | 'Pre-Production' | 'Planning' | 'Concept' | 'Archive';
  category: string;
  color: string;
  display_order: number;
  edit_locked: boolean;
  last_major_edit?: string;
  content_structure?: ProjectContentStructure;
}

export interface ProjectContentStructure {
  sections: ProjectSectionConfig[];
  features?: string[];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ProjectSectionConfig {
  key: string;
  title: string;
  description?: string;
  order: number;
  icon?: string;
  visible: boolean;
  editable: boolean;
}

export interface ProjectSection {
  id?: number;
  project_slug: string;
  section_key: string;
  display_order: number;
  is_visible: boolean;
}

export interface ProjectWithContent {
  metadata: ProjectMetadata;
  content?: string;
  sections: ProjectSection[];
  last_revision?: ProjectRevisionSummary;
}

export interface ProjectRevisionSummary {
  id: number;
  summary?: string | null;
  author_id?: number | null;
  author_name: string;
  revision_timestamp: string;
  size_bytes: number;
  is_minor: number;
}

export interface ContentReference {
  id?: number;
  source_type: 'project' | 'wiki' | 'forum';
  source_id: string;
  target_type: 'project' | 'wiki' | 'forum';
  target_id: string;
  reference_context?: string;
  created_at?: string;
}

export interface ProjectEditRequest {
  content: string;
  summary: string;
  is_minor?: boolean;
}

export interface ProjectListItem {
  project_slug: string;
  title: string;
  status: ProjectMetadata['status'];
  category: string;
  color: string;
  description?: string;
  last_updated?: string;
  content_preview?: string;
}

// Default project section configurations
export const DEFAULT_PROJECT_SECTIONS: ProjectSectionConfig[] = [
  {
    key: 'overview',
    title: 'Overview',
    description: 'Project summary and key information',
    order: 0,
    icon: '📋',
    visible: true,
    editable: true,
  },
  {
    key: 'gameplay',
    title: 'Gameplay',
    description: 'Game mechanics, controls, and systems',
    order: 1,
    icon: '🎮',
    visible: true,
    editable: true,
  },
  {
    key: 'narrative',
    title: 'Narrative & Setting',
    description: 'Story, characters, and world-building',
    order: 2,
    icon: '📖',
    visible: true,
    editable: true,
  },
  {
    key: 'assets',
    title: 'Asset Requirements',
    description: 'Art, audio, and technical assets',
    order: 3,
    icon: '🎨',
    visible: true,
    editable: true,
  },
  {
    key: 'goals',
    title: 'Project Goals',
    description: 'Vision, objectives, and success metrics',
    order: 4,
    icon: '🎯',
    visible: true,
    editable: true,
  },
  {
    key: 'marketing',
    title: 'Outreach & Marketing',
    description: 'Promotion, community, and distribution',
    order: 5,
    icon: '📢',
    visible: true,
    editable: true,
  },
  {
    key: 'production',
    title: 'Production',
    description: 'Development timeline, resources, and costs',
    order: 6,
    icon: '⚙️',
    visible: true,
    editable: true,
  },
];

// Project status configurations
export const PROJECT_STATUS_CONFIG = {
  'In Development': {
    color: '#DC2626',
    description: 'Active development with regular updates',
    priority: 0,
  },
  'Pre-Production': {
    color: '#EA580C',
    description: 'Planning and prototyping phase',
    priority: 1,
  },
  Planning: {
    color: '#0891B2',
    description: 'Design and conceptualization stage',
    priority: 2,
  },
  Concept: {
    color: '#7C3AED',
    description: 'Initial idea development',
    priority: 3,
  },
  Archive: {
    color: '#4B5563',
    description: 'Historical or completed projects',
    priority: 4,
  },
} as const;

// Project category configurations
export const PROJECT_CATEGORIES = [
  'Action-Adventure',
  'Adventure',
  'Sci-Fi Adventure',
  'Tactical Shooter',
  'Co-op Shooter',
  'Platformer',
  'RPG',
  'Strategy',
  'Simulation',
  'Puzzle',
  'Experimental',
] as const;

export type ProjectStatus = keyof typeof PROJECT_STATUS_CONFIG;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];
