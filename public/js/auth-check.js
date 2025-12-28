// -----------------------------
// auth-check.js (universal auth logic)
// -----------------------------

// ✅ Ensure scripts only run after DOM is completely ready
window.addEventListener("load", () => {
  setupDelegation();
  handleAuthButtons();
});

// -----------------------------
// 🔍 Get currently logged-in user
// -----------------------------
function getLoggedInUser() {
  try {
    const localUser = localStorage.getItem("user");
    if (localUser) return JSON.parse(localUser);
    const sessionUser = sessionStorage.getItem("user");
    if (sessionUser) return JSON.parse(sessionUser);
  } catch (err) {
    console.error("Error parsing user data:", err);
  }
  return null;
}

// -----------------------------
// 🔐 Show login popup (universal)
// -----------------------------
function showLoginPopup(message = "You need to log in first to continue.") {
  const existing = document.querySelector(".login-popup");
  if (existing) {
    existing.querySelector("p").textContent = message;
    existing.classList.add("show");
    return;
  }

  const popup = document.createElement("div");
  popup.className = "login-popup";
  popup.innerHTML = `
    <div class="popup-content">
      <h3>🏨 Casa Tente Boutique Hotel</h3>
      <p>${message}</p>
      <div class="popup-actions">
        <button id="goLogin">Go to Login</button>
        <button id="cancelLogin">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("show"), 30);

  const goLoginBtn = popup.querySelector("#goLogin");
  const cancelLoginBtn = popup.querySelector("#cancelLogin");

  const cleanup = () => {
    popup.classList.remove("show");
    setTimeout(() => popup.remove(), 300);
  };

  goLoginBtn.addEventListener("click", () => {
    localStorage.setItem("redirectAfterLogin", window.location.href);
    cleanup();
    setTimeout(() => (window.location.href = "/login-page"), 350);
  });

  cancelLoginBtn.addEventListener("click", () => {
    cleanup();
    // Optional redirect if on restricted pages
    if (window.location.pathname.includes("reservation.html")) {
      window.location.href = "/rooms-page";
    }
  });
}

// -----------------------------
// 🚪 Show logout confirmation popup
// -----------------------------
function showLogoutPopup() {
  if (document.querySelector(".logout-popup")) return;

  const popup = document.createElement("div");
  popup.className = "logout-popup";
  popup.innerHTML = `
    <div class="logout-popup-box">
      <h3>Are you sure you want to log out?</h3>
      <div class="logout-actions">
        <button id="confirmLogout">Yes, Log Out</button>
        <button id="cancelLogout">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("show"), 30);

  popup.querySelector("#confirmLogout").addEventListener("click", () => {
    localStorage.removeItem("user");
    sessionStorage.clear();
    popup.classList.remove("show");
    setTimeout(() => {
      popup.remove();
      showLogoutSuccess();
    }, 300);
  });

  popup.querySelector("#cancelLogout").addEventListener("click", () => {
    popup.classList.remove("show");
    setTimeout(() => popup.remove(), 300);
  });
}

// -----------------------------
// ✅ Logout success popup
// -----------------------------
function showLogoutSuccess() {
  if (document.querySelector(".success-popup")) return;

  const popup = document.createElement("div");
  popup.className = "success-popup";
  popup.innerHTML = `
    <div class="success-box">
      <h3>✅ You’ve been logged out successfully!</h3>
      <div class="progress-bar"><div class="progress"></div></div>
    </div>
  `;
  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("show"), 30);

  const progress = popup.querySelector(".progress");
  setTimeout(() => (progress.style.width = "100%"), 50);

  setTimeout(() => {
    popup.classList.remove("show");
    setTimeout(() => {
      popup.remove();
      window.location.href = "/home-page";
    }, 300);
  }, 2000);
}

// -----------------------------
// 🧭 Handle login/logout buttons dynamically
// -----------------------------
function handleAuthButtons() {
  setTimeout(() => {
    const user = getLoggedInUser();

    const avatar = document.getElementById("profileAvatar");
    const dropdown = document.getElementById("profileDropdown");
    const logoutProfileBtn = document.getElementById("logoutProfileBtn");
    const profileLink = document.getElementById("profileLink");

    if (!avatar) return;

    avatar.onclick = (e) => {
      e.stopPropagation();

      if (!user) {
        showLoginPopup("To manage your profile, please login first.");
        return;
      }

      dropdown.classList.toggle("show");
    };

    if (logoutProfileBtn) {
      logoutProfileBtn.onclick = (e) => {
        e.preventDefault();
        showLogoutPopup();
      };
    }

    if (profileLink) {
      profileLink.onclick = (e) => {
        e.preventDefault();
        const user = getLoggedInUser();
        if (!user) return showLoginPopup();

        if (user.role === "admin") {
          window.location.href = "/admin-page";
        } else {
          window.location.href = "/profile-page";
        }
      };
    }

    const historyLink = document.getElementById("historyLink");

    if (historyLink) {
      historyLink.onclick = (e) => {
        e.preventDefault();
        window.location.href = "/history-page";
      };
    }

    // Close dropdown when clicking elsewhere
    document.addEventListener("click", () => {
      dropdown?.classList.remove("show");
    });

  }, 200);
}

// -----------------------------
// 🌍 Global click delegation for restricted actions
// -----------------------------
function setupDelegation() {
  document.addEventListener(
    "click",
    (e) => {
      const book = e.target.closest(".book-btn");
      const feedback = e.target.closest(".feedback-btn");
      const user = getLoggedInUser();

      // BOOK NOW restriction
      if (book) {
        if (!user) {
          e.preventDefault();
          showLoginPopup("Please log in to make a reservation.");
          return;
        }
      }

      // FEEDBACK restriction (dynamic check)
      if (feedback) {
        e.preventDefault();

        if (!user) {
          showLoginPopup("Please log in to leave feedback.");
          return;
        }

        // 🕐 Show loading while checking stay status
        const originalText = feedback.textContent;
        feedback.textContent = "Checking...";
        feedback.disabled = true;

        // Check backend if user has completed a stay
        fetch(`/api/user/${user.user_id || user.id}/completed-stays`)
          .then((res) => res.json())
          .then((data) => {
            if (data.completed) {
              // ✅ Eligible → redirect to feedback page
              window.location.href = "/feedback-page";
            } else {
              // ❌ Not yet completed stay
              showLoginPopup("You can only leave feedback after completing your stay.");
            }
          })
          .catch((err) => {
            console.error("Error checking completed stay:", err);
            showLoginPopup("Unable to verify your reservation status. Please try again later.");
          })
          .finally(() => {
            feedback.textContent = originalText;
            feedback.disabled = false;
          });
      }
    },
    true
  );
}
