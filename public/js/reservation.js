// ==============================
// reservation.js (final - stores user_id)
// ==============================
const { jsPDF } = window.jspdf;

// 🟣 Debug helper
console.log("🟣 Reservation script loaded on:", window.location.pathname);

window.addEventListener("load", async () => {
  console.log("🟢 Page fully loaded. Starting reservation script...");
  // =============================
  // 🌟 Reservation Success Popup (matches logout popup design)
  // =============================
  function showReservationPopup(title, message, type = "success", duration = 2500) {
    const existing = document.querySelector(".reservation-popup");
    if (existing) existing.remove();

    const popup = document.createElement("div");
    popup.className = `reservation-popup ${type}`;
    popup.innerHTML = `
      <div class="popup-card">
        <div class="popup-icon">${type === "success" ? "✅" : "⚠️"}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="progress-bar"><div class="progress"></div></div>
      </div>
    `;
    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add("show"), 50);

    const progress = popup.querySelector(".progress");
    setTimeout(() => (progress.style.width = "100%"), 100);

    setTimeout(() => {
      popup.classList.remove("show");
      setTimeout(() => popup.remove(), 300);
    }, duration);
  }

  const roomDetails = document.getElementById("roomDetails");
  const form = document.getElementById("reservationForm");
  const totalEl = document.getElementById("totalPrice");
  const checkin = document.getElementById("checkin");
  const checkout = document.getElementById("checkout");

  // =============================
  // 📅 Highlight Reserved Dates
  // =============================
  async function highlightReservedDates(roomId) {
    try {
      const res = await fetch(`/rooms/${roomId}/reserved-dates`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reserved = await res.json();
      console.log("📅 Reserved dates fetched:", reserved);

      // Keep in memory to validate selections
      window.bookedDates = reserved.map(r => ({
        date: r.date,
        status: r.status
      }));
    } catch (err) {
      console.error("❌ Error loading reserved dates:", err);
      window.bookedDates = [];
    }
  }

  // =============================
  // 🎨 Highlight Booked Dates (Visual Hint)
  // =============================
  function colorizeBookedDates(input) {
    if (!window.bookedDates?.length) return;

    input.addEventListener("input", () => {
      const date = input.value;
      const match = window.bookedDates.find(d => d.date === date);

      // Reset all possible classes before re-applying
      input.classList.remove("pending", "confirmed", "cancelled", "available");

      if (match) {
        // Change input background color based on status
        if (match.status === "pending") input.classList.add("pending");
        else if (match.status === "confirmed") input.classList.add("confirmed");
        else if (match.status === "cancelled") input.classList.add("cancelled");
        else input.classList.add("available");
      } else {
        // Reset if date has no booking
        input.classList.add("available");
      }
    });

    // 🪶 Optional tooltip on hover
    input.addEventListener("mousemove", e => {
      const date = input.value;
      const match = window.bookedDates.find(d => d.date === date);
      if (match) {
        input.title = `📅 ${match.date} — ${match.status.toUpperCase()}`;
      } else {
        input.title = "";
      }
    });
  }

  // =============================
  // 📅 Initialize Flatpickr for Check-in and Check-out
  // =============================
  function setupDatePickers(bookedDates) {
    const disabledDates = bookedDates
      .filter(d => ["pending", "confirmed", "in_progress"].includes(d.status))
      .map(d => d.date);

    console.log("📆 Disabled dates in calendar:", disabledDates);

    let checkoutPicker; // must declare first!

    // ✅ Initialize Check-out first (so it can be referenced inside Check-in)
    checkoutPicker = flatpickr("#checkout", {
      dateFormat: "Y-m-d",
      disable: disabledDates,
      clickOpens: false, // locked until check-in picked
      onReady: function () {
        const checkoutInput = document.querySelector("#checkout");
        checkoutInput.setAttribute("disabled", true);
      },
      onOpen: function () {
        const ciValue = document.querySelector("#checkin").value;
        if (!ciValue) {
          this.close();
          alert("⚠️ Please select a check-in date first.");
        }
      },
      onChange: function (selectedDates) {
        const ciValue = document.querySelector("#checkin").value;
        if (ciValue && selectedDates.length > 0) {
          const checkinDate = new Date(ciValue);
          const checkoutDate = selectedDates[0];
          console.log(`🟩 Selected stay: ${checkinDate.toDateString()} → ${checkoutDate.toDateString()}`);
        }
      },
      // 🎨 Highlight reserved dates
      onDayCreate: function (dObj, dStr, fp, dayElem) {
        const dateStr = dayElem.dateObj.toISOString().split("T")[0];
        const booked = bookedDates.find(d => d.date === dateStr);

        if (booked) {
          dayElem.classList.add("flatpickr-disabled-day");
          if (booked.status === "pending") dayElem.style.background = "rgba(255, 193, 7, 0.35)"; // yellow
          if (booked.status === "confirmed") dayElem.style.background = "rgba(220, 53, 69, 0.35)"; // red
          if (booked.status === "in_progress") dayElem.style.background = "rgba(220, 53, 69, 0.35)";
          dayElem.title = `📅 ${booked.status.toUpperCase()}`;
        }
      },
    });

    // ✅ Initialize Check-in
    flatpickr("#checkin", {
      dateFormat: "Y-m-d",
      minDate: "today",
      disable: disabledDates,
      // 🎨 Add same day coloring
      onDayCreate: function (dObj, dStr, fp, dayElem) {
        const dateStr = dayElem.dateObj.toISOString().split("T")[0];
        const booked = bookedDates.find(d => d.date === dateStr);

        if (booked) {
          dayElem.classList.add("flatpickr-disabled-day");
          if (booked.status === "pending") dayElem.style.background = "rgba(255, 193, 7, 0.35)";
          if (booked.status === "confirmed") dayElem.style.background = "rgba(220, 53, 69, 0.35)";
          if (booked.status === "in_progress") dayElem.style.background = "rgba(220, 53, 69, 0.35)";
          dayElem.title = `📅 ${booked.status.toUpperCase()}`;
        }
      },
      onChange: function (selectedDates) {
        if (selectedDates.length > 0) {
          const checkinDate = selectedDates[0];
          const nextDay = new Date(checkinDate.getTime() + 86400000);

          // Enable checkout calendar permanently
          const checkoutInput = document.querySelector("#checkout");
          checkoutInput.removeAttribute("disabled");
          checkoutPicker.set("clickOpens", true);

          // Update checkout picker settings
          checkoutPicker.set("minDate", nextDay);
          checkoutPicker.set("disable", disabledDates);

          // Auto-open checkout once
          checkoutPicker.open();
        }
      },
    });
  }

  // =============================
  // 🚫 Prevent Booking on Reserved Dates
  // =============================
  function isDateBooked(dateStr) {
    return window.bookedDates?.some(
      d => d.date === dateStr && ["pending", "confirmed"].includes(d.status)
    );
  }

  // =============================
  // 🚫 Disable Booked Dates (no alert, just unselectable)
  // =============================
  function disableBookedDates(input) {
    if (!input || !window.bookedDates?.length) return;

    input.addEventListener("input", () => {
      const selected = input.value;
      const isBooked = window.bookedDates.some(
        (d) => d.date === selected && ["pending", "confirmed"].includes(d.status)
      );

      // If booked, just clear input silently
      if (isBooked) {
        input.value = "";
        input.classList.add("booked-blocked");
      } else {
        input.classList.remove("booked-blocked");
      }
    });

    input.addEventListener("focus", () => {
      input.title = "Some dates are unavailable due to existing reservations.";
    });
  }

  await new Promise((resolve) => setTimeout(resolve, 300));

  // Extract slug
  let slug = window.location.pathname.replace("/reserve/", "");
  slug = slug.replace(/\/$/, "");

  // Fetch rooms
  const roomsRes = await fetch("/rooms");
  const rooms = await roomsRes.json();

  // Match using slug
  const roomData = rooms.find(r =>
    r.room_name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-") === slug
  );

  if (!roomData) {
    roomDetails.innerHTML = "<p>⚠️ Invalid room. Please return to Rooms page.</p>";
    return;
  }

  console.log("Room found:", roomData);

  // ✅ ADD THIS
  const roomId = roomData.room_id;

  // Continue logic
  console.log("🏨 Loaded room data:", roomData.room_name);
  await highlightReservedDates(roomId);
  setupDatePickers(window.bookedDates);
  colorizeBookedDates(checkin);
  colorizeBookedDates(checkout);
  disableBookedDates(checkin);
  disableBookedDates(checkout);

  // === Render room info safely ===
  try {
    const imgSrc = roomData.image_url ? `/${roomData.image_url}` : "/images/default-room.jpg";
    const roomName = roomData.room_name || "Unnamed Room";
    const description = roomData.description || "No description available.";
    const price = roomData.price_per_night?.toLocaleString() || "—";

    roomDetails.innerHTML = `
      <img src="${imgSrc}" alt="${roomName}" />
      <h2>${roomName}</h2>
      <p>${description}</p>
      <p><strong>₱${price} / night</strong></p>

      <div class="amenities-wrapper">
        <h4>Amenities:</h4>
        <ul id="reservationAmenities"></ul>
      </div>
    `;

    // === Insert amenities into reservation page ===
    const amenitiesList = document.getElementById("reservationAmenities");

    if (roomData.amenities) {
      const items = roomData.amenities.split(",");
      items.forEach(a => {
        amenitiesList.innerHTML += `<li>${a.trim()}</li>`;
      });
    } else {
      amenitiesList.innerHTML = "<li>No amenities listed.</li>";
    }

    // ✅ Guest limits (dynamic from database)
    const guestInput = document.getElementById("guests");
    const guestNote = document.querySelector(".guest-note");

    // Get max guests directly from database field
    // ✅ Try all possible field names to ensure it reads correctly
    let maxGuests = Number(
      roomData.max_guests ||
      roomData.max_persons ||
      roomData.max_person ||
      roomData.maxGuests
    ) || 1;

    console.log("👥 Max guests fetched from DB:", maxGuests);

    guestInput.max = maxGuests;
    guestInput.min = 1;
    guestInput.value = 1;
    guestInput.placeholder = `Up to ${maxGuests} guest${maxGuests > 1 ? "s" : ""}`;
    if (guestNote)
      guestNote.textContent = `Maximum of ${maxGuests} guest${maxGuests > 1 ? "s" : ""} only`;

    guestInput.addEventListener("input", () => {
      const val = parseInt(guestInput.value, 10);
      if (val > maxGuests) {
        alert(`⚠️ Max ${maxGuests} guests allowed.`);
        guestInput.value = maxGuests;
      } else if (val < 1 || isNaN(val)) {
        guestInput.value = 1;
      }
    });
  } catch (err) {
    console.error("❌ Error rendering room details:", err);
  }

  // === Auto-fill user info from storage ===
  let user = null;
  try {
    user =
      JSON.parse(localStorage.getItem("user")) ||
      JSON.parse(sessionStorage.getItem("user"));

    if (user) {
      document.getElementById("fullname").value = user.fullname || "";
      document.getElementById("email").value = user.email || "";
      document.getElementById("contact").value = user.contact || "";
      console.log("👤 User auto-filled:", user.email);
    } else {
      console.warn("⚠️ No logged-in user found — form left blank.");
    }
  } catch (err) {
    console.error("❌ Error auto-filling user data:", err);
  }

  // === Date & total calculation ===
  const pricePerNight = Number(roomData.price_per_night) || 0;
  checkin.min = new Date().toISOString().split("T")[0];

  checkin.addEventListener("change", () => {
    const ciDate = new Date(checkin.value);
    const minCo = new Date(ciDate.getTime() + 86400000);
    checkout.min = minCo.toISOString().split("T")[0];
    checkout.value = "";
    totalEl.textContent = "Total: PHP 0";
  });

  checkout.addEventListener("change", () => {
    if (!checkin.value || !checkout.value) return;

    const ci = new Date(checkin.value);
    const co = new Date(checkout.value);

    // Generate all dates between check-in and check-out
    const range = [];
    for (let d = new Date(ci); d <= co; d.setDate(d.getDate() + 1)) {
      range.push(new Date(d).toISOString().split("T")[0]);
    }

    // 🚫 Check if any date in the range is already booked
    const conflict = range.find(d => isDateBooked(d));
    if (conflict) {
      checkout.value = "";
      totalEl.textContent = "Total: PHP 0";
      checkout.classList.add("booked-blocked");
      return;
    } else {
      checkout.classList.remove("booked-blocked");
    }

    // ✅ Otherwise, calculate total price normally
    const diffDays = Math.max(0, (co - ci) / (1000 * 60 * 60 * 24));
    const total = diffDays * pricePerNight;
    totalEl.textContent = `Total: PHP ${total.toLocaleString()}`;
  });

  // === Handle form submission (One-click only + Custom popup) ===
  const confirmButton = form.querySelector("button[type='submit']");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (confirmButton.disabled) return;
    confirmButton.disabled = true;
    confirmButton.textContent = "Processing...";

    const name = document.getElementById("fullname").value.trim();
    const email = document.getElementById("email").value.trim();
    const contact = document.getElementById("contact").value.trim();
    const ci = document.getElementById("checkin").value;
    const co = document.getElementById("checkout").value;
    const guests = document.getElementById("guests").value;
    const requests = document.getElementById("requests").value.trim() || "None";

    if (!ci || !co) {
      showReservationPopup("Missing Dates", "Please select check-in and check-out dates.", "error");
      confirmButton.disabled = false;
      confirmButton.textContent = "Submit Reservation";
      return;
    }

    if (!user || !user.user_id) {
      showReservationPopup("Login Required", "You must be logged in to make a reservation.", "error");
      confirmButton.disabled = false;
      confirmButton.textContent = "Submit Reservation";
      return;
    }

    try {
      // === Generate PDF Slip ===
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const width = doc.internal.pageSize.getWidth();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("Casa Tente Boutique Hotel", width / 2, 60, { align: "center" });
      doc.setFontSize(12);
      doc.text("Official Reservation Slip", width / 2, 80, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      let y = 120;
      const diffDays = Math.max(1, Math.round((new Date(co) - new Date(ci)) / (1000 * 60 * 60 * 24)));
      const totalAmount = diffDays * pricePerNight;
      const info = [
        `Full Name: ${name}`,
        `Email: ${email}`,
        `Contact: ${contact}`,
        `Room: ${roomData.room_name}`,
        `Check-in: ${ci}`,
        `Check-out: ${co}`,
        `Nights: ${diffDays}`,
        `Guests: ${guests}`,
        `Price per Night: PHP ${pricePerNight.toLocaleString()}`,
        `Total Amount: PHP ${totalAmount.toLocaleString()}`,
        `Requests: ${requests}`,
      ];
      info.forEach(line => { doc.text(line, 60, y); y += 18; });
      doc.text("Thank you for choosing Casa Tente Boutique Hotel!", 60, y + 25);
      const pdfBase64 = doc.output("datauristring");

      await fetch("/reservation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.user_id,
          room_id: roomId,
          checkin: ci,
          checkout: co,
          guests,
          requests,
          total_amount: totalAmount,
        }),
      });

      await fetch("/send-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, pdfBase64 }),
      });

      showReservationPopup("Reservation Submitted 🎉", "Your e-slip was sent to your email.", "success");
      setTimeout(() => window.location.href = "/home-page", 2500);

    } catch (err) {
      console.error("❌ Error sending reservation:", err);
      showReservationPopup("Server Error", "Failed to submit reservation. Please try again later.", "error");
      confirmButton.disabled = false;
      confirmButton.textContent = "Confirm Reservation";
    }
  });
});

// =============================
// 🧩 SAFETY AUTH INITIALIZER
// =============================
window.addEventListener("load", () => {
  console.log("🧩 Auth safety re-check triggered...");
  if (typeof handleAuthButtons === "function") {
    setTimeout(() => {
      try {
        handleAuthButtons();
        console.log("✅ Auth buttons reattached successfully.");
      } catch (err) {
        console.warn("⚠️ handleAuthButtons not found or failed:", err);
      }
    }, 400);
  } else {
    console.warn("⚠️ handleAuthButtons not available yet.");
  }

  const fixPopupZ = () => {
    const popups = document.querySelectorAll(
      ".login-popup, .logout-popup, .success-popup"
    );
    popups.forEach((p) => (p.style.zIndex = "99999"));
  };
  document.addEventListener("DOMNodeInserted", fixPopupZ);
});

// ✅ Ensure Auth Check for Logout Visibility
document.addEventListener("DOMContentLoaded", () => {
  // Wait until auth-check.js is loaded
  if (typeof handleAuthButtons === "function") {
    handleAuthButtons(); // Handles login/logout visibility and actions
  } else {
    // Retry a few times if it's not yet loaded
    let attempts = 0;
    const interval = setInterval(() => {
      if (typeof handleAuthButtons === "function") {
        handleAuthButtons();
        clearInterval(interval);
      } else if (attempts++ > 10) {
        clearInterval(interval);
        console.warn("⚠️ auth-check.js not found after retries");
      }
    }, 300);
  }
});
