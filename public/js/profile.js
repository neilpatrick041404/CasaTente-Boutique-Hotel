window.addEventListener("load", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (!user) {
    window.location.replace("/login-page");
    return;
  }

function showPopup(title, message, duration = 2500) {
  const popup = document.getElementById("popupMessage");
  const titleEl = document.getElementById("popupTitle");
  const textEl = document.getElementById("popupText");

  if (!popup || !titleEl || !textEl) {
    alert(message);
    return;
  }

  titleEl.textContent = title;
  textEl.textContent = message;

  popup.style.display = "flex";
  requestAnimationFrame(() => popup.classList.add("show"));

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => popup.style.display = "none", 300);
  }, duration);
}

function closePopup(popup) {
  if (!popup) return;

  popup.classList.remove("show");

  setTimeout(() => {
    popup.style.display = "none";
    popup.style.pointerEvents = "auto"; // <-- ensure clickable when reopened
  }, 300);
}

let originalEmail = "";
let userData = null;
// store the verified current password (Step 1) so Step 2 can compare
let verifiedCurrentPassword = "";
// Display fields
const displayName = document.getElementById("displayName");
const displayEmail = document.getElementById("displayEmail");
const displayContact = document.getElementById("displayContact");

// Popup inputs
const firstNameInput = document.getElementById("firstNameInput");
const middleNameInput = document.getElementById("middleNameInput");
const lastNameInput = document.getElementById("lastNameInput");
const emailInput = document.getElementById("emailInput");
const contactInput = document.getElementById("contactInput");

// REMOVE ERROR STYLES WHEN USER TYPES
const allInputs = [firstNameInput, lastNameInput, emailInput, contactInput];

allInputs.forEach(input => {
  input.addEventListener("input", () => {
      input.classList.remove("input-error");
      document.getElementById("requiredFieldsMsg").style.display = "none";
      document.getElementById("emailError").style.display = "none";

      document.querySelectorAll("#profileForm label").forEach(lbl => {
          lbl.classList.remove("required");
      });
  });
});

contactInput.addEventListener("input", () => {
  // Remove non-digits
  contactInput.value = contactInput.value.replace(/\D/g, "");

  // Limit to 11 digits max
  if (contactInput.value.length > 11) {
    contactInput.value = contactInput.value.slice(0, 11);
  }

  // Hide error automatically when typing
  document.getElementById("contactError").style.display = "none";
});

// Popups
const editPopup = document.getElementById("editProfilePopup");
const passwordPopup = document.getElementById("passwordPopup");
const emailVerifyPopup = document.getElementById("emailVerifyPopup");
const newPasswordPopup = document.getElementById("newPasswordPopup");

// Buttons
const editBtn = document.getElementById("editBtn");
const changePasswordBtn = document.getElementById("changePasswordBtn");

// ================= LOAD USER DATA =================
fetch(`/api/user/${user.user_id}`)
  .then(res => res.json())
  .then(data => {
    userData = data; // ← SAVE GLOBALLY

    displayName.textContent = data.fullname;
    displayEmail.textContent = data.email;
    displayContact.textContent = data.contact;

    originalEmail = data.email;
  });

// ================= EDIT PROFILE =================
editBtn.onclick = () => {
  if (!userData) return;

  const parts = userData.fullname.trim().split(" ");

  if (parts.length === 2) {
    // Example: "Neil Columna"
    firstNameInput.value = parts[0];
    middleNameInput.value = "";
    lastNameInput.value = parts[1];
  }

  else if (parts.length === 3) {
    // Example: "Neil Patrick Columna"
    firstNameInput.value = parts[0] + " " + parts[1];   // Combine!
    middleNameInput.value = "";                         // No middle name
    lastNameInput.value = parts[2];
  }

  else if (parts.length >= 4) {
    // Example: "Juan Carlos De la Cruz"
    firstNameInput.value = parts[0];
    middleNameInput.value = parts.slice(1, -1).join(" ");
    lastNameInput.value = parts[parts.length - 1];
  }

  emailInput.value = userData.email;
  contactInput.value = userData.contact;

  editPopup.style.display = "flex";
  requestAnimationFrame(() => editPopup.classList.add("show"));
};

document.getElementById("cancelEditProfile").onclick = () => {
  closePopup(editPopup);
};

// Save profile
document.getElementById("profileForm").onsubmit = async (e) => {
  e.preventDefault();
  
  const saveBtn = document.querySelector("#profileForm button[type='submit']");
  // CHECK IF ANYTHING CHANGED
  const newFullname = `${firstNameInput.value.trim()} ${middleNameInput.value.trim()} ${lastNameInput.value.trim()}`.replace(/\s+/g, " ").trim();
  const oldFullname = userData.fullname.trim();

  const newEmail = emailInput.value.trim();
  const newContact = contactInput.value.trim();

  if (
      newFullname === oldFullname &&
      newEmail === userData.email &&
      newContact === userData.contact
  ) {
      // Reset button FIRST
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";

      // Then close popup
      closePopup(editPopup);
      return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  const emailError = document.getElementById("emailError");
  const contactError = document.getElementById("contactError");
  const reqMsg = document.getElementById("requiredFieldsMsg");

  // Reset states
  emailError.style.display = "none";
  contactError.style.display = "none";
  reqMsg.style.display = "none";

  document.querySelectorAll("#profileForm label").forEach(lbl => lbl.classList.remove("required"));
  document.querySelectorAll("#profileForm input").forEach(inp => inp.classList.remove("input-error"));

  let hasError = false;

  // REQUIRED: first name
  if (firstNameInput.value.trim() === "") {
      document.querySelector("label[for='firstNameInput']").classList.add("required");
      firstNameInput.classList.add("input-error");
      hasError = true;
  }

  // REQUIRED: last name
  if (lastNameInput.value.trim() === "") {
      document.querySelector("label[for='lastNameInput']").classList.add("required");
      lastNameInput.classList.add("input-error");
      hasError = true;
  }

  // REQUIRED: email empty
  if (emailInput.value.trim() === "") {
      document.querySelector("label[for='emailInput']").classList.add("required");
      emailInput.classList.add("input-error");
      hasError = true;
  }

  // REQUIRED: contact empty
  if (contactInput.value.trim() === "") {
      document.querySelector("label[for='contactInput']").classList.add("required");
      contactInput.classList.add("input-error");
      hasError = true;
  }

  // If any required field is missing
  if (hasError) {
      reqMsg.style.display = "block";
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      return;
  }

  // EMAIL FORMAT
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailInput.value.trim())) {
      emailError.textContent = "Please enter a valid email address.";
      emailError.style.display = "block";
      emailInput.classList.add("input-error");
      document.querySelector("label[for='emailInput']").classList.add("required");

      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      return;
  }

  // CONTACT NUMBER FORMAT
  if (contactInput.value.trim() !== "" && !/^09\d{9}$/.test(contactInput.value.trim())) {
      contactError.textContent = "Contact number must start with 09 and be exactly 11 digits long.";
      contactError.style.display = "block";
      contactInput.classList.add("input-error");
      document.querySelector("label[for='contactInput']").classList.add("required");

      saveBtn.disabled = false;
      saveBtn.textContent = "Save Changes";
      return;
  }

  // Build full name
  const fullname = `${firstNameInput.value} ${middleNameInput.value ? middleNameInput.value + " " : ""}${lastNameInput.value}`;

  const updatedData = {
    fullname: fullname.trim(),
    email: emailInput.value.trim(),
    contact: contactInput.value.trim()
  };

  const res = await fetch(`/api/user/${user.user_id}/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updatedData)
  });

  const result = await res.json();

  if (result.requireVerification) {
      closePopup(editPopup);
      emailVerifyPopup.style.display = "flex";
      requestAnimationFrame(() => emailVerifyPopup.classList.add("show"));
  } else {
      showProfileSuccess();
  }
};

// ================= EMAIL OTP VERIFICATION =================
document.getElementById("emailOtpForm").onsubmit = async (e) => {
  e.preventDefault();

  const otp = document.getElementById("emailOtpInput").value;
  const otpError = document.getElementById("otpError");

  const res = await fetch(`/api/verify-email/${user.user_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ otp })
  });

  const data = await res.json();

  if (!res.ok) {
    // ❌ Show error under input instead of alert
    otpError.textContent = data.message;
    otpError.style.display = "block";
    return;
  }

  // ✅ OTP Correct → Success popup
  showPopup("✅ Email Verified", data.message);

  // Close the popup
  closePopup(emailVerifyPopup);

  // Logout user to refresh email in session
  localStorage.removeItem("user");
  showLogoutSuccess();
};

document.getElementById("emailOtpInput").addEventListener("input", () => {
  document.getElementById("otpError").style.display = "none";
});

// OTP Cancel button
document.getElementById("cancelEmailVerify").onclick = () => {
  closePopup(emailVerifyPopup);
  document.getElementById("otpError").style.display = "none";
  document.getElementById("emailOtpInput").value = "";
};

// Force OTP input to accept numbers only
document.getElementById("emailOtpInput").addEventListener("input", () => {
  const otpField = document.getElementById("emailOtpInput");
  otpField.value = otpField.value.replace(/\D/g, ""); // remove non-digits
  document.getElementById("otpError").style.display = "none";
});

// ================= CHANGE PASSWORD POPUP 1 — CURRENT PASSWORD =================

changePasswordBtn.onclick = () => {
  passwordPopup.style.display = "flex";
  passwordPopup.style.pointerEvents = "auto";
  document.getElementById("currentPassword").value = "";
  requestAnimationFrame(() => passwordPopup.classList.add("show"));
};

document.getElementById("cancelPassword").onclick = () => {
  document.getElementById("currentPassword").value = "";
  closePopup(passwordPopup);
};

document.getElementById("nextPassword").onclick = async () => {
  const input = document.getElementById("currentPassword");
  const requiredMsg = document.getElementById("pwStep1Required");
  const error = document.getElementById("passwordError");
  const nextBtn = document.getElementById("nextPassword");
  const label = document.getElementById("labelCurrentPw");

  // Reset
  requiredMsg.style.display = "none";
  error.style.display = "none";
  input.classList.remove("input-error");
  label.classList.remove("label-error");

  if (input.value.trim() === "") {
    requiredMsg.style.display = "block";
    input.classList.add("input-error");
    label.classList.add("label-error");
    return;
  }

  nextBtn.disabled = true;
  nextBtn.textContent = "Checking...";

  const res = await fetch(`/api/user/${user.user_id}/verify-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword: input.value.trim() })
  });

  const data = await res.json();

  nextBtn.disabled = false;
  nextBtn.textContent = "Next";

  if (!res.ok) {
    error.textContent = data.message;
    error.style.display = "block";
    input.classList.add("input-error");
    label.classList.add("label-error");
    return;
  }

  // SAVE VERIFIED PASSWORD FOR STEP 2 CHECK
  verifiedCurrentPassword = input.value.trim();
  closePopup(passwordPopup);

  setTimeout(() => {
    newPasswordPopup.style.display = "flex";
    newPasswordPopup.style.pointerEvents = "auto";
    document.getElementById("currentPassword").value = "";
    requestAnimationFrame(() => newPasswordPopup.classList.add("show"));
  }, 300);
};

// 🔄 LIVE RESET — Current Password
document.getElementById("currentPassword").addEventListener("input", () => {
  const input = document.getElementById("currentPassword");
  const requiredMsg = document.getElementById("pwStep1Required");
  const error = document.getElementById("passwordError");
  const label = document.getElementById("labelCurrentPw");

  requiredMsg.style.display = "none";
  error.style.display = "none";

  input.classList.remove("input-error");
  label.classList.remove("label-error");
});

// ================= CHANGE PASSWORD POPUP 2 — NEW PASSWORD =================

document.getElementById("submitNewPw").onclick = async () => {
  const pw = document.getElementById("newPw");
  const conf = document.getElementById("confirmPw");

  const requiredMsg = document.getElementById("pwStep2Required");
  const pwRule = document.getElementById("newPwRuleError");
  const confErr = document.getElementById("confirmPwError");

  const updateBtn = document.getElementById("submitNewPw");

  // reset
  requiredMsg.style.display = "none";
  pwRule.style.display = "none";
  confErr.style.display = "none";

  pw.classList.remove("input-error");
  conf.classList.remove("input-error");

  document.getElementById("labelNewPw").classList.remove("label-error");
  document.getElementById("labelConfirmPw").classList.remove("label-error");

  // Empty fields
  if (pw.value.trim() === "" || conf.value.trim() === "") {
    requiredMsg.style.display = "block";

    if (pw.value.trim() === "") {
      pw.classList.add("input-error");
      document.getElementById("labelNewPw").classList.add("label-error");
    }

    if (conf.value.trim() === "") {
      conf.classList.add("input-error");
      document.getElementById("labelConfirmPw").classList.add("label-error");
    }

    return;
  }

  // Password rule
  if (pw.value.length < 8 || !/\d/.test(pw.value)) {
    pwRule.textContent = "Password must be at least 8 characters long and include a number.";
    pwRule.style.display = "block";
    pw.classList.add("input-error");
    document.getElementById("labelNewPw").classList.add("label-error");
    return;
  }

  // Password mismatch
  if (pw.value !== conf.value) {
    confErr.textContent = "Passwords do not match.";
    confErr.style.display = "block";
    conf.classList.add("input-error");
    document.getElementById("labelConfirmPw").classList.add("label-error");
    return;
  }

  // Check if new password is the same as current password
  // Step 3 — compare with verified password from Step 1
  if (pw.value.trim() === verifiedCurrentPassword) {
      pwRule.textContent = "New password cannot be the same as your current password.";
      pwRule.style.display = "block";
      pw.classList.add("input-error");
      document.getElementById("labelNewPw").classList.add("label-error");
      return;
  }

  updateBtn.disabled = true;
  updateBtn.textContent = "Updating...";

  const res = await fetch(`/api/user/${user.user_id}/change-password`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPassword: pw.value.trim() })
  });

  const data = await res.json();

  updateBtn.disabled = false;
  updateBtn.textContent = "Update Password";

  // SUCCESS — Use same animation as Edit Profile
  closePopup(newPasswordPopup);

  pw.value = "";
  conf.value = "";
  document.getElementById("currentPassword").value = "";

  showPasswordSuccess(data.message);

};

// 🔄 LIVE RESET — New Password
document.getElementById("newPw").addEventListener("input", () => {
  const pw = document.getElementById("newPw");

  document.getElementById("pwStep2Required").style.display = "none";
  document.getElementById("newPwRuleError").style.display = "none";

  pw.classList.remove("input-error");
  document.getElementById("labelNewPw").classList.remove("label-error");
});

// 🔄 LIVE RESET — Confirm Password
document.getElementById("confirmPw").addEventListener("input", () => {
  const conf = document.getElementById("confirmPw");

  document.getElementById("pwStep2Required").style.display = "none";
  document.getElementById("confirmPwError").style.display = "none";

  conf.classList.remove("input-error");
  document.getElementById("labelConfirmPw").classList.remove("label-error");
});

document.getElementById("newPw").addEventListener("input", () => {
  document.getElementById("confirmPwError").style.display = "none";
});
document.getElementById("confirmPw").addEventListener("input", () => {
  document.getElementById("newPwRuleError").style.display = "none";
});

document.getElementById("cancelNewPw").onclick = () => {
  closePopup(newPasswordPopup);
};

function showProfileSuccess() {
  const popup = document.getElementById("profileSuccessPopup");
  const progress = document.getElementById("profileProgress");

  popup.classList.add("show");

  // Animate progress bar
  setTimeout(() => {
    progress.style.width = "100%";
  }, 50);

  // Auto close + reload after 2 seconds
  setTimeout(() => {
    popup.classList.remove("show");
    progress.style.width = "0";

    location.reload();
  }, 2000);
}

// 🔥 ADD THIS NEW FUNCTION RIGHT UNDER showProfileSuccess()
function showPasswordSuccess(message) {
  const popup = document.getElementById("profileSuccessPopup");
  const progress = document.getElementById("profileProgress");

  document.getElementById("successTitle").textContent = "Password Updated";
  document.getElementById("successMessage").textContent = message;

  popup.classList.add("show");

  setTimeout(() => {
    progress.style.width = "100%";
  }, 50);

  setTimeout(() => {
    popup.classList.remove("show");
    progress.style.width = "0";

    location.reload();
  }, 2000);
}

});