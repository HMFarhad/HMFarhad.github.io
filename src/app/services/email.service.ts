import { Injectable } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import emailjs from '@emailjs/browser';
import { environment } from '../../environments/environment';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private isInitialized = false;

  constructor() {
    this.initializeEmailJS();
  }

  private initializeEmailJS(): void {
    if (environment.emailjs.publicKey && !this.isInitialized) {
      emailjs.init(environment.emailjs.publicKey);
      this.isInitialized = true;
    }
  }

  sendEmail(formData: ContactFormData): Observable<EmailResponse> {
    // Check if EmailJS is properly configured
    if (!environment.emailjs.publicKey || !environment.emailjs.serviceId || !environment.emailjs.templateId) {
      return throwError(() => ({ 
        status: 0, 
        message: 'EmailJS not configured - using mailto fallback' 
      }));
    }

    // Prepare template parameters
    const templateParams = {
      from_name: formData.name,
      from_email: formData.email,
      subject: formData.subject,
      message: formData.message,
      to_email: 'hssnmd.farhad@gmail.com',
      // Additional parameters for better email formatting
      reply_to: formData.email,
      user_name: formData.name,
      user_email: formData.email,
      user_subject: formData.subject,
      user_message: formData.message
    };

    // Send email using EmailJS
    const emailPromise = emailjs.send(
      environment.emailjs.serviceId,
      environment.emailjs.templateId,
      templateParams
    );

    // Convert Promise to Observable
    return from(emailPromise).pipe(
      map((response: any) => {
        if (response.status === 200) {
          return {
            success: true,
            message: 'Email sent successfully'
          };
        } else {
          throw new Error('Failed to send email');
        }
      }),
      catchError((error: any) => {
        console.error('EmailJS Error:', error);
        return throwError(() => ({
          success: false,
          message: 'Failed to send email',
          error: error.text || error.message || 'Unknown error'
        }));
      })
    );
  }
}