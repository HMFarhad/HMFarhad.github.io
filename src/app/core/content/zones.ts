import { Zone } from './zone.model';

export const ZONES: Zone[] = [
  {
    id: 'about',
    title: 'About',
    enabled: true,
    payload: {
      name: 'H. M. Farhad',
      tagline: 'Software engineer · Forest wanderer',
      bio: 'I build expressive interfaces and quietly photoreal 3D worlds. This portfolio is a walk through what I have made and what I love.'
    }
  },
  {
    id: 'education',
    title: 'Education',
    enabled: true,
    payload: {
      items: [
        { institution: 'Your University', degree: 'B.Sc. in Computer Science', period: '20XX – 20XX', details: 'Honours; specialised in graphics and systems.' }
      ]
    }
  },
  {
    id: 'skills',
    title: 'Skills',
    enabled: true,
    payload: {
      groups: [
        { name: 'Frontend', items: ['Angular', 'TypeScript', 'SCSS', 'RxJS'] },
        { name: '3D / Graphics', items: ['Three.js', 'WebGL', 'GLSL', 'PBR / IBL'] },
        { name: 'Backend', items: ['Node.js', 'C#', '.NET', 'PostgreSQL'] }
      ]
    }
  },
  {
    id: 'experience',
    title: 'Experience',
    enabled: true,
    payload: {
      items: [
        {
          company: 'Company A',
          role: 'Senior Software Engineer',
          period: '20XX – Present',
          summary: 'Led front-end architecture for a multi-tenant SaaS platform.',
          highlights: ['Reduced bundle size by 38%', 'Introduced design system', 'Mentored four engineers']
        }
      ]
    }
  },
  {
    id: 'projects',
    title: 'Projects',
    enabled: true,
    payload: {
      items: [
        { name: 'Cloud Forest', blurb: 'A 3D portfolio walk through a stylised photoreal forest.', tech: ['Angular', 'Three.js', 'GLSL'] },
        { name: 'Project Two', blurb: 'Placeholder for another notable project.', tech: ['TypeScript', 'Node.js'] }
      ]
    }
  },
  {
    id: 'blogs',
    title: 'Blogs',
    enabled: true,
    payload: {
      items: [
        { title: 'Photoreal forests on the web', date: '2026-01-01', url: '#', excerpt: 'Notes on IBL, billboard imposters, and getting from "low-poly toy" to "moody walk".' }
      ]
    }
  },
  {
    id: 'contact',
    title: 'Contact',
    enabled: true,
    payload: {
      email: 'hello@example.com',
      links: [
        { label: 'GitHub', url: 'https://github.com/HMFarhad' },
        { label: 'LinkedIn', url: 'https://www.linkedin.com/' }
      ]
    }
  }
];

export const ACTIVE_ZONES: Zone[] = ZONES.filter((z) => z.enabled);
