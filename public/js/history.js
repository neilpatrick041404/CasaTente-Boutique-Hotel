// ===== Protect page from non-logged users =====
window.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user"));

  if (!user) {
    localStorage.setItem("redirectAfterLogin", "/history-page");
    window.location.href = "/login-page";
    return;
  }

  loadHistory(user.user_id);
});

let selectedReservationId = null;

// ===== Load Reservations =====
function loadHistory(userId) {
  fetch(`/api/user/${userId}/reservations`)
    .then(res => res.json())
    .then(data => renderReservations(data));
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function renderReservations(list) {
  const container = document.getElementById("historyList");
  container.innerHTML = "";

  if (!list.length) {
    container.innerHTML = `<p style="text-align:center;color:#333;font-weight:500;">
      You have no reservations yet.</p>`;
    return;
  }

  list.forEach(r => {
    const item = document.createElement("div");
    item.className = "reservation-item";

    // 🔥 Convert in_progress → in progress AND capitalize
    const cleanStatus = r.status.replace("_", " ");
    const formattedStatus = cleanStatus.charAt(0).toUpperCase() + cleanStatus.slice(1);

    item.innerHTML = `
      <!-- ROW 1: CHECK-IN + CHECK-OUT -->
        <div class="res-row-two">
            <div><span>Check-in:</span> <strong>${formatDate(r.check_in)}</strong></div>
            <div><span>Check-out:</span> <strong>${formatDate(r.check_out)}</strong></div>
            <div></div> <!-- empty placeholder column to center Check-out -->
        </div>

        <!-- ROW 2: GUESTS + TOTAL + STATUS -->
        <div class="res-row-three">
            <div><span>Guests:</span> <strong>${r.guests}</strong></div>
            <div><span>Total:</span> <strong>₱${Number(r.total_amount).toLocaleString()}</strong></div>
            <div><span>Status:</span> <strong class="status-${cleanStatus.replace(" ", "-")}">${formattedStatus}</strong></div>
        </div>
    `;

    // 🔥 Show cancellation button or submitted label
    if (r.status === "pending") {
        if (r.cancel_requested === 1) {
            // Already sent
            const note = document.createElement("p");
            note.style.color = "#d97706";
            note.style.fontWeight = "600";
            note.style.marginTop = "10px";
            note.textContent = "Cancellation Request Submitted";
            item.appendChild(note);
        } else {
            // Show button only if NOT requested yet
            const btn = document.createElement("button");
            btn.className = "cancel-btn";
            btn.textContent = "Request Cancellation";
            btn.onclick = () => openCancelPopup(r.reservation_id);
            item.appendChild(btn);
        }
    }

    container.appendChild(item);
  });
}

// ===== Popup Logic =====

function resetCancelPopup() {
  document.getElementById("cancelReason").value = "";
  document.getElementById("cancelErrorStar").style.display = "none";
  document.getElementById("cancelErrorText").style.display = "none";
  document.getElementById("cancelReason").classList.remove("input-error");
}

function openCancelPopup(reservationId) {
  selectedReservationId = reservationId;
  resetCancelPopup();
  document.getElementById("cancelPopup").classList.add("show");
}

document.getElementById("closeCancelBtn").onclick = () => {
  document.getElementById("cancelPopup").classList.remove("show");
  resetCancelPopup();
};

function showFilloutError() {
  // Show red star
  document.getElementById("cancelErrorStar").style.display = "inline";

  // Show red text
  document.getElementById("cancelErrorText").style.display = "block";

  // Make textarea red
  document.getElementById("cancelReason").classList.add("input-error");
}

document.getElementById("cancelReason").addEventListener("input", () => {
  document.getElementById("cancelErrorStar").style.display = "none";
  document.getElementById("cancelErrorText").style.display = "none";
  document.getElementById("cancelReason").classList.remove("input-error");
});

document.getElementById("sendCancelBtn").onclick = () => {
  const reason = document.getElementById("cancelReason").value.trim();
  if (!reason) { showFilloutError(); return;}

  const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user"));

  const sendBtn = document.getElementById("sendCancelBtn");
  sendBtn.textContent = "Sending...";
  sendBtn.classList.add("sending");
  sendBtn.disabled = true;

  fetch("/api/cancel-request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reservation_id: selectedReservationId,
      user_name: user.fullname,
      user_email: user.email,
      reason
    })
  })
    .then(res => res.json())
    .then(response => {
    if (response.alreadyRequested) {
        showAlreadyRequested();
        return;
    }

    showCancelSuccess();

    document.getElementById("cancelPopup").classList.remove("show");
    document.getElementById("cancelReason").value = "";

    // 🔥 Refresh reservation list to update the button → label
    const user = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user"));
    loadHistory(user.user_id);
    })

    .finally(() => {
      // 🔥 ALWAYS RESET BUTTON (success OR error OR alreadyRequested)
      sendBtn.textContent = "Submit";
      sendBtn.classList.remove("sending");
      sendBtn.disabled = false;
    });
};

function showCancelSuccess() {
  const popup = document.getElementById("cancelSuccessPopup");
  const progress = document.getElementById("cancelSuccessProgress");

  popup.classList.add("show");
  progress.style.width = "0%";

  setTimeout(() => {
    progress.style.transition = "width 2s linear";
    progress.style.width = "100%";
  }, 50);

  // Auto-hide after 2.3 seconds
  setTimeout(() => {
    popup.classList.remove("show");
  }, 2300);
}
