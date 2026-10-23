const nodemailer = require("nodemailer");

let transporter = null;

const isSmtpConfigured = () =>
  !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () => {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT) || 587;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

exports.sendOtpEmail = async (email, otp) => {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SMTP_HOST, SMTP_USER and SMTP_PASS must be set in the environment (.env) to send emails"
      );
    }
    // Local/dev fallback: no SMTP configured, so print the code instead of emailing it.
    console.log(`[DEV OTP] ${email} -> ${otp}`);
    return;
  }

  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your RentOnGoVehicle verification code",
      text: `Your verification code is ${otp}. It expires in 5 minutes. If you didn't request this, you can ignore this email.`,
      html: `
        <div style="font-family: sans-serif; font-size: 15px; color: #222;">
          <p>Your RentOnGoVehicle verification code is:</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>This code expires in 5 minutes.</p>
          <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (err) {
    if (process.env.NODE_ENV === "production") throw err;
    // Local/dev fallback: SMTP is configured but the send itself failed
    // (bad network, wrong app password, etc) — don't let that lock out local testing.
    console.error(`[DEV OTP] Email send failed (${err.message}); code for ${email} -> ${otp}`);
  }
};
