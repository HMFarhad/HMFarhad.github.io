import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ACTIVE_ZONES } from '../../core/content/zones';
import { Zone } from '../../core/content/zone.model';

@Component({
  selector: 'app-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './page.component.html',
  styleUrl: './page.component.scss'
})
export class PageComponent {
  zones: Zone[] = ACTIVE_ZONES;

  // Type guards for the template.
  isAbout      = (z: Zone) => z.id === 'about';
  isEducation  = (z: Zone) => z.id === 'education';
  isSkills     = (z: Zone) => z.id === 'skills';
  isExperience = (z: Zone) => z.id === 'experience';
  isProjects   = (z: Zone) => z.id === 'projects';
  isBlogs      = (z: Zone) => z.id === 'blogs';
  isContact    = (z: Zone) => z.id === 'contact';
}
