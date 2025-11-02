import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Testimonial {
  id: number;
  name: string;
  position: string;
  company: string;
  relationship: string;
  date: string;
  content: string;
  profileImage?: string;
}

@Component({
  selector: 'app-testimonials',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss'
})
export class TestimonialsComponent {
  testimonials: Testimonial[] = [
    {
      id: 1,
      name: 'Md. Najib Hasan',
      position: 'Chief Technology Officer',
      company: 'NAFS Technologies',
      relationship: 'managed Farhad at Prime Tech Solutions Limited',
      date: 'May 19, 2023',
      content: 'I highly recommend Hossain Md Farhad for a .NET developer position. His expertise in .NET development is truly commendable with deep understanding of C#, ASP.NET, and related technologies. His ability to design robust, scalable solutions is impressive.'
    },
    {
      id: 2,
      name: 'Mizanur Rahman',
      position: 'Data Analyst & MS Power Platform Developer',
      company: 'United Nation',
      relationship: 'worked with Farhad at PrimeTech Solutions Limited',
      date: 'July 1, 2025',
      content: 'Hossain MD Farhad has outstanding ability to manage complex projects with keen eye on product strategy. His leadership skills are exceptional with uncanny ability to build stakeholder relationships and genuine interest in team development.'
    },
    {
      id: 3,
      name: 'Md Hakimul Hosen',
      position: 'Lead Software Engineer',
      company: 'PrimeTech Solutions Limited',
      relationship: 'managed Farhad at PrimeTech Solutions Limited',
      date: 'May 22, 2023',
      content: 'Hossain MD Farhad has exceptional leadership skills and analytical mind. He consistently looks for ways to improve products and processes. His strategic thinking and problem-solving skills make him an outstanding asset to any organization.'
    },
    {
      id: 4,
      name: 'Newaz Sharif',
      position: '.NET Lead',
      company: 'GrowthOps',
      relationship: 'worked with Farhad at Mobility One Sdn Bhd',
      date: 'May 29, 2023',
      content: 'Hossain MD Farhad is a quick learner with amazing ability to adapt new technologies. He is an awesome team player with great communication skills - fully professional, punctual, dedicated and honest in his work.'
    },
    {
      id: 5,
      name: 'Ibne Sayad',
      position: 'SQA Engineer',
      company: 'HaCon-A Siemens Company',
      relationship: 'worked with Farhad at AdvancePro Technologies Ltd',
      date: 'May 19, 2023',
      content: 'Hossain MD Farhad is fantastic at his job! He knows his way around people, excellent with clients, and does whatever it takes to help teammates. He ensures everyone stays focused on main goals with smooth collaboration.'
    },
    {
      id: 6,
      name: 'Mohammad (Jubair)',
      position: 'PhD Student - Computer Science',
      company: 'CU Boulder',
      relationship: 'was Farhad\'s teacher at American International University-Bangladesh',
      date: 'October 7, 2022',
      content: 'It is my pleasure to recommend Hossain MD Farhad. He distinguished himself with interesting, well-researched projects. He is highly intelligent with excellent analytical skills, particularly in Computer Vision and Machine Learning.'
    }
  ];

  currentIndex = 0;
  translateX = 0;
  isSliding = false;
  
  nextTestimonial() {
    if (this.currentIndex < this.testimonials.length - 1) {
      this.isSliding = true;
      this.currentIndex++;
      this.updateTranslateX();
    }
  }
  
  previousTestimonial() {
    if (this.currentIndex > 0) {
      this.isSliding = true;
      this.currentIndex--;
      this.updateTranslateX();
    }
  }
  
  goToTestimonial(index: number) {
    if (index !== this.currentIndex) {
      this.isSliding = true;
      this.currentIndex = index;
      this.updateTranslateX();
    }
  }

  private updateTranslateX() {
    this.translateX = -this.currentIndex * 100;
    setTimeout(() => {
      this.isSliding = false;
    }, 500);
  }

  trackByTestimonial(index: number, testimonial: Testimonial): number {
    return testimonial.id;
  }
}