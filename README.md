# Hossain MD Farhad - Portfolio Website

An interactive, eye-catching personal portfolio website built with Angular 18, showcasing professional experience, skills, and projects with modern animations and responsive design.

## ✨ Features

- **Interactive Spinning Skills Section** - Dynamic rotating skills carousel inspired by professional portfolio designs
- **Responsive Design** - Mobile-first approach with smooth animations and transitions
- **Modern UI/UX** - Clean design with glassmorphism effects and gradient backgrounds
- **Professional Sections** - Hero, About, Skills, Experience, Education, and Contact
- **Smooth Scrolling Navigation** - Seamless navigation with scroll-to-section functionality
- **Contact Form** - Functional contact form with validation and email integration
- **Downloadable Resume** - One-click resume download functionality
- **SEO Optimized** - Server-side rendering ready for better search engine visibility

## 🚀 Technologies Used

- **Frontend**: Angular 18, TypeScript, SCSS
- **Styling**: Custom CSS with animations, Font Awesome icons
- **Build Tool**: Angular CLI
- **Development**: Node.js, npm

## 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/HMFarhad/portfolio-website.git
   cd portfolio-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Development server**
   ```bash
   ng serve
   ```
   Navigate to `http://localhost:4200/` - the application will automatically reload on file changes.

4. **Build for production**
   ```bash
   ng build
   ```
   Build artifacts will be stored in the `dist/` directory.

## 📁 Project Structure

```
src/
├── app/
│   ├── components/
│   │   ├── header/          # Navigation header with smooth scroll
│   │   ├── hero/            # Hero section with animated elements
│   │   ├── about/           # About section with achievements
│   │   ├── skills/          # Interactive spinning skills carousel
│   │   ├── experience/      # Professional experience timeline
│   │   ├── education/       # Education background and languages
│   │   ├── contact/         # Contact form and information
│   │   └── footer/          # Footer with links and social media
│   ├── app.component.*      # Main app component
│   └── app.config.ts        # App configuration
├── styles.scss              # Global styles and utilities
└── index.html              # Main HTML file
```

## 🎨 Key Components

### Spinning Skills Section
- Dynamic rotating carousel showcasing technical skills
- Floating technology bubbles with animations
- Interactive skill categories with progress indicators
- Responsive design for all screen sizes

### Professional Timeline
- Interactive experience timeline with hover effects
- Challenge and solution sections for each role
- Technology tags and achievement highlights
- Mobile-optimized vertical layout

### Contact Integration
- Functional contact form with validation
- Direct email integration via mailto links
- Social media and professional network links
- Responsive design with smooth animations

## 📱 Responsive Design

The portfolio is fully responsive with breakpoints for:
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🌟 Performance Features

- Lazy loading components
- Optimized animations and transitions
- Compressed images and assets
- SEO-ready meta tags and structure

## 👨‍💻 About the Developer

**Hossain MD Farhad** - Full Stack Web Developer
- 📧 Email: hssnmd.farhad@gmail.com
- 💼 LinkedIn: [linkedin.com/in/hmfarhad](https://www.linkedin.com/in/hmfarhad/)
- 🐱 GitHub: [github.com/HMFarhad](https://github.com/HMFarhad/)
- 📱 Phone: +358402467814
- 📍 Location: Helsinki, Finland

## 🚀 Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## 📦 Build & Deployment

### GitHub Pages Deployment

This project is configured for GitHub Pages deployment:

1. **Production Build**
   ```bash
   ng build --configuration production
   ```

2. **Copy build files to root** (for GitHub Pages)
   ```bash
   # Windows PowerShell
   Copy-Item -Path "dist\portfolio-website\browser\*" -Destination "." -Recurse -Force
   
   # Linux/Mac
   cp -r dist/portfolio-website/browser/* .
   ```

3. **Deploy to GitHub Pages**
   ```bash
   git add .
   git commit -m "Deploy Angular portfolio to GitHub Pages"
   git push origin main
   ```

4. **Alternative: Static Hosting** - Can also be deployed to:
   - Netlify
   - Vercel
   - Firebase Hosting
   - Any static hosting service

### Important Notes

- The `angular.json` file has been configured with increased CSS budgets for the portfolio components
- Build artifacts are copied to the root directory for GitHub Pages compatibility
- The site will be available at `https://hmfarhad.github.io/` after deployment

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](../../issues).

## 📄 License

This project is [MIT](LICENSE) licensed.

---

*Built with ❤️ using Angular & TypeScript*

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
