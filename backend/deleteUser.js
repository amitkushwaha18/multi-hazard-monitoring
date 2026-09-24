const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const targetEmails = [
  "pandeyshreya585@gmail.com",
  "rohitsharma768934@gmail.com",
  "nikkikumari088819@gmail.com",
  "abc@gmai.com",
  "amitpayal954@gmail.com",
  "mr.amit@gmail.com",
  "mr.amit018426@gmail.com",
  "google.user@gmail.com",
  "google.guest.923249@shm-demo.local",
  "yashtiwari0825@gmail.com",
  "amitkushwaha0804.gmail.com628125@shm-demo.local",
  "amit.kuswaha537218@shm-demo.local",
  "google.guest.497946@shm-demo.local",
  "viratkohli3915@gmail.com"
];

const deleteUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB Atlas.');
    console.log(`Attempting to delete ${targetEmails.length} user(s)...\n`);

    for (const email of targetEmails) {
      const user = await User.findOne({ email });
      if (user) {
        await User.deleteOne({ email });
        console.log(`User [${email}] successfully deleted from database.`);
      } else {
        console.log(`No user found with email ${email}.`);
      }
    }

    console.log('\nDeletion process completed.');
    await mongoose.disconnect();
    console.log('Disconnected from database.');
    process.exit();
  } catch (err) {
    console.error('Error deleting users:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

deleteUsers();