// weekly-job.js
const { exec } = require("child_process");
const now = new Date();

if (now.getDay() === 1) {
  // Run on Monday (0=Sunday, 1=Monday, etc.)
  console.log("Running weekly task...");

  exec("node index.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    console.log(`Output: ${stdout}`);
    if (stderr) console.error(`Stderr: ${stderr}`);
  });
} else {
  console.log(`Not scheduled to run today (Day ${now.getDay()})`);
  console.log(`Current UTC time: ${now.toUTCString()}`);
}
