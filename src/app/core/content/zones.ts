import { Zone } from './zone.model';

export const ZONES: Zone[] = [
  {
    id: 'about',
    title: 'About',
    enabled: true,
    payload: {
      name: 'Hossain MD Farhad',
      tagline: 'Full Stack Web Developer · Software Engineer',
      bio: 'Recent M.Eng. graduate in Cloud-based Software Engineering with 4+ years building robust web applications — inventory systems, e-commerce platforms, automated billing, and large-scale API integrations. Passionate about efficient, scalable solutions that combine technical excellence with user-centric design. Based in Helsinki, Finland.'
    }
  },
  {
    id: 'education',
    title: 'Education',
    enabled: true,
    payload: {
      items: [
        {
          institution: 'Vaasa University of Applied Science (VAMK)',
          degree: 'M.Eng. — Cloud-based Software Engineering',
          period: '2025',
          details: 'Vaasa, Finland. Thesis on long-term user engagement in smart-home energy systems.'
        },
        {
          institution: 'University of Dhaka (DU)',
          degree: 'M.Sc. — Information Technology',
          period: '2023',
          details: 'Dhaka, Bangladesh.'
        }
      ]
    }
  },
  {
    id: 'skills',
    title: 'Skills',
    enabled: true,
    payload: {
      groups: [
        {
          name: 'Backend',
          items: ['C# / .NET Core', 'ASP.NET MVC', 'Web API', 'Entity Framework', 'Clean Architecture']
        },
        {
          name: 'Frontend',
          items: ['Angular 15+', 'TypeScript', 'JavaScript', 'RxJS', 'Bootstrap']
        },
        {
          name: 'Data & DevOps',
          items: ['SQL Server / T-SQL', 'Oracle 11g', 'MySQL', 'GitHub Actions', 'Hangfire']
        }
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
          company: 'AdvancePro Technologies',
          role: 'Senior Software Engineer (Freelance)',
          period: 'Jan 2023 – Present',
          summary: 'Backend architecture for a Canadian SaaS inventory platform integrated with QuickBooks, Shopify and Avalara.',
          highlights: [
            'Reduced search API response times by 30% via lean dedicated endpoints',
            'Integrated Authorize.net payments for 200+ active business clients',
            'Built robust RESTful APIs for third-party integrations'
          ]
        },
        {
          company: 'MobilityOne Sdn Bhd',
          role: 'Senior .NET Programmer',
          period: 'Dec 2022 – Aug 2024',
          summary: 'Public-facing eBilling system used across multiple Malaysian municipalities for utility payments.',
          highlights: [
            'Automated settlement via Hangfire for 200–300 daily real-time transactions',
            'Reduced pending settlements by 90%; >85% completion within 24 hours',
            'Maintained APIs across MSSQL and Oracle 11g'
          ]
        },
        {
          company: 'Prime Tech Solution Limited',
          role: 'Software Engineer',
          period: 'Mar 2018 – Dec 2022',
          summary: 'Full-stack delivery on .NET Core + Angular for e-commerce, distribution, and government projects.',
          highlights: [
            'Banglalink DMS: real-time SignalR for 4,500 distributors and 200,000 retailers',
            'AARMOIRE: modular Clean-Architecture e-commerce APIs with GitHub Actions CI/CD',
            'IRIDP-2: nationwide infrastructure tracking with role-based dashboards'
          ]
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
        {
          name: 'AdvancePro — Inventory Management System',
          blurb: 'Canadian SaaS for inventory, integrated with QuickBooks, Shopify and Avalara. Lean search API cut response times by 30%; Authorize.net payments for 200+ business clients.',
          tech: ['C# .NET Core', 'REST API', 'MSSQL', 'EF Core', 'n-tier'],
          link: 'https://aptx.ca/'
        },
        {
          name: 'eBilling — Municipal Payment Gateway',
          blurb: 'Public eBilling for Malaysian municipalities. Hangfire-driven automated settlement reduced pending transactions by 90% with >85% same-day completion.',
          tech: ['C# .NET Core', 'Web API', 'MSSQL', 'Oracle 11g', 'Hangfire'],
          link: 'https://www.mobilityonegroup.com/'
        },
        {
          name: 'Banglalink DMS',
          blurb: 'Distribution Management System serving 4,500 distributors and 200,000 retailers, with real-time SignalR updates across the supply chain.',
          tech: ['ASP.NET', 'MVC', 'EF', 'Oracle 11g', 'SignalR'],
          link: 'https://blkdms.banglalink.net/'
        },
        {
          name: 'AARMOIRE — E-Commerce Platform',
          blurb: 'Modular .NET Core + Angular e-commerce APIs with inventory, loyalty and reporting modules. Clean Architecture; GitHub Actions CI/CD.',
          tech: ['ASP.NET', 'Web API', 'EF', 'MSSQL', 'Angular'],
          link: 'https://aarmoire.com/'
        },
        {
          name: 'IRIDP-2 — Rural Infrastructure Tracking',
          blurb: 'ASP.NET MVC system for tracking nationwide infrastructure projects with role-based dashboards and performance analytics.',
          tech: ['ASP.NET MVC', 'EF', 'MSSQL', 'Repository Pattern'],
          link: 'https://oldweb.lged.gov.bd/ProjectHome.aspx'
        },
        {
          name: 'Voice-Enabled Semantic Flight Search (Bengali)',
          blurb: 'Voice-powered flight search for Bengali speakers — Bengali NLP, speech-to-text, semantic search and live airline API integration.',
          tech: ['Bengali NLP', 'Speech Recognition', 'Semantic Search', 'ML'],
          link: 'https://github.com/HMFarhad/VoiceSearch-Bengali'
        }
      ]
    }
  },
  {
    id: 'blogs',
    title: 'Blogs',
    enabled: true,
    payload: {
      items: [
        {
          title: 'I Built a Prompt Factory to Work Better with AI Coding Agents',
          date: '2025',
          url: 'https://medium.com/@HMFarhad/i-built-a-prompt-factory-to-work-better-with-ai-coding-agents-ff98800d99dd',
          excerpt: 'A simple workflow that turns rough developer tasks into structured prompts for AI coding agents — steering the agent before the plan exists rather than after.'
        },
        {
          title: 'GitHub Actions Self-Hosted Runner: Tackling Real Challenges',
          date: 'Jul 22, 2025',
          url: 'https://medium.com/@HMFarhad/my-journey-with-github-actions-self-hosted-runner-tackling-challenges-with-automation-and-810908275129',
          excerpt: 'Setting up a self-hosted runner on Windows for a .NET project: stale services, NETWORK SERVICE permissions, .NET install failures — and a workflow that saves 10–20 min per PR.'
        },
        {
          title: 'Understanding JWT Implementation Flow — A Simple Guide for Beginners',
          date: '2024',
          url: 'https://medium.com/@HMFarhad',
          excerpt: 'Step-by-step on issuing JWTs and refresh tokens, validating requests, and handling token expiry without forcing the user to log in again.'
        }
      ]
    }
  },
  {
    id: 'contact',
    title: 'Contact',
    enabled: true,
    payload: {
      email: 'hssnmd.farhad@gmail.com',
      links: [
        { label: 'GitHub — HMFarhad', url: 'https://github.com/HMFarhad' },
        { label: 'LinkedIn — hmfarhad', url: 'https://www.linkedin.com/in/hmfarhad/' },
        { label: 'Medium — @HMFarhad', url: 'https://medium.com/@HMFarhad' },
        { label: 'Phone — +358 40 246 7814', url: 'tel:+358402467814' }
      ]
    }
  }
];

export const ACTIVE_ZONES: Zone[] = (() => {
  const order: Zone['id'][] = [
    'about', 'skills', 'experience', 'projects', 'education', 'blogs', 'contact'
  ];
  const enabled = ZONES.filter((z) => z.enabled);
  return order
    .map((id) => enabled.find((z) => z.id === id))
    .filter((z): z is Zone => !!z);
})();
