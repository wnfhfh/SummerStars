const express = require('express');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const PRODUCTS_PATH = path.join(__dirname, 'data', 'products.json');
const ORDERS_PATH = path.join(__dirname, 'data', 'orders.json');

// GET /api/products
app.get('/api/products', (req, res) => {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  res.json(products);
});

// POST /api/checkout
app.post('/api/checkout', async (req, res) => {
  const { email, cart } = req.body;

  if (!email || !cart || cart.length === 0) {
    return res.status(400).json({ error: 'Invalid checkout data.' });
  }

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = {
    id: `ORD-${Date.now()}`,
    email,
    cart,
    total: parseFloat(total.toFixed(2)),
    date: new Date().toISOString()
  };

  // Save order to JSON
  const orders = JSON.parse(fs.readFileSync(ORDERS_PATH, 'utf8'));
  orders.push(order);
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(orders, null, 2));

  // Build email HTML
  const rowsHtml = cart.map(item => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #eee">${item.name}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee">${item.color}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee">${item.size}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #eee;text-align:right">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="background:#1a1a2e;padding:32px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:28px;letter-spacing:2px">SUMMERSTARS</h1>
          <p style="color:#aaa;margin:8px 0 0">Order Confirmation</p>
        </div>
        <div style="padding:32px">
          <h2 style="margin-top:0;color:#1a1a2e">Thank you for your order!</h2>
          <p style="color:#555">Hi there! Your order has been received and is being processed.</p>
          <div style="background:#f9f9f9;border-radius:6px;padding:16px;margin:20px 0">
            <p style="margin:0;color:#888;font-size:13px">ORDER ID</p>
            <p style="margin:4px 0 0;font-weight:bold;color:#1a1a2e;font-size:16px">${order.id}</p>
            <p style="margin:12px 0 0;color:#888;font-size:13px">DATE</p>
            <p style="margin:4px 0 0;color:#555;font-size:14px">${new Date(order.date).toLocaleString()}</p>
          </div>
          <h3 style="color:#1a1a2e;border-bottom:2px solid #f0f0f0;padding-bottom:10px">Order Summary</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f0f0f0">
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Item</th>
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Color</th>
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Size</th>
                <th style="padding:10px 14px;text-align:center;font-size:13px;color:#555">Qty</th>
                <th style="padding:10px 14px;text-align:right;font-size:13px;color:#555">Subtotal</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="text-align:right;margin-top:16px;padding-top:16px;border-top:2px solid #1a1a2e">
            <span style="font-size:18px;font-weight:bold;color:#1a1a2e">Total: $${total.toFixed(2)}</span>
          </div>
          <p style="margin-top:32px;color:#555;font-size:14px">
            We'll notify you once your order ships. If you have any questions, reply to this email.
          </p>
          <p style="color:#555;font-size:14px">— The SummerStars Team</p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;color:#aaa;font-size:12px">
          &copy; ${new Date().getFullYear()} SummerStars. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: false,
    auth: {
      user: config.email.user,
      pass: config.email.password
    }
  });

  try {
    await transporter.sendMail({
      from: `"SummerStars" <${config.email.user}>`,
      to: email,
      subject: `Order Confirmation – ${order.id}`,
      html: emailHtml
    });
    res.json({ success: true, orderId: order.id });
  } catch (err) {
    console.error('Email send error:', err.message);
    res.status(500).json({ error: 'Order saved but email failed to send.', orderId: order.id });
  }
});

app.listen(PORT, () => {
  console.log(`SummerStars shop running at http://localhost:${PORT}`);
});
