// ───────────────────────────────────────────────
// 📋 feedback.js — Clickable SVG Stars + Auto-fill + Confetti Popup
// ───────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.querySelector("#feedbackForm");
  if (!form) return;

  // Short delay for stable DOM rendering
  await new Promise((resolve) => setTimeout(resolve, 300));

  // 🧠 Get logged-in user
  const user =
    JSON.parse(localStorage.getItem("user")) ||
    JSON.parse(sessionStorage.getItem("user")) ||
    null;

  if (!user) {
    alert("Please log in first to submit feedback.");
    window.location.href = "/login-page";
    return;
  }

  // ✅ Auto-fill user data
  document.getElementById("fullname").value = user.fullname || "";
  document.getElementById("email").value = user.email || "";

  // ───────────────────────────────────────────────
  // ⭐ STAR RATING (SVG version)
  // ───────────────────────────────────────────────
  const stars = document.querySelectorAll("#starRating svg");
  const ratingInput = document.getElementById("rating");
  let selected = 0;

  stars.forEach((star) => {
    star.addEventListener("mouseover", () => {
      const val = parseInt(star.dataset.value);
      stars.forEach((s) =>
        s.classList.toggle("filled", parseInt(s.dataset.value) <= val)
      );
    });

    star.addEventListener("mouseout", () => {
      stars.forEach((s) =>
        s.classList.toggle("filled", parseInt(s.dataset.value) <= selected)
      );
    });

    star.addEventListener("click", () => {
      selected = parseInt(star.dataset.value);
      ratingInput.value = selected;
      stars.forEach((s) =>
        s.classList.toggle("filled", parseInt(s.dataset.value) <= selected)
      );
      star.classList.add("clicked");
      setTimeout(() => star.classList.remove("clicked"), 300);
    });
  });

  // ───────────────────────────────────────────────
  // ✅ CHECK COMPLETED STAY STATUS
  // ───────────────────────────────────────────────
  try {
    const res = await fetch(`/api/user/${user.user_id}/completed-stays`);
    const data = await res.json();

    if (!data.completed) {
      alert("You can only leave feedback after completing your stay.");
      form.style.display = "none";
      return;
    }
  } catch (err) {
    console.error("❌ Error checking completed stay:", err);
    alert("Unable to verify your stay. Please try again later.");
    return;
  }

  // ───────────────────────────────────────────────
  // 🧾 SUBMIT FEEDBACK HANDLER
  // ───────────────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const message = document.querySelector("#message").value.trim();
    const rating = ratingInput.value;
    const submitBtn = form.querySelector(".submit-btn");

    if (!message || !rating) {
      alert("⚠️ Please fill in both message and rating.");
      return;
    }

    submitBtn.disabled = true;

    const feedbackData = {
      user_id: user.user_id,
      comment: message,
      rating: parseInt(rating, 10),
    };

    try {
      const response = await fetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedbackData),
      });

      const result = await response.json();

      if (response.ok) {
        showSuccessPopup();
        triggerConfetti();

        // Reset form
        form.reset();
        selected = 0;
        stars.forEach((s) => s.classList.remove("filled"));
      } else {
        alert(result.message || "Failed to submit feedback.");
      }
    } catch (error) {
      console.error("❌ Error submitting feedback:", error);
      alert("Something went wrong. Please try again later.");
    } finally {
      submitBtn.disabled = false;
    }
  });
});

// ───────────────────────────────────────────────
// 🎉 CONFETTI FUNCTION (gold SVG stars)
// ───────────────────────────────────────────────
function triggerConfetti() {
  const count = 30;
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement("div");
    confetti.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" fill="#ffca28" viewBox="0 0 24 24" width="18" height="18">
        <path d="M12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.62 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21z"/>
      </svg>
    `;
    confetti.style.position = "fixed";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.top = "-20px";
    confetti.style.opacity = Math.random();
    confetti.style.animation = `fall ${2 + Math.random() * 2}s linear forwards`;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 4000);
  }
}

// ───────────────────────────────────────────────
// ✅ SUCCESS POPUP FUNCTION
// ───────────────────────────────────────────────
function showSuccessPopup() {
  const popup = document.createElement("div");
  popup.className = "feedback-success-popup show";
  popup.innerHTML = `
    <div class="popup-content">
      <h3>✅ Feedback Submitted Successfully!</h3>
      <p>Thank you for sharing your experience with Casa Tente Boutique Hotel.</p>
      <button id="closeFeedbackPopup">Okay</button>
    </div>
  `;
  document.body.appendChild(popup);

  popup.querySelector("#closeFeedbackPopup").addEventListener("click", () => {
    popup.classList.remove("show");
    setTimeout(() => {
      popup.remove();
      window.location.href = "/home-page"; // ✅ Redirect to home after success
    }, 300);
  });
}

// ───────────────────────────────────────────────
// 🪄 ADD FALLING ANIMATION
// ───────────────────────────────────────────────
const confettiStyle = document.createElement("style");
confettiStyle.textContent = `
@keyframes fall {
  to {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}`;
document.head.appendChild(confettiStyle);

