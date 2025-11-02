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
      title: 'AdvancePro - Inventory Management',
      description: 'Canadian SaaS company providing inventory management solutions integrated with QuickBooks, Shopify, Avalara and other platforms.',
      impact: 'Reduced API response times by 30% and enabled secure transactions for 200+ active business clients',
      technologies: ['C# (.NET Core)', 'REST API', 'MSSQL', 'Entity Framework'],
      link: 'https://aptx.ca/',
      image: 'assets/images/projects/AdvancePro.png'
    },
    {
      title: 'eBilling System - FinTech Platform',
      description: 'Malaysia-based FinTech e-payment solution for municipal utility bill payments across multiple municipalities.',
      impact: 'Reduced pending settlements by 90% with 200-300 daily transactions achieving >85% completion within 24 hours',
      technologies: ['C# (.NET Core)', 'MSSQL', 'Oracle 11g', 'Hangfire'],
      link: 'https://www.mobilityonegroup.com/',
      image: 'assets/images/projects/eBilling.png'
    },
    {
      title: 'Banglalink DMS - Supply Chain',
      description: 'Distribution Management System serving telecommunications supply chain and logistics operations.',
      impact: 'Enhanced supply chain transparency for 4,500 distributors and 200,000 retailers with real-time updates',
      technologies: ['C# (ASP.NET)', 'Oracle 11g', 'SignalR', 'MVC'],
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
