import { Injectable } from '@angular/core';

export interface ProfileData {
  personalInfo: {
    name: string;
    title: string;
    location: string;
    email: string;
    phone: string;
    linkedin: string;
    github: string;
    totalExperience: number;
  };
  skills: {
    [key: string]: {
      experience: number;
      level: string;
      technologies: string[];
    }
  };
  experience: {
    company: string;
    position: string;
    duration: string;
    startDate: string;
    endDate: string;
    technologies: string[];
    achievements: string[];
  }[];
  education: {
    degree: string;
    field: string;
    institution: string;
    year: string;
    location: string;
  }[];
  languages: {
    name: string;
    proficiency: string;
    level: number;
  }[];
  projects: {
    name: string;
    technologies: string[];
    description: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class ProfileDataService {
  private profileData: ProfileData = {
    personalInfo: {
      name: 'Hossain MD Farhad',
      title: 'Full Stack Web Developer',
      location: 'Helsinki, Finland',
      email: 'hssnmd.farhad@gmail.com',
      phone: '+358402467814',
      linkedin: 'linkedin.com/in/hmfarhad',
      github: 'github.com/HMFarhad',
      totalExperience: 5
    },
    skills: {
      'C#': { experience: 5, level: 'Expert', technologies: ['ASP.NET', '.NET Core', '.NET Framework'] },
      'JavaScript': { experience: 5, level: 'Expert', technologies: ['Node.js', 'Angular', 'React'] },
      'TypeScript': { experience: 2, level: 'Intermediate', technologies: ['Angular', 'Node.js'] },
      'SQL': { experience: 5, level: 'Expert', technologies: ['SQL Server', 'MySQL', 'Oracle'] },
      'Angular': { experience: 2, level: 'Intermediate', technologies: ['Angular 15+', 'RxJS', 'Bootstrap'] },
      '.NET Core': { experience: 5, level: 'Expert', technologies: ['Entity Framework', 'RESTful APIs', 'Clean Architecture'] },
      'SQL Server': { experience: 5, level: 'Expert', technologies: ['MSSQL Server', 'T-SQL', 'Database Design'] },
      'Entity Framework': { experience: 5, level: 'Advanced', technologies: ['Code First', 'Database First', 'LINQ'] },
      'RESTful APIs': { experience: 5, level: 'Expert', technologies: ['Web API', 'HTTP Services', 'JSON'] }
    },
    experience: [
      {
        company: 'AdvancePro Technologies',
        position: 'Senior Software Engineer (Freelance)',
        duration: 'January 2023 – Present',
        startDate: '2023-01',
        endDate: 'Present',
        technologies: ['C#', '.NET Core', 'SQL Server', 'RESTful APIs', 'Shopify API'],
        achievements: [
          'Developed complete backend architecture with optimized performance',
          'Built robust RESTful APIs for third-party integrations',
          'Integrated with Shopify, Avalara, and other major platforms'
        ]
      },
      {
        company: 'MobilityOne Sdn Bhd',
        position: 'Senior .NET Programmer',
        duration: 'December 2022 – August 2024',
        startDate: '2022-12',
        endDate: '2024-08',
        technologies: ['C#', 'ASP.NET', '.NET Core', 'SQL Server', 'Automated Billing'],
        achievements: [
          'Built high-quality software architecture for enterprise applications',
          'Created RESTful APIs for automated biller system',
          'Automated critical tasks improving efficiency and user satisfaction'
        ]
      },
      {
        company: 'Prime Tech Solution Limited',
        position: 'Software Engineer',
        duration: 'March 2018 – December 2022',
        startDate: '2018-03',
        endDate: '2022-12',
        technologies: ['C#', '.NET Core', 'Angular', 'Entity Framework', 'SignalR'],
        achievements: [
          'Built backend APIs for .NET Core & Angular e-commerce application',
          'Implemented Clean Architecture patterns for maintainability',
          'Implemented SignalR for improved data consistency'
        ]
      }
    ],
    education: [
      {
        degree: 'Master of Engineering (M.Eng.)',
        field: 'Cloud-based Software Engineering',
        institution: 'Vaasa University of Applied Science (VAMK)',
        year: '2025',
        location: 'Vaasa, Finland'
      },
      {
        degree: 'Master of Science (M.Sc.)',
        field: 'Information Technology',
        institution: 'University of Dhaka (DU)',
        year: '2023',
        location: 'Dhaka, Bangladesh'
      }
    ],
    languages: [
      { name: 'English', proficiency: 'Professional Working Proficiency', level: 85 },
      { name: 'Bengali', proficiency: 'Native', level: 100 },
      { name: 'Finnish', proficiency: 'Elementary Proficiency', level: 30 },
      { name: 'Hindi', proficiency: 'Limited Working Proficiency', level: 60 }
    ],
    projects: [
      {
        name: 'AdvancePro Inventory Management System',
        technologies: ['C#', '.NET Core', 'SQL Server', 'RESTful APIs', 'Shopify API'],
        description: 'Complete backend architecture for inventory management with third-party integrations'
      },
      {
        name: 'E-Commerce Platform with Angular',
        technologies: ['C#', '.NET Core', 'Angular', 'Entity Framework', 'SignalR'],
        description: 'Full-stack e-commerce application with real-time features'
      },
      {
        name: 'Automated Billing System',
        technologies: ['C#', 'ASP.NET', '.NET Core', 'SQL Server'],
        description: 'Enterprise automated billing system with payment processing'
      }
    ]
  };

  getProfileData(): ProfileData {
    return this.profileData;
  }

  searchSkillExperience(skill: string): number | null {
    const normalizedSkill = skill.toLowerCase();
    const skillEntry = Object.entries(this.profileData.skills).find(
      ([key]) => key.toLowerCase() === normalizedSkill
    );
    return skillEntry ? skillEntry[1].experience : null;
  }

  getTotalExperience(): number {
    return this.profileData.personalInfo.totalExperience;
  }

  getSkillLevel(skill: string): string | null {
    const normalizedSkill = skill.toLowerCase();
    const skillEntry = Object.entries(this.profileData.skills).find(
      ([key]) => key.toLowerCase() === normalizedSkill
    );
    return skillEntry ? skillEntry[1].level : null;
  }

  getEducation(): any[] {
    return this.profileData.education;
  }

  getLanguages(): any[] {
    return this.profileData.languages;
  }

  getProjects(): any[] {
    return this.profileData.projects;
  }

  getExperience(): any[] {
    return this.profileData.experience;
  }

  getPersonalInfo(): any {
    return this.profileData.personalInfo;
  }
}
