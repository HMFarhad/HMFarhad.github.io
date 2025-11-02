import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Project {
  title: string;
  description: string;
  technologies: string[];
  category: string;
  link?: string;
  github?: string;
  featured: boolean;
  image?: string;
}

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss'
})
export class ProjectsComponent {
  projects: Project[] = [
    // Professional Projects
    {
      title: 'AdvancePro - Inventory Management System',
      description: 'AdvancePro is a Canadian SaaS company providing inventory management solutions integrated with QuickBooks, Shopify, Avalara and other platforms. Enhanced API efficiency by doing a deep performance analysis and moving beyond strict REST conventions to design a lean, dedicated search API that returned only essential data, <strong>reducing response times by 30%</strong>. Integrated payment workflows with Authorize.net, enabling secure online transactions and automated invoice generation for <strong>200+ active business clients</strong>.',
      technologies: ['C# (.NET Core)', 'REST API', 'MSSQL', 'Entity Framework Core', 'Integration', 'MVC', 'n-tier Architecture'],
      category: 'Professional Work',
      link: 'https://aptx.ca/',
      image: 'assets/images/projects/AdvancePro.png',
      featured: true
    },
    {
      title: 'eBilling System - Municipal Payment Gateway',
      description: 'MobilityOne Sdn Bhd is a Malaysia-based FinTech company that provides e-payment solutions and platforms for prepaid distribution, and electronic transactions. Built and maintained APIs in .NET Core with MSSQL and Oracle for a public-facing eBilling system used across multiple municipalities, enabling continuous payments for utility bills. Developed an automated settlement system using Hangfire background jobs to handle <strong>200–300 real-time daily transactions</strong>, <strong>reducing pending settlements by 90%</strong> and achieving <strong>>85% completion within 24 hours</strong>.',
      technologies: ['C# (.NET Core)', 'Web API', 'MSSQL', 'Oracle 11g', 'API Integration', 'Hangfire'],
      category: 'Professional Work',
      link: 'https://www.mobilityonegroup.com/',
      image: 'assets/images/projects/eBilling.png',
      featured: true
    },
    {
      title: 'Banglalink Distribution Management System (DMS)',
      description: 'Enhanced supply chain transparency in the Banglalink DMS system serving <strong>4,500 distributors and 200,000 retailers</strong>, implementing <strong>real-time updates with SignalR</strong>. A comprehensive web-based solution that manages supply chain and logistics activities including warehouse inventory management among Distributor, RSO, Retailer and related entities. Successfully streamlined operations and improved data consistency across the entire distribution network.',
      technologies: ['C# (ASP.NET)', 'MVC', 'Entity Framework', 'Oracle 11g', 'SignalR', 'n-tier Architecture'],
      category: 'Professional Work',
      link: 'https://blkdms.banglalink.net/',
      image: 'assets/images/projects/BL_DMS.png',
      featured: true
    },
    {
      title: 'Important Rural Infrastructure Development Project-2 (IRIDP-2)',
      description: 'Delivered an ASP.NET MVC system for IRIDP-2, enabling the government to track infrastructure projects nationwide with role-based dashboards and performance analytics. The system monitors payment logs, development of roads, bridges, and culverts throughout the country. Successfully integrated multiple APIs to streamline data flow and improve system interoperability while implementing dynamic user roles for enhanced security and access control.',
      technologies: ['C# (ASP.NET)', 'MVC', 'Entity Framework', 'MSSQL', 'Two-tier Architecture', 'Repository Pattern'],
      category: 'Professional Work',
      link: 'https://oldweb.lged.gov.bd/ProjectHome.aspx',
      image: 'assets/images/projects/IRIDP.png',
      featured: true
    },
    {
      title: 'AARMOIRE - E-Commerce Platform',
      description: 'Built modular .NET Core + Angular e-commerce APIs for AARMOIRE, supporting inventory, loyalty, and reporting features with CI/CD pipelines via GitHub Actions. Comprehensive e-Commerce web application featuring inventory management, sales processing, e-shop functionality, admin dashboard, customer management, and loyalty program modules. Backend architecture implemented using Clean Architecture principles with .NET Core APIs, while the frontend utilizes Angular for a modern, responsive user experience.',
      technologies: ['C# (ASP.NET)', 'Web API', 'MVC', 'Entity Framework', 'MSSQL', 'Clean Architecture', 'Angular'],
      category: 'Professional Work',
      link: 'https://aarmoire.com/',
      image: 'assets/images/projects/Aarmoire.png',
      featured: true
    },
    {
      title: 'LKSS & LKSS-HRC Business Process Automation',
      description: 'Full-stack web-based automation system for LKSS and LKSS-HRC, two government-affiliated welfare and HR organizations in Bangladesh. The solution streamlined operations across financial accounting, HR/payroll, member management, and project lifecycle tracking. Developed modular architecture for scalable automation.',
      technologies: ['ASP.NET MVC (C#)', 'MSSQL', 'RDLC Reporting', 'Agile Scrum', 'RBAC', 'HTTPS', 'Data Encryption', 'Azure'],
      category: 'Professional Work',
      link: 'https://www.developmentaid.org/organizations/view/106609/lkss-human-resource-center-lkss-hrc',
      image: 'assets/images/projects/LKSS.png',
      featured: true
    },
    // Personal Projects
    {
      title: 'eCommerce Demo Platform',
      description: 'A comprehensive e-commerce demonstration project showcasing modern software architecture patterns and best practices. Built with .NET Core API following Onion Architecture principles, featuring clean code structure, repository pattern implementation, and robust database design with MSSQL. This project demonstrates proficiency in enterprise-level development methodologies and serves as a portfolio piece highlighting technical expertise in full-stack development.',
      technologies: ['.NET Core', 'Clean Architecture', 'MSSQL', 'Repository Pattern', 'MVC', 'C#'],
      category: 'Web Development',
      github: 'https://github.com/HMFarhad/eCommerce-DEMO',
      image: 'assets/images/projects/e-commerce.jpeg',
      featured: true
    },
    {
      title: 'Enhancing Long-Term User Engagement in Smart Home Energy Systems : an user-centered approach to personalized feedback and privacy',
      description: 'Smart home energy systems are becoming more common as tools to help people manage energy more efficiently. But keeping users engaged over time still seems to be a challenge. This study explores the gap between early use and longer-term interaction, focusing on how personalization and privacy features might influence behavior. The goal is to understand which design choices can encourage ongoing use and build trust in energy feedback tools.',
      technologies: ['Research', 'Academic Writing', 'Data Analysis', 'Methodology'],
      category: 'Research',
      link: 'https://www.theseus.fi/handle/10024/890922',
      image: 'assets/images/projects/VAMK.jpg',
      featured: true
    },
    {
      title: 'Voice Enabled Semantic Flight Search for Bengali Language',
      description: 'An innovative voice-powered flight search application designed specifically for Bengali speakers, addressing the gap in native language support for travel booking systems. The system intelligently processes voice commands in Bengali, converts speech to text using advanced NLP techniques, extracts semantic meaning from conversational queries, and seamlessly integrates with multiple airline APIs to provide comprehensive flight search results with real-time price comparisons.',
      technologies: ['Bengali NLP', 'Speech Recognition', 'Semantic Search', 'Flight API', 'Machine Learning'],
      category: 'Web Development',
      github: 'https://github.com/HMFarhad/VoiceSearch-Bengali',
      image: 'assets/images/projects/VoiceSearch.png',
      featured: true
    },
    {
      title: 'Speech to Text Conversion for Bengali Language - A Review',
      description: 'Comprehensive graduate research thesis analyzing automatic speech recognition (ASR) systems specifically designed for Bengali language processing. The study provides an in-depth review of various methodologies including Mel-Frequency Cepstral Coefficients (MFCC), Hidden Markov Models (HMM), and Gaussian Mixture Models (GMM) for Bengali ASR implementation. This research contributes to the advancement of natural language processing technologies for underrepresented languages.',
      technologies: ['MFCC', 'HMM', 'GMM', 'Bengali ASR', 'Research', 'NLP'],
      category: 'Research',
      link: 'https://www.researchgate.net/publication/SPEECH_TO_TEXT_CONVERSION_FOR_BENGALI_LANGUAGE',
      image: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Dual Examiner System',
      description: 'A sophisticated examination management platform designed to streamline academic assessment processes with dual examiner workflows. The system facilitates collaborative evaluation, automated student assessment tracking, and comprehensive administrative oversight. Features include secure user authentication, role-based access control, automated grading workflows, and detailed reporting capabilities, ensuring transparency and efficiency in academic evaluation processes.',
      technologies: ['System Design', 'Database Management', 'User Authentication', 'Assessment Tools', 'Workflow Management'],
      category: 'Web Development',
      github: 'https://github.com/HMFarhad/DaulExaminerSystem',
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Simple Optical Character Recognition for Handwritten Characters',
      description: 'An intelligent handwriting recognition system designed to digitize handwritten text and reduce manual typing workload. The system employs advanced computer vision techniques including morphological operations for image preprocessing, intelligent cropping algorithms for character segmentation, and K-Nearest Neighbors (KNN) classification for accurate character recognition. Implemented in MATLAB with a focus on practical applications in document digitization.',
      technologies: ['MATLAB', 'Image Processing', 'KNN', 'OCR', 'Computer Vision'],
      category: 'Computer Vision',
      github: 'https://github.com/HMFarhad/Simple-OCR',
      image: 'assets/images/projects/OCR.png',
      featured: false
    },
    {
      title: 'Eight Puzzle Solver',
      description: 'A comprehensive artificial intelligence project that implements and analyzes fundamental search algorithms to solve the classic 8-puzzle sliding puzzle problem. The system explores various AI search strategies including breadth-first search, depth-first search, and heuristic-based approaches like A* algorithm. This project demonstrates deep understanding of algorithmic problem-solving, state space exploration, and optimization techniques in artificial intelligence.',
      technologies: ['AI', 'Search Algorithms', 'Heuristics', 'A* Algorithm', 'Problem Solving'],
      category: 'Artificial Intelligence',
      image: 'assets/images/projects/EightPuzzle.png',
      featured: false
    },
    {
      title: 'Flappy Bird using OpenGL',
      description: 'Recreation of the famous Flappy Bird game using OpenGL in C++. Utilizes OpenGL library GLUT and C++ libraries to provide a desktop gaming experience similar to the popular mobile game.',
      technologies: ['C++', 'OpenGL', 'GLUT', 'Game Development'],
      category: 'Game Development',
      github: 'https://github.com/HMFarhad/Flappy-Bird-using-Open-GL',
      image: 'assets/images/projects/flappyBird.jpeg',
      featured: false
    },
    {
      title: 'Design of an 8-bit Computer',
      description: 'Microprocessor and I/O System project involving the complete design and simulation of an 8-bit computer system using Proteus software.',
      technologies: ['Proteus', 'Microprocessor', 'Digital Design'],
      category: 'Hardware Design',
      image: 'assets/images/projects/8bitcomputer.jpeg',
      featured: false
    },
    {
      title: 'Design of a 32-bit Arithmetic Logic Unit (ALU)',
      description: 'Digital Electronics course project focusing on the design and implementation of a 32-bit ALU, demonstrating understanding of digital logic and computer architecture.',
      technologies: ['Digital Logic', 'VHDL/Verilog', 'ALU Design'],
      category: 'Hardware Design',
      image: 'assets/images/projects/32bitcomputer.png',
      featured: false
    }
  ];

  filteredProjects = this.projects;
  selectedCategory = 'All';

  categories = ['All', 'Professional Work', 'Research', 'Web Development', 'Computer Vision', 'Artificial Intelligence', 'Game Development', 'Hardware Design'];

  filterProjects(category: string) {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(project => project.category === category);
    }
  }
}
