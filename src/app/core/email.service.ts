import { Injectable } from '@angular/core';
import emailjs from '@emailjs/browser';
import { environment } from '../../environments/environment';

export interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface SendResult {
  success: boolean;
  /** True when EmailJS keys are not configured at build time. */
  notConfigured?: boolean;
  /** Server-side message in case of failure. */
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private initialized = false;

  /** True only when all three required EmailJS values were injected at build. */
  get isConfigured(): boolean {
    const e = environment.emailjs;
    return !!(e.publicKey && e.serviceId && e.templateId);
  }

  private ensureInit(): void {
    if (!this.initialized && environment.emailjs.publicKey) {
      emailjs.init(environment.emailjs.publicKey);
      this.initialized = true;
    }
  }

  /** Send the notification email; if configured, also fire a non-blocking auto-reply. */
  async send(form: ContactFormData): Promise<SendResult> {
    if (!this.isConfigured) {
      return { success: false, notConfigured: true };
    }
    this.ensureInit();

    const params = {
      from_name:    form.name,
      from_email:   form.email,
      subject:      form.subject,
      message:      form.message,
      reply_to:     form.email,
      to_email:     'hssnmd.farhad@gmail.com',
      user_name:    form.name,
      user_email:   form.email,
      user_subject: form.subject,
      user_message: form.message
    };

    try {
      const res = await emailjs.send(
        environment.emailjs.serviceId,
        environment.emailjs.templateId,
        params
      );
      if (res.status !== 200) {
        return { success: false, error: `Status ${res.status}` };
      }

      // Fire-and-forget auto-reply to the visitor; failures are non-fatal.
      const autoId = environment.emailjs.autoReplyTemplateId;
      if (autoId) {
        emailjs
          .send(environment.emailjs.serviceId, autoId, params)
          .catch((err) => console.warn('Auto-reply failed:', err));
      }

      return { success: true };
    } catch (err: any) {
      console.error('EmailJS send failed:', err);
      return { success: false, error: err?.text || err?.message || 'Unknown error' };
    }
  }
}
