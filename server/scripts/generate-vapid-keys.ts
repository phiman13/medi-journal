import webpush from "web-push";

const subject = process.argv[2];
if (!subject || !(subject.startsWith("mailto:") || subject.startsWith("https:"))) {
  console.error("Nutzung: npm run generate-vapid-keys -- mailto:du@example.com");
  process.exit(1);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + privateKey);
console.log("VAPID_SUBJECT=" + subject);
