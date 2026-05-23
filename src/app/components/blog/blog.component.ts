import { Component, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

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
      id: '3',
      title: 'I Built a Prompt Factory to Work Better with AI Coding Agents',
      excerpt: 'As developers, we often have to analyze, plan, and implement features in systems we are still learning or systems that have grown complex over time. AI coding agents help a lot in this process, but the quality of the result depends heavily on the quality of the instruction. So I created a simple workflow: a prompt factory that generates a strong, structured prompt for the actual AI coding agent.',
      content: `<p>As developers, we often have to analyze, plan, and implement features in systems we are still learning or systems that have grown complex over time.</p>

<p>Sometimes the task is straightforward:</p>
<ul>
  <li>Add a field.</li>
  <li>Update an API.</li>
  <li>Fix a bug.</li>
  <li>Add a test.</li>
</ul>

<p>But other times, the task requires more than just code. It requires understanding product behavior, existing architecture, edge cases, rollout risk, backward compatibility, and operational impact.</p>

<p>AI coding agents help a lot in this process. But I noticed something important:</p>

<blockquote>The quality of the result depends heavily on the quality of the instruction.</blockquote>

<p>This is not a new idea. Most developers using AI tools already know that better prompting leads to better results. But I did not want to manually master prompt writing for every possible role: architect, reviewer, debugger, planner, tester, product engineer, or implementation assistant.</p>

<p>So I created a simple workflow.</p>

<p>Instead of directly asking an AI agent to solve a development task, I first pass my rough context into a <strong>prompt factory</strong>.</p>

<p>The prompt factory does only one thing:</p>

<blockquote>It generates a strong, structured prompt for the actual AI coding agent.</blockquote>

<p>Then I use that generated prompt as the starting point in tools like GitHub Copilot, Claude, ChatGPT, or another coding agent.</p>

<p>The workflow looks like this:</p>

<pre><code>Raw developer task
        ↓
Prompt factory
        ↓
Structured agent prompt
        ↓
AI coding agent
        ↓
Better analysis / plan / implementation</code></pre>

<p>The goal is not to make prompts longer. The goal is to make them <strong>more useful</strong>.</p>

<p>One important detail: I still review the generated prompt before using it. The prompt factory does not remove the need for judgment. It simply moves part of that judgment earlier in the process.</p>

<p>This is actually one of the main benefits of the workflow.</p>

<p>Without the prompt factory, I give the task to an AI agent, wait for the plan, then review the plan and suggest corrections. That works, but by that point the agent may already have chosen a direction, made assumptions, or structured the solution in a way that needs to be reshaped.</p>

<p>With the prompt factory, I can steer the agent <em>before</em> the plan exists.</p>

<p>I can look at the generated prompt and adjust the framing, scope, constraints, safety requirements, or output format before sending it to the coding agent. That is usually easier than trying to correct a full implementation plan after it has already been generated.</p>

<p>So the workflow is not:</p>
<blockquote>"Let the prompt factory decide everything."</blockquote>

<p>It is:</p>
<blockquote>"Use the prompt factory to create a better starting point, then review that starting point before asking the coding agent to plan or implement."</blockquote>

<h3>Why I started doing this</h3>
<p>When I gave coding agents short instructions, I often got decent but incomplete answers.</p>

<p>For example:</p>
<blockquote>Add support for customer-level retention policy.</blockquote>

<p>A good model can produce something useful from that. But the problem is that this task is actually much bigger than it looks.</p>

<p>It may involve:</p>
<ul>
  <li>Existing retention rules</li>
  <li>Customer, reseller, and global scopes</li>
  <li>Policy precedence</li>
  <li>Background deletion workers</li>
  <li>Legal hold behavior</li>
  <li>Grace periods</li>
  <li>Audit logs</li>
  <li>Billing or storage impact</li>
  <li>Permissions</li>
  <li>Frontend changes</li>
  <li>Rollout safety</li>
  <li>Backward compatibility</li>
  <li>Tests and migration safety</li>
</ul>

<p>A short prompt does not force the agent to think through all of that. It may still do some of it, but it is more likely to jump directly into implementation.</p>

<p>That is where the prompt factory helps.</p>

<p>It turns a rough task into a structured instruction that makes the AI behave more like a careful product engineer.</p>

<h3>An actual example</h3>
<p>I tested this with a real feature-planning task:</p>

<blockquote>Add support for customer-level retention policy.</blockquote>

<p>I ran this in two separate Copilot chat threads using the same model, Claude Opus 4.7 given the same project context.</p>

<p>The threads were separate, so the second one did not inherit context from the first.</p>

<h3>Attempt 1: raw feature request</h3>
<p>In the first thread, I used the raw feature request.</p>

<p>The resulting plan was not bad. It had a clear structure and covered several implementation areas:</p>

<pre><code>Plan: Customer-level retention policy
Add a single customer-wide default retention policy per Organization that applies
to every service type as a fallback when no more-specific policy matches.

Precedence:
  per-user override
    &gt; service-specific policy with group/site filter
    &gt; org-wide service-specific policy
    &gt; new customer-level policy

Phases:
  1. Data model &amp; migration
  2. Backend service &amp; API
  3. Retention worker integration
  4. Storage calculation
  5. Frontend
  6. Tests
  7. Verification</code></pre>

<p>This is already useful.</p>

<p>It identified a data model change, backend service, controller, worker integration, frontend work, and tests. It also thought about precedence and verification.</p>

<p>But it made some decisions very early.</p>

<p>For example, it proposed a single customer-wide default retention policy and a dedicated entity for it. It also framed the worker change as a fallback pass after existing per-policy loops.</p>

<p>That may be correct, but the plan moved quickly into a specific solution.</p>

<p>The main limitation was not that the plan was bad. The limitation was that it was <strong>implementation-forward</strong>.</p>

<p>It answered:</p>
<blockquote>"How could we build this?"</blockquote>

<p>But it did not spend enough time on:</p>
<ul>
  <li>"What kind of policy-resolution problem is this?"</li>
  <li>"What safety controls are required because retention can delete data?"</li>
  <li>"How do reseller defaults, customer defaults, object-level policies, and legal hold interact?"</li>
  <li>"How should this be rolled out safely?"</li>
  <li>"What must remain byte-identical for existing customers?"</li>
</ul>

<p>For many features, that difference matters.</p>

<p>For retention policy, it matters a lot.</p>

<h3>Attempt 2: using the prompt factory first</h3>
<p>In the second thread, I did not send the raw feature request directly.</p>

<p>Instead, I first used my prompt factory. It generated a structured prompt for the coding agent.</p>

<p>I will not include the full prompt here because it would make this post too long, but these were the important parts.</p>

<p>The generated prompt assigned a role:</p>
<blockquote>You are a senior product engineer and solutions architect designing a production-ready implementation plan.</blockquote>

<p>It clarified the objective:</p>
<blockquote>Produce a complete, repo-convention-aligned implementation plan to introduce customer-level retention policy support.</blockquote>

<p>It added product context:</p>
<blockquote>The product is multi-tenant with a reseller hierarchy: reseller → customer/organization → users/sites/mailboxes.</blockquote>

<p>It gave constraints:</p>
<ul>
  <li>Treat this as a multi-scope policy resolution problem, not just a CRUD feature.</li>
  <li>Define clear precedence rules between Global, Reseller, Customer, and object-level retention.</li>
  <li>Preserve backward compatibility.</li>
  <li>Retention changes must be non-destructive on write.</li>
  <li>Include safety controls: grace period, dry-run, audit log, legal hold override, min/max bounds, and reversibility window.</li>
</ul>

<p>And it forced the output into useful sections:</p>
<ol>
  <li>Requirements Clarification</li>
  <li>Policy Model &amp; Precedence Rules</li>
  <li>Data Model &amp; Schema Changes</li>
  <li>Backend / Domain Changes</li>
  <li>API Surface</li>
  <li>Frontend Changes</li>
  <li>Enforcement &amp; Safety Controls</li>
  <li>Test Plan</li>
  <li>Rollout Plan</li>
  <li>Risks &amp; Mitigations</li>
  <li>PR-Ready Implementation Outline</li>
</ol>

<p>That prompt changed the shape of the answer.</p>

<p>The AI did not just produce an implementation plan. It produced a more complete product-engineering plan.</p>

<h3>The difference in output</h3>
<p>The second plan started differently.</p>

<p>Instead of immediately choosing a single customer-wide fallback model, it first clarified the policy model:</p>

<pre><code>Resolution order:
  Legal hold
    → explicit policy
    → organization default
    → vendor default
    → global default</code></pre>

<p>This is a meaningful difference.</p>

<p>The second plan treated retention as a hierarchy of policies, not just a new fallback row.</p>

<p>It also included concepts that were either missing or less developed in the first plan:</p>
<ul>
  <li>Vendor default retention</li>
  <li>Min/max bounds</li>
  <li>Per-row lock behavior</li>
  <li>Legal hold at user and organization level</li>
  <li>30-day grace period</li>
  <li>Dry-run preview API</li>
  <li>Audit history</li>
  <li>Feature flag rollout</li>
  <li>Resumable enforcement</li>
  <li>Rollout by environment</li>
  <li>Observability and alerting</li>
  <li>Risk table with mitigations</li>
  <li>PR-by-PR implementation sequence</li>
</ul>

<p>The first plan was more like:</p>
<blockquote>Here is how to add customer-level retention support.</blockquote>

<p>The second plan was more like:</p>
<blockquote>Here is how to safely introduce a multi-scope retention policy system into a production product.</blockquote>

<p>That is the key difference.</p>

<h3>Before vs after, side by side</h3>
<p>Here is a simplified comparison of the difference I noticed between the raw prompt result and the prompt-factory result.</p>

<p><strong>Framing</strong></p>
<ul>
  <li>Raw prompt result: Add customer-level fallback policy.</li>
  <li>Prompt-factory result: Design multi-scope retention resolution.</li>
</ul>

<p><strong>Policy model</strong></p>
<ul>
  <li>Raw prompt result: User override → service policy → org-wide service policy → customer policy.</li>
  <li>Prompt-factory result: Legal hold → explicit policy → org default → vendor default → global.</li>
</ul>

<p><strong>Safety controls</strong></p>
<ul>
  <li>Raw prompt result: Some validation and manual smoke testing.</li>
  <li>Prompt-factory result: Grace period, dry-run, audit, legal hold, reversibility, and feature flag.</li>
</ul>

<p><strong>Scope</strong></p>
<ul>
  <li>Raw prompt result: Mostly customer-level.</li>
  <li>Prompt-factory result: Customer, vendor/reseller, global, workload, and explicit policies.</li>
</ul>

<p><strong>Rollout</strong></p>
<ul>
  <li>Raw prompt result: Verification steps.</li>
  <li>Prompt-factory result: Phased rollout plan with observability and alerts.</li>
</ul>

<p><strong>Testing</strong></p>
<ul>
  <li>Raw prompt result: New test classes and behavior tests.</li>
  <li>Prompt-factory result: Resolver matrix, services, worker, migration, authorization, and performance tests.</li>
</ul>

<p><strong>Risk handling</strong></p>
<ul>
  <li>Raw prompt result: Further considerations.</li>
  <li>Prompt-factory result: Dedicated risks and mitigations section.</li>
</ul>

<p><strong>Engineering output</strong></p>
<ul>
  <li>Raw prompt result: Implementation phases.</li>
  <li>Prompt-factory result: PR-ready implementation sequence.</li>
</ul>

<p>This does not mean the first plan was useless. It was actually a decent plan.</p>

<p>But the second plan was more careful, more complete, and more production-aware.</p>

<p>That is exactly what I want from the prompt factory.</p>

<h3>The prompt factory is not just a prompt beautifier</h3>
<p>A bad version of this workflow would simply take:</p>
<blockquote>Add support for customer-level retention policy.</blockquote>

<p>And turn it into:</p>
<blockquote>Please carefully and professionally add support for customer-level retention policy using best practices.</blockquote>

<p>That is not very useful.</p>

<p>A good prompt factory does something different.</p>

<p>It adds the missing thinking structure:</p>
<ul>
  <li>What role should the AI take?</li>
  <li>What context matters?</li>
  <li>What should it not assume?</li>
  <li>What risks must it consider?</li>
  <li>What output format will be useful?</li>
  <li>What safety constraints are required?</li>
  <li>What does "done" mean?</li>
</ul>

<p>In this example, the prompt factory changed the task from a simple implementation request into a structured architecture and rollout planning request.</p>

<p>The generated prompt itself is also an artifact that needs review. That may sound like extra work, but I would have to review something anyway. If I skip the prompt factory, I still have to review the implementation plan produced by the agent. The difference is that reviewing the prompt lets me steer earlier.</p>

<blockquote>Changing a prompt is cheaper than changing a plan.</blockquote>

<p>For example, if the generated prompt forgets to mention backward compatibility, legal hold, rollout safety, or repo conventions, I can add those before the agent produces the plan. If I only notice those gaps after the implementation plan is generated, the agent may already have built the entire answer around incomplete assumptions.</p>

<p>This makes prompt review a lightweight planning checkpoint.</p>

<p>That is why the output improved.</p>

<h3>Does this consume more tokens?</h3>
<p>Yes.</p>

<p>This workflow usually consumes more tokens.</p>

<p>There is an extra step:</p>
<pre><code>Raw task → prompt factory → generated prompt → coding agent</code></pre>

<p>The generated prompt is also longer than the original task.</p>

<p>So if you measure one request in isolation, it costs more.</p>

<p>But that is not the full picture.</p>

<p>The better question is:</p>
<blockquote>Does it reduce the total number of iterations needed to get a useful result?</blockquote>

<p>In my experience, often yes.</p>

<p>A better initial prompt can reduce:</p>
<ul>
  <li>Vague answers</li>
  <li>Missed edge cases</li>
  <li>Repeated clarification</li>
  <li>Rework</li>
  <li>Incorrect assumptions</li>
  <li>Shallow implementation plans</li>
  <li>Unsafe changes</li>
</ul>

<p>For small tasks, the prompt factory may be overkill.</p>

<p>For complex tasks, especially ones involving architecture, data deletion, security, billing, compliance, or rollout risk, the extra tokens are usually worth it.</p>

<p>My rule is simple:</p>
<blockquote>Use the smallest prompt that makes the agent think at the right level.</blockquote>

<p>Not every task needs an architecture-grade prompt.</p>

<p>But some tasks absolutely do.</p>

<h3>Drawbacks and how I handle them</h3>
<p>This workflow is useful, but it is not free.</p>
<ul>
  <li><strong>It adds one more artifact to review:</strong> The generated prompt still needs review, but reviewing the prompt lets me steer the agent before the implementation plan is created.</li>
  <li><strong>It can overcomplicate small tasks:</strong> For simple changes, I skip the prompt factory and use a direct prompt.</li>
  <li><strong>It can create false confidence:</strong> A polished prompt can still contain wrong assumptions, so I check whether it preserves the original intent and marks unknowns clearly.</li>
  <li><strong>It consumes more tokens:</strong> The extra prompting layer costs more upfront, but it can reduce rework for complex tasks.</li>
  <li><strong>It can bias the agent too early:</strong> I try to write prompts as constraints and goals, not as predetermined solutions.</li>
</ul>

<h3>When this workflow works best</h3>
<p>This workflow is most useful when the task has hidden complexity.</p>

<p>Good examples:</p>
<ul>
  <li>Adding a new policy system</li>
  <li>Debugging production-like behavior</li>
  <li>Designing a migration</li>
  <li>Refactoring a core module</li>
  <li>Planning a feature across backend and frontend</li>
  <li>Reviewing a risky pull request</li>
  <li>Adding authorization or billing behavior</li>
  <li>Changing background jobs</li>
  <li>Introducing destructive operations</li>
  <li>Designing tests for complex logic</li>
</ul>

<p>It is less useful for tiny changes.</p>`,
      publishDate: 'May 24, 2026',
      readTime: '9 min read',
      tags: ['AI', 'Prompt Engineering', 'GitHub Copilot', 'Productivity', 'Software Architecture'],
      mediumUrl: 'https://medium.com/@HMFarhad/i-built-a-prompt-factory-to-work-better-with-ai-coding-agents-ff98800d99dd',
      featured: true
    },
    {
      id: '1',
      title: 'My Journey with GitHub Actions Self-Hosted Runner: Tackling Challenges with Automation and Persistence',
      excerpt: 'As a developer passionate about optimizing workflows and solving complex problems, I recently set up a self-hosted GitHub Actions runner on my Windows machine to automate CI/CD for my .NET project. What started as a straightforward task turned into a series of challenges, but the result was worth it: a solution that saves 10–20 minutes of PR review time per pull request.',
      content: `<p>As a developer passionate about optimizing workflows and solving complex problems, I recently set up a self-hosted GitHub Actions runner on my Windows machine to automate CI/CD for my .NET project. The goal was to build the solution, run tests, and execute SQL scripts automatically for every pull request. What started as a straightforward task turned into a series of challenges, but the result was worth it: a solution that saves 10–20 minutes of PR review time per pull request.</p>

<h3>The Goal</h3>
<p>For every pull request, I wanted to automatically build the project, execute a PowerShell script (<code>Run-SqlScript-OnPR.ps1</code>) to validate SQL scripts, and comment the status on the PR. The SQL validation ensured scripts were error-free before merging, but running them on a shared server wasn't safe. A self-hosted runner allowed me to execute the script locally, keeping other servers secure.</p>

<h3>The Challenges</h3>
<ol>
  <li><strong>A Session for This Runner Already Exists:</strong> After removing an old runner, I encountered this error due to stale services and cached files. I resolved it by checking for leftover services with <code>sc query</code>, deleting them, cleaning the <code>_work</code> directory, and using a unique runner name.</li>
  <li><strong>Git Dubious Ownership Error:</strong> Git flagged a permissions issue because the runner used the NETWORK SERVICE account, but files were owned by Administrators. I updated folder ownership to NETWORK SERVICE using <code>icacls</code>, added the repository as a safe directory in Git, and ran the runner consistently as a service. Later, revisiting ownership changes helped resolve other permission issues.</li>
  <li><strong>.NET Installation Permission Denied:</strong> The setup-dotnet step failed due to insufficient write access. I fixed this by installing .NET locally in a user-writable cache, avoiding protected directories, and ensuring consistent permissions from earlier steps.</li>
  <li><strong>PowerShell Script Execution Errors:</strong> The script didn't run because PowerShell Core (<code>pwsh</code>) wasn't installed, and the script path wasn't resolved correctly. Switching to classic Windows PowerShell and using relative paths fixed the issue.</li>
  <li><strong>Workspace State Issues:</strong> Failed jobs left the <code>_work</code> directory in an inconsistent state, causing Git errors. Adding a cleanup step to delete the directory at the start of each workflow, along with occasional manual cache deletion, resolved this.</li>
  <li><strong>Admin Mode Pitfall:</strong> Running the PowerShell script in Administrator mode caused permission conflicts with the NETWORK SERVICE account. Starting the runner as a service and avoiding manual Admin runs ensured consistency.</li>
</ol>

<h3>The Result</h3>
<p>The workflow now automatically builds the project, validates SQL scripts locally, and comments the results on the PR, saving 10–20 minutes per review by catching issues early without risking shared servers.</p>

<h3>Key Takeaways</h3>
<p>Persistence was key — each error taught me about permissions and runners. Using a self-hosted runner enabled safe SQL testing, and automation reduced manual effort. Avoiding Admin mode conflicts and regularly cleaning the <code>_work</code> directory were critical. Sometimes, revisiting earlier fixes solved later problems.</p>

<p>I'd love to hear about your experiences with GitHub Actions or self-hosted runners. Have you faced similar challenges?</p>`,
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
      content: `<p>JWT offers several advantages, one of which is the elimination of the necessity to query the database or authentication server for user information with each request. The efficiency and speed of JWT verification are achieved as it does not rely on database lookups. Additionally, JWTs are stored solely on the client side, with the server generating and sending them to the client.</p>

<p>Here is a detailed step-by-step of the JWT token interaction:</p>

<h3>Step 1: User Authentication</h3>
<ol>
  <li>A user logs into the application by providing their username and password.</li>
  <li>The server validates the credentials and generates a JWT (JSON Web Token) containing user information and a unique identifier.</li>
</ol>

<h3>Step 2: Issuing JWT and Refresh Token</h3>
<ol>
  <li>The server sends the JWT to the client (front-end) as a response to the successful login request.</li>
  <li>Additionally, the server generates a refresh token, which is a longer-lived token that is securely stored on the client-side.</li>
</ol>

<h3>Step 3: Using JWT for API Calls</h3>
<ol>
  <li>The client includes the JWT in the header of every API request it makes to the server.</li>
  <li>The server validates the JWT's authenticity, integrity, and expiration.</li>
  <li>If the JWT is valid and hasn't expired, the server processes the request and sends the response.</li>
</ol>

<h3>Step 4: JWT Expiration and Refreshing Tokens</h3>
<ol>
  <li>JWTs have a limited lifespan (expiration time), often around 15–60 minutes, for security.</li>
  <li>If the JWT expires, the client needs to obtain a new one without asking the user to log in again.</li>
  <li>The client sends the refresh token to a specific endpoint on the server, asking for a new JWT.</li>
  <li>The server verifies the refresh token's validity and generates a new JWT if it's still valid.</li>
  <li>The new JWT is sent back to the client, along with a new refresh token (optional).</li>
  <li>The client stores the new JWT and refresh token for future API calls.</li>
</ol>

<h3>Step 5: Handling Refresh Token Expiration</h3>
<ol>
  <li>Refresh tokens also have an expiration time, but it's usually longer than JWTs (e.g., a few days or weeks).</li>
  <li>If the refresh token expires, the user will need to log in again to obtain a new refresh token.</li>
</ol>

<h3>Scenario</h3>
<ol>
  <li>User logs into a social media app.</li>
  <li>Server generates a JWT containing user info and sends it to the app.</li>
  <li>App displays the user's feed using the JWT for API calls.</li>
  <li>An hour later, the JWT expires.</li>
  <li>User wants to post a new photo, but their JWT is invalid now.</li>
  <li>The app sends the refresh token to the server.</li>
  <li>Server validates the refresh token and issues a new JWT.</li>
  <li>App uses the new JWT to successfully post the photo.</li>
  <li>After a week, the refresh token expires (user hasn't used the app for a while).</li>
  <li>User must log in again to get a new refresh token.</li>
</ol>

<h3>Summary</h3>
<p>JWTs provide secure access to APIs for a limited time. When they expire, the app uses a refresh token to obtain a new JWT without requiring the user to log in again. If both JWT and refresh token expire, the user needs to log in anew. This mechanism balances convenience and security.</p>`,
      publishDate: 'August 4, 2023',
      readTime: '3 min read',
      tags: ['JWT', 'Authentication', 'Security', 'Web Development', 'API'],
      mediumUrl: 'https://medium.com/@HMFarhad/understanding-jwt-implementation-flow-a-simple-guide-for-front-end-developers-96d122b7176d',
      featured: true
    }
  ];

  selectedPost: BlogPost | null = null;
  showFullPost = false;

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  openPost(post: BlogPost) {
    this.selectedPost = post;
    this.showFullPost = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  closePost() {
    this.selectedPost = null;
    this.showFullPost = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'auto';
    }
  }

  openMediumPost(url: string) {
    if (isPlatformBrowser(this.platformId)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }
}
