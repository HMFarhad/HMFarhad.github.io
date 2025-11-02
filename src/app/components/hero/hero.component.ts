import { Component, OnInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

interface FeaturedProject {
  title: string;
  description: string;
  impact: string;
  technologies: string[];
  link?: string;
  github?: string;
  image?: string;
  category?: string;
}

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent implements OnInit, OnDestroy {
  private intervalId: any;
  currentProjectIndex = 0;
  private isBrowser: boolean;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }
  
  allProjects: FeaturedProject[] = [
    // Professional Projects
    {
      title: 'AdvancePro - Inventory Management System',
      description: 'AdvancePro is a Canadian SaaS company providing inventory management solutions integrated with QuickBooks, Shopify, Avalara and other platforms. Enhanced API efficiency by doing a deep performance analysis and moving beyond strict REST conventions to design a lean, dedicated search API that returned only essential data, <strong>reducing response times by 30%</strong>. Integrated payment workflows with Authorize.net, enabling secure online transactions and automated invoice generation for <strong>200+ active business clients</strong>.',
      impact: 'Reduced API response times by 30% and enabled secure transactions for 200+ active business clients',
      technologies: ['C# (.NET Core)', 'REST API', 'MSSQL', 'Entity Framework Core', 'Integration', 'MVC'],
      link: 'https://aptx.ca/',
      image: 'assets/images/projects/AdvancePro.png',
      category: 'SaaS Platform'
    },
    {
      title: 'eBilling System - Municipal Payment Gateway',
      description: 'MobilityOne Sdn Bhd is a Malaysia-based FinTech company that provides e-payment solutions and platforms for prepaid distribution, and electronic transactions. Built and maintained APIs in .NET Core with MSSQL and Oracle for a public-facing eBilling system used across multiple municipalities, enabling continuous payments for utility bills. Developed an automated settlement system using Hangfire background jobs to handle <strong>200–300 real-time daily transactions</strong>, <strong>reducing pending settlements by 90%</strong> and achieving <strong>>85% completion within 24 hours</strong>.',
      impact: 'Reduced pending settlements by 90% with 200-300 daily transactions achieving >85% completion within 24 hours',
      technologies: ['C# (.NET Core)', 'Web API', 'MSSQL', 'Oracle 11g', 'API Integration', 'Hangfire'],
      link: 'https://www.mobilityonegroup.com/',
      image: 'assets/images/projects/eBilling.png'
    },
    {
      title: 'Banglalink Distribution Management System (DMS)',
      description: 'Enhanced supply chain transparency in the Banglalink DMS system serving <strong>4,500 distributors and 200,000 retailers</strong>, implementing <strong>real-time updates with SignalR</strong>. A comprehensive web-based solution that manages supply chain and logistics activities including warehouse inventory management among Distributor, RSO, Retailer and related entities. Successfully streamlined operations and improved data consistency across the entire distribution network.',
      impact: 'Enhanced supply chain transparency for 4,500 distributors and 200,000 retailers with real-time updates',
      technologies: ['C# (ASP.NET)', 'MVC', 'Entity Framework', 'Oracle 11g', 'SignalR', 'n-tier Architecture'],
      link: 'https://blkdms.banglalink.net/',
      image: 'assets/images/projects/BL_DMS.png'
    },
    {
      title: 'IRIDP-2 - Government Infrastructure',
      description: 'Government system for tracking nationwide infrastructure projects including roads, bridges, and culverts.',
      impact: 'Enabled nationwide infrastructure project tracking with role-based dashboards and performance analytics',
      technologies: ['C# (ASP.NET)', 'MSSQL', 'MVC', 'Repository Pattern'],
      link: 'https://oldweb.lged.gov.bd/ProjectHome.aspx',
      image: 'assets/images/projects/IRIDP.png'
    },
    {
      title: 'AARMOIRE - E-Commerce Platform',
      description: '.NET Core & Angular based e-Commerce Web Application with inventory, sales, loyalty modules and reporting features.',
      impact: 'Built modular APIs with Clean Architecture and CI/CD pipelines via GitHub Actions',
      technologies: ['C# (ASP.NET)', 'Web API', 'Angular', 'Clean Architecture'],
      link: 'https://aarmoire.com/',
      image: 'assets/images/projects/Aarmoire.png'
    },
    {
      title: 'LKSS & LKSS-HRC Business Automation',
      description: 'Full-stack automation system for government-affiliated welfare and HR organizations in Bangladesh.',
      impact: 'Streamlined operations across financial accounting, HR/payroll, and project lifecycle tracking',
      technologies: ['ASP.NET MVC (C#)', 'MSSQL', 'RDLC Reporting', 'Azure'],
      link: 'https://www.developmentaid.org/organizations/view/106609/lkss-human-resource-center-lkss-hrc',
      image: 'assets/images/projects/LKSS.png'
    },
    // Academic & Personal Projects
    {
      title: 'eCommerce Demo Platform',
      description: 'Comprehensive e-commerce demonstration showcasing modern software architecture patterns and best practices.',
      impact: 'Demonstrates enterprise-level development methodologies with Clean Architecture',
      technologies: ['.NET Core', 'Clean Architecture', 'MSSQL', 'Repository Pattern'],
      github: 'https://github.com/HMFarhad/eCommerce-DEMO',
      image: 'assets/images/projects/e-commerce.jpeg'
    },
    {
      title: 'Smart Home Energy Systems Research',
      description: 'Master\'s thesis on enhancing long-term user engagement in smart home energy systems through personalized feedback.',
      impact: 'Contributed to understanding user behavior in energy management systems',
      technologies: ['Research', 'Data Analysis', 'UX Design', 'Academic Writing'],
      link: 'https://www.theseus.fi/handle/10024/890922',
      image: 'assets/images/projects/VAMK.jpg'
    },
    {
      title: 'Voice Search for Bengali Language',
      description: 'Voice-powered flight search application designed specifically for Bengali speakers with NLP and semantic search.',
      impact: 'Addressed native language gap in travel booking systems with advanced AI',
      technologies: ['Bengali NLP', 'Speech Recognition', 'Machine Learning', 'Flight API'],
      github: 'https://github.com/HMFarhad/VoiceSearch-Bengali',
      image: 'assets/images/projects/VoiceSearch.png'
    },
    {
      title: 'Optical Character Recognition',
      description: 'Intelligent handwriting recognition system for digitizing handwritten text using computer vision techniques.',
      impact: 'Automated document digitization with advanced image processing algorithms',
      technologies: ['MATLAB', 'Image Processing', 'KNN', 'Computer Vision'],
      github: 'https://github.com/HMFarhad/Simple-OCR',
      image: 'assets/images/projects/OCR.png'
    },
    {
      title: 'AI Eight Puzzle Solver',
      description: 'Comprehensive AI project implementing fundamental search algorithms to solve the classic 8-puzzle problem.',
      impact: 'Demonstrated advanced algorithmic problem-solving with heuristic optimization',
      technologies: ['AI', 'Search Algorithms', 'A* Algorithm', 'Heuristics'],
      image: 'assets/images/projects/EightPuzzle.png'
    },
    {
      title: 'Flappy Bird Game - OpenGL',
      description: 'Recreation of the famous Flappy Bird game using OpenGL in C++ with desktop gaming experience.',
      impact: 'Showcased game development skills with graphics programming',
      technologies: ['C++', 'OpenGL', 'GLUT', 'Game Development'],
      github: 'https://github.com/HMFarhad/Flappy-Bird-using-Open-GL',
      image: 'assets/images/projects/flappyBird.jpeg'
    }
  ];

  ngOnInit(): void {
    // Only start auto-slide in browser environment after component is stable
    if (this.isBrowser) {
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        this.startAutoSlide();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.intervalId && this.isBrowser) {
      clearInterval(this.intervalId);
    }
  }

  startAutoSlide(): void {
    if (this.isBrowser && typeof window !== 'undefined') {
      // Add a small delay to ensure the component is fully rendered
      setTimeout(() => {
        this.intervalId = setInterval(() => {
          this.nextProject();
        }, 5000); // Auto-slide every 5 seconds
      }, 1000);
    }
  }

  nextProject(): void {
    this.currentProjectIndex = (this.currentProjectIndex + 1) % this.allProjects.length;
  }

  previousProject(): void {
    this.currentProjectIndex = (this.currentProjectIndex - 1 + this.allProjects.length) % this.allProjects.length;
  }

  goToProject(index: number): void {
    this.currentProjectIndex = index;
  }

  getCurrentProjectUrl(): string {
    const currentProject = this.allProjects[this.currentProjectIndex];
    if (currentProject) {
      // Prefer live link over GitHub link
      return currentProject.link || currentProject.github || '#';
    }
    return '#';
  }

  getCurrentProjectDomain(): string {
    const url = this.getCurrentProjectUrl();
    if (url === '#') return 'Project Details';
    
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      if (domain.includes('github.com')) {
        return '🔗 github.com/HMFarhad';
      }
      return `🌐 ${domain}`;
    } catch {
      return url;
    }
  }

  scrollToSection(sectionId: string): void {
    if (this.isBrowser) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  downloadResume(): void {
    if (this.isBrowser) {
      // Download the PDF resume from assets folder
      const link = document.createElement('a');
      link.href = '/assets/documents/Hossain_MD_Farhad_Resume.pdf';
      link.download = 'Hossain_MD_Farhad_Resume.pdf';
      link.target = '_blank'; // Opens in new tab if PDF viewer is available
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
