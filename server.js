require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");

const app = express();

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

const PORT = process.env.PORT || 3000;

// ───────────────────────────────────────────────
// 🌐 MIDDLEWARE
// ───────────────────────────────────────────────
app.use(cors({ origin: "*" }));
app.use(bodyParser.json({ limit: "10mb" }));

// ───────────────────────────────────────────────
// 📁 STATIC FILE SETUP
// ───────────────────────────────────────────────
const publicPath = path.resolve(__dirname, "public").replace(/%20/g, " ");
if (!fs.existsSync(publicPath)) {
  console.error("❌ Public folder missing:", publicPath);
  process.exit(1);
}
app.use(express.static(publicPath, { maxAge: "1h" }));
console.log(`✅ Static assets served from: ${publicPath}`);

// ───────────────────────────────────────────────
// 🗄️ MYSQL CONNECTION
// ───────────────────────────────────────────────
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to MySQL Database!");
    connection.release();
  }
});

// ───────────────────────────────────────────────
// 📧 EMAIL TRANSPORTER
// ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) console.log("❌ SMTP Connection Error:", error);
  else console.log("📡 SMTP server ready");
});

// ───────────────────────────────────────────────
// 📸 FILE UPLOAD CONFIGURATION (for images)
// ───────────────────────────────────────────────
const multer = require("multer");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(publicPath, "uploads/amenities")); // where files go
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-${file.fieldname}${ext}`;
    cb(null, fileName);
  }
});

const upload = multer({ storage });

// Create folder if missing
const uploadDir = path.join(publicPath, "uploads/amenities");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ Upload Amenity Image
app.post("/upload-amenity-image", upload.single("icon"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded." });
  }

  const fileUrl = `/uploads/amenities/${req.file.filename}`;
  res.json({ message: "✅ Image uploaded successfully!", fileUrl });
});

// ───────────────────────────────────────────────
// 📸 FILE UPLOAD CONFIGURATION (for room images)
// ───────────────────────────────────────────────
const roomStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(publicPath, "uploads/rooms")); // separate folder for room images
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${Date.now()}-room${ext}`;
    cb(null, fileName);
  }
});

const roomUpload = multer({ storage: roomStorage });

// Create folder if missing
const roomUploadDir = path.join(publicPath, "uploads/rooms");
if (!fs.existsSync(roomUploadDir)) {
  fs.mkdirSync(roomUploadDir, { recursive: true });
}

// ✅ Upload Room Image
app.post("/upload-room-image", roomUpload.single("roomImage"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No image uploaded." });
  }

  const fileUrl = `/uploads/rooms/${req.file.filename}`;
  res.json({ message: "✅ Room image uploaded successfully!", fileUrl });
});

// ───────────────────────────────────────────────
// 🔐 OTP MANAGEMENT (SIGNUP + RESET PASSWORD)
// ───────────────────────────────────────────────
const signupOtpStore = {};
const resetOtpStore = {};

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000);
}

// Automatically clear expired OTPs every 10 minutes
setInterval(() => {
  const now = Date.now();
  const cleanup = (store) => {
    Object.keys(store).forEach((email) => {
      if (now - store[email].time > 3 * 60 * 1000) delete store[email];
    });
  };
  cleanup(signupOtpStore);
  cleanup(resetOtpStore);
}, 10 * 60 * 1000);

// ───────────────────────────────────────────────
// 🧍 USER REGISTRATION
// ───────────────────────────────────────────────
app.post("/register", async (req, res) => {
  const { fullname, email, contact, password, role } = req.body;
  if (!fullname || !email || !password)
    return res.status(400).json({ message: "All fields are required." });

  try {
    const [existingEmail] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingEmail.length)
      return res.status(400).json({ message: "Email already registered." });

    // ✅ Validate contact number
    if (!/^\d{11}$/.test(contact)) {
      return res.status(400).json({ message: "Contact number must be exactly 11 digits." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || "customer";

    await db
    .promise()
    .query(
      "INSERT INTO users (fullname, email, contact, password, role, verified) VALUES (?, ?, ?, ?, ?, 0)",
      [fullname, email, contact, hashedPassword, userRole]
      );

    const otp = generateOTP();
    signupOtpStore[email.toLowerCase()] = { otp, time: Date.now() };

    const mailOptions = {
      from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Casa Tente Hotel - Email Verification",
      text: `Welcome to Casa Tente Hotel!\n\nYour OTP code is ${otp}.\nThis code will expire in 3 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📩 Signup OTP sent to ${email}`);
    res.json({ message: "✅ Registration successful! Check your email for OTP." });
  } catch (err) {
    console.error("❌ Registration error:", err.message);
    res.status(500).json({ message: "Database error during registration." });
  }
});

app.post("/check-account", async (req, res) => {
  const { email } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT verified FROM users WHERE email = ?",
      [email]
    );

    // ❌ Not registered
    if (!rows.length) {
      return res.status(200).json({
        exists: false,
        verified: false
      });
    }

    const user = rows[0];

    // ✅ Registered → return verification status
    return res.status(200).json({
      exists: true,
      verified: user.verified === 1
    });

  } catch (err) {
    console.error("❌ Error checking account:", err.message);
    res.status(500).json({
      message: "Server error while checking account."
    });
  }
});

// ───────────────────────────────────────────────
// 🔓 LOGIN
// ───────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const [rows] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (!rows.length) return res.status(404).json({ message: "Email not found." });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Incorrect password." });

    if (!user.verified)
      return res.status(403).json({ message: "Please verify your email before logging in." });

    res.json({
      message: "✅ Login successful!",
      user: { user_id: user.user_id, fullname: user.fullname, email: user.email, contact: user.contact, role: user.role },
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ message: "Database error during login." });
  }
});

// ───────────────────────────────────────────────
// 🔐 OTP ENDPOINTS (SIGNUP + RESET PASSWORD)
// ───────────────────────────────────────────────

// Verify signup OTP
app.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  const stored = signupOtpStore[email?.toLowerCase()];
  if (!stored) return res.status(400).json({ message: "OTP expired or not found." });
  if (parseInt(otp) !== stored.otp) return res.status(400).json({ message: "Invalid OTP." });

  try {
    await db.promise().query("UPDATE users SET verified = 1 WHERE email = ?", [email]);
    delete signupOtpStore[email.toLowerCase()];
    console.log(`✅ Signup OTP verified for ${email}`);
    res.json({ message: "Email verified successfully." });
  } catch (err) {
    console.error("❌ OTP verification error:", err.message);
    res.status(500).json({ message: "Error verifying OTP." });
  }
});

// Resend signup OTP
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required." });

  const otp = generateOTP();
  signupOtpStore[email.toLowerCase()] = { otp, time: Date.now() };

  const mailOptions = {
    from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Casa Tente Hotel - New OTP",
    text: `Your new OTP is ${otp}. It expires in 3 minutes.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`📩 Signup OTP resent to ${email}`);
    res.json({ message: "New OTP sent to your email." });
  } catch (err) {
    console.error("❌ Error resending OTP:", err.message);
    res.status(500).json({ message: "Failed to resend OTP." });
  }
});

// Send reset password OTP
app.post("/send-reset-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required." });

  try {
    const [user] = await db.promise().query("SELECT * FROM users WHERE email = ?", [email]);
    if (!user.length)
      return res.status(404).json({ message: "Email not found." });

    const otp = generateOTP();
    resetOtpStore[email.toLowerCase()] = { otp, time: Date.now() };

    const mailOptions = {
      from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Casa Tente Hotel - Password Reset OTP",
      text: `Your password reset code is ${otp}. It expires in 3 minutes.`,
    };

    await transporter.sendMail(mailOptions);
    console.log(`📩 Reset OTP sent to ${email}`);
    res.json({ message: "OTP sent to your email." });
  } catch (err) {
    console.error("❌ Error sending reset OTP:", err.message);
    res.status(500).json({ message: "Server error while sending OTP." });
  }
});

// Verify reset OTP
app.post("/verify-reset-otp", (req, res) => {
  const { email, otp } = req.body;
  const stored = resetOtpStore[email?.toLowerCase()];
  if (!stored) return res.status(400).json({ message: "OTP expired or not found." });
  if (parseInt(otp) !== stored.otp) return res.status(400).json({ message: "Invalid OTP." });

  res.json({ message: "OTP verified. You may now reset your password." });
});

// Reset password
app.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword)
    return res.status(400).json({ message: "Missing required fields." });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.promise().query("UPDATE users SET password = ? WHERE email = ?", [hashed, email]);
    delete resetOtpStore[email.toLowerCase()];
    console.log(`🔐 Password updated for ${email}`);
    res.json({ message: "Password updated successfully." });
  } catch (err) {
    console.error("❌ Error resetting password:", err.message);
    res.status(500).json({ message: "Failed to reset password." });
  }
});

// ───────────────────────────────────────────────
// 📋 FETCH DATA ENDPOINTS
// ───────────────────────────────────────────────
async function queryDB(sql, params = []) {
  try {
    const [rows] = await db.promise().query(sql, params);
    return rows;
  } catch (err) {
    console.error("❌ Database query failed:", err.message);
    throw new Error("Database query failed");
  }
}

// ABOUT
app.get("/about", async (req, res) => {
  try {
    res.json(await queryDB("SELECT * FROM about ORDER BY about_id ASC"));
  } catch {
    res.status(500).json({ message: "Error fetching about content." });
  }
});

// ROOMS
app.get("/rooms", async (req, res) => {
  try {
    res.json(await queryDB("SELECT * FROM rooms ORDER BY room_id ASC"));
  } catch {
    res.status(500).json({ message: "Error fetching rooms." });
  }
});

// 🔍 Get single room by ID
app.get("/rooms/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const rows = await queryDB("SELECT * FROM rooms WHERE room_id = ?", [id]);
    if (!rows.length) return res.status(404).json({ message: "Room not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error fetching room:", err.message);
    res.status(500).json({ message: "Error fetching room details." });
  }
});

// ───────────────────────────────────────────────
// ➕ ADD ROOM (with image_url support)
// ───────────────────────────────────────────────
app.post("/rooms", async (req, res) => {
  const { room_name, room_type, description, price_per_night, max_guests, amenities, image_url } = req.body;

  // ✅ Basic validation
  if (!room_name || !room_type || !price_per_night || !max_guests) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // ✅ Insert new room (image_url added)
    const sql = `
      INSERT INTO rooms 
      (room_name, room_type, description, price_per_night, max_guests, amenities, image_url, availability_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'available')
    `;

    await db.promise().query(sql, [
      room_name,
      room_type,
      description || "",
      price_per_night,
      max_guests,
      amenities || "",
      image_url || "" // ✅ Store uploaded image path or leave empty
    ]);

    console.log(`✅ Added room: ${room_name}`);
    res.json({ message: "✅ Room added successfully!" });
  } catch (err) {
    console.error("❌ Error adding room:", err.message);
    res.status(500).json({ message: "Database error while adding room." });
  }
});

// ───────────────────────────────────────────────
// ✏️ UPDATE ROOM
// ───────────────────────────────────────────────
app.put("/rooms/:id", async (req, res) => {
  const { id } = req.params;
  const { room_name, room_type, description, price_per_night, max_guests, amenities, image_url } = req.body;

  try {
    const [result] = await db.promise().query(
      `UPDATE rooms
       SET room_name=?, room_type=?, description=?, price_per_night=?, max_guests=?, amenities=?, image_url=?
       WHERE room_id=?`,
      [room_name, room_type, description, price_per_night, max_guests, amenities, image_url || "", id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Room not found." });
    }

    res.json({ message: "✅ Room updated successfully!" });
  } catch (err) {
    console.error("❌ Error updating room:", err.message);
    res.status(500).json({ message: "Database error while updating room." });
  }
});

// 🗑 DELETE ROOM
app.delete("/rooms/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.promise().query("DELETE FROM rooms WHERE room_id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Room not found." });
    }
    res.json({ message: "🗑 Room deleted successfully." });
  } catch (err) {
    console.error("❌ Error deleting room:", err.message);
    res.status(500).json({ message: "Database error while deleting room." });
  }
});

// ───────────────────────────────────────────────
// 🌿 AMENITIES MANAGEMENT (Indoor + Outdoor, supports icon_url)
// ───────────────────────────────────────────────

// ✅ GET INDOOR AMENITIES
app.get("/indoor-amenities", async (req, res) => {
  try {
    const rows = await queryDB(
      `SELECT amenity_id, amenity_name, description, amenity_type, icon_url, created_at 
       FROM indoor_amenities 
       ORDER BY amenity_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching indoor amenities:", err.message);
    res.status(500).json({ message: "Error fetching indoor amenities." });
  }
});

// ✅ GET OUTDOOR AMENITIES
app.get("/outdoor-amenities", async (req, res) => {
  try {
    const rows = await queryDB(
      `SELECT outdoor_id, amenity_name, description, icon_url, created_at 
       FROM outdoor_amenities 
       ORDER BY outdoor_id ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching outdoor amenities:", err.message);
    res.status(500).json({ message: "Error fetching outdoor amenities." });
  }
});

// ✅ ADD AMENITY (auto-detects indoor/outdoor)
app.post("/amenities", async (req, res) => {
  const { amenity_name, description, amenity_type, icon_url } = req.body;

  if (!amenity_name || !amenity_type) {
    return res
      .status(400)
      .json({ message: "Amenity name and type are required." });
  }

  try {
    if (amenity_type.toLowerCase() === "indoor") {
      await db.promise().query(
        `INSERT INTO indoor_amenities (amenity_name, description, amenity_type, icon_url)
         VALUES (?, ?, 'indoor', ?)`,
        [amenity_name, description || "", icon_url || ""]
      );
    } else if (amenity_type.toLowerCase() === "outdoor") {
      await db.promise().query(
        `INSERT INTO outdoor_amenities (amenity_name, description, icon_url)
         VALUES (?, ?, ?)`,
        [amenity_name, description || "", icon_url || ""]
      );
    } else {
      return res.status(400).json({ message: "Invalid amenity type." });
    }

    console.log(`✅ Added new ${amenity_type} amenity:`, amenity_name);
    res.json({
      message: `✅ ${
        amenity_type.charAt(0).toUpperCase() + amenity_type.slice(1)
      } amenity added successfully!`,
    });
  } catch (err) {
    console.error("❌ Error adding amenity:", err.message);
    res.status(500).json({ message: "Database error while adding amenity." });
  }
});

// ✅ UPDATE AMENITY (type + id required in URL)
app.put("/amenities/:type/:id", async (req, res) => {
  const { type, id } = req.params;
  const { amenity_name, description, icon_url } = req.body;

  const isIndoor = type.toLowerCase() === "indoor";
  const table = isIndoor ? "indoor_amenities" : "outdoor_amenities";
  const idCol = isIndoor ? "amenity_id" : "outdoor_id";

  try {
    const [result] = await db
      .promise()
      .query(
        `UPDATE ${table} 
         SET amenity_name=?, description=?, icon_url=? 
         WHERE ${idCol}=?`,
        [amenity_name, description || "", icon_url || "", id]
      );

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: `${type} amenity not found.` });
    }

    res.json({
      message: `✅ ${
        type.charAt(0).toUpperCase() + type.slice(1)
      } amenity updated successfully!`,
    });
  } catch (err) {
    console.error(`❌ Error updating ${type} amenity:`, err.message);
    res.status(500).json({
      message: `Database error while updating ${type} amenity.`,
    });
  }
});

// ✅ DELETE AMENITY (detects type)
app.delete("/amenities/:type/:id", async (req, res) => {
  const { type, id } = req.params;

  const table =
    type === "indoor" ? "indoor_amenities" : "outdoor_amenities";
  const idCol = type === "indoor" ? "amenity_id" : "outdoor_id";

  try {
    const [result] = await db
      .promise()
      .query(`DELETE FROM ${table} WHERE ${idCol} = ?`, [id]);

    if (result.affectedRows === 0)
      return res.status(404).json({ message: `${type} amenity not found.` });

    res.json({ message: `🗑 ${type} amenity deleted successfully!` });
  } catch (err) {
    console.error(`❌ Error deleting ${type} amenity:`, err.message);
    res.status(500).json({ message: `Database error while deleting ${type} amenity.` });
  }
});

// CONTACT
app.get("/contact", async (req, res) => {
  try {
    res.json(await queryDB("SELECT * FROM contact ORDER BY contact_id ASC"));
  } catch {
    res.status(500).json({ message: "Error fetching contact info." });
  }
});

// ───────────────────────────────────────────────
// 🏨 RESERVATION HANDLING (Save + Email Slip)
// ───────────────────────────────────────────────
app.post("/reservation", async (req, res) => {
  const {
    user_id,
    room_id,
    checkin,
    checkout,
    guests,
    requests,
    total_amount,
  } = req.body;

  // ✅ Validate essential fields
  if (!user_id || !room_id || !checkin || !checkout) {
    return res.status(400).json({ message: "Missing required fields." });
  }

  try {
    // ✅ Optional: Verify user exists
    const [userCheck] = await db
      .promise()
      .query("SELECT fullname, email, contact FROM users WHERE user_id = ?", [user_id]);
    if (!userCheck.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const user = userCheck[0];

    // ✅ Insert reservation (relational approach)
    const sql = `
      INSERT INTO reservations 
      (user_id, room_id, check_in, check_out, guests, requests, total_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    await db
      .promise()
      .query(sql, [user_id, room_id, checkin, checkout, guests, requests, total_amount]);

    console.log("✅ Reservation saved for user_id:", user_id);

    // ✅ Optional: Send response with confirmation details
    res.json({
      message: "Reservation saved successfully.",
      reservation: {
        user_id,
        fullname: user.fullname,
        email: user.email,
        contact: user.contact,
        room_id,
        checkin,
        checkout,
        guests,
        requests,
        total_amount,
        status: "pending",
      },
    });
  } catch (err) {
    console.error("❌ Error saving reservation:", err.message);
    res
      .status(500)
      .json({ message: "Database error while saving reservation.", error: err.message });
  }
});

// Send reservation slip via email
app.post("/send-slip", async (req, res) => {
  const { email, name, pdfBase64 } = req.body;

  if (!email || !pdfBase64) {
    return res.status(400).json({ message: "Email or slip missing." });
  }

  try {
    const mailOptions = {
      from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your Reservation Slip - Casa Tente Boutique Hotel",
      text: `Dear ${name || "Guest"},\n\nAttached is your reservation slip.\nWe look forward to hosting you!`,
      attachments: [
        {
          filename: "CasaTente_ReservationSlip.pdf",
          content: pdfBase64.split("base64,")[1],
          encoding: "base64",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log(`📧 Slip sent successfully to ${email}`);
    res.json({ message: "Slip sent successfully." });
  } catch (err) {
    console.error("❌ Error sending slip email:", err.message);
    res.status(500).json({ message: "Failed to send reservation slip." });
  }
});

// ───────────────────────────────────────────────
// 🧾 ADMIN — GET ALL RESERVATIONS
// ───────────────────────────────────────────────
app.get("/reservations", async (req, res) => {
  try {
    // 🔥 Auto-expire pending reservations that are past their check-in date
    await db.promise().query(`
      UPDATE reservations
      SET status = 'expired'
      WHERE status = 'pending'
      AND check_in < CURDATE()
    `);

    // ✅ Automatically update statuses when admin opens Reservations
    await db.promise().query(`
      UPDATE reservations
      SET status = 'in_progress'
      WHERE status = 'confirmed'
      AND check_in <= CURDATE()
      AND check_out >= CURDATE()
    `);

    await db.promise().query(`
      UPDATE reservations
      SET status = 'completed'
      WHERE (status = 'in_progress' OR status = 'confirmed')
      AND check_out < CURDATE()
    `);
    
    const sql = `
      SELECT r.reservation_id,
            u.fullname AS user_name,
            rm.room_name,
            r.guests,
            r.check_in,
            r.check_out,
            r.total_amount,
            r.status,
            r.reservation_type,
            DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.user_id
      LEFT JOIN rooms rm ON r.room_id = rm.room_id
      ORDER BY r.created_at DESC
    `;

    const [rows] = await db.promise().query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching reservations:", err.message);
    res.status(500).json({ message: "Failed to load reservations." });
  }
});

// ───────────────────────────────────────────────
// 🔄 ADMIN — UPDATE RESERVATION STATUS
// ───────────────────────────────────────────────
app.put("/reservations/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["confirmed", "cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status update." });
  }

  try {
    // ✅ Get reservation + user data
    const [rows] = await db.promise().query(`
      SELECT r.*, u.email, u.fullname, rm.room_name
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.user_id
      LEFT JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.reservation_id = ?
    `, [id]);

    if (!rows.length)
      return res.status(404).json({ message: "Reservation not found." });

    const reservation = rows[0];

    // ✅ Update status
    await db.promise().query(
      "UPDATE reservations SET status = ? WHERE reservation_id = ?",
      [status, id]
    );

    // ==============================
    // 📧 SEND EMAIL TO CUSTOMER
    // ==============================
    if (reservation.email) {
      let subject = "";
      let message = "";

      if (status === "confirmed") {
        subject = "✅ Reservation Confirmed - Casa Tente Hotel";
        message = `
Dear ${reservation.fullname},

We are pleased to inform you that your reservation has been CONFIRMED.

📌 Reservation Details:
Room: ${reservation.room_name}
Check-in: ${formatDate(reservation.check_in)}
Check-out: ${formatDate(reservation.check_out)}
Guests: ${reservation.guests}
Total: ₱${Number(reservation.total_amount).toLocaleString()}

We look forward to welcoming you to Casa Tente Hotel.

Best regards,
Casa Tente Hotel Team
`;
      } else if (status === "cancelled") {
        subject = "❌ Reservation Cancelled - Casa Tente Hotel";
        message = `
Dear ${reservation.fullname},

We would like to inform you that your reservation has been CANCELLED.

📌 Reservation Details:
Room: ${reservation.room_name}
Check-in: ${formatDate(reservation.check_in)}
Check-out: ${formatDate(reservation.check_out)}

If this was a mistake or you wish to rebook, please visit our website.

Best regards,
Casa Tente Hotel Team
`;
      }

      await transporter.sendMail({
        from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
        to: reservation.email,
        subject: subject,
        text: message
      });

      console.log(`📧 Status email sent to ${reservation.email}`);
    }

    res.json({ message: `Reservation #${id} has been ${status}.` });

  } catch (err) {
    console.error("❌ Error updating reservation:", err.message);
    res.status(500).json({ message: "Database error while updating reservation." });
  }
});

// 🧾 ADMIN — ADD MANUAL / BLOCKED RESERVATION (Enhanced with requests field)
app.post("/reservations/manual", async (req, res) => {
  const { room_id, check_in, check_out, requests, guests, total_amount } = req.body;

  // Basic validation
  if (!room_id || !check_in || !check_out) {
    return res.status(400).json({ message: "Room ID, check-in, and check-out are required." });
  }

  try {
    // Get room details for price
    const [room] = await db.promise().query("SELECT price_per_night FROM rooms WHERE room_id = ?", [room_id]);
    if (!room.length) {
      return res.status(404).json({ message: "Room not found." });
    }

    // Auto-calculate total if not provided
    const pricePerNight = room[0].price_per_night;
    const days = Math.max(
      1,
      Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24))
    );
    const total = total_amount || pricePerNight * days;

    // Insert manual reservation (no user_id needed)
    await db.promise().query(
      `
      INSERT INTO reservations 
      (room_id, user_id, guests, check_in, check_out, requests, total_amount, status, reservation_type, created_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'confirmed', 'manual', NOW())
      `,
      [room_id, guests || 1, check_in, check_out, requests || "No special requests.", total]
    );

    console.log(`✅ Manual reservation added for Room #${room_id} (${check_in} - ${check_out})`);
    res.json({ message: "✅ Manual reservation successfully added!" });
  } catch (err) {
    console.error("❌ Error adding manual reservation:", err.message);
    res.status(500).json({ message: "Database error while adding manual reservation." });
  }
});

// ───────────────────────────────────────────────
// 🗑 ADMIN — REMOVE MANUAL RESERVATION
// ───────────────────────────────────────────────
app.delete("/reservations/manual/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await db.promise().query(
      "DELETE FROM reservations WHERE reservation_id = ? AND reservation_type = 'manual'",
      [id]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Manual reservation not found." });

    console.log(`🗑 Manual reservation #${id} removed.`);
    res.json({ message: "🗑 Manual reservation removed successfully!" });
  } catch (err) {
    console.error("❌ Error deleting manual reservation:", err.message);
    res.status(500).json({ message: "Database error while deleting manual reservation." });
  }
});

// ───────────────────────────────────────────────
// 📅 CUSTOMER — GET RESERVED DATES (for Calendar)
// ───────────────────────────────────────────────
app.get("/rooms/:room_id/reserved-dates", async (req, res) => {
  const { room_id } = req.params;

  // Helper to format date as YYYY-MM-DD (local)
  function toLocalYMD(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  try {
    // 🔥 Auto-expire pending reservations that are already in the past
    await db.promise().query(`
      UPDATE reservations
      SET status = 'expired'
      WHERE status = 'pending'
      AND check_in < CURDATE()
    `);

    const sql = `
      SELECT check_in, check_out, status, reservation_type
      FROM reservations
      WHERE room_id = ?
      AND status IN ('pending', 'confirmed', 'in_progress')
    `;
    const [rows] = await db.promise().query(sql, [room_id]);

    const dateMap = {}; // e.g., { '2025-11-05': 'confirmed' }

    for (const r of rows) {
      const start = new Date(r.check_in);
      const end = new Date(r.check_out);

      // ✅ Include both check-in and check-out days in the disabled range
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = toLocalYMD(new Date(d));

        // ✅ Block all important statuses (pending, confirmed, in_progress)
        // Manual reservations are also included automatically
        if (["pending", "confirmed", "in_progress"].includes(r.status)) {
          // Prioritize confirmed / in_progress over pending
          if (!dateMap[dateStr] || ["confirmed", "in_progress"].includes(r.status)) {
            dateMap[dateStr] = r.status;
          }
        }
      }
    }

    // Convert map → array for frontend
    const reservedDates = Object.keys(dateMap).map((date) => ({
      date,
      status: dateMap[date],
    }));

    res.json(reservedDates);
  } catch (err) {
    console.error("❌ Error fetching reserved dates:", err.message);
    res.status(500).json({ message: "Failed to fetch reserved dates." });
  }
});

// ───────────────────────────────────────────────
// 👤 CHECK IF USER HAS COMPLETED A STAY (For Feedback Access)
// ───────────────────────────────────────────────
app.get("/api/user/:user_id/completed-stays", async (req, res) => {
  const { user_id } = req.params;

  try {
    const sql = `
      SELECT COUNT(*) AS completedCount
      FROM reservations
      WHERE user_id = ? AND status = 'completed'
    `;
    const [rows] = await db.promise().query(sql, [user_id]);

    const hasCompletedStay = rows[0].completedCount > 0;
    res.json({ completed: hasCompletedStay });
  } catch (err) {
    console.error("❌ Error checking completed stays:", err.message);
    res.status(500).json({ completed: false });
  }
});

// ───────────────────────────────────────────────
// ⏰ AUTOMATIC DAILY UPDATE FOR COMPLETED RESERVATIONS
// ───────────────────────────────────────────────
const cron = require("node-cron");

// Runs every day at 12:00 midnight
cron.schedule("0 0 * * *", async () => {
  try {
    // 🔥 Auto-expire pending reservations that are already in the past
    await db.promise().query(`
      UPDATE reservations
      SET status = 'expired'
      WHERE status = 'pending'
      AND check_in < CURDATE()
    `);

    // 🌅 1. Mark confirmed reservations as "in_progress" if the stay starts today or earlier and not yet checked out
    await db.promise().query(`
      UPDATE reservations
      SET status = 'in_progress'
      WHERE status = 'confirmed'
      AND check_in <= CURDATE()
      AND check_out >= CURDATE()
    `);

    // 🌙 2. Mark "in_progress" or "confirmed" reservations as "completed" after checkout date
    const [result] = await db.promise().query(`
      UPDATE reservations
      SET status = 'completed'
      WHERE (status = 'in_progress' OR status = 'confirmed')
      AND check_out < CURDATE()
    `);

    if (result.affectedRows > 0) {
      console.log(`🌙 ${result.affectedRows} reservations updated automatically (to completed or in progress).`);
    } else {
      console.log("🌙 No reservations to update tonight.");
    }
  } catch (err) {
    console.error("❌ Cron job error (auto-status update):", err.message);
  }
});

// ───────────────────────────────────────────────
// 💬 FEEDBACK SUBMISSION
// ───────────────────────────────────────────────
app.post("/feedback", async (req, res) => {
  const { user_id, comment, rating } = req.body;

  if (!user_id || !comment || !rating) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    await db
      .promise()
      .query(
        "INSERT INTO feedback (user_id, comment, rating) VALUES (?, ?, ?)",
        [user_id, comment, rating]
      );

    console.log(`✅ Feedback saved from user #${user_id}`);
    res.json({ message: "Thank you for your feedback!" });
  } catch (err) {
    console.error("❌ Error saving feedback:", err.message);
    res.status(500).json({ message: "Database error while saving feedback." });
  }
});

// 🧾 ADMIN — GET ALL FEEDBACK (with user full name)
app.get("/feedback", async (req, res) => {
  try {
    const sql = `
      SELECT 
        f.feedback_id,
        u.fullname AS fullname,
        f.comment,
        f.rating,
        DATE_FORMAT(f.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
      FROM feedback f
      LEFT JOIN users u ON f.user_id = u.user_id
      ORDER BY f.rating DESC, f.created_at DESC
    `;
    const [rows] = await db.promise().query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching feedback:", err.message);
    res.status(500).json({ message: "Failed to fetch feedback." });
  }
});

// ───────────────────────────────────────────────
// 👤 GET USER PROFILE (for displaying name, email, contact)
// ───────────────────────────────────────────────
app.get("/api/user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.promise().query(
      "SELECT user_id, fullname, email, contact FROM users WHERE user_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
});

// ───────────────────────────────────────────────
// 👤 UPDATE USER PROFILE (name, email, contact)
// ───────────────────────────────────────────────
app.put("/api/user/:id/update", async (req, res) => {
  const { id } = req.params;
  const { fullname, email, contact } = req.body;

  if (!fullname || !email || !contact)
    return res.status(400).json({ message: "All fields required" });

  if (!/^09\d{9}$/.test(contact))
    return res.status(400).json({ message: "Contact must start with 09 and be 11 digits long." });

  try {
    // Get current user's email
    const [[currentUser]] = await db.promise().query(
      "SELECT email FROM users WHERE user_id = ?",
      [id]
    );

    if (!currentUser)
      return res.status(404).json({ message: "User not found" });

    const emailChanged = currentUser.email !== email;

    // ───────────────────────────────────────────────
    // 1️⃣ EMAIL CHANGED → Request verification but DO NOT update email yet
    // ───────────────────────────────────────────────
    if (emailChanged) {

      // Check if new email already in use
      const [existing] = await db.promise().query(
        "SELECT user_id FROM users WHERE email = ?",
        [email]
      );

      if (existing.length > 0) {
        return res.status(400).json({
          message: "Email already exists. Please use a different one."
        });
      }

      // Generate OTP (store temporarily, NOT in DB)
      const otp = generateOTP();
      signupOtpStore[id] = {
        newEmail: email,
        otp,
        time: Date.now()
      };

      // Send OTP email
      await transporter.sendMail({
        from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verify Your New Email",
        text: `Your OTP is ${otp}. It expires in 3 minutes.`
      });

      // Update ONLY fullname + contact, keep email & verified unchanged
      await db.promise().query(
        "UPDATE users SET fullname=?, contact=? WHERE user_id=?",
        [fullname, contact, id]
      );

      return res.json({
        message: "Email change requires verification.",
        requireVerification: true
      });
    }

    // ───────────────────────────────────────────────
    // 2️⃣ EMAIL NOT CHANGED → Update normally
    // ───────────────────────────────────────────────
    await db.promise().query(
      "UPDATE users SET fullname=?, contact=? WHERE user_id=?",
      [fullname, contact, id]
    );

    return res.json({
      message: "Profile updated successfully",
      requireVerification: false
    });

  } catch (err) {
    console.error("Update error:", err);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

// ✅ VERIFY UPDATED EMAIL OTP (Profile Change)
app.post("/api/verify-email/:id", async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;

  try {
    const [[user]] = await db.promise().query(
      "SELECT email FROM users WHERE user_id = ?",
      [id]
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const stored = signupOtpStore[user.email.toLowerCase()];
    if (!stored) {
      return res.status(400).json({ message: "OTP expired or not found." });
    }

    if (parseInt(otp) !== stored.otp) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    await db.promise().query(
      "UPDATE users SET verified = 1 WHERE user_id = ?",
      [id]
    );

    delete signupOtpStore[user.email.toLowerCase()];

    res.json({ message: "✅ Email successfully verified." });

  } catch (err) {
    console.error("Email verification error:", err);
    res.status(500).json({ message: "Email verification failed." });
  }
});

// ───────────────────────────────────────────────
// 🔍 VERIFY CURRENT PASSWORD ONLY (for Step 1)
// ───────────────────────────────────────────────
app.post("/api/user/:id/verify-password", async (req, res) => {
  const { id } = req.params;
  const { currentPassword } = req.body;

  try {
    const [rows] = await db.promise().query(
      "SELECT password FROM users WHERE user_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, rows[0].password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password." });
    }

    // 👍 Password is correct
    return res.json({ message: "Password verified." });

  } catch (err) {
    console.error("Verify password error:", err);
    return res.status(500).json({ message: "Server error verifying password." });
  }
});

// ───────────────────────────────────────────────
// 🔐 CHANGE PASSWORD — Step 2 (Only newPassword needed)
// ───────────────────────────────────────────────
app.put("/api/user/:id/change-password", async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;  // ✔ only new password

  try {
    const [rows] = await db.promise().query(
      "SELECT user_id FROM users WHERE user_id = ?",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.promise().query(
      "UPDATE users SET password = ? WHERE user_id = ?",
      [hashedPassword, id]
    );

    return res.json({ message: "Password updated successfully!" });

  } catch (err) {
    console.error("Password update error:", err);
    return res.status(500).json({ message: "Failed to update password." });
  }
});

// ───────────────────────────────────────────────
// 👥 ADMIN — GET ALL USERS (verified first)
// ───────────────────────────────────────────────
app.get("/admin/users", async (req, res) => {
  try {
    const sql = `
      SELECT 
        user_id,
        fullname,
        email,
        contact,
        verified
      FROM users
      WHERE role = 'customer'
      ORDER BY verified DESC, fullname ASC
    `;

    const [rows] = await db.promise().query(sql);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ message: "Failed to load users." });
  }
});

// 🧾 CUSTOMER — GET PERSONAL RESERVATION HISTORY
app.get("/api/user/:user_id/reservations", async (req, res) => {
  const { user_id } = req.params;

  try {
    const sql = `
      SELECT 
        r.reservation_id,
        r.room_id,
        rm.room_name,
        r.check_in,
        r.check_out,
        r.guests,
        r.total_amount,
        r.status,
        r.created_at,
        r.cancel_requested
      FROM reservations r
      LEFT JOIN rooms rm ON r.room_id = rm.room_id
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;

    const [rows] = await db.promise().query(sql, [user_id]);

    res.json(rows);
  } catch (err) {
    console.error("❌ Error fetching user history:", err.message);
    res.status(500).json({ message: "Failed to fetch reservation history." });
  }
});

// 📨 USER REQUESTS CANCELLATION (email only)
app.post("/api/cancel-request", async (req, res) => {
  const { reservation_id, user_name, user_email, reason } = req.body;

  if (!reservation_id || !reason) {
    return res.status(400).json({ message: "Missing cancellation details." });
  }

  try {
    // 1️⃣ Prevent double requests
    const [existing] = await db.promise().query(
      "SELECT cancel_requested FROM reservations WHERE reservation_id = ?",
      [reservation_id]
    );

    if (!existing.length) {
      return res.status(404).json({ message: "Reservation not found." });
    }

    if (existing[0].cancel_requested === 1) {
      return res.json({ alreadyRequested: true });
    }

    // 2️⃣ Mark as cancel-requested
    await db.promise().query(
      "UPDATE reservations SET cancel_requested = 1 WHERE reservation_id = ?",
      [reservation_id]
    );

    // 3️⃣ Send email to hotel
    await transporter.sendMail({
      from: `"Casa Tente Hotel" <${process.env.EMAIL_USER}>`,
      to: "hotelcasatenteboutique@gmail.com",
      subject: `Cancellation Request for Reservation #${reservation_id}`,
      text: `
A guest has requested cancellation.

Reservation ID: ${reservation_id}
Name: ${user_name}
Email: ${user_email}

Reason:
${reason}
      `
    });

    res.json({
      message: "Cancellation request sent successfully.",
      alreadyRequested: false
    });

  } catch (err) {
    console.error("❌ Email error:", err.message);
    res.status(500).json({ message: "Failed to send cancellation request." });
  }
});

// ───────────────────────────────────────────────
// ✅ ROOT & 404 HANDLERS
// ───────────────────────────────────────────────
// Clean URLs for main pages
app.get("/home-page", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.get("/rooms-page", (req, res) => {
  res.sendFile(path.join(publicPath, "rooms.html"));
});

app.get("/about-page", (req, res) => {
  res.sendFile(path.join(publicPath, "about.html"));
});

app.get("/contact-page", (req, res) => {
  res.sendFile(path.join(publicPath, "contact.html"));
});

app.get("/amenities-page", (req, res) => {
  res.sendFile(path.join(publicPath, "amenities.html"));
});

app.get("/login-page", (req, res) => {
  res.sendFile(path.join(publicPath, "login.html"));
});

app.get("/signup-page", (req, res) => {
  res.sendFile(path.join(publicPath, "signup.html"));
});

// Reservation Dynamic Slug URL — Example: /reserve/standard-room-1
app.get("/reserve/:slug", (req, res) => {
  res.sendFile(path.join(publicPath, "reservation.html"));
});

app.get("/feedback-page", (req, res) => {
  res.sendFile(path.join(publicPath, "feedback.html"));
});

app.get("/forgot-password-page", (req, res) => {
  res.sendFile(path.join(publicPath, "forgot_password.html"));
});

app.get("/profile-page", (req, res) => {
  res.sendFile(path.join(publicPath, "profile.html"));
});

app.get("/history-page", (req, res) => {
  res.sendFile(path.join(publicPath, "history.html"));
});

app.get("/admin-page", (req, res) => {
  res.sendFile(path.join(publicPath, "admin.html"));
});

// Default redirect root → /home
app.get("/", (req, res) => {
  res.redirect("/home-page");
});

// 404 page
app.use((req, res) => {
  res.status(404).type("text").send("404 - Page Not Found");
});

// ───────────────────────────────────────────────
// 🚀 START SERVER
// ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📂 Public directory: ${publicPath}`);
});
