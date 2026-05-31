import { Zone } from './zone.model';

export const ZONES: Zone[] = [
  {
    id: 'about',
    title: 'About',
    enabled: true,
    payload: {
      name: 'Hossain Mohammad Farhad',
      tagline: 'Full Stack Web Developer | C# .NET Core, Angular, MSSQL | Scalable API & Cloud Solutions',
      // Paragraphs are separated by blank lines. The HTML page renders this
      // with `white-space: pre-line`; the 3D landmark in landmarks.ts splits
      // on the same blank-line marker to lay out one paragraph at a time.
      bio:
        "If you're scanning for a rockstar developer, you can stop here. That's not me. I'm a regular engineer who shows up every day and moves forward in small, consistent steps. Progress, for me, is a straight line drawn slowly, not a spike on a chart.\n\n" +
        "When I face a new problem, my first attempt is rarely the clever shortcut. More often, it's the longer, more obvious path, the one that actually gets me to a working result. Only after that does the real work begin: going back, questioning every choice, and reshaping the solution until it's something I'd be comfortable defending. Optimization isn't an afterthought for me. It's the second half of the job.\n\n" +
        "I'm not a jack of all trades, and I don't pretend to be. But when a project needs it, I can deep dive into the specifics faster than I used to, thanks to AI as a learning tool. If the team needs someone to take on something unfamiliar, I'm happy to be that person and get up to speed quickly."
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
          details: 'Vaasa, Finland.'
        },
        {
          institution: 'American International University Bangladesh (AIUB)',
          degree: 'B.Sc. — Computer Science and Engineering',
          period: '2018',
          details: 'Dhaka, Bangladesh.'
        },
        {
          institution: 'Languages',
          degree: 'Bengali — Native  ·  English — Advanced (TOEFL 96/120)  ·  Finnish — Actively learning',
          period: '',
          details: ''
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
          items: ['C#', 'ASP.NET', 'ASP.NET MVC', 'Web API', '.NET Core', 'EF Core', 'Entity Framework']
        },
        {
          name: 'Frontend',
          items: ['Angular', 'TypeScript', 'JavaScript']
        },
        {
          name: 'Databases',
          items: ['MSSQL', 'Oracle 11g']
        },
        {
          name: 'Practices',
          items: ['REST API design', 'Clean Architecture', 'n-tier', 'MVC', 'OOP', 'Unit & integration testing']
        },
        {
          name: 'Tooling',
          items: ['Git', 'GitHub Actions (CI/CD)', 'JIRA', 'HanSoft', 'Agile / Scrum', 'AI-assisted development']
        },
        {
          name: 'Communication',
          items: ['Stakeholder collaboration', 'Code reviews', 'Technical documentation']
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
          role: 'Software Engineer (Freelance)',
          period: 'Jan 2023 – Sep 2025',
          summary: 'Canadian SaaS inventory management platform integrated with Shopify, WooCommerce and QuickBooks.',
          highlights: [
            'Designed and optimized backend REST APIs in C#, .NET Core and EF Core, supporting real-time inventory and order operations for 200+ active business clients.',
            'Identified bottlenecks in an existing API surface and redesigned endpoints beyond strict REST conventions, reducing response times by ~30% under peak load.',
            'Delivered reliable data synchronization across multiple external systems, ensuring consistency for inventory, orders and financial data.',
            'Contributed to code reviews and refactoring, improving maintainability and reducing production issues.'
          ]
        },
        {
          company: 'MobilityOne Sdn Bhd',
          role: '.NET Programmer',
          period: 'Dec 2022 – Aug 2024',
          summary: 'Public-facing eBilling platform handling high-volume financial transactions.',
          highlights: [
            'Designed and shipped an automated settlement system using Hangfire background jobs on .NET Core / MS SQL, reducing manual processing by 90% and bringing 85% of transactions to completion within 24 hours.',
            'Built backend services with Clean Architecture, working closely with support and business teams to ensure transaction reliability across payment gateways.',
            'Contributed to backend architecture and consistent transaction handling across distributed components.'
          ]
        },
        {
          company: 'Prime Tech Solution Limited',
          role: 'Software Engineer',
          period: 'Mar 2018 – Dec 2020',
          summary: 'Dynamic software farm — full-stack delivery across distribution, government and e-commerce projects.',
          highlights: [
            'Enhanced supply-chain transparency in the Banglalink DMS system serving 4,500 distributors and 200,000 retailers, implementing real-time updates with SignalR.',
            'Delivered an ASP.NET MVC system for IRIDP-2, enabling government-wide infrastructure project tracking with role-based dashboards and performance analytics.',
            'Built modular .NET Core + Angular e-commerce APIs for AARMOIRE, with CI/CD pipelines via GitHub Actions.'
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
