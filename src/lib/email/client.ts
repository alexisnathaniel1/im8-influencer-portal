import nodemailer from "nodemailer";

export function createTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER ?? "creators@im8health.com",
      pass: process.env.SMTP_PASS,
    },
  });
}

export const EMAIL_FROM =
  process.env.EMAIL_FROM ??
  `IM8 Influencer Team <${process.env.SMTP_USER ?? "creators@im8health.com"}>`;
