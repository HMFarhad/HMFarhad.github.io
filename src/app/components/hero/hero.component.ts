import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent {
  
  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  downloadResume(): void {
    // Download the PDF resume from assets folder
    const link = document.createElement('a');
    link.href = '/assets/documents/Hossain_MD_Farhad_Resume.pdf';
    link.download = 'HossainMD_Farhad_Resume.pdf';
    link.target = '_blank'; // Opens in new tab if PDF viewer is available
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
