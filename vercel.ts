// Vercel project configuration
// Cron jobs run on Vercel's infrastructure; cron syntax follows standard unix cron

const config = {
  framework: "nextjs",
  buildCommand: "npm run build",
  crons: [
    // Reminder nudge: ping pending approval packets every morning at 9am UTC
    { path: "/api/crons/approval-reminders", schedule: "0 9 * * *" },
  ],
};

export default config;
