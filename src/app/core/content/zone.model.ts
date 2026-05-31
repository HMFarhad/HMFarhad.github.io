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

export interface ProjectItem {
  name: string;
  blurb: string;
  tech: string[];
  link?: string;
  imageUrl?: string;
}

export interface BlogItem {
  title: string;
  date: string;
  url: string;
  excerpt: string;
}

export interface ContactPayload {
  email: string;
  links: { label: string; url: string }[];
}

export type Zone =
  | ZoneBase<'about', AboutPayload>
  | ZoneBase<'education', { items: EducationItem[] }>
  | ZoneBase<'skills', SkillsPayload>
  | ZoneBase<'experience', { items: ExperienceItem[] }>
  | ZoneBase<'projects', { items: ProjectItem[] }>
  | ZoneBase<'blogs', { items: BlogItem[] }>
  | ZoneBase<'contact', ContactPayload>;
