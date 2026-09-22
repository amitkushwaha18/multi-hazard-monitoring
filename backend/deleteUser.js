const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const targetEmail = [
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

const deleteUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: targetEmail });
    if (user) {
      await User.deleteOne({ email: targetEmail });
      console.log(`User [${targetEmail}] successfully deleted from database.`);
    } else {
      console.log(`No user found with email ${targetEmail}.`);
    }
    await mongoose.disconnect();
    process.exit();
  } catch (err) {
    console.error('Error deleting user:', err.message);
    await mongoose.disconnect();
    process.exit(1);
  }
};

deleteUser();