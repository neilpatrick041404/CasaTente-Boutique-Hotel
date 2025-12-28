// ==========================================
// CONTACT PAGE SCRIPT (Feedback Restriction)
// ==========================================

// 📞 Load contact information dynamically
async function loadContactInfo() {
  try {
    const response = await fetch("/contact");
    const contacts = await response.json();

    const container = document.getElementById("contactInfo");

    if (!contacts.length) {
      container.innerHTML = "<p>No contact information available.</p>";
      return;
    }

    const grouped = contacts.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {});

    container.innerHTML = `
      <div class="info-card">
        <i class="fas fa-phone-alt"></i>
        <h3>📞 ${grouped.phone?.[0]?.label || "Call Us"}</h3>
        ${
          grouped.phone
            ?.map((p) => {
              // Detect landline vs mobile
              const isLandline = p.value.startsWith("(0");
              const emoji = isLandline ? "☎️" : "📱";
              return `<p>${emoji} ${p.value}</p>`;
            })
            .join("") || "<p>No phone numbers available.</p>"
        }
      </div>

      <div class="info-card">
        <i class="fas fa-envelope"></i>
        <h3>✉️ ${grouped.email?.[0]?.label || "Email"}</h3>
        ${
          grouped.email
            ?.map(
              (e) =>
                `<p>📧 <a href="mailto:${e.value}" target="_blank">${e.value}</a></p>`
            )
            .join("") || "<p>No email listed.</p>"
        }
      </div>

      <div class="info-card">
        <i class="fab fa-facebook"></i>
        <h3>🌐 ${grouped.facebook?.[0]?.label || "Facebook"}</h3>
        ${
          grouped.facebook
            ?.map(
              (f) =>
                `<p class="facebook-link"><span class="emoji">🔗</span><a href="${f.value}" target="_blank">${f.value}</a></p>`
            )
            .join("") || "<p>No Facebook link available.</p>"
        }
      </div>
    `;

  } catch (error) {
    console.error("❌ Error fetching contact info:", error);
    document.getElementById("contactInfo").innerHTML =
      "<p>⚠️ Unable to load contact information. Please try again later.</p>";
  }
}

loadContactInfo();


// ==========================================
// FEEDBACK BUTTON LOGIC
// ==========================================

// Utility: get current logged user
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

// Utility: show nice popup (like rooms page)
function showPopup(message, primaryText, primaryAction, singleButton = false) {
  const existingPopup = document.querySelector(".login-popup");
  if (existingPopup) existingPopup.remove();

  const popup = document.createElement("div");
  popup.className = "login-popup";
  popup.innerHTML = `
    <div class="popup-content">
      <h3>🏨 Casa Tente Boutique Hotel</h3>
      <p>${message}</p>
      <div class="popup-actions">
        ${
          singleButton
            ? `<button id="popupPrimary">${primaryText}</button>`
            : `
              <button id="popupPrimary">${primaryText}</button>
              <button id="popupCancel">Cancel</button>
            `
        }
      </div>
    </div>
  `;

  document.body.appendChild(popup);
  setTimeout(() => popup.classList.add("show"), 50);

  const primaryBtn = popup.querySelector("#popupPrimary");
  const cancelBtn = popup.querySelector("#popupCancel");

  primaryBtn.addEventListener("click", () => {
    popup.classList.remove("show");
    setTimeout(() => {
      popup.remove();
      primaryAction();
    }, 300);
  });

  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), 300);
    });
  }
}


// ==========================================
// CHECK RESERVATION STATUS + FEEDBACK ACCESS
// ==========================================

async function hasCompletedStay(userId) {
  try {
    const response = await fetch(`/reservations/user/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch reservation data");
    const reservations = await response.json();

    // check if any reservation has 'completed' status
    return reservations.some((r) => r.status === "completed");
  } catch (err) {
    console.error("❌ Error checking reservation:", err);
    return false;
  }
}


// ==========================================
// MAIN LOGIC WHEN CLICKING FEEDBACK BUTTON (Fixed)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  const feedbackButton = document.getElementById("feedbackButton");

  if (!feedbackButton) return;

  // 🧠 Remove any old click listeners (safety for cached reloads)
  feedbackButton.replaceWith(feedbackButton.cloneNode(true));
  const newButton = document.getElementById("feedbackButton");

  // 🟢 Feedback button click event
  newButton.addEventListener("click", async (e) => {
    e.preventDefault();

    console.log("💬 Feedback button clicked");

    const user = getLoggedInUser();

    // Case 1️⃣: Not logged in
    if (!user) {
      showPopup(
        "Please log in first to share your experience with us.",
        "Go to Login",
        () => (window.location.href = "/login-page")
      );
      return;
    }

    // Case 2️⃣: Logged in but hasn't completed a stay
    const stayed = await hasCompletedStay(user.user_id || user.id);
    if (!stayed) {
      showPopup(
        "You need to complete a stay first before giving feedback.",
        "Okay",
        () => {}, // no redirect, just close
        true // single button mode
      );
      return;
    }

    // Case 3️⃣: Logged in and completed a stay
    window.location.href = "/feedback-page";
  });
});
