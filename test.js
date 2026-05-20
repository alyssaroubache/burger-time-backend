const bcrypt = require("bcrypt");

const hash = "$2b$10$Nh7Q5wpYLh3ap3ftZ238AOlr6D309z/Yb5k0BXNN/FysZUmF3ua2S";

const test = async () => {
  const ok = await bcrypt.compare("1111", hash);

  console.log(ok);
};

test();