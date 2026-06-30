// ─── Portfolio Webhook Configuration ───
// Paste your webhook URL below (from your .env WEBHOOK_URL value).
// This file is loaded before main.js - keep it out of version control if the URL is sensitive.
const WEBHOOK_URL = 'https://n8n.srv1419396.hstgr.cloud/webhook/deepankar-formSubmission';

// ─── Hero logo sphere ───
// The tech logos that orbit on the rotating sphere behind your name. SVGs are pulled live
// from two free CDNs (Iconify "logos" = full-colour, Simple Icons = brand-colour), so they
// cache globally and load instantly - nothing to host.
//   • { n: accessibility label, u: SVG url, w: size weight (1 = normal), floor: min opacity }
//   • make a logo prominent with a bigger w + a floor so it stays large/visible as it rotates
//   • recolour a monochrome icon with /HEXCODE (Simple Icons) or ?color=%23HEX (Iconify)
const HERO_LOGOS = [
  // ── prominent: the core tools (n8n is the headline) ──
  { n: 'n8n',            u: 'https://cdn.simpleicons.org/n8n',                                    w: 2.4,  floor: 0.78 },
  { n: 'Claude',         u: 'https://cdn.simpleicons.org/claude/D97757',                          w: 1.45, floor: 0.55 },
  { n: 'ChatGPT',        u: 'https://api.iconify.design/simple-icons:openai.svg?color=%2310A37F', w: 1.45, floor: 0.55 },
  { n: 'Google Gemini',  u: 'https://cdn.simpleicons.org/googlegemini/8AB4F8',                    w: 1.45, floor: 0.55 },
  // ── supporting stack ──
  { n: 'VS Code',        u: 'https://api.iconify.design/logos:visual-studio-code.svg' },
  { n: 'Supabase',       u: 'https://api.iconify.design/logos:supabase-icon.svg' },
  { n: 'Snowflake',      u: 'https://api.iconify.design/logos:snowflake-icon.svg' },
  { n: 'Salesforce',     u: 'https://api.iconify.design/logos:salesforce.svg' },
  { n: 'MongoDB',        u: 'https://api.iconify.design/logos:mongodb-icon.svg' },
  { n: 'Microsoft 365',  u: 'https://api.iconify.design/logos:microsoft-icon.svg' },
  { n: 'Gmail',          u: 'https://api.iconify.design/logos:google-gmail.svg' },
  { n: 'Google Drive',   u: 'https://api.iconify.design/logos:google-drive.svg' },
  { n: 'Google Docs',    u: 'https://cdn.simpleicons.org/googledocs/4285F4' },
  { n: 'Google Sheets',  u: 'https://cdn.simpleicons.org/googlesheets/34A853' },
  { n: 'Jira',           u: 'https://api.iconify.design/logos:jira.svg' },
  { n: 'Claude Code',    u: 'https://api.iconify.design/lucide:terminal.svg?color=%23E8E4D8' },
  { n: 'MCP',            u: 'https://cdn.simpleicons.org/modelcontextprotocol/E8E4D8' },
  { n: 'Code',           u: 'https://api.iconify.design/lucide:code.svg?color=%238FAF90' },
];
