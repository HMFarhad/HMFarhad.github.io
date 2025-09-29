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
    {
      title: 'eCommerce Demo Platform',
      description: 'Personal Coding Style Showcasing Project. The tech stack used in the project includes .NET Core API, Onion Architecture, MSSQL, Clean Architecture, Repository Pattern, MVC, C# 8.0.',
      technologies: ['Web Development', 'E-commerce', 'Database', 'Payment Integration'],
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
      description: 'A tool for searching flights using voice commands in Bengali language. The system listens to user voice commands in Bengali, converts speech to text, finds semantic meaning, and initiates flight searches with price comparison among various airlines.',
      technologies: ['Bengali NLP', 'Speech Recognition', 'Semantic Search', 'Flight API'],
      category: 'Web Development',
      github: 'https://github.com/HMFarhad/VoiceSearch-Bengali',
      image: 'https://images.unsplash.com/photo-1589490740833-9991abcba5e4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: true
    },
    {
      title: 'Speech to Text Conversion for Bengali Language - A Review',
      description: 'Comprehensive thesis work analyzing automatic speech recognition systems for Bengali language. Reviewed various methods including MFCC, Hidden Markov Model (HMM), and Gaussian Mixture Model (GMM) for ASR in Bengali language.',
      technologies: ['MFCC', 'HMM', 'GMM', 'Bengali ASR', 'Research'],
      category: 'Research',
      link: 'https://www.researchgate.net/publication/SPEECH_TO_TEXT_CONVERSION_FOR_BENGALI_LANGUAGE',
      image: 'https://images.unsplash.com/photo-1589254065878-42c9da997008?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Dual Examiner System',
      description: 'Advanced examination management system designed to handle dual examiner workflows, student assessment processes, and administrative tasks with robust security and user management features.',
      technologies: ['System Design', 'Database Management', 'User Authentication', 'Assessment Tools'],
      category: 'Web Development',
      github: 'https://github.com/HMFarhad/DaulExaminerSystem',
      image: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Simple Optical Character Recognition for Handwritten Characters',
      description: 'Handwriting recognition system that takes hand-written input and recognizes characters to reduce typing workload. Implemented using morphological operations, image cropping, and KNN classifier in MATLAB.',
      technologies: ['MATLAB', 'Image Processing', 'KNN', 'OCR'],
      category: 'Computer Vision',
      github: 'https://github.com/HMFarhad/Simple-OCR',
      image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Eight Puzzle Solver',
      description: 'AI project examining and analyzing fundamental search algorithms using artificial intelligence techniques to solve the classic 8-puzzle problem.',
      technologies: ['AI', 'Search Algorithms', 'Problem Solving'],
      category: 'Artificial Intelligence',
      image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Flappy Bird using OpenGL',
      description: 'Recreation of the famous Flappy Bird game using OpenGL in C++. Utilizes OpenGL library GLUT and C++ libraries to provide a desktop gaming experience similar to the popular mobile game.',
      technologies: ['C++', 'OpenGL', 'GLUT', 'Game Development'],
      category: 'Game Development',
      github: 'https://github.com/HMFarhad/Flappy-Bird-using-Open-GL',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Design of an 8-bit Computer',
      description: 'Microprocessor and I/O System project involving the complete design and simulation of an 8-bit computer system using Proteus software.',
      technologies: ['Proteus', 'Microprocessor', 'Digital Design'],
      category: 'Hardware Design',
      image: 'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    },
    {
      title: 'Design of a 32-bit Arithmetic Logic Unit (ALU)',
      description: 'Digital Electronics course project focusing on the design and implementation of a 32-bit ALU, demonstrating understanding of digital logic and computer architecture.',
      technologies: ['Digital Logic', 'VHDL/Verilog', 'ALU Design'],
      category: 'Hardware Design',
      image: 'https://images.unsplash.com/photo-1543674892-7d64d45df18b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      featured: false
    }
  ];

  filteredProjects = this.projects;
  selectedCategory = 'All';

  categories = ['All', 'Research', 'Web Development', 'Computer Vision', 'Artificial Intelligence', 'Game Development', 'Hardware Design'];

  filterProjects(category: string) {
    this.selectedCategory = category;
    if (category === 'All') {
      this.filteredProjects = this.projects;
    } else {
      this.filteredProjects = this.projects.filter(project => project.category === category);
    }
  }
}
