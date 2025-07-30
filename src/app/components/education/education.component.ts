import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Education {
  degree: string;
  field: string;
  institution: string;
  year: string;
  location?: string;
  description?: string;
  highlights?: string[];
  icon: string;
}

interface Language {
  name: string;
  level: string;
  percentage: number;
  certification?: string;
  flag: string;
}

@Component({
  selector: 'app-education',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './education.component.html',
  styleUrl: './education.component.scss'
})
export class EducationComponent {
  educations: Education[] = [
    {
      degree: 'Master of Engineering (M.Eng.)',
      field: 'Cloud-based Software Engineering',
      institution: 'Vaasa University of Applied Science (VAMK)',
      year: '2025',
      location: 'Vaasa, Finland',
      description: 'Specialized in modern cloud technologies, microservices architecture, and scalable software solutions.',
      highlights: [
        'Advanced Cloud Computing and Architecture',
        'Microservices and Container Technologies',
        'DevOps and CI/CD Pipelines',
        'Software Quality and Testing Strategies'
      ],
      icon: 'fas fa-graduation-cap'
    },
    {
      degree: 'Master of Science (M.Sc.)',
      field: 'Information Technology',
      institution: 'University of Dhaka (DU)',
      year: '2021',
      location: 'Dhaka, Bangladesh',
      description: 'Advanced studies in computer science fundamentals, algorithms, and software engineering principles.',
      highlights: [
        'Advanced Algorithms and Data Structures',
        'Database Management Systems',
        'Software Engineering Methodologies',
        'Research in Modern Web Technologies'
      ],
      icon: 'fas fa-university'
    },
    {
      degree: 'Bachelor of Science (B.Sc.)',
      field: 'Computer Science and Engineering',
      institution: 'American International University Bangladesh (AIUB)',
      year: '2018',
      location: 'Dhaka, Bangladesh',
      description: 'Comprehensive foundation in computer science, programming, and engineering principles.',
      highlights: [
        'Object-Oriented Programming',
        'Web Development Technologies',
        'Database Design and Implementation',
        'Software Project Management'
      ],
      icon: 'fas fa-laptop-code'
    }
  ];

  languages: Language[] = [
    {
      name: 'Bengali',
      level: 'Native',
      percentage: 100,
      flag: 'fas fa-globe-asia'
    },
    {
      name: 'English',
      level: 'Advanced',
      percentage: 96,
      certification: 'TOEFL: 80/120',
      flag: 'fas fa-globe'
    },
    {
      name: 'Hindi',
      level: 'Conversational',
      percentage: 30,
      flag: 'fas fa-language'
    }
  ];
}
