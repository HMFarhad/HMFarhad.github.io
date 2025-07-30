import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Experience {
  position: string;
  company: string;
  duration: string;
  description: string;
  achievements: string[];
  challenges?: string;
  improvements?: string;
  technologies: string[];
  icon: string;
}

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './experience.component.html',
  styleUrl: './experience.component.scss'
})
export class ExperienceComponent {
  experiences: Experience[] = [
    {
      position: 'Senior Software Engineer (Freelance)',
      company: 'AdvancePro Technologies',
      duration: 'January 2023 – Present',
      description: 'Leading backend development of AdvancePro inventory management system.',
      achievements: [
        'Developed complete backend architecture with optimized performance',
        'Built robust RESTful APIs for third-party integrations',
        'Integrated with Shopify, Avalara, and other major platforms'
      ],
      challenges: 'Backend latency affecting system performance',
      improvements: 'Refactored architecture reducing response times by 30%',
      technologies: ['C#', '.NET Core', 'SQL Server', 'RESTful APIs', 'Shopify API'],
      icon: 'fas fa-rocket'
    },
    {
      position: 'Senior .NET Programmer',
      company: 'MobilityOne Sdn Bhd',
      duration: 'December 2022 – August 2024',
      description: 'Developed enterprise applications and automated billing systems.',
      achievements: [
        'Built high-quality software architecture for enterprise applications',
        'Created RESTful APIs for automated biller system',
        'Optimized pending transactions by 90% through improvements'
      ],
      challenges: 'Payment platform integration difficulties',
      improvements: 'Automated critical tasks improving efficiency and user satisfaction',
      technologies: ['C#', 'ASP.NET', '.NET Core', 'SQL Server', 'Automated Billing'],
      icon: 'fas fa-code'
    },
    {
      position: 'Software Engineer',
      company: 'Prime Tech Solution Limited',
      duration: 'March 2018 – December 2022',
      description: 'Developed testable code and deployed software systems.',
      achievements: [
        'Built backend APIs for .NET Core & Angular e-commerce application',
        'Implemented Clean Architecture patterns for maintainability',
        'Deployed software components into functional systems'
      ],
      challenges: 'Real-time data synchronization issues',
      improvements: 'Implemented SignalR for improved data consistency',
      technologies: ['C#', '.NET Core', 'Angular', 'Entity Framework', 'SignalR'],
      icon: 'fas fa-laptop-code'
    }
  ];
}
