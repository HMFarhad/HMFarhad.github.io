import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmailService, ContactFormData } from '../../services/email.service';

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

  isSubmitting = false;
  submitMessage = '';
  submitMessageType: 'success' | 'error' | '' = '';

  constructor(private emailService: EmailService) {}

  async onSubmit(): Promise<void> {
    if (this.isFormValid() && !this.isSubmitting) {
      this.isSubmitting = true;
      this.submitMessage = '';
      
      try {
        const formData: ContactFormData = {
          name: this.formData.name,
          email: this.formData.email,
          subject: this.formData.subject,
          message: this.formData.message
        };

        const response = await this.emailService.sendEmail(formData).toPromise();

        if (response?.success) {
          this.submitMessage = 'Thank you for your message! I\'ll get back to you soon.';
          this.submitMessageType = 'success';
          this.resetForm();
        } else {
          throw new Error(response?.error || 'Failed to send email');
        }
      } catch (error: any) {
        console.error('Email sending error:', error);
        
        // Fallback to mailto if EmailJS is not configured or fails
        if (error.status === 0 || !error.success) {
          this.openMailtoFallback();
        } else {
          this.submitMessage = error.error || 'Sorry, there was an error sending your message. Please try again or contact me directly at hssnmd.farhad@gmail.com';
          this.submitMessageType = 'error';
        }
      } finally {
        this.isSubmitting = false;
        
        // Clear message after 5 seconds
        setTimeout(() => {
          this.submitMessage = '';
          this.submitMessageType = '';
        }, 5000);
      }
    }
  }

  private openMailtoFallback(): void {
    const subject = encodeURIComponent(this.formData.subject);
    const body = encodeURIComponent(
      `Name: ${this.formData.name}\nEmail: ${this.formData.email}\n\nMessage:\n${this.formData.message}`
    );
    const mailtoLink = `mailto:hssnmd.farhad@gmail.com?subject=${subject}&body=${body}`;
    
    window.open(mailtoLink, '_blank');
    
    this.submitMessage = 'Your email client should open now. If not, please contact me directly at hssnmd.farhad@gmail.com';
    this.submitMessageType = 'success';
    this.resetForm();
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
