export default ({ env }) => ({
  email: {
    config: {
      provider: 'nodemailer',
      providerOptions: {
        host: env('SMTP_HOST', 'localhost'),
        port: env.int('SMTP_PORT', 587),
        auth: {
          user: env('SMTP_USER'),
          pass: env('SMTP_PASS'),
        },
      },
      settings: {
        defaultFrom: env('EMAIL_FROM', 'no-reply@sanscroquettesfixes.fr'),
        defaultReplyTo: env('EMAIL_REPLY_TO', 'contact@sanscroquettesfixes.fr'),
      },
    },
  },
});
