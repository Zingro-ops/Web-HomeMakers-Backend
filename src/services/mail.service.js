import { Resend } from "resend";
import { approvalEmailHtml } from "../templates/approvalEmail.template.js";

// Required .env vars:
//   RESEND_API_KEY   — from your Resend dashboard
//   RESEND_FROM_EMAIL — e.g. "Zingro <notifications@zingro.in>"
//                        MUST be on a domain verified in Resend (SPF/DKIM
//                        set up), not a raw gmail.com address — that's
//                        exactly the pattern that got silently dropped by
//                        Gmail's spam filters before this switch.
//   DASHBOARD_URL     — e.g. "https://zingro.in/dashboard"
const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "Zingro <onboarding@resend.dev>",
      to: cook.email,
      subject: "Your kitchen is live on Zingro 🎉",
      html: approvalEmailHtml({
        cookName: cook.personal?.name,
        dashboardUrl,
      }),
    });

    if (error) {
      // Resend returns errors in the response body rather than throwing —
      // this is NOT the same as a network/auth exception below.
      console.error(
        `Resend rejected approval email to ${cook.email} (cook ${cook._id}):`,
        JSON.stringify(error),
      );
      return;
    }

    console.log(
      `Approval email sent to ${cook.email} (cook ${cook._id}), Resend id: ${data?.id}`,
    );
  } catch (e) {
    // Email failure should never block the actual approval — the cook is
    // already approved in the DB by the time this runs. Log and move on.
    console.error(
      `Failed to send approval email to ${cook.email} (cook ${cook._id}):`,
      e.message,
    );
  }
}
