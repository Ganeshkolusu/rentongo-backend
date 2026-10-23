const admin = require("firebase-admin");
const serviceAccount = require("../rentongovehicle-7e6c0-firebase-adminsdk-fbsvc-24472ff3aa.json"); // Download this from Firebase console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
