// server/index.js
import express from 'express';
import cors from 'cors';
import nodemailer from 'nodemailer';
import 'dotenv/config';

const app = express();
app.use(cors());
app.use(express.json());

const restaurantEmail = process.env.RESTAURANT_EMAIL || process.env.SMTP_USER;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,       // e.g. smtp.gmail.com or your provider's SMTP
  port: Number(process.env.SMTP_PORT), // 465 (secure) or 587
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function validateServer(body) {
  const errors = {};
  if (!body.name?.trim()) errors.name = 'Name required';
  if (!/^[0-9+\-\s]{7,15}$/.test(body.phone?.trim() || '')) errors.phone = 'Invalid phone';
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.email = 'Invalid email';
  if (!body.date) errors.date = 'Date required';
  if (!body.time) errors.time = 'Time required';
  return errors;
}

app.post('/api/reserve', async (req, res) => {
  const { name, phone, email, date, time, guests, notes } = req.body;

  const errors = validateServer(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  try {
    // 1. Notify the restaurant/staff
    await transporter.sendMail({
      from: `"Reservation Bot" <${process.env.SMTP_USER}>`,
      to: restaurantEmail,
      subject: `New reservation: ${name} — ${date} ${time}`,
      html: `
        <h3>New Reservation Request</h3>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Email:</strong> ${email || '—'}</p>
        <p><strong>Date:</strong> ${date} at ${time}</p>
        <p><strong>Guests:</strong> ${guests}</p>
        <p><strong>Notes:</strong> ${notes || '—'}</p>
      `,
    });

    // 2. Confirmation to the guest (only if they gave an email)
    if (email) {
      await transporter.sendMail({
        from: `"Your Restaurant" <${process.env.SMTP_USER}>`,
        to: email,
        subject: 'We received your reservation request',
        html: `
          <p>Hi ${name.split(' ')[0]},</p>
          <p>We've received your request for <strong>${guests} guest(s)</strong> on
          <strong>${date} at ${time}</strong>. We'll confirm shortly — call us if it's urgent.</p>
        `,
      });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Email send failed:', err);
    res.status(500).json({ error: 'Could not send confirmation email' });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(process.env.PORT || 4000, () => {
    console.log('Reservation server running');
  });
}

export default app;