import { Injectable } from '@angular/core';
import { ProfileDataService } from './profile-data.service';

export interface ChatMessage {
  text: string;
  isUser: boolean;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatbotService {
  private keywords = {
    experience: ['experience', 'years', 'how long', 'worked', 'work'],
    skills: ['skill', 'technology', 'tech', 'programming', 'language', 'framework'],
    education: ['education', 'degree', 'university', 'study', 'graduate', 'master', 'bachelor'],
    personal: ['name', 'email', 'phone', 'location', 'contact', 'linkedin', 'github'],
    languages: ['language', 'speak', 'fluent', 'proficiency'],
    projects: ['project', 'work', 'built', 'developed', 'created'],
    companies: ['company', 'employer', 'worked at', 'job']
  };

  private skillAliases: { [key: string]: string } = {
    'c sharp': 'C#',
    'csharp': 'C#',
    'c#': 'C#',
    'dotnet': '.NET Core',
    'dot net': '.NET Core',
    '.net core': '.NET Core',
    '.net': '.NET Core',
    'asp.net': '.NET Core',
    'aspnet': '.NET Core',
    'javascript': 'JavaScript',
    'js': 'JavaScript',
    'typescript': 'TypeScript',
    'ts': 'TypeScript',
    'sql': 'SQL',
    'sql server': 'SQL Server',
    'mssql': 'SQL Server',
    'angular': 'Angular',
    'entity framework': 'Entity Framework',
    'ef': 'Entity Framework',
    'rest': 'RESTful APIs',
    'api': 'RESTful APIs',
    'restful': 'RESTful APIs'
  };

  constructor(private profileService: ProfileDataService) {}

  processMessage(message: string): string {
    const normalizedMessage = message.toLowerCase().trim();
    const profileData = this.profileService.getProfileData();

    // Experience-related queries
    if (this.containsKeywords(normalizedMessage, this.keywords.experience)) {
      return this.handleExperienceQuery(normalizedMessage);
    }

    // Skills-related queries
    if (this.containsKeywords(normalizedMessage, this.keywords.skills)) {
      return this.handleSkillsQuery(normalizedMessage);
    }

    // Education-related queries
    if (this.containsKeywords(normalizedMessage, this.keywords.education)) {
      return this.handleEducationQuery(normalizedMessage);
    }

    // Personal info queries
    if (this.containsKeywords(normalizedMessage, this.keywords.personal)) {
      return this.handlePersonalQuery(normalizedMessage);
    }

    // Languages queries
    if (this.containsKeywords(normalizedMessage, this.keywords.languages)) {
      return this.handleLanguagesQuery(normalizedMessage);
    }

    // Projects queries
    if (this.containsKeywords(normalizedMessage, this.keywords.projects)) {
      return this.handleProjectsQuery(normalizedMessage);
    }

    // Companies queries
    if (this.containsKeywords(normalizedMessage, this.keywords.companies)) {
      return this.handleCompaniesQuery(normalizedMessage);
    }

    // Default response
    return this.getDefaultResponse();
  }

  private containsKeywords(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }

  private handleExperienceQuery(message: string): string {
    const profileData = this.profileService.getProfileData();
    
    // Check for specific skill experience
    const skill = this.extractSkillFromMessage(message);
    if (skill) {
      const experience = this.profileService.searchSkillExperience(skill);
      if (experience !== null) {
        const level = this.profileService.getSkillLevel(skill);
        return `Farhad has ${experience}+ years of experience with ${skill} (${level} level).`;
      } else {
        return `I don't have specific experience information for ${skill}. You can ask about: C#, JavaScript, SQL, Angular, .NET Core, Entity Framework, or RESTful APIs.`;
      }
    }

    // Total experience
    if (message.includes('total') || message.includes('overall') || !skill) {
      return `Farhad has ${profileData.personalInfo.totalExperience}+ years of total professional experience in software development, working with technologies like C#, .NET Core, SQL Server, and Angular.`;
    }

    return `Farhad has ${profileData.personalInfo.totalExperience}+ years of professional experience. You can ask about specific technologies like "How many years of C# experience?" for detailed information.`;
  }

  private handleSkillsQuery(message: string): string {
    const skill = this.extractSkillFromMessage(message);
    
    if (skill) {
      const experience = this.profileService.searchSkillExperience(skill);
      const level = this.profileService.getSkillLevel(skill);
      
      if (experience !== null && level) {
        return `Farhad has ${experience}+ years of experience with ${skill} and is at ${level} level.`;
      } else {
        return `I don't have specific information about ${skill}. Available skills: C#, JavaScript, SQL, Angular, .NET Core, SQL Server, Entity Framework, RESTful APIs.`;
      }
    }

    // List main skills
    const profileData = this.profileService.getProfileData();
    const mainSkills = ['C#', 'JavaScript', 'SQL', 'Angular', '.NET Core', 'SQL Server'];
    return `Farhad's main technical skills include: ${mainSkills.join(', ')}. Ask about any specific technology for detailed experience, e.g., "How many years of C# experience?"`;
  }

  private handleEducationQuery(message: string): string {
    const education = this.profileService.getEducation();
    
    if (message.includes('master')) {
      const masters = education.filter(edu => edu.degree.toLowerCase().includes('master'));
      if (masters.length > 0) {
        const masterInfo = masters.map(edu => 
          `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.year})`
        ).join(' and ');
        return `Farhad has: ${masterInfo}.`;
      }
      return `Master's degree information not found.`;
    }

    if (message.includes('bachelor') || message.includes('undergraduate')) {
      const bachelor = education.find(edu => edu.degree.toLowerCase().includes('bachelor') || edu.degree.toLowerCase().includes('science'));
      return bachelor ? 
        `Bachelor's degree: ${bachelor.degree} in ${bachelor.field} from ${bachelor.institution} (${bachelor.year}).` :
        `Bachelor's degree information not found.`;
    }

    // Return all education
    const eduInfo = education.map(edu => 
      `${edu.degree} in ${edu.field} from ${edu.institution} (${edu.year})`
    ).join('; ');
    
    return `Farhad's education: ${eduInfo}.`;
  }

  private handlePersonalQuery(message: string): string {
    const personalInfo = this.profileService.getPersonalInfo();

    if (message.includes('name')) {
      return `His full name is ${personalInfo.name}.`;
    }
    if (message.includes('email')) {
      return `You can reach Farhad at ${personalInfo.email}.`;
    }
    if (message.includes('phone')) {
      return `Farhad's phone number is ${personalInfo.phone}.`;
    }
    if (message.includes('location')) {
      return `Farhad is currently located in ${personalInfo.location}.`;
    }
    if (message.includes('linkedin')) {
      return `Farhad's LinkedIn profile: ${personalInfo.linkedin}.`;
    }
    if (message.includes('github')) {
      return `Farhad's GitHub profile: ${personalInfo.github}.`;
    }

    return `Farhad is a ${personalInfo.title} based in ${personalInfo.location}. You can contact him at ${personalInfo.email}.`;
  }

  private handleLanguagesQuery(message: string): string {
    const languages = this.profileService.getLanguages();
    
    const langInfo = languages.map(lang => 
      `${lang.name} (${lang.proficiency})`
    ).join(', ');
    
    return `Farhad speaks: ${langInfo}.`;
  }

  private handleProjectsQuery(message: string): string {
    const projects = this.profileService.getProjects();
    
    const projectInfo = projects.map(project => 
      `${project.name} using ${project.technologies.join(', ')}`
    ).join('; ');
    
    return `Some of Farhad's key projects include: ${projectInfo}.`;
  }

  private handleCompaniesQuery(message: string): string {
    const experience = this.profileService.getExperience();
    
    const companies = experience.map(exp => 
      `${exp.company} as ${exp.position} (${exp.duration})`
    ).join('; ');
    
    return `Farhad has worked at: ${companies}.`;
  }

  private extractSkillFromMessage(message: string): string | null {
    // Check direct skill names first
    for (const [alias, skill] of Object.entries(this.skillAliases)) {
      if (message.includes(alias)) {
        return skill;
      }
    }

    // Check profile skills
    const profileData = this.profileService.getProfileData();
    for (const skill of Object.keys(profileData.skills)) {
      if (message.includes(skill.toLowerCase())) {
        return skill;
      }
    }

    return null;
  }

  private getDefaultResponse(): string {
    return `I can help you learn about Farhad's professional background! Here are some examples of what you can ask:

📋 **Experience Questions:**
• "How many years of C# experience does Farhad have?"
• "What is his JavaScript experience?"
• "Tell me about his .NET Core skills"

🎓 **Education:**
• "What is Farhad's education background?"
• "Does he have a Master's degree?"

🏢 **Work History:**
• "What companies has Farhad worked for?"
• "Tell me about his current job"

📞 **Contact & Personal:**
• "How can I contact Farhad?"
• "What languages does he speak?"

What would you like to know?`;
  }

  getWelcomeMessage(): string {
    return `Hi! I'm Farhad's AI assistant. I can answer questions about his professional background, skills, experience, and projects. What would you like to know about him?
    <b>NOTE</b>: I am still in learning phase(beta), so I might not have all the answers yet or may give wrong information.`;
  }
}
