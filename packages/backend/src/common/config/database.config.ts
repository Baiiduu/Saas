export default () => ({
  database: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/saas_db?schema=public',
  },
});
