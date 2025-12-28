// 🏨 Fetch and Categorize Rooms from Database
async function loadRooms() {
  try {
    const response = await fetch('/rooms');
    const rooms = await response.json();

    const standardContainer = document.getElementById('standardRooms');
    const deluxeContainer = document.getElementById('deluxeRooms');

    // Separate rooms by category
    const standardRooms = rooms.filter(r => r.room_type?.toLowerCase() === 'standard');
    const deluxeRooms = rooms.filter(r => r.room_type?.toLowerCase() === 'deluxe');

    // 🧩 Render function
    const renderRooms = (list, container) => {
      if (!list.length) {
        container.innerHTML = "<p>No rooms available in this category.</p>";
        return;
      }

      container.innerHTML = list.map(room => `
        <div class="room-card" onclick='openRoomPopup(${JSON.stringify(room).replace(/'/g, "\\'")})'>
          <img src="${ room.image_url ? `/${room.image_url}` : '/images/default-room.jpg' }" alt="${room.room_name}" />
          <h3>${room.room_name}</h3>
          <p><strong>Max Persons:</strong> ${room.max_guests || 'N/A'}</p>
          <p>${room.description || 'Enjoy comfort and relaxation in this cozy room.'}</p>
          <span class="price">₱${room.price_per_night?.toLocaleString() || '—'} / night</span>
          <a href="/reserve/${
              room.room_name
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, "")
                .replace(/\s+/g, "-")
            }" 
            class="book-btn" onclick="event.stopPropagation();">Book Now</a>
        </div>
      `).join('');
    };

    renderRooms(standardRooms, standardContainer);
    renderRooms(deluxeRooms, deluxeContainer);

  } catch (error) {
    console.error("❌ Error loading rooms:", error);
    document.getElementById('standardRooms').innerHTML =
      "<p>⚠️ Unable to load rooms. Please try again later.</p>";
    document.getElementById('deluxeRooms').innerHTML =
      "<p>⚠️ Unable to load rooms. Please try again later.</p>";
  }
}

// 🚀 Run on page load
loadRooms();

// ==============================
// ROOM DETAILS POPUP LOGIC
// ==============================
const popupOverlay = document.getElementById("roomPopup");
const closePopupBtn = document.getElementById("closePopupBtn");
const bookRoomBtn = document.getElementById("bookRoomBtn");

// Open popup
function openRoomPopup(room) {
  document.getElementById("popupRoomImage").src = room.image_url ? `/${room.image_url}` : "/images/default-room.jpg";
  document.getElementById("popupRoomName").textContent = room.room_name;
  document.getElementById("popupRoomType").textContent = room.room_type;
  document.getElementById("popupDescription").textContent = room.description;
  document.getElementById("popupMaxGuests").textContent = room.max_guests;
  document.getElementById("popupPrice").textContent = room.price_per_night?.toLocaleString();

  const amenitiesList = room.amenities ? room.amenities.split(",") : [];
  const container = document.getElementById("popupAmenities");
  container.innerHTML = "";
  amenitiesList.forEach(a => {
    container.innerHTML += `<li>${a}</li>`;
  });

  bookRoomBtn.onclick = (e) => {
      const user = getLoggedInUser?.() || JSON.parse(localStorage.getItem("user"));

      if (!user) {
          popupOverlay.classList.remove("show");
          showLoginPopup("Please log in to make a reservation.");
          return;
      }

      const slug = room.room_name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");

      window.location.href = `/reserve/${slug}`;
  };

  popupOverlay.classList.add("show");
}

// Close popup
closePopupBtn.addEventListener("click", () => {
  popupOverlay.classList.remove("show");
});

// Close when clicking outside
popupOverlay.addEventListener("click", (e) => {
  if (e.target === popupOverlay) popupOverlay.classList.remove("show");
});
