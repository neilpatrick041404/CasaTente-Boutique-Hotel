// ----------------------------
// signup.js – Registration + OTP Verification
// ----------------------------

const signupForm = document.getElementById("signupForm");
const otpModal = document.getElementById("otpModal");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const resendOtpBtn = document.getElementById("resendSignupOtpBtn");
const popup = document.getElementById("popupMessage");
const signupBtn = signupForm.querySelector("button[type='submit']");

let tempEmail = "";
let resendAttempts = 0;
let resendTimer;

// 🧩 Helper: show popup (always visible)
function showPopup(title, message, duration = 2500, callback = null) {
  const titleEl = document.getElementById("popupTitle");
  const textEl = document.getElementById("popupText");

  if (!popup) {
    console.error("❌ Popup element missing in DOM");
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = message;

  popup.style.display = "flex";
  void popup.offsetWidth; // trigger reflow
  popup.classList.add("show");

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => {
      popup.style.display = "none";
      if (callback) callback();
    }, 400);
  }, duration);
}

function showOtpModal() {
  if (!otpModal) return console.error("❌ OTP Modal not found");
  otpModal.style.display = "flex";
  otpModal.classList.add("show");
}

function hideOtpModal() {
  otpModal.classList.remove("show");
  otpModal.style.display = "none";       // ✅ ensures it's fully gone
  document.body.style.pointerEvents = "auto"; // ✅ re-enables clicking
}

// 🧩 SIGNUP PROCESS
signupForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const surname = document.getElementById("surname").value.trim();
  const middle = document.getElementById("middle").value.trim();
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value;
  const confirm = document.getElementById("confirmPassword").value;
  const rawContact = document.getElementById("contact").value.trim(); // only 10 digits input

  let errorBox = document.querySelector(".error-message");
  if (!errorBox) {
    errorBox = document.createElement("p");
    errorBox.className = "error-message";
    signupForm.insertBefore(errorBox, signupForm.firstChild);
  }

  errorBox.style.display = "none";

  // ✅ Contact number validation (only 10 digits after +63)
  if (!/^\d{10}$/.test(rawContact)) {
    errorBox.textContent = "Please enter a valid 10-digit contact number.";
    errorBox.style.display = "block";
    return;
  }

  // Convert +63 to 09 for backend storage
  const contact = "0" + rawContact;

  // ✅ Password validation
  const passwordRule = /^(?=.*\d).{8,}$/;
  if (!passwordRule.test(password)) {
    errorBox.textContent = "Password must be at least 8 characters long and include a number.";
    errorBox.style.display = "block";
    return;
  }

  if (password !== confirm) {
    errorBox.textContent = "Passwords do not match.";
    errorBox.style.display = "block";
    return;
  }

  const fullname = `${name} ${middle ? middle + " " : ""}${surname}`;

  // ✅ BUTTON STATE CHANGE HAPPENS HERE
  const originalText = signupBtn.textContent;
  signupBtn.disabled = true;
  signupBtn.textContent = "Creating account...";

  try {
    const response = await fetch("http://localhost:3000/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullname, email, contact, password }),
    });

    const data = await response.json();

    if (response.ok) {
      tempEmail = email;
      resendAttempts = 0;

      // ✅ Popup then show OTP modal
      showPopup(
        "✅ Registration Successful!",
        "Please check your email for the OTP verification code.",
        2200,
        () => {
          setTimeout(() => {
            showOtpModal();
            startResendTimer();
          }, 200);
        }
      );
    } else {
      errorBox.textContent = data.message || "Registration failed.";
      errorBox.style.display = "block";

      signupBtn.disabled = false;
      signupBtn.textContent = originalText;
      signupBtn.style.opacity = "1";
    }
  } catch (err) {
    console.error("❌ Registration Error:", err);
    errorBox.textContent = "⚠️ Unable to connect to the server.";
    errorBox.style.display = "block";

    signupBtn.disabled = false;
    signupBtn.textContent = originalText;
    signupBtn.style.opacity = "1";
  }
});

/* ===========================================
   🟣 VERIFY ACCOUNT POPUP LOGIC
=========================================== */
const verifyPopup = document.getElementById("verifyEmailPopup");
const verifyLink = document.getElementById("verifyAccountLink");
const closeVerifyPopup = document.getElementById("closeVerifyPopup");
const sendVerifyOtpBtn = document.getElementById("sendVerifyOtpBtn");
const verifyEmailInput = document.getElementById("verifyEmailInput");
const verifyEmailError = document.getElementById("verifyEmailError");

// 🟪 Open popup
if (verifyLink && verifyPopup && sendVerifyOtpBtn && verifyEmailInput) {
  verifyLink.addEventListener("click", (e) => {
    e.preventDefault();
    verifyPopup.classList.add("show");
  });
}

// 🟪 Close popup
closeVerifyPopup.addEventListener("click", () => {
  verifyPopup.classList.remove("show");
  verifyEmailInput.value = "";
  verifyEmailError.textContent = "";
});

// 🟪 Send OTP for unverified users
sendVerifyOtpBtn.addEventListener("click", async () => {
  const email = verifyEmailInput.value.trim().toLowerCase();
  verifyEmailError.textContent = "";

  if (!email) {
    verifyEmailError.textContent = "Please enter your email address.";
    return;
  }

  // Prevent double clicks
  sendVerifyOtpBtn.disabled = true;
  sendVerifyOtpBtn.textContent = "Checking...";

  try {
    const res = await fetch("http://localhost:3000/check-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();

    if (!res.ok) {
      verifyEmailError.textContent = data.message || "Server error.";
      sendVerifyOtpBtn.disabled = false;
      sendVerifyOtpBtn.textContent = "Send OTP";
      return;
    }

    if (!data.exists) {
      verifyEmailError.textContent = "Account is not registered.";
      sendVerifyOtpBtn.disabled = false;
      sendVerifyOtpBtn.textContent = "Send OTP";
      return;
    }

    if (data.exists && data.verified === true) {
      verifyEmailError.textContent = "Account already verified.";
      sendVerifyOtpBtn.disabled = false;
      sendVerifyOtpBtn.textContent = "Send OTP";
      return;
    }

    if (data.exists && data.verified === false) {
      // ✅ Only unverified registered accounts reach here
      const otpRes = await fetch("http://localhost:3000/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const otpData = await otpRes.json();

      if (otpRes.ok) {
        verifyPopup.classList.remove("show");
        tempEmail = email;

        showPopup(
          "📩 OTP Sent!",
          "A verification code has been sent to your email.",
          2200,
          () => {
            setTimeout(() => {
              otpModal.style.display = "flex";
              otpModal.classList.add("show");
              startResendTimer();
            }, 200);
          }
        );
      } else {
        verifyEmailError.textContent = otpData.message || "Failed to send OTP.";
      }
    }
  } catch (err) {
    console.error("❌ Verify account error:", err);
    verifyEmailError.textContent = "Server connection failed.";
  } finally {
    sendVerifyOtpBtn.disabled = false;
    sendVerifyOtpBtn.textContent = "Send OTP";
  }
});

// ✅ OTP Verification
verifyOtpBtn.addEventListener("click", async () => {
  const otp = document.getElementById("otpInput").value.trim();

  if (!otp) {
    alert("Please enter the OTP.");
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempEmail, otp }),
    });

    const data = await res.json();

    if (res.ok) {
      hideOtpModal();
      showPopup(
        "✅ Email Verified!",
        "Your email has been successfully verified. Redirecting to login...",
        2200,
        () => (window.location.href = "/login-page")
      );
    } else {
      alert(data.message || "Invalid OTP. Please try again.");
    }
  } catch (err) {
    console.error("❌ OTP Verification Error:", err);
    alert("⚠️ Could not verify OTP. Please ensure the server is running.");
  }
});

// 🔁 RESEND OTP
resendOtpBtn.addEventListener("click", async () => {
  if (!tempEmail) return;
  if (resendAttempts >= 3) {
    alert("You’ve reached the maximum resend attempts.");
    resendOtpBtn.disabled = true;
    return;
  }

  try {
    resendOtpBtn.disabled = true;
    resendOtpBtn.textContent = "Sending...";

    const res = await fetch("http://localhost:3000/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempEmail }),
    });

    const data = await res.json();

    if (res.ok) {
      resendAttempts++;
      showPopup("📩 OTP Sent!", "A new verification code was sent to your email.");
      startResendTimer();
    } else {
      alert(data.message || "Unable to resend OTP.");
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = "Resend OTP";
    }
  } catch (err) {
    console.error("❌ Error resending OTP:", err);
    alert("⚠️ Server error. Please try again later.");
    resendOtpBtn.disabled = false;
    resendOtpBtn.textContent = "Resend OTP";
  }
});

// 🕒 Resend Timer
function startResendTimer() {
  let timeLeft = 60;
  resendOtpBtn.disabled = true;
  resendOtpBtn.textContent = `Resend OTP (${timeLeft}s)`;

  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 0) {
      clearInterval(resendTimer);
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = "Resend OTP";
    } else {
      resendOtpBtn.textContent = `Resend OTP (${timeLeft}s)`;
    }
  }, 1000);
}

// ❌ Close OTP Modal
document.getElementById("closeOtpBtn")?.addEventListener("click", () => {
  hideOtpModal();
  clearInterval(resendTimer);
  resendOtpBtn.disabled = false;
  resendOtpBtn.textContent = "Resend OTP";

  signupBtn.disabled = false;
  signupBtn.textContent = "Sign Up";
});
