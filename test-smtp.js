const nodemailer = require('nodemailer');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8').split('\n').reduce((acc, line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) acc[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  return acc;
}, {});

const port = parseInt(env.SMTP_PORT || '587', 10);
const secure = env.SMTP_SECURE === 'true' || port === 465;

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: port,
  secure: secure,
  requireTLS: port === 587,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify(function (error, success) {
  if (error) {
    console.error('SMTP Connection Error Details:');
    console.error(error);
  } else {
    console.log('SMTP Server is ready to take our messages');
    
    transporter.sendMail({
      from: env.SMTP_FROM,
      to: env.SMTP_FROM,
      subject: 'Test Email',
      text: 'This is a test'
    }, (err, info) => {
      if (err) {
         console.error('Send Error:', err);
      } else {
         console.log('Send Success:', info);
      }
    });
  }
});