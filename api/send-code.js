const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ success: false, error: "Request body must be valid JSON." });
    }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: "Request body must be a JSON object." });
  }

  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const code = typeof body.code === "string" ? body.code : "";

  if (!email || !code) {
    return res.status(400).json({ success: false, error: "Email and code are required." });
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: "A valid email address is required." });
  }
  if (!/^\d{4}$/.test(code)) {
    return res.status(400).json({ success: false, error: "Code must contain exactly 4 digits." });
  }
  if (firstName.length > 100 || lastName.length > 100) {
    return res.status(400).json({ success: false, error: "Name fields must be 100 characters or fewer." });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailAppPassword) {
    console.error("Email delivery is not configured: GMAIL_USER or GMAIL_APP_PASSWORD is missing.");
    return res.status(500).json({
      success: false,
      error: "Email delivery is not configured.",
      details: "Set GMAIL_USER and GMAIL_APP_PASSWORD in the deployment environment."
    });
  }

  const safeFirstName = escapeHtml(firstName || "მეგობარო");
  const safeFullName = escapeHtml([firstName, lastName].filter(Boolean).join(" ") || "Lumina");
  const textName = [firstName, lastName].filter(Boolean).join(" ") || "მეგობარო";
  const html = `<!doctype html>
<html lang="ka">
  <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:32px 16px;background:#f3f6fb;font-family:Arial,sans-serif;color:#26334b;">
    <main style="max-width:520px;margin:0 auto;padding:36px 28px;border-radius:22px;background:#ffffff;text-align:center;">
      <div style="font-size:28px;color:#7669d8;">✦ Lumina</div>
      <h1 style="margin:24px 0 8px;font-size:23px;">გამარჯობა, ${safeFirstName}!</h1>
      <p style="margin:0;color:#68758a;line-height:1.6;">თქვენი დამადასტურებელი კოდია:</p>
      <p style="margin:22px 0;padding:16px;border-radius:14px;background:#f0efff;color:#6255c2;font-size:34px;font-weight:bold;letter-spacing:8px;">${code}</p>
      <p style="color:#68758a;line-height:1.6;">Hello, ${safeFirstName}! Your Lumina verification code is above.</p>
      <p style="color:#68758a;line-height:1.6;">Здравствуйте, ${safeFirstName}! Ваш код подтверждения Lumina указан выше.</p>
      <p style="margin:24px 0 0;color:#98a1b0;font-size:12px;">${safeFullName}</p>
    </main>
  </body>
</html>`;
  const text = [
    `Lumina — თქვენი დამადასტურებელი კოდი`,
    `გამარჯობა, ${textName}! თქვენი დამადასტურებელი კოდია: ${code}`,
    `Hello, ${textName}! Your Lumina verification code is: ${code}`,
    `Здравствуйте, ${textName}! Ваш код подтверждения Lumina: ${code}`
  ].join("\n\n");

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword.replace(/\s/g, "")
      }
    });

    await transporter.sendMail({
      from: { name: "Lumina", address: gmailUser },
      to: email,
      subject: "Lumina — თქვენი 4-ნიშნა კოდი",
      text,
      html
    });

    return res.status(200).json({ ok: true, success: true });
  } catch (error) {
    console.error("Lumina verification email delivery failed:", error.code || "SMTP_ERROR", error.message);
    return res.status(502).json({
      success: false,
      error: "Verification email could not be sent.",
      details: error.message || "The Gmail SMTP service returned an unknown error.",
      code: error.code || "SMTP_ERROR"
    });
  }
};
