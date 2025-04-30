module.exports = {
  async up(db) {
    await db.collection('users').deleteMany({ 'companies.code': 'greenbrier' });
  },
};
