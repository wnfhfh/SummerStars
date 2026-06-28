const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Works locally (config.json) and on Netlify (env vars)
let emailUser, emailPass;
try {
  const config = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8')
  );
  emailUser = config.email.user;
  emailPass = config.email.password;
} catch {
  emailUser = process.env.EMAIL_USER;
  emailPass = process.env.EMAIL_PASSWORD;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { email, cart } = JSON.parse(event.body);
  if (!email || !cart || cart.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Données invalides.' }) };
  }

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const gst   = subtotal * 0.05;
  const qst   = subtotal * 0.09975;
  const total = subtotal + gst + qst;

  const orderId = `ORD-${Date.now()}`;
  const order = {
    id: orderId,
    email,
    cart,
    subtotal: parseFloat(subtotal.toFixed(2)),
    gst:      parseFloat(gst.toFixed(2)),
    qst:      parseFloat(qst.toFixed(2)),
    total:    parseFloat(total.toFixed(2)),
    date:     new Date().toISOString()
  };

  // Save to /tmp (ephemeral on Netlify, persistent locally)
  const ordersPath = '/tmp/orders.json';
  let orders = [];
  try { orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8')); } catch {}
  orders.push(order);
  fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

  // Build email
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
    <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <div style="background:#1E4476;padding:32px;text-align:center">
          <h1 style="color:#EDD9A3;margin:0;font-size:28px;letter-spacing:2px">Summer Stars</h1>
          <p style="color:rgba(255,255,255,0.7);margin:8px 0 0">Confirmation de commande</p>
        </div>
        <div style="padding:32px">
          <h2 style="margin-top:0;color:#1E4476">Merci pour votre commande !</h2>
          <p style="color:#555">Votre commande a bien été reçue et est en cours de traitement.</p>
          <div style="background:#f9f9f9;border-radius:6px;padding:16px;margin:20px 0">
            <p style="margin:0;color:#888;font-size:13px">NUMÉRO DE COMMANDE</p>
            <p style="margin:4px 0 0;font-weight:bold;color:#1E4476;font-size:16px">${orderId}</p>
            <p style="margin:12px 0 0;color:#888;font-size:13px">DATE</p>
            <p style="margin:4px 0 0;color:#555;font-size:14px">${new Date().toLocaleString('fr-CA')}</p>
          </div>
          <h3 style="color:#1E4476;border-bottom:2px solid #f0f0f0;padding-bottom:10px">Récapitulatif</h3>
          <table style="width:100%;border-collapse:collapse">
            <thead>
              <tr style="background:#f0f0f0">
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Article</th>
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Couleur</th>
                <th style="padding:10px 14px;text-align:left;font-size:13px;color:#555">Taille</th>
                <th style="padding:10px 14px;text-align:center;font-size:13px;color:#555">Qté</th>
                <th style="padding:10px 14px;text-align:right;font-size:13px;color:#555">Sous-total</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div style="text-align:right;margin-top:16px;padding-top:12px;border-top:1px solid #ddd;font-size:13px;color:#555;line-height:1.8">
            <div>Sous-total : <strong>$${subtotal.toFixed(2)}</strong></div>
            <div>TPS (5 %) : <strong>$${gst.toFixed(2)}</strong></div>
            <div>TVQ (9,975 %) : <strong>$${qst.toFixed(2)}</strong></div>
            <div style="border-top:2px solid #1E4476;margin-top:8px;padding-top:8px;font-size:17px;font-weight:bold;color:#1E4476">
              Total : $${total.toFixed(2)}
            </div>
          </div>
          <p style="margin-top:32px;color:#555;font-size:14px">
            Nous vous informerons dès que votre commande sera expédiée. Pour toute question, répondez à ce courriel.
          </p>
          <p style="color:#555;font-size:14px">— L'équipe Summer Stars</p>
        </div>
        <div style="background:#f9f9f9;padding:16px;text-align:center;color:#aaa;font-size:12px">
          &copy; ${new Date().getFullYear()} Summer Stars. Tous droits réservés.
        </div>
      </div>
    </body></html>
  `;

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: emailUser, pass: emailPass }
  });

  try {
    await transporter.sendMail({
      from: `"Summer Stars" <${emailUser}>`,
      to: email,
      subject: `Confirmation de commande – ${orderId}`,
      html: emailHtml
    });
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, orderId })
    };
  } catch (err) {
    console.error('Email error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Courriel non envoyé.', orderId })
    };
  }
};
