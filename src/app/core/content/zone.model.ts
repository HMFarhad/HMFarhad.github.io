// Discriminated union over zone ids.
export type ZoneId =
  | 'about'
  | 'education'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'blogs'
  | 'contact';

interface ZoneBase<TId extends ZoneId, TPayload> {
  id: TId;
  title: string;
  enabled: boolean;
  payload: TPayload;
}

export interface AboutPayload {
  name: string;
  tagline: string;
  bio: string;
  avatarUrl?: string;
}

export interface EducationItem {
  institution: string;
  degree: string;
  period: string;
  details?: string;
}

export interface SkillsPayload {
  groups: { name: string; items: string[] }[];
}

export interface ExperienceItem {
  company: string;
  role: string;
  period: string;
  summary: string;
  highlights?: string[];
}

/**
 * Rich single-experience payload used by the per-job "experience-*"
 * sub-zones. Each job gets its own zone / holographic screen along the
 * trail, mirroring the card layout used on the legacy text site.
 */
export interface SingleExperiencePayload {
  role: string;
  company: string;
  /** Short description of the platform / product. */
  blurb: string;
  period: string;
  /** Single-line lead-in below the period. */
  summary: string;
  /** 2–4 bullet contributions. */
  highlights: string[];
  /** The problem encountered on the project. */
  challenge: string;
  /** How that problem was solved. */
  resolution: string;
  /** Tech stack chips shown at the bottom of the card. */
  tech: string[];
}

export interface ProjectItem {
  name: string;
  blurb: string;
  tech: string[];
  link?: string;
  /** Label for `link` (e.g. "Visit Site", "GitHub", "View Paper"). */
  linkLabel?: string;
  /** Short category tag shown above the project name (e.g. "Professional Work"). */
  category?: string;
  imageUrl?: string;
}

export interface BlogItem {
  title: string;
  date: string;
  url: string;
  excerpt: string;
  readTime?: string;
  tags?: string[];
}

export interface ContactPayload {
  email: string;
  links: { label: string; url: string }[];
}

export type Zone =
  | ZoneBase<'about', AboutPayload>
  | ZoneBase<'education', { items: EducationItem[] }>
  | ZoneBase<'skills', SkillsPayload>
  | ZoneBase<'experience', { items: SingleExperiencePayload[] }>
  | ZoneBase<'projects', { items: ProjectItem[] }>
  | ZoneBase<'blogs', { items: BlogItem[] }>
  | ZoneBase<'contact', ContactPayload>;
