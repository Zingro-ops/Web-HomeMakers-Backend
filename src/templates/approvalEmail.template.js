// Approval email template — matches the app's visual language (same
// gradient stops as BRAND_GRADIENT in src/lib/brand.js on the frontend).
// Plain string builder, no template engine dependency — deliberately
// table-based / inline-styled since that's what actually renders
// consistently across email clients (Gmail, Outlook, etc. strip <style>
// blocks and modern CSS in ways React/Tailwind never has to worry about).

export function approvalEmailHtml({ cookName, dashboardUrl }) {
  const name = cookName || "there";
  const gradient =
    "linear-gradient(120deg, #FA8C0A 0%, #F05A64 55%, #7832F0 100%)";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>You're live on Zingro</title>
</head>
<body style="margin:0; padding:0; background-color:#fffaf2; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffaf2; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 20px rgba(26,18,5,0.08);">

          <!-- Header banner -->
          <tr>
            <td style="background:${gradient}; padding:36px 32px; text-align:center;">
              <p style="margin:0 0 8px; color:#ffffff; font-size:12px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; opacity:0.9;">
                Verified &amp; Approved
              </p>
              <h1 style="margin:0; color:#ffffff; font-size:26px; font-weight:800; letter-spacing:-0.02em;">
                Your kitchen is live on Zingro
              </h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px; color:#1a1205; font-size:16px; line-height:1.6;">
                Namaste ${escapeHtml(name)},
              </p>
              <p style="margin:0 0 16px; color:#5c4f3d; font-size:15px; line-height:1.65;">
                Good news — your Zingro homemaker application has been reviewed and approved.
                Your kitchen is now verified and visible to customers near you.
              </p>
              <p style="margin:0 0 24px; color:#5c4f3d; font-size:15px; line-height:1.65;">
                You can start adding dishes, setting your hours, and receiving orders right away
                from your dashboard.
              </p>

              <!-- CTA button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 28px;">
                <tr>
                  <td style="border-radius:999px; background:${gradient};">
                    <a href="${dashboardUrl}" style="display:inline-block; padding:14px 32px; color:#ffffff; font-size:15px; font-weight:700; text-decoration:none;">
                      Go to your dashboard →
                    </a>
                  </td>
                </tr>
              </table>

              
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px; border-top:1px solid #f0eae0; text-align:center;">
              <p style="margin:0 0 4px; color:#8a7b63; font-size:12px;">
                Questions? Reach out anytime through the Support page in your app.
              </p>
              <p style="margin:0; color:#8a7b63; font-size:12px;">
                © ${new Date().getFullYear()} Zingro
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function listItem(number, text) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="width:22px; height:22px; border-radius:50%; background:#7832F0; text-align:center; vertical-align:middle;">
          <span style="color:#ffffff; font-size:11px; font-weight:700;">${number}</span>
        </td>
        <td style="padding-left:10px; color:#5c4f3d; font-size:14px; line-height:1.5;">
          ${escapeHtml(text)}
        </td>
      </tr>
    </table>`;
}

// Minimal escaping since cookName is user-provided — this goes into an
// email body, not just a DOM node, so it's worth being careful here too.
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
