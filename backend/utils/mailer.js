const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD, // App password
  },
});



const sendWelcomeEmail = async (userEmail, userName) => {
  const htmlContent = `
    <div style="font-family: 'Poppins', Arial, sans-serif; background-color: #fafafa; padding: 30px;">
      <div style="max-width: 600px; margin: auto; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); overflow: hidden;">
        <div style="background: linear-gradient(135deg, #ff7a18, #ffb347); padding: 20px 0; text-align: center;">
          <img src="${process.env.OG_IMAGE}" alt="InspireStack" style="width: 120px; border-radius: 10px;" />
          <h1 style="color: white; margin-top: 10px; font-size: 22px;">Welcome to InspireStack!</h1>
        </div>
        <div style="padding: 30px; text-align: center;">
          <h2 style="color: #333;">Hello ${userName || "there"} 👋</h2>
          <p style="color: #555; font-size: 15px; line-height: 1.6;">
            Your login/registration was successful! 🎉 <br/>
            We're thrilled to have you on board.
          </p>
          <a href="${process.env.SITE_URL}" style="display: inline-block; background: linear-gradient(90deg, #ff7a18, #ffb347);
            color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; margin-top: 20px;">
            Visit InspireStack
          </a>
        </div>
        <div style="text-align: center; background: #f5f5f5; padding: 15px; font-size: 13px; color: #777;">
          © ${new Date().getFullYear()} InspireStack — All rights reserved.
        </div>
      </div>
    </div>`;

  await transporter.sendMail({
    from: `"InspireStack" <${process.env.EMAIL}>`,
    to: userEmail,
    subject: "🎉 Welcome to InspireStack!",
    html: htmlContent,
  });

  console.log(`✅ Welcome email sent to ${userEmail}`);
};

module.exports = { sendWelcomeEmail };
