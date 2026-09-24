/* ═══════════════════════════════════════════════════════
   POSTS · every published essay, newest first
   ─────────────────────────────────────────────────────────
   Generated from the list in thoughts.html. js/blog.js reads it on each
   blog/*.html page to build the previous/next links and the
   "More in <category>" list, so the order here must match the order of
   the rows in thoughts.html (01 at the top).

   Fields
     slug      file name in blog/ without ".html"
     title     the h1 of the post
     excerpt   one or two sentences, the same text as in thoughts.html
     category  exactly the label in the post's .post-cat (it is also the
               topic chip on thoughts.html, so reuse an existing one when
               it fits)
     minutes   read time, as in the post's meta line

   To publish a new post
   1. Copy a file in blog/ to blog/<slug>.html. Replace the head meta,
      the canonical and og:url, the JSON-LD, the .post-meta line, the h1
      and the article body. Keep the two stylesheets and the script tags at
      the bottom exactly as they are.
   2. Add its entry at the TOP of the list below.
   3. In thoughts.html: add its row at the top of the ol.blog-list (give it
      data-featured and remove data-featured from the previous first row),
      and move the "Latest essay" card to the new post. Row numbers, chip
      counts and totals are recounted by js/blog.js, but keep the static
      numbers right for visitors without JavaScript.
   4. Add the URL to sitemap.xml.
═══════════════════════════════════════════════════════ */
window.BLOG_POSTS = [
  {
    slug: "claude-design-enterprise-guide",
    title: "Claude Design for Enterprises: 6\u00a0Things to Know Before You Prototype",
    excerpt: "It is not a prettier Canva. Design system extraction, the four-part prompt framework, and an honest map of where it still breaks.",
    category: "Enterprise AI",
    minutes: 6
  },
  {
    slug: "youtube-research-ai-agents",
    title: "The AI Agent That Does YouTube Research While You Sleep",
    excerpt: "Viral outlier detection, transcript analysis, and thumbnail vision models: a content research pipeline built on validated data instead of guesswork.",
    category: "AI Agents",
    minutes: 5
  },
  {
    slug: "n8n-mcp-claude-code",
    title: "Stop Prototyping Slowly: n8n MCP + Claude Code",
    excerpt: "From plain-English prompt to production-shaped workflow in about 20 minutes. Why MCP changes what Claude actually knows about your stack, and where humans still matter.",
    category: "Automation",
    minutes: 5
  },
  {
    slug: "ai-chatbots-context-problem",
    title: "Why AI Chatbots Fail: It's a Context Problem, Not an Intelligence Problem",
    excerpt: "Most AI support failures are blindness, not stupidity. The context-first architecture I build instead, with human approval kept in the loop.",
    category: "AI Systems",
    minutes: 6
  },
  {
    slug: "ai-speed-vs-skill",
    title: "AI Makes You Faster. Does It Make You Worse?",
    excerpt: "Speed is measurable and mastery is not. On using AI for leverage without quietly outsourcing the judgment that made you good.",
    category: "Perspective",
    minutes: 3
  },
  {
    slug: "project-glasswing-ai-regulation",
    title: "Project Glasswing: Why AI Regulation Can't Wait Any Longer",
    excerpt: "AI already decides credit, diagnoses, and hiring while the rules move at a different speed. What tiered, adaptive governance should look like.",
    category: "AI Governance",
    minutes: 5
  },
  {
    slug: "ai-lead-qualification-outbound",
    title: "Lead Qualification Is the Real Outbound Bottleneck",
    excerpt: "Pointing AI at writing emails faster only accelerates rejection. The actual constraint is deciding who deserves the email at all.",
    category: "Revenue Automation",
    minutes: 4
  },
  {
    slug: "is-n8n-dead",
    title: "No, n8n Isn't Dead. It Turned Into Infrastructure.",
    excerpt: "The hype went quiet and people read that as decline. The tourists left and the builders stayed, which is what maturity actually looks like.",
    category: "Automation",
    minutes: 4
  },
  {
    slug: "autonomous-ai-agents-2026",
    title: "Why 2026 Belongs to Autonomous AI Agents",
    excerpt: "Systems that hold a goal, plan the steps, and execute across platforms are moving from demo to deployment. What that does to audits and to data entry roles.",
    category: "AI Agents",
    minutes: 4
  },
  {
    slug: "ai-for-accountants",
    title: "AI for Accountants: Automating Audit and Tax in 2026",
    excerpt: "Continuous reconciliation turns the audit into a verification layer rather than a discovery exercise. What that means for the people doing the discovering.",
    category: "Enterprise AI",
    minutes: 3
  },
  {
    slug: "claude-code-review",
    title: "Claude Code Review and the End of the PR Bottleneck",
    excerpt: "Specialised agents that cross-check each other, comment inline, and scale review depth to the risk of the change.",
    category: "Engineering",
    minutes: 4
  },
  {
    slug: "claude-code-n8n-one-person-team",
    title: "Claude Code Plus n8n: How One Person Covers Four Jobs",
    excerpt: "One tool makes you a faster builder, the other makes you present in more places at once. Together they change the arithmetic of headcount.",
    category: "Automation",
    minutes: 4
  },
  {
    slug: "n8n-enterprise-automation",
    title: "Why n8n Is Ready to Replace the Enterprise Automation Giants",
    excerpt: "Enterprise-grade has been marketing language for expensive contracts. The honest definition is control over where workflows run and what happens to your data.",
    category: "Enterprise AI",
    minutes: 4
  },
  {
    slug: "n8n-revenue-multiplication",
    title: "How n8n Multiplies Revenue in the Age of Agentic AI",
    excerpt: "Scripted automation executes steps. Agentic systems reason and adapt. That difference shows up in velocity, in margin, and in signals you used to catch too late.",
    category: "Revenue Automation",
    minutes: 4
  },
  {
    slug: "moltbook-implications",
    title: "Moltbook's Hidden Promise: Platforms That Optimise for Understanding",
    excerpt: "Most platforms optimise for time on site. Optimising for whether you understood something would produce a very different content ecosystem.",
    category: "Perspective",
    minutes: 4
  },
  {
    slug: "upskilling-for-ai-workplace",
    title: "Closing the AI Skills Gap in an AI-First Workplace",
    excerpt: "Companies bought the infrastructure and found their teams could not use it. The gap is conceptual, and the fix is training for partnership.",
    category: "Future of Work",
    minutes: 5
  },
  {
    slug: "fortune-500-automation-audit",
    title: "Most Fortune 500s Are One Audit Away From an AI Revolution",
    excerpt: "Enterprises bleed money through process inefficiency that never reaches an earnings call. The audit is what turns invisible cost into a roadmap.",
    category: "Enterprise AI",
    minutes: 5
  }
];
