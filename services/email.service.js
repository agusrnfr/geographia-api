// services/emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
	host: process.env.MAIL_HOST,
	port: process.env.MAIL_PORT,
	secure: false,
	auth: {
		user: process.env.MAIL_USER,
		pass: process.env.MAIL_PASS,
	},
});

const sendEmail = async (to, code) => {
	const mailOptions = {
		from: '"Geographia" <no-reply@geographia.email>',
		to,
		subject: "Código para restablecer tu contraseña",
		html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
        <h2 style="color: #2c3e50;">Hola,</h2>
        <p>Has solicitado restablecer tu contraseña.</p>
        <p>Tu código de verificación es:</p>
        <p style="font-size: 24px; font-weight: bold; background: #f4f4f4; padding: 10px; display: inline-block;">${code}</p>
        <p>Si no solicitaste este cambio, ignora este mensaje.</p>
        <br>
        <p>Saludos,<br><em>Equipo Geographia</em></p>
      </div>
    `,
	};

	console.log("Sending email to:", to);

	try {
		await transporter.sendMail(mailOptions);
	} catch (err) {
		console.error("Error sending email:", err.message, err.response, err.stack);
		throw new Error("Failed to send email");
	}
};

module.exports = { sendEmail };
