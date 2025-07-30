import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  publishDate: string;
  readTime: string;
  tags: string[];
  mediumUrl: string;
  featured: boolean;
}

@Component({
  selector: 'app-blog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './blog.component.html',
  styleUrl: './blog.component.scss'
})
export class BlogComponent {
  blogPosts: BlogPost[] = [
    {
      id: '1',
      title: 'My Journey with GitHub Actions Self-Hosted Runner: Tackling Challenges with Automation and Persistence',
      excerpt: 'As a developer passionate about optimizing workflows and solving complex problems, I recently set up a self-hosted GitHub Actions runner on my Windows machine to automate CI/CD for my .NET project. What started as a straightforward task turned into a series of challenges, but the result was worth it: a solution that saves 10–20 minutes of PR review time per pull request.',
      content: `As a developer passionate about optimizing workflows and solving complex problems, I recently set up a self-hosted GitHub Actions runner on my Windows machine to automate CI/CD for my .NET project. The goal was to build the solution, run tests, and execute SQL scripts automatically for every pull request. What started as a straightforward task turned into a series of challenges, but the result was worth it: a solution that saves 10–20 minutes of PR review time per pull request.

**The Goal:** For every pull request, I wanted to automatically build the project, execute a PowerShell script (Run-SqlScript-OnPR.ps1) to validate SQL scripts, and comment the status on the PR. The SQL validation ensured scripts were error-free before merging, but running them on a shared server wasn't safe. A self-hosted runner allowed me to execute the script locally, keeping other servers secure.

**The Challenges:**

1. **A Session for This Runner Already Exists:** After removing an old runner, I encountered this error due to stale services and cached files. I resolved it by checking for leftover services with sc query, deleting them, cleaning the _work directory, and using a unique runner name.

2. **Git Dubious Ownership Error:** Git flagged a permissions issue because the runner used the NETWORK SERVICE account, but files were owned by Administrators. I updated folder ownership to NETWORK SERVICE using icacls, added the repository as a safe directory in Git, and ran the runner consistently as a service. Later, revisiting ownership changes helped resolve other permission issues.

3. **.NET Installation Permission Denied:** The setup-dotnet step failed due to insufficient write access. I fixed this by installing .NET locally in a user-writable cache, avoiding protected directories, and ensuring consistent permissions from earlier steps.

4. **PowerShell Script Execution Errors:** The script didn't run because PowerShell Core (pwsh) wasn't installed, and the script path wasn't resolved correctly. Switching to classic Windows PowerShell and using relative paths fixed the issue.

5. **Workspace State Issues:** Failed jobs left the _work directory in an inconsistent state, causing Git errors. Adding a cleanup step to delete the directory at the start of each workflow, along with occasional manual cache deletion, resolved this.

6. **Admin Mode Pitfall:** Running the PowerShell script in Administrator mode caused permission conflicts with the NETWORK SERVICE account. Starting the runner as a service and avoiding manual Admin runs ensured consistency.

**The Result:** The workflow now automatically builds the project, validates SQL scripts locally, and comments the results on the PR, saving 10–20 minutes per review by catching issues early without risking shared servers.

**Key Takeaways:** Persistence was key — each error taught me about permissions and runners. Using a self-hosted runner enabled safe SQL testing, and automation reduced manual effort. Avoiding Admin mode conflicts and regularly cleaning the _work directory were critical. Sometimes, revisiting earlier fixes solved later problems.

I'd love to hear about your experiences with GitHub Actions or self-hosted runners. Have you faced similar challenges?`,
      publishDate: 'July 22, 2025',
      readTime: '2 min read',
      tags: ['GitHub Actions', 'CI/CD', 'DevOps', 'Automation', '.NET'],
      mediumUrl: 'https://medium.com/@HMFarhad/my-journey-with-github-actions-self-hosted-runner-tackling-challenges-with-automation-and-810908275129',
      featured: true
    },
    {
      id: '2',
      title: 'Understanding JWT implementation flow: A Simple Guide for Beginners',
      excerpt: 'JWT offers several advantages, one of which is the elimination of the necessity to query the database or authentication server for user information with each request. The efficiency and speed of JWT verification are achieved as it does not rely on database lookups.',
      content: `JWT offers several advantages, one of which is the elimination of the necessity to query the database or authentication server for user information with each request. The efficiency and speed of JWT verification are achieved as it does not rely on database lookups. Additionally, JWTs are stored solely on the client side, with the server generating and sending them to the client.

Here is a detailed steps for the JWT token interaction:

**Step 1: User Authentication**

1. A user logs into the application by providing their username and password.
2. The server validates the credentials and generates a JWT (JSON Web Token) containing user information and a unique identifier.

**Step 2: Issuing JWT and Refresh Token**

1. The server sends the JWT to the client (front-end) as a response to the successful login request.
2. Additionally, the server generates a refresh token, which is a longer-lived token that is securely stored on the client-side.

**Step 3: Using JWT for API Calls**

1. The client includes the JWT in the header of every API request it makes to the server.
2. The server validates the JWT's authenticity, integrity, and expiration.
3. If the JWT is valid and hasn't expired, the server processes the request and sends the response.

**Step 4: JWT Expiration and Refreshing Tokens**

1. JWTs have a limited lifespan (expiration time), often around 15–60 minutes, for security.
2. If the JWT expires, the client needs to obtain a new one without asking the user to log in again.
3. The client sends the refresh token to a specific endpoint on the server, asking for a new JWT.
4. The server verifies the refresh token's validity and generates a new JWT if it's still valid.
5. The new JWT is sent back to the client, along with a new refresh token (optional).
6. The client stores the new JWT and refresh token for future API calls.

**Step 5: Handling Refresh Token Expiration**

1. Refresh tokens also have an expiration time, but it's usually longer than JWTs (e.g., a few days or weeks).
2. If the refresh token expires, the user will need to log in again to obtain a new refresh token.

**Scenario:**

1. User logs into a social media app.
2. Server generates a JWT containing user info and sends it to the app.
3. App displays the user's feed using the JWT for API calls.
4. An hour later, the JWT expires.
5. User wants to post a new photo, but their JWT is invalid now.
6. The app sends the refresh token to the server.
7. Server validates the refresh token and issues a new JWT.
8. App uses the new JWT to successfully post the photo.
9. After a week, the refresh token expires (user hasn't used the app for a while).
10. User must log in again to get a new refresh token.

**Summary:** JWTs provide secure access to APIs for a limited time. When they expire, the app uses a refresh token to obtain a new JWT without requiring the user to log in again. If both JWT and refresh token expire, the user needs to log in anew. This mechanism balances convenience and security.`,
      publishDate: 'August 4, 2023',
      readTime: '3 min read',
      tags: ['JWT', 'Authentication', 'Security', 'Web Development', 'API'],
      mediumUrl: 'https://medium.com/@HMFarhad/understanding-jwt-implementation-flow-a-simple-guide-for-front-end-developers-96d122b7176d',
      featured: true
    }
  ];

  selectedPost: BlogPost | null = null;
  showFullPost = false;

  openPost(post: BlogPost) {
    this.selectedPost = post;
    this.showFullPost = true;
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
  }

  closePost() {
    this.selectedPost = null;
    this.showFullPost = false;
    // Restore body scroll
    document.body.style.overflow = 'auto';
  }

  openMediumPost(url: string) {
    window.open(url, '_blank');
  }
}
