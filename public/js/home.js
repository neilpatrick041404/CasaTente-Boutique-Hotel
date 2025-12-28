// 🏨 Load limited rooms (2 Standard + 2 Deluxe)
async function loadRooms() {
  const container = document.getElementById("roomsContainer");

  try {
    const response = await fetch("/rooms");
    const rooms = await response.json();

    if (!rooms.length) {
      container.innerHTML = "<p>No rooms available at the moment.</p>";
      return;
    }

    // Limit to 2 Standard + 2 Deluxe
    const categories = ["Standard", "Deluxe"];
    const limitedRooms = [];

    categories.forEach((type) => {
      const filtered = rooms
        .filter((r) => r.room_type?.toLowerCase().includes(type.toLowerCase()))
        .slice(0, 2);
      limitedRooms.push(...filtered);
    });

    // 🧱 Render cards (Book Now has .book-btn for auth-check.js)
    container.innerHTML = limitedRooms
    .map(
      (room) => `
        <div class="room-card" onclick="showRoomDetails(${room.room_id})">
          <img src="${room.image_url || "images/default-room.jpg"}" alt="${room.room_name}" />
          <h3>${room.room_name}</h3>
          <p class="max-person"><strong>Max Persons:</strong> ${room.max_guests || 1}</p>
          <p class="description">${room.description || "A comfortable stay awaits you."}</p>
          <span class="price">₱${room.price_per_night?.toLocaleString() || "—"} / night</span>
          <a href="/reserve/${room.room_name
              .toLowerCase()
              .replace(/[^a-z0-9\s]/g, "")
              .replace(/\s+/g, "-")}" 
            class="book-btn"
            onclick="event.stopPropagation();">Book Now</a>
        </div>
      `
    )
    .join("");

  } catch (error) {
    console.error("Error loading rooms:", error);
    container.innerHTML =
      "<p>⚠️ Unable to load rooms. Please try again later.</p>";
  }
}

// 🌿 Load outdoor amenities (limit to 3)
async function loadOutdoorAmenities() {
  const container = document.getElementById("outdoorAmenities");

  try {
    const response = await fetch("/outdoor-amenities");
    const amenities = await response.json();

    const limited = amenities.slice(0, 3);

    container.innerHTML = limited
      .map(
        (a) => `
      <div class="amenity-card">
        <img src="${a.icon_url || "images/default-amenity.jpg"}" alt="${a.amenity_name}" />
        <h4>${a.amenity_name}</h4>
        <p>${a.description || ""}</p>
      </div>
    `
      )
      .join("");
  } catch (error) {
    console.error("Error loading outdoor amenities:", error);
    container.innerHTML =
      "<p>⚠️ Unable to load amenities. Please try again later.</p>";
  }
}

// 🧩 Upgraded Room Popup (like Rooms Page)
async function showRoomDetails(id) {
  const popup = document.getElementById("homeRoomPopup");

  const img = document.getElementById("homePopupRoomImage");
  const nameEl = document.getElementById("homePopupRoomName");
  const typeEl = document.getElementById("homePopupRoomType");
  const descEl = document.getElementById("homePopupDescription");
  const maxGuestsEl = document.getElementById("homePopupMaxGuests");
  const amenitiesList = document.getElementById("homePopupAmenities");
  const priceEl = document.getElementById("homePopupPrice");
  const bookBtn = document.getElementById("homeBookRoomBtn");

  try {
    const roomRes = await fetch("/rooms");
    const rooms = await roomRes.json();
    const room = rooms.find(r => r.room_id === id);
    if (!room) return;

    img.src = room.image_url || "images/default-room.jpg";
    nameEl.textContent = room.room_name;
    typeEl.textContent = room.room_type;
    descEl.textContent = room.description;
    maxGuestsEl.textContent = room.max_guests;
    priceEl.textContent = room.price_per_night?.toLocaleString();

    amenitiesList.innerHTML = "";
    if (room.amenities) {
      room.amenities.split(",").forEach(a => {
        amenitiesList.innerHTML += `<li>${a.trim()}</li>`;
      });
    } else {
      amenitiesList.innerHTML = "<li>No amenities listed.</li>";
    }

    // BOOK NOW BUTTON
    bookBtn.onclick = (e) => {
      const user = getLoggedInUser?.() || JSON.parse(localStorage.getItem("user"));

      // ❗ If not logged in → show SAME popup as auth-check.js
      if (!user) {
        document.getElementById("homeRoomPopup").classList.remove("show");
        showLoginPopup("Please log in to make a reservation.");
        return;
      }

      // ✔ Logged in → proceed to reservation
      const slug = room.room_name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");

      window.location.href = `/reserve/${slug}`;
    };

    popup.classList.add("show");

  } catch (err) {
    console.error("Popup load error:", err);
  }
}

// CLOSE POPUP BUTTON
document.getElementById("homeClosePopupBtn").onclick = () => {
  document.getElementById("homeRoomPopup").classList.remove("show");
};

// CLOSE WHEN CLICKING OUTSIDE
document.getElementById("homeRoomPopup").onclick = (e) => {
  if (e.target.id === "homeRoomPopup") {
    e.currentTarget.classList.remove("show");
  }
};

// 🚀 Run functions on load
document.addEventListener("DOMContentLoaded", () => {
  loadRooms();
  loadOutdoorAmenities();

  // ✅ Ensure login/logout popup logic from auth-check.js runs properly
  if (typeof handleAuthButtons === "function") {
    handleAuthButtons(); // Reattach login/logout event handlers
  }
});

