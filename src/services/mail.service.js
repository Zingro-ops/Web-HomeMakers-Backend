import nodemailer from "nodemailer";
import { approvalEmailHtml } from "../templates/approvalEmail.template.js";

// Gmail SMTP via an App Password (not the account password — generate one
// under Google Account → Security → 2-Step Verification → App Passwords).
// Required .env vars: GMAIL_USER, GMAIL_APP_PASSWORD, DASHBOARD_URL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendApprovalEmail(cook) {
  if (!cook.email) {
    console.warn(
      `Skipping approval email for cook ${cook._id} — no email on file.`,
    );
    return;
  }

  const dashboardUrl =
    process.env.DASHBOARD_URL || "https://zingro.in/dashboard";

  try {
    await transporter.sendMail({
      from: `"Zingro" <${process.env.GMAIL_USER}>`,
      to: cook.email,
      subject: "Your kitchen is live on Zingro 🎉",
      html: approvalEmailHtml({
        cookName: cook.personal?.name,
        dashboardUrl,
      }),
    });
    console.log(`Approval email sent to ${cook.email} (cook ${cook._id})`);
  } catch (e) {
    // Email failure should never block the actual approval — the cook is
    // already approved in the DB by the time this runs. Log and move on.
    console.error(
      `Failed to send approval email to ${cook.email} (cook ${cook._id}):`,
      e.message,
    );
  }
}
