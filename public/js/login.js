// 🟢 Show popup with message (for errors)
function showPopup(title, message, type = "success", animate = false) {
  const popup = document.getElementById("popup");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  titleEl.textContent = title;
  msgEl.textContent = message;

  popup.className = `popup show ${type}`;

  // Add shake animation for error
  if (type === "error" && animate) {
    popup.classList.add("shake");
    setTimeout(() => popup.classList.remove("shake"), 600);
  }

  // Auto-close for success popups
  if (type === "success") {
    setTimeout(() => {
      closePopup();
    }, 3000);
  }
}

// 🟢 Close popup manually
function closePopup() {
  const popup = document.getElementById("popup");
  popup.classList.remove("show");
}

document.getElementById("popupCloseBtn").addEventListener("click", closePopup);

// 🌟 Show success popup after login (with progress bar)
function showLoginSuccess(fullname, isReturning, isAdmin = false) {
  const successPopup = document.createElement("div");
  successPopup.className = "success-popup";

  const firstName = fullname.split(" ")[0];
  const message = isReturning
    ? `✅ Welcome back, ${firstName}!`
    : `✅ Welcome, ${firstName}!`;

  successPopup.innerHTML = `
    <div class="success-box ${isAdmin ? "admin-style" : ""}">
      <h3>${message}</h3>
      <div class="progress-bar"><div class="progress"></div></div>
    </div>
  `;

  document.body.appendChild(successPopup);

  // Fade-in effect
  setTimeout(() => successPopup.classList.add("show"), 50);

  // Animate progress bar
  const progress = successPopup.querySelector(".progress");
  progress.style.width = "100%";

  // Fade-out + redirect after 2 seconds
  setTimeout(() => {
    successPopup.classList.remove("show");
    setTimeout(() => successPopup.remove(), 300);
  }, 2000);
}

// 🧩 Handle login form submission (prevent multiple clicks)
const loginForm = document.getElementById("loginForm");
const loginButton = loginForm.querySelector("button[type='submit']");

loginForm.addEventListener("submit", async function (e) {
  e.preventDefault();

  // 🔒 Disable the button to prevent multiple clicks
  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    showPopup("Missing Fields", "Please enter both email and password.", "error", true);
    loginButton.disabled = false;
    loginButton.textContent = "LOG IN";
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      const userKey = `user_logged_before_${data.user.email}`;
      const isReturning = localStorage.getItem(userKey) === "true";

      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem(userKey, "true");

      // ✅ Show success popup
      showLoginSuccess(data.user.fullname, isReturning, data.user.role === "admin");

      // Redirect logic
      const redirectAfter = localStorage.getItem("redirectAfterLogin");

      // Redirect logic — prefer admin redirect first
      setTimeout(() => {
        // always parse role from data.user
        if (data.user && data.user.role === "admin") {
          // admin should always go to admin dashboard
          localStorage.removeItem("redirectAfterLogin");
          window.location.href = "/admin-page";
          return;
        }

        // non-admins follow redirectAfterLogin if present
        const redirectAfter = localStorage.getItem("redirectAfterLogin");
        if (redirectAfter) {
          localStorage.removeItem("redirectAfterLogin");
          window.location.href = redirectAfter;
        } else {
          window.location.href = "/home-page";
        }
      }, 2000);

    } else {
      showPopup("Login Failed", data.message || "Incorrect email or password.", "error", true);
      loginButton.disabled = false;
      loginButton.textContent = "LOG IN";
    }
  } catch (err) {
    console.error("Error:", err);
    showPopup("Server Error", "Please try again later.", "error", true);
    loginButton.disabled = false;
    loginButton.textContent = "LOG IN";
  }
});

