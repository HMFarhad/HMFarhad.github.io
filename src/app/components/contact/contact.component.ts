import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss'
})
export class ContactComponent {
  formData: ContactForm = {
    name: '',
    email: '',
    subject: '',
    message: ''
  };

  onSubmit(): void {
    if (this.isFormValid()) {
      // For now, we'll just create a mailto link
      const subject = encodeURIComponent(this.formData.subject);
      const body = encodeURIComponent(
        `Name: ${this.formData.name}\nEmail: ${this.formData.email}\n\nMessage:\n${this.formData.message}`
      );
      const mailtoLink = `mailto:hssnmd.farhad@gmail.com?subject=${subject}&body=${body}`;
      
      window.location.href = mailtoLink;
      
      // Reset form after submission
      this.resetForm();
      
      // Show success message (you could add a toast notification here)
      alert('Thank you for your message! Your default email client should open now.');
    }
  }

  private isFormValid(): boolean {
    return !!(this.formData.name && 
              this.formData.email && 
              this.formData.subject && 
              this.formData.message);
  }

  private resetForm(): void {
    this.formData = {
      name: '',
      email: '',
      subject: '',
      message: ''
    };
  }
}
