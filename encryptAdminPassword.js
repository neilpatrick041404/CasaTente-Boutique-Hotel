import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

(async () => {
  // Step 1: Connect to your MySQL database
  const db = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Admin123!", // your MySQL password if any
    database: "casatente_db" // change to your actual DB name
  });

  try {
    // Step 2: Find the admin user
    const [admins] = await db.execute("SELECT user_id, password FROM users WHERE role = 'admin'");

    if (admins.length === 0) {
      console.log("⚠️ No admin account found.");
      return;
    }

    for (const admin of admins) {
      const userId = admin.user_id;
      const currentPassword = admin.password;

      // Step 3: Check if already hashed (bcrypt hashes start with "$2b$")
      if (!currentPassword.startsWith("$2b$")) {
        // Hash the current password
        const hashedPassword = await bcrypt.hash(currentPassword, 10);

        // Step 4: Update the password in database
        await db.execute("UPDATE users SET password = ? WHERE user_id = ?", [hashedPassword, userId]);
        console.log(`✅ Admin password hashed successfully for user_id: ${userId}`);
      } else {
        console.log(`⚠️ Password already hashed for user_id: ${userId}`);
      }
    }
  } catch (err) {
    console.error("❌ Error hashing password:", err);
  } finally {
    await db.end();
  }
})();
