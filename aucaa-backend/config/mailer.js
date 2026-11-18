const nodemailer = require('nodemailer')

function createTransporter() {
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS } = process.env

  if (!EMAIL_USER || !EMAIL_PASS) {
    return null
  }

  return nodemailer.createTransport({
    host: EMAIL_HOST || 'smtp.gmail.com',
    port: Number(EMAIL_PORT || 587),
    secure: Number(EMAIL_PORT || 587) === 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  })
}

async function sendPasswordResetOtp(email, otp) {
  const transporter = createTransporter()

  if (!transporter) {
    console.warn('[Password Reset OTP] Email not configured. Demo OTP:', otp)
    return { sent: false, otp }
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER

  try {
    await transporter.sendMail({
      from,
      to: email,
      subject: 'Your AUCAA password reset code',
      text: `Your AUCAA password reset code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
          <h2 style="margin-bottom: 12px;">Password reset verification</h2>
          <p>Use this 6-digit code to verify your account and reset your password.</p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #f97316; margin: 18px 0;">${otp}</div>
          <p>This code expires in 10 minutes.</p>
        </div>
      `
    })

    return { sent: true, otp }
  } catch (error) {
    const authFailure = error && (error.code === 'EAUTH' || /Invalid login|Application-specific password required/i.test(error.message || ''))

    if (authFailure) {
      const msg = 'Gmail SMTP authentication failed. Please update EMAIL_PASS in the backend .env file with a valid Gmail App Password.'
      console.error('[Password Reset OTP] Gmail auth failed:', error.message || error)
      const wrapped = new Error(msg)
      wrapped.code = 'EAUTH'
      throw wrapped
    }

    throw error
  }
}

async function sendEmailVerification(email, token) {
  const transporter = createTransporter()
  if (!transporter) {
    console.warn('[Email Verification] Email not configured. Token:', token)
    return { sent: false }
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
  const verificationUrl = `${baseUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Verify your AUCAA account',
    text: `Verify your AUCAA account by opening this link: ${verificationUrl}\n\nThis link expires in 1 hour.`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;"><h2>Verify your AUCAA account</h2><p>Click the button below to verify your email address.</p><p><a href="${verificationUrl}" style="display:inline-block;padding:10px 16px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;">Verify email</a></p><p>This link expires in 1 hour.</p></div>`
  })

  return { sent: true }
}

async function sendAccountApprovedEmail(email, username) {
  const transporter = createTransporter()
  if (!transporter) {
    console.warn('[Account Approval] Email not configured for:', email)
    return { sent: false }
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5174'
  const loginUrl = `${baseUrl.replace(/\/$/, '')}/login`

  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your AUCAA account has been verified',
    text: `Your AUCAA account has been verified by an administrator. You can now log in: ${loginUrl}`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;"><h2>Your AUCAA account is verified</h2><p>Your account${username ? ` (${username})` : ''} has been approved by an administrator.</p><p><a href="${loginUrl}" style="display:inline-block;padding:10px 16px;background:#f97316;color:#fff;text-decoration:none;border-radius:6px;">Go to login</a></p></div>`
  })

  return { sent: true }
}

async function sendAccountRejectedEmail(email, username) {
  const transporter = createTransporter()
  if (!transporter || !email) {
    console.warn('[Account Rejection] Email not configured for:', email || 'unknown')
    return { sent: false }
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  await transporter.sendMail({
    from,
    to: email,
    subject: 'Your AUCAA account application was not approved',
    text: `Your AUCAA account${username ? ` (${username})` : ''} was not approved by an administrator. Please contact AUCAA administration if you believe this is an error.`,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;"><h2>Your AUCAA account was not approved</h2><p>Your account${username ? ` (${username})` : ''} was not approved by an administrator.</p><p>Please contact AUCAA administration if you believe this is an error.</p></div>`
  })

  return { sent: true }
}

async function sendNotificationEmail({ email, title, message, username, subject, category = 'notification' }) {
  const transporter = createTransporter()
  if (!transporter || !email) {
    console.warn(`[${category}] Email not configured for:`, email || 'unknown')
    return { sent: false }
  }

  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  const safeTitle = title || 'AUCAA Update'
  const safeMessage = message || 'There is a new update for you.'
  const greeting = username ? `Hi ${username},` : 'Hi,'

  await transporter.sendMail({
    from,
    to: email,
    subject: subject || safeTitle,
    text: `${greeting}\n\n${safeTitle}\n\n${safeMessage}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827; background: #f8fafc; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
        <div style="font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #f97316; font-weight: 700; margin-bottom: 8px;">AUCAA</div>
        <h2 style="margin: 0 0 12px; font-size: 24px; color: #111827;">${safeTitle}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; color: #374151;">${greeting}</p>
        <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 15px; line-height: 1.6; color: #1f2937; white-space: pre-line;">${safeMessage}</div>
      </div>
    `
  })

  return { sent: true }
}

async function sendAnnouncementEmail(email, title, message, username) {
  return sendNotificationEmail({
    email,
    title,
    message,
    username,
    subject: `AUCAA Announcement: ${title}`,
    category: 'announcement'
  })
}

async function sendGameNotificationEmail(email, title, message, username) {
  return sendNotificationEmail({
    email,
    title,
    message,
    username,
    subject: `AUCAA Game Update: ${title}`,
    category: 'game'
  })
}

module.exports = {
  createTransporter,
  sendPasswordResetOtp,
  sendEmailVerification,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendAnnouncementEmail,
  sendGameNotificationEmail
}
