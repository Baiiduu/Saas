export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-do-not-use-in-production',
    expiration: process.env.JWT_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
});
