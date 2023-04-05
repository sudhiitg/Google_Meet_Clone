const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const ef = require('./emailformat');


dotenv.config({ path: '../config.env' });

async function sendMail(userDetails) {

    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_APP_PASSWORD
        }
    });
    //ef.emailFormat();
    //console.log('hello', userDetails);
    const content = ef.emailFormat(userDetails);
    let info = await transporter.sendMail({
        from: 'Gmeet-Clone', // sender address
        to: userDetails.userEmail, // list of receivers
        subject: "Hello, you have a meeting scheduled!", // Subject line
        text: "Hello, you have a meeting scheduled! ", // plain text body
        html: content, // html body
    });

    console.log(`Message sent`.bgMagenta);

}

module.exports = { sendMail };