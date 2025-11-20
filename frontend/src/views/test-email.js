const { Resend } = require('resend');
const resend = new Resend(process.env.re_QnxoZLSw_3QgJP7mdhA6uxNx8SUTLVjNW);

resend.emails.send({
  from: 'notificaciones@suitemanagers.com',
  to: 'orillasdelcoilaco@gmail.com',
  subject: 'Test SuiteManager',
  html: '<h1>✅ Funciona!</h1>'
});