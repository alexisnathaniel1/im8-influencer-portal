// Vercel project configuration
// Cron jobs run on Vercel's infrastructure; cron syntax follows standard unix cron

const config = {
  framework: "nextjs",
  buildCommand: "npm run build",
  crons: [
    { path: "/api/crons/approval-reminders", schedule: "0 9 * * *" },
    { path: "/api/cron/poll-metrics", schedule: "0 * * * *" },
    { path: "/api/cron/sync-partner-inbox", schedule: "0 */4 * * *" },
  ],
};

export default config;
