import { hashPassword } from "../src/auth/password";

const plain = process.argv[2];
if (!plain) {
  console.error("Nutzung: npm run hash-password -- <passwort>");
  process.exit(1);
}

hashPassword(plain).then((hash) => {
  console.log("MASTER_PASSWORD_HASH=" + hash);
});
