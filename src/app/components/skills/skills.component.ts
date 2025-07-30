import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Skill {
  name: string;
  experience: string;
  icon: string;
  color: string;
}

interface SkillCategory {
  title: string;
  skills: string[];
}

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './skills.component.html',
  styleUrl: './skills.component.scss'
})
export class SkillsComponent implements OnInit {
  skills: Skill[] = [
    {
      name: 'C#',
      experience: '5+ Years',
      icon: 'fab fa-microsoft',
      color: 'linear-gradient(135deg, #239B56, #512DA8)'
    },
    {
      name: 'Angular',
      experience: '2+ Years',
      icon: 'fab fa-angular',
      color: 'linear-gradient(135deg, #DD2C00, #FF6D00)'
    },
    {
      name: '.NET Core',
      experience: '5+ Years',
      icon: 'fas fa-code',
      color: 'linear-gradient(135deg, #512DA8, #303F9F)'
    },
    {
      name: 'SQL Server',
      experience: '5+ Years',
      icon: 'fas fa-database',
      color: 'linear-gradient(135deg, #1976D2, #0288D1)'
    },
    {
      name: 'JavaScript',
      experience: '5+ Years',
      icon: 'fab fa-js-square',
      color: 'linear-gradient(135deg, #F57F17, #FF8F00)'
    },
    {
      name: 'RESTful APIs',
      experience: '5+ Years',
      icon: 'fas fa-exchange-alt',
      color: 'linear-gradient(135deg, #388E3C, #689F38)'
    }
  ];

  floatingTech: string[] = [
    'Entity Framework', 'JIRA', 'Git', 'MVC', 'Clean Architecture', 'SignalR', 'Shopify API'
  ];

  skillCategories: SkillCategory[] = [
    {
      title: 'Programming Languages',
      skills: ['C#', 'SQL', 'JavaScript', 'HTML', 'CSS', 'TypeScript']
    },
    {
      title: 'Frameworks & Libraries',
      skills: ['ASP.NET', '.NET Core', 'Entity Framework', 'Angular', 'Bootstrap']
    },
    {
      title: 'Databases',
      skills: ['MSSQL Server', 'Oracle', 'MySQL']
    },
    {
      title: 'Tools & Technologies',
      skills: ['Git', 'GitHub', 'JIRA', 'HANSOFT', 'Visual Studio', 'VS Code']
    },
    {
      title: 'Methodologies',
      skills: ['RESTful API', 'MVC', 'Clean Architecture', 'Agile', 'SCRUM']
    }
  ];

  ngOnInit(): void {
    // Component initialization
  }

  getAnimationDelay(index: number): string {
    return `${index * 0.5}s`;
  }
}
