const bcrypt = require('bcrypt');

const run = async () => {
  const newPassword = '1111';
  const hash = await bcrypt.hash(newPassword, 10);
  console.log(hash);
};

run();