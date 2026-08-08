import nodemailer from "nodemailer";

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_SERVER,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_USE_SSL === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
}

export function isEmailConfigured() {
  return Boolean(process.env.SMTP_SERVER && process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

export async function sendInvoiceEmail({
  to, clientName, docNumber, invoiceUrl, amount, currency, description, coin,
}: {
  to: string; clientName: string; docNumber: string; invoiceUrl: string;
  amount: number; currency: string; description: string; coin?: number;
}) {
  const from = `"Lintos" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  const isHebrew = (coin ?? 1) === 1;
  const sym = currency === "ILS" ? "₪" : currency;
  const amountFormatted = `${sym}${Number(amount).toLocaleString(isHebrew ? "he-IL" : "en-US")}`;

  const html = isHebrew ? `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1f1f1f;padding:20px 32px;display:flex;align-items:center;gap:12px">
      <span style="color:#9dc020;font-size:20px;font-weight:700">Lintos</span>
      <span style="color:#666;font-size:12px">Technology solutions</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;color:#111;font-size:16px">שלום ${clientName},</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px">מצורפת חשבונית עבור התשלום שלך.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0">מספר חשבונית</td><td style="padding:8px 0;text-align:left;font-weight:600;border-bottom:1px solid #f0f0f0">#${docNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0">תיאור</td><td style="padding:8px 0;text-align:left;border-bottom:1px solid #f0f0f0">${description}</td></tr>
        <tr><td style="padding:8px 0;color:#888">סכום</td><td style="padding:8px 0;text-align:left;font-weight:700;font-size:16px">${amountFormatted}</td></tr>
      </table>
      <a href="${invoiceUrl}" target="_blank" style="display:inline-block;background:#9dc020;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600">פתח חשבונית</a>
      <p style="margin:24px 0 0;color:#aaa;font-size:12px">אם הכפתור לא עובד, הדבק את הקישור הבא בדפדפן:<br><span dir="ltr" style="word-break:break-all">${invoiceUrl}</span></p>
    </div>
  </div>
</body></html>` : `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;direction:ltr">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1f1f1f;padding:20px 32px">
      <span style="color:#9dc020;font-size:20px;font-weight:700">Lintos</span>
      <span style="color:#666;font-size:12px;margin-left:10px">Technology solutions</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;color:#111;font-size:16px">Hello ${clientName},</p>
      <p style="margin:0 0 24px;color:#555;font-size:14px">Please find your invoice for the recent payment.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px">
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0">Invoice number</td><td style="padding:8px 0;text-align:right;font-weight:600;border-bottom:1px solid #f0f0f0">#${docNumber}</td></tr>
        <tr><td style="padding:8px 0;color:#888;border-bottom:1px solid #f0f0f0">Description</td><td style="padding:8px 0;text-align:right;border-bottom:1px solid #f0f0f0">${description}</td></tr>
        <tr><td style="padding:8px 0;color:#888">Amount</td><td style="padding:8px 0;text-align:right;font-weight:700;font-size:16px">${amountFormatted}</td></tr>
      </table>
      <a href="${invoiceUrl}" target="_blank" style="display:inline-block;background:#9dc020;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:600">View Invoice</a>
      <p style="margin:24px 0 0;color:#aaa;font-size:12px">If the button doesn't work, paste this link in your browser:<br><span style="word-break:break-all">${invoiceUrl}</span></p>
    </div>
  </div>
</body></html>`;

  const text = isHebrew
    ? `שלום ${clientName},\n\nחשבונית #${docNumber} עבור ${description} (${amountFormatted}).\n\nקישור: ${invoiceUrl}`
    : `Hello ${clientName},\n\nInvoice #${docNumber} for ${description} (${amountFormatted}).\n\nLink: ${invoiceUrl}`;

  const subject = isHebrew ? `חשבונית #${docNumber} מאת Lintos` : `Invoice #${docNumber} from Lintos`;
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject, html, text });
}

export async function sendPaymentLinkEmail({
  to, clientName, paymentUrl, amount, currency, info,
}: {
  to: string; clientName?: string; paymentUrl: string;
  amount?: number; currency?: string; info?: string;
}) {
  const from = `"Lintos" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  const sym = currency === "ILS" ? "₪" : (currency || "");
  const amountStr = amount ? `${sym}${Number(amount).toLocaleString("he-IL")}` : "";

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1f1f1f;padding:20px 32px">
      <span style="color:#9dc020;font-size:20px;font-weight:700">Lintos</span>
      <span style="color:#666;font-size:12px;margin-right:10px">Technology solutions</span>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;color:#111;font-size:16px">שלום ${clientName || ""},</p>
      <p style="margin:0 0 20px;color:#555;font-size:14px">נשלח לך קישור לביצוע תשלום.</p>
      ${info ? `<p style="margin:0 0 8px;color:#888;font-size:13px">עבור: <strong style="color:#333">${info}</strong></p>` : ""}
      ${amountStr ? `<p style="margin:0 0 24px;font-size:28px;font-weight:700;color:#1f1f1f">${amountStr}</p>` : ""}
      <a href="${paymentUrl}" target="_blank" style="display:inline-block;background:#9dc020;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:600">לביצוע תשלום</a>
      <p style="margin:24px 0 0;color:#aaa;font-size:12px">אם הכפתור לא עובד, הדבק את הקישור הבא בדפדפן:<br><span dir="ltr" style="word-break:break-all">${paymentUrl}</span></p>
    </div>
  </div>
</body></html>`;

  const text = `שלום ${clientName || ""},\n\nקישור לתשלום${info ? ` עבור ${info}` : ""}${amountStr ? ` (${amountStr})` : ""}:\n\n${paymentUrl}`;
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject: "קישור לתשלום מ-Lintos", html, text });
}

export async function sendOtpEmail({ to, code }: { to: string; code: string }) {
  const from = `"Lintos" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`;
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1f1f1f;padding:20px 32px;display:flex;align-items:center;gap:12px">
      <span style="color:#9dc020;font-size:22px;font-weight:700">Lintos</span>
      <span style="color:#666;font-size:13px">Technology solutions</span>
    </div>
    <div style="padding:36px 32px;text-align:center">
      <p style="margin:0 0 8px;color:#333;font-size:16px">קוד הכניסה שלך</p>
      <div style="margin:20px 0;letter-spacing:12px;font-size:40px;font-weight:700;color:#1f1f1f;font-family:monospace">${code}</div>
      <p style="margin:0 0 4px;color:#888;font-size:13px">הקוד תקף ל-10 דקות.</p>
      <p style="margin:0;color:#aaa;font-size:12px">אם לא ביקשת קוד זה, התעלם מהודעה זו.</p>
    </div>
  </div>
</body>
</html>`;
  const text = `קוד הכניסה שלך ל-Lintos: ${code}\n\nהקוד תקף ל-10 דקות.`;
  const transporter = getTransporter();
  await transporter.sendMail({ from, to, subject: "קוד כניסה ל-Lintos", html, text });
}
