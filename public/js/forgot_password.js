let tempEmail = "";
let resendTimer;
let timeLeft = 60;

/* ===========================================
   🟣 POPUP HELPER
=========================================== */
function showPopup(title, message, duration = 2500, callback = null) {
  const popup = document.getElementById("popupMessage");
  const titleEl = document.getElementById("popupTitle");
  const textEl = document.getElementById("popupText");

  if (!popup || !titleEl || !textEl) {
    console.error("Popup elements missing in HTML.");
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = message;

  popup.style.display = "flex";
  requestAnimationFrame(() => popup.classList.add("show"));

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => {
      popup.style.display = "none";
      if (callback) callback();
    }, 300);
  }, duration);
}

/* ===========================================
   🟣 SEND OTP (One-click only version)
=========================================== */
document.getElementById("forgotForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const emailInput = document.getElementById("email");
  const email = emailInput.value.trim().toLowerCase();
  const sendBtn = document.querySelector("#forgotForm button[type='submit']");

  if (!email) {
    showPopup("⚠️ Missing Email", "Please enter your email.");
    return;
  }

  // 🔒 Disable button immediately
  sendBtn.disabled = true;
  sendBtn.textContent = "Sending...";

  try {
    const response = await fetch("http://localhost:3000/send-reset-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      tempEmail = email;
      showPopup("📩 OTP Sent!", "A verification code has been sent to your email.", 2500, () => {
        const otpModal = document.getElementById("otpModal");
        otpModal.classList.add("show");
        otpModal.style.display = "flex";
        startResendTimer();
      });
    } else {
      showPopup("⚠️ Error", data.message || "Failed to send OTP. Please try again.");
      // 🔓 Re-enable button if failed
      sendBtn.disabled = false;
      sendBtn.textContent = "Send OTP";
    }
  } catch (err) {
    console.error("❌ Server error:", err);
    showPopup("⚠️ Server Error", "Unable to connect to the server. Please try again later.");
    // 🔓 Re-enable button after error
    sendBtn.disabled = false;
    sendBtn.textContent = "Send OTP";
  }
});

/* ===========================================
   🟣 VERIFY OTP
=========================================== */
document.getElementById("verifyOtpBtn").addEventListener("click", async () => {
  const otp = document.getElementById("otpInput").value.trim();
  const otpError = document.getElementById("otpError");
  otpError.textContent = "";

  if (!otp) {
    otpError.textContent = "Please enter the OTP.";
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/verify-reset-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempEmail, otp }),
    });

    const data = await res.json();

    if (res.ok) {
      // Close OTP modal and show success popup
      const otpModal = document.getElementById("otpModal");
      otpModal.classList.remove("show");
      setTimeout(() => (otpModal.style.display = "none"), 300);

      showPopup("✅ OTP Verified!", "You can now reset your password.", 2500, () => {
        const resetModal = document.getElementById("resetModal");
        resetModal.classList.add("show");
        resetModal.style.display = "flex";
      });
    } else {
      otpError.textContent = data.message || "Invalid OTP. Please try again.";
    }
  } catch (err) {
    console.error("❌ OTP verification error:", err);
    otpError.textContent = "Server error. Please try again.";
  }
});

/* ===========================================
   🟣 RESET PASSWORD
=========================================== */
document.getElementById("resetPasswordBtn").addEventListener("click", async () => {
  const pass = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const error = document.getElementById("resetError");
  error.textContent = "";

  if (pass.length < 8 || !/\d/.test(pass)) {
    error.textContent = "Password must be at least 8 characters long and contain a number.";
    return;
  }

  if (pass !== confirm) {
    error.textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await fetch("http://localhost:3000/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempEmail, newPassword: pass }),
    });

    const data = await res.json();

    if (res.ok) {
      const resetModal = document.getElementById("resetModal");
      resetModal.classList.remove("show");
      setTimeout(() => (resetModal.style.display = "none"), 300);

      showPopup("✅ Password Updated!", "Redirecting to login...", 2200, () => {
        window.location.href = "/login-page";
      });
    } else {
      error.textContent = data.message || "Failed to update password.";
    }
  } catch (err) {
    console.error("❌ Reset password error:", err);
    error.textContent = "Server error. Please try again later.";
  }
});

/* ===========================================
   🟣 RESEND OTP + TIMER (same as signup)
=========================================== */
const resendOtpBtn = document.getElementById("resendForgotOtpBtn");

function startResendTimer() {
  timeLeft = 60;
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

resendOtpBtn.addEventListener("click", async () => {
  if (!tempEmail) return;

  resendOtpBtn.disabled = true;
  resendOtpBtn.textContent = "Sending...";

  try {
    const res = await fetch("http://localhost:3000/send-reset-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempEmail }),
    });

    const data = await res.json();

    if (res.ok) {
      showPopup("📩 OTP Sent!", "A new verification code was sent to your email.");
      startResendTimer();
    } else {
      resendOtpBtn.disabled = false;
      resendOtpBtn.textContent = "Resend OTP";
      alert(data.message || "Failed to resend OTP.");
    }
  } catch (err) {
    console.error("❌ Error resending OTP:", err);
    resendOtpBtn.disabled = false;
    resendOtpBtn.textContent = "Resend OTP";
    alert("Server error. Try again later.");
  }
});

/* ===========================================
   🟣 CLOSE MODALS
=========================================== */
document.getElementById("closeOtpBtn").addEventListener("click", () => {
  const otpModal = document.getElementById("otpModal");
  otpModal.classList.remove("show");
  setTimeout(() => (otpModal.style.display = "none"), 300);
});

document.getElementById("closeResetBtn").addEventListener("click", () => {
  const resetModal = document.getElementById("resetModal");
  resetModal.classList.remove("show");
  setTimeout(() => (resetModal.style.display = "none"), 300);
});
