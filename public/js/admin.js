// ==============================
// admin.js (Enhanced: Add, Edit, Delete Room + Custom Popups)
// ==============================
const sectionTitle = document.getElementById("sectionTitle");
const contentSection = document.getElementById("contentSection");

// Sidebar Navigation
document.querySelectorAll(".sidebar a").forEach(link => {
  link.addEventListener("click", async e => {
    e.preventDefault();
    document.querySelectorAll(".sidebar a").forEach(l => l.classList.remove("active"));
    e.target.classList.add("active");
    const section = e.target.dataset.section;
    await loadSection(section);
  });
});

// ------------------------------
// 🧩 Section Loader
// ------------------------------
async function loadSection(section) {
  if (!sectionTitle || !contentSection) {
    console.error("❌ sectionTitle or contentSection not found in DOM.");
    return;
  }

  sectionTitle.textContent = section.charAt(0).toUpperCase() + section.slice(1);
  contentSection.innerHTML = `<p>Loading ${section}...</p>`;

  switch (section) {
    case "rooms":
      await loadRooms();
      break;
    case "reservations":
      await loadReservations();
      break;
    case "amenities":
      await loadAmenities();
      break;
    case "feedbacks":
      await loadFeedbacks();
      break;
    case "analytics":
      currentDate = new Date();
      await loadAnalytics();
      break;  
    case "users":
      await loadUsers();
      break;
    default:
      contentSection.innerHTML = `<p>⚠️ Unknown section.</p>`;
  }
}

// ------------------------------
// 🏨 Load Rooms (with Add, Edit, Delete + Image Upload but No Table Thumbnails)
// ------------------------------
async function loadRooms() {
  try {
    const res = await fetch("/rooms");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    contentSection.innerHTML = `
      <div class="room-header">
        <h3> </h3>
        <button id="addRoomBtn" class="btn add-btn">➕ Add Room</button>
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Type</th>
            <th>Price</th>
            <th>Guests</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td>${r.room_id}</td>
              <td>${r.room_name}</td>
              <td>${r.room_type}</td>
              <td>₱${Number(r.price_per_night).toLocaleString()}</td>
              <td>${r.max_guests}</td>
              <td>${r.availability_status ?? "Available"}</td>
              <td class="action-buttons">
                <button class="btn edit-btn" data-id="${r.room_id}">✏️ Edit</button>
                <button class="btn btn-delete delete-btn" data-id="${r.room_id}">🗑 Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <!-- Room Modal -->
      <div id="roomModal" class="modal hidden">
        <div class="modal-content room-modal-scrollable">
          <h3 id="modalTitle">Add Room</h3>
          <form id="roomForm" enctype="multipart/form-data">
            <input type="hidden" id="room_id" />

            <label>Room Name</label>
            <input type="text" id="room_name" required />

            <label>Room Type</label>
            <select id="room_type" required>
              <option value="">Select Room Type</option>
              <option value="Standard">Standard</option>
              <option value="Deluxe">Deluxe</option>
            </select>

            <label>Description</label>
            <textarea id="description" placeholder="Enter room description"></textarea>

            <label>Price per Night</label>
            <input type="number" id="price_per_night" required />

            <label>Max Guests</label>
            <input type="number" id="max_guests" required />

            <label>Amenities (comma separated)</label>
            <input type="text" id="amenities" placeholder="e.g. TV, Mini Fridge, Balcony" />

            <label>Upload Image (Optional)</label>
            <input type="file" id="room_image_file" accept="image/*" />
            <input type="hidden" id="room_image_url" />

            <div id="roomImagePreviewContainer" class="hidden">
              <img id="roomImagePreview" class="room-preview">
            </div>

            <label>Or Image URL (optional)</label>
            <input type="text" id="manual_room_image_url" placeholder="Paste image URL" />

            <div class="modal-actions">
              <button type="submit" class="btn save-btn">💾 Save</button>
              <button type="button" id="cancelModal" class="btn cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // 🟢 Add Room
    document.getElementById("addRoomBtn").addEventListener("click", () => openRoomModal());

    // 🟢 Edit Room
    document.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const room = data.find(r => r.room_id == btn.dataset.id);
        openRoomModal(room);
      });
    });

    // 🟢 Delete Room
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const roomId = btn.dataset.id;
        await deleteRoom(roomId);
      });
    });

    // 🟢 Cancel Modal
    document.getElementById("cancelModal").addEventListener("click", closeRoomModal);

    // 🟢 Handle Image Upload
    const fileInput = document.getElementById("room_image_file");
    const hiddenUrlInput = document.getElementById("room_image_url");
    const manualInput = document.getElementById("manual_room_image_url");
    const previewContainer = document.getElementById("roomImagePreviewContainer");
    const previewImage = document.getElementById("roomImagePreview");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("roomImage", file);

      try {
        const res = await fetch("/upload-room-image", { method: "POST", body: formData });
        const data = await res.json();

        if (data.fileUrl) {
          hiddenUrlInput.value = data.fileUrl;
          previewContainer.classList.remove("hidden");
          previewImage.src = data.fileUrl;
          showPopup("✅ Uploaded", "Room image uploaded successfully!", "success");
        } else {
          showPopup("⚠️ Failed", "Image upload failed. Try again.", "error");
        }
      } catch (err) {
        console.error("❌ Upload error:", err);
        showPopup("❌ Error", "Server error while uploading image.", "error");
      }
    });

    let roomPreviewTimer = null;

    manualInput.addEventListener("input", () => {
      clearTimeout(roomPreviewTimer);
      const url = manualInput.value.trim();

      roomPreviewTimer = setTimeout(() => {
        if (!url) {
          previewContainer.classList.add("hidden");
          hiddenUrlInput.value = "";
          return;
        }

        const isLikelyImage =
          url.match(/\.(jpeg|jpg|gif|png|webp|avif)$/i) ||
          url.startsWith("/uploads/");

        if (!isLikelyImage) {
          previewContainer.classList.add("hidden");
          return;
        }

        previewContainer.classList.remove("hidden");
        previewImage.style.opacity = "0.3";
        previewImage.src = url;
        hiddenUrlInput.value = url;

        previewImage.onload = () => {
          previewImage.style.opacity = "1";
        };

        previewImage.onerror = () => {
          previewContainer.classList.add("hidden");
        };
      }, 700);
    });

    // 🟢 Save Handler
    document.getElementById("roomForm").addEventListener("submit", async e => {
      e.preventDefault();

      const id = document.getElementById("room_id").value;
      const roomData = {
        room_name: document.getElementById("room_name").value.trim(),
        room_type: document.getElementById("room_type").value.trim(),
        description: document.getElementById("description").value.trim(),
        price_per_night: parseFloat(document.getElementById("price_per_night").value),
        max_guests: parseInt(document.getElementById("max_guests").value),
        amenities: document.getElementById("amenities").value.trim(),
        image_url: document.getElementById("room_image_url").value.trim()
      };

      const method = id ? "PUT" : "POST";
      const url = id ? `/rooms/${id}` : "/rooms";

      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roomData)
        });

        const result = await res.json();
        showPopup("✅ Success", result.message || "Room saved successfully!", "success");
        closeRoomModal();
        await loadRooms();
      } catch (err) {
        console.error("❌ Error saving room:", err);
        showPopup("❌ Error", "Failed to save room. Please try again.", "error");
      }
    });

  } catch (err) {
    console.error("❌ Error loading rooms:", err);
    showPopup("❌ Error", "Failed to load room data.", "error");
  }
}

// ------------------------------
// 🪟 Modal Controls
// ------------------------------
function openRoomModal(room = null) {
  const modal = document.getElementById("roomModal");
  const previewContainer = document.getElementById("roomImagePreviewContainer");
  const previewImage = document.getElementById("roomImagePreview");

  modal.classList.remove("hidden");
  document.body.classList.add("modal-open"); // ✅ Prevent background scroll

  if (room) {
    // Editing existing room
    document.getElementById("modalTitle").textContent = "Edit Room";
    document.getElementById("room_id").value = room.room_id;
    document.getElementById("room_name").value = room.room_name;
    document.getElementById("room_type").value = room.room_type;
    document.getElementById("description").value = room.description || "";
    document.getElementById("price_per_night").value = room.price_per_night;
    document.getElementById("max_guests").value = room.max_guests;
    document.getElementById("amenities").value = room.amenities || "";
    document.getElementById("room_image_url").value = room.image_url || "";
    document.getElementById("manual_room_image_url").value = room.image_url || "";

    // Remove placeholder "Select Room Type" when editing
    const roomTypeSelect = document.getElementById("room_type");
    const placeholderOption = roomTypeSelect.querySelector('option[value=""]');
    if (placeholderOption) placeholderOption.remove();

    // ✅ Image preview (show only if image_url exists)
    if (room.image_url) {
      previewContainer.classList.remove("hidden");
      previewImage.src = room.image_url;
    } else {
      previewContainer.classList.add("hidden");
      previewImage.src = "";
    }
  } else {
    // Adding new room
    document.getElementById("modalTitle").textContent = "Add Room";
    document.getElementById("roomForm").reset();
    document.getElementById("room_id").value = "";
    document.getElementById("room_image_url").value = "";
    document.getElementById("manual_room_image_url").value = "";
    document.getElementById("room_type").value = "";

    previewContainer.classList.add("hidden");
    previewImage.src = "";
  }

  // ✅ Reset modal scroll position
  const modalContent = modal.querySelector(".modal-content");
  if (modalContent) modalContent.scrollTop = 0;
}

function closeRoomModal() {
  const modal = document.getElementById("roomModal");
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open"); // ✅ Re-enable background scroll
}

// ------------------------------
// 🗑 Delete Room (Custom Confirmation Popup)
// ------------------------------
async function deleteRoom(id) {
  const confirmed = await showConfirmPopup(
    "🗑 Confirm Delete",
    `Are you sure you want to delete room #${id}? This action cannot be undone.`
  );

  if (!confirmed) {
    showPopup("❌ Cancelled", "Room deletion cancelled.", "error");
    return;
  }

  try {
    const res = await fetch(`/rooms/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    showPopup("🗑 Deleted", data.message || "Room deleted successfully!", "success");
    console.log("🗑 Deleted room ID:", id);
    await loadRooms(); // Refresh table
  } catch (err) {
    console.error("❌ Error deleting room:", err);
    showPopup("❌ Error", "Failed to delete room. Please try again.", "error");
  }
}

// ------------------------------
// 🌟 Popup Utility
// ------------------------------
function showPopup(title, message, type = "success", duration = 2000) {
  const popup = document.getElementById("popup");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  if (!popup || !titleEl || !msgEl) return console.warn("Popup element not found");

  popup.classList.remove("hidden", "success", "error");
  popup.classList.add(type);

  titleEl.textContent = title;
  msgEl.textContent = message;

  setTimeout(() => popup.classList.add("hidden"), duration);
}

// ------------------------------
// ⚠️ Confirmation Popup Utility (Enhanced with Dynamic Colors)
// ------------------------------
function showConfirmPopup(title, message, type = "default") {
  return new Promise((resolve) => {
    const popup = document.getElementById("confirmPopup");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYes");
    const noBtn = document.getElementById("confirmNo");

    // Set title/message
    titleEl.textContent = title;
    msgEl.textContent = message;

    // Adjust colors & button text dynamically
    if (type === "confirm") {
      titleEl.style.color = "#2563eb"; // blue
      yesBtn.textContent = "Yes, Confirm";
      yesBtn.style.background = "#2563eb";
    } else if (type === "cancel") {
      titleEl.style.color = "#dc2626"; // red
      yesBtn.textContent = "Yes, Cancel";
      yesBtn.style.background = "#dc2626";
    } else if (type === "delete") {
      titleEl.style.color = "#dc2626"; // red
      yesBtn.textContent = "Yes, Delete";
      yesBtn.style.background = "#dc2626";
    } else {
      titleEl.style.color = "#333";
      yesBtn.textContent = "Yes";
      yesBtn.style.background = "#2563eb";
    }

    popup.classList.remove("hidden");

    const close = (result) => {
      popup.classList.add("hidden");
      yesBtn.removeEventListener("click", onYes);
      noBtn.removeEventListener("click", onNo);
      resolve(result);
    };

    const onYes = () => close(true);
    const onNo = () => close(false);

    yesBtn.addEventListener("click", onYes);
    noBtn.addEventListener("click", onNo);
  });
}

// ------------------------------
// 🌿 Load Amenities (Indoor + Outdoor) — Updated with Image Upload + Preview
// ------------------------------
async function loadAmenities() {
  try {
    const [resIndoor, resOutdoor] = await Promise.all([
      fetch("/indoor-amenities"),
      fetch("/outdoor-amenities")
    ]);

    const indoor = await resIndoor.json();
    const outdoor = await resOutdoor.json();

    contentSection.innerHTML = `
      <div class="room-header">
        <h3> </h3>
        <button id="addAmenityBtn" class="btn add-btn">➕ Add Amenity</button>
      </div>

      <div class="amenity-section">
        <h4>🏠 Indoor Amenities</h4>
        <table class="table">
          <thead>
            <tr><th>ID</th><th>Image</th><th>Name</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${indoor.map(a => `
              <tr>
                <td>${a.amenity_id}</td>
                <td>${a.icon_url ? `<img src="${a.icon_url}" alt="${a.amenity_name}" class="amenity-thumb">` : "—"}</td>
                <td>${a.amenity_name}</td>
                <td>${a.description ?? "—"}</td>
                <td class="action-buttons">
                  <button class="btn edit-btn" data-type="indoor" data-id="${a.amenity_id}">✏️ Edit</button>
                  <button class="btn btn-delete delete-btn" data-type="indoor" data-id="${a.amenity_id}">🗑 Delete</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>

        <hr class="amenity-divider">

        <h4>🌳 Outdoor Amenities</h4>
        <table class="table">
          <thead>
            <tr><th>ID</th><th>Image</th><th>Name</th><th>Description</th><th>Actions</th></tr>
          </thead>
          <tbody>
            ${outdoor.map(a => `
              <tr>
                <td>${a.outdoor_id}</td>
                <td>${a.icon_url ? `<img src="${a.icon_url}" alt="${a.amenity_name}" class="amenity-thumb">` : "—"}</td>
                <td>${a.amenity_name}</td>
                <td>${a.description ?? "—"}</td>
                <td class="action-buttons">
                  <button class="btn edit-btn" data-type="outdoor" data-id="${a.outdoor_id}">✏️ Edit</button>
                  <button class="btn btn-delete delete-btn" data-type="outdoor" data-id="${a.outdoor_id}">🗑 Delete</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>

      <!-- Amenity Modal -->
      <div id="amenityModal" class="modal hidden">
        <div class="modal-content">
          <h3 id="amenityModalTitle">Add Amenity</h3>
          <form id="amenityForm" enctype="multipart/form-data">
            <input type="hidden" id="amenity_id" />

            <label>Amenity Name</label>
            <input type="text" id="amenity_name" required />

            <label>Description</label>
            <textarea id="amenity_description" placeholder="Enter a short description"></textarea>

            <label>Amenity Type</label>
            <select id="amenity_type" required>
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>

            <label>Upload Image (Optional)</label>
            <input type="file" id="icon_file" accept="image/*" />
            <input type="hidden" id="icon_url" />

            <div id="imagePreviewContainer" class="hidden">
              <img id="imagePreview" class="amenity-preview">
            </div>

            <label>Or Image URL (optional)</label>
            <input type="text" id="manual_icon_url" placeholder="Paste full image URL here" />

            <div class="modal-actions">
              <button type="submit" class="btn save-btn">💾 Save</button>
              <button type="button" id="cancelAmenityModal" class="btn cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // 🟢 Add Amenity
    document.getElementById("addAmenityBtn").addEventListener("click", () => openAmenityModal());

    // 🟢 Edit Buttons
    document.querySelectorAll(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        const dataSource = type === "indoor" ? indoor : outdoor;
        const item = dataSource.find(a =>
          (type === "indoor" ? a.amenity_id : a.outdoor_id) == id
        );
        openAmenityModal(item, type);
      });
    });

    // 🟢 Delete Buttons
    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.type;
        const id = btn.dataset.id;
        await deleteAmenity(id, type);
      });
    });

    // 🟢 Cancel Modal
    document.getElementById("cancelAmenityModal").addEventListener("click", closeAmenityModal);

    // 🟢 Handle image upload
    const fileInput = document.getElementById("icon_file");
    const hiddenUrlInput = document.getElementById("icon_url");
    const manualInput = document.getElementById("manual_icon_url");
    const previewContainer = document.getElementById("imagePreviewContainer");
    const previewImage = document.getElementById("imagePreview");

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append("icon", file);

      try {
        const res = await fetch("/upload-amenity-image", {
          method: "POST",
          body: formData
        });

        const data = await res.json();
        if (data.fileUrl) {
          hiddenUrlInput.value = data.fileUrl;
          previewContainer.classList.remove("hidden");
          previewImage.src = data.fileUrl;
          showPopup("✅ Uploaded", "Image uploaded successfully!", "success");
        } else {
          showPopup("⚠️ Failed", "Image upload failed. Try again.", "error");
        }
      } catch (err) {
        console.error("❌ Upload error:", err);
        showPopup("❌ Error", "Server error while uploading image.", "error");
      }
    });

    // 🟢 Smoothed Live Image Preview — No shaking, no popup spam
    let previewTimer = null;

    manualInput.addEventListener("input", () => {
      clearTimeout(previewTimer);
      const url = manualInput.value.trim();

      // only proceed if user stopped typing for 700ms
      previewTimer = setTimeout(() => {
        // if empty — hide preview
        if (!url) {
          previewContainer.classList.add("hidden");
          hiddenUrlInput.value = "";
          return;
        }

        // check if URL looks like an image
        const isLikelyImage =
          url.match(/\.(jpeg|jpg|gif|png|webp|avif)$/i) ||
          url.startsWith("/uploads/");

        if (!isLikelyImage) {
          // Don’t preview until URL seems complete
          previewContainer.classList.add("hidden");
          return;
        }

        // ✅ Show preview safely (no popup on error)
        previewContainer.classList.remove("hidden");
        previewImage.style.opacity = "0.3";
        previewImage.src = url;
        hiddenUrlInput.value = url;

        previewImage.onload = () => {
          previewImage.style.opacity = "1";
        };

        previewImage.onerror = () => {
          // silently hide if not loadable
          previewContainer.classList.add("hidden");
        };
      }, 700);
    });

    // 🟢 Save Amenity
    document.getElementById("amenityForm").addEventListener("submit", async e => {
      e.preventDefault();

      const id = document.getElementById("amenity_id").value;
      const name = document.getElementById("amenity_name").value.trim();
      const desc = document.getElementById("amenity_description").value.trim();
      const type = document.getElementById("amenity_type").value;
      const icon_url = hiddenUrlInput.value.trim();

      const method = id ? "PUT" : "POST";
      const endpoint = id ? `/amenities/${type}/${id}` : "/amenities";

      try {
        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amenity_name: name, description: desc, amenity_type: type, icon_url })
        });

        const result = await res.json();
        showPopup("✅ Success", result.message || "Amenity saved successfully!", "success");
        closeAmenityModal();
        await loadAmenities();
      } catch (err) {
        console.error("❌ Error saving amenity:", err);
        showPopup("❌ Error", "Failed to save amenity.", "error");
      }
    });

  } catch (err) {
    console.error("❌ Error loading amenities:", err);
    showPopup("❌ Error", "Failed to load amenities.", "error");
  }
}

// ------------------------------
// 🪟 Amenity Modal Controls — Fixed scroll & reset image
// ------------------------------
function openAmenityModal(item = null, type = "indoor") {
  const modal = document.getElementById("amenityModal");
  const previewContainer = document.getElementById("imagePreviewContainer");
  const previewImage = document.getElementById("imagePreview");
  const iconFile = document.getElementById("icon_file");
  const iconUrl = document.getElementById("icon_url");
  const manualUrl = document.getElementById("manual_icon_url");

  // 🔓 Show modal & prevent background scroll
  modal.classList.remove("hidden");
  document.body.classList.add("modal-open");

  // Reset scroll to top
  const modalContent = modal.querySelector(".modal-content");
  if (modalContent) modalContent.scrollTop = 0;

  // 🔄 Always reset form and image state
  const form = document.getElementById("amenityForm");
  form.reset();
  iconFile.value = "";
  iconUrl.value = "";
  manualUrl.value = "";
  previewImage.src = "";
  previewContainer.classList.add("hidden");

  if (item) {
    // ✏️ Editing existing amenity
    document.getElementById("amenityModalTitle").textContent = "Edit Amenity";
    document.getElementById("amenity_id").value = item.amenity_id || item.outdoor_id;
    document.getElementById("amenity_name").value = item.amenity_name || "";
    document.getElementById("amenity_description").value = item.description || "";
    document.getElementById("amenity_type").value = type;
    iconUrl.value = item.icon_url || "";
    manualUrl.value = item.icon_url || "";

    // ✅ Show preview if URL is valid
    if (item.icon_url) {
      previewContainer.classList.remove("hidden");
      previewImage.src = item.icon_url;
    } else {
      previewContainer.classList.add("hidden");
      previewImage.src = "";
    }
  } else {
    // ➕ Adding new amenity
    document.getElementById("amenityModalTitle").textContent = "Add Amenity";
    document.getElementById("amenity_id").value = "";
    document.getElementById("amenity_type").value = "indoor";
  }
}

function closeAmenityModal() {
  const modal = document.getElementById("amenityModal");
  modal.classList.add("hidden");
  document.body.classList.remove("modal-open"); // ✅ Re-enable background scroll
}

// ------------------------------
// 🗑 Delete Amenity
// ------------------------------
async function deleteAmenity(id, type) {
  const confirmed = await showConfirmPopup(
    "🗑 Confirm Delete",
    `Are you sure you want to delete this ${type} amenity #${id}? This cannot be undone.`
  );

  if (!confirmed) {
    showPopup("❌ Cancelled", "Amenity deletion cancelled.", "error");
    return;
  }

  try {
    const res = await fetch(`/amenities/${type}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    showPopup("🗑 Deleted", data.message || "Amenity deleted successfully!", "success");
    await loadAmenities();
  } catch (err) {
    console.error("❌ Error deleting amenity:", err);
    showPopup("❌ Error", "Failed to delete amenity.", "error");
  }
}

// ------------------------------
// 📅 LOAD RESERVATIONS (Admin)
// ------------------------------
async function loadReservations() {
  try {
    const res = await fetch("/reservations");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    contentSection.innerHTML = `
      <div class="room-header">
        <h3> </h3>
        <div style="display:flex;gap:10px;align-items:center;">
            <select id="statusFilter" class="btn add-btn" style="padding:6px 10px;border-radius:8px;">
                <option value="all">Default (All)</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
            </select>

            <button id="switchTableView" class="btn add-btn hidden">📄 Table View</button>
            <button id="switchCalendarView" class="btn add-btn">📅 Calendar View</button>
            <button id="addManualReservationBtn" class="btn add-btn">➕ Add Manual Reservation</button>
        </div>
      </div>

      <!-- TABLE VIEW -->
      <div id="reservationTableView">
        <div class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Room</th>
                <th>Guest</th>
                <th>Guests</th>
                <th>Check-in</th>
                <th>Check-out</th>
                <th>Total (₱)</th>
                <th> Status </th>
                <th>Reserved On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                data.length
                  ? data.map((r) => {
                      const today = new Date();
                      const checkInDate = new Date(r.check_in);
                      const isOngoing = today >= checkInDate;

                      let actionsHTML = "";

                      if (r.status === "pending") {
                        actionsHTML = `
                          <button class="btn btn-confirm" data-id="${r.reservation_id}">Confirm</button>
                          <button class="btn btn-cancel" data-id="${r.reservation_id}">Cancel</button>
                          <button class="btn btn-view" data-request="${r.requests || 'None'}">View</button>
                        `;
                      } else if (r.status === "confirmed") {
                        if (isOngoing) {
                          actionsHTML = `<span style="color:green;font-weight:600;">In Progress</span>`;
                        } else {
                          actionsHTML = `
                            <button class="btn btn-cancel" data-id="${r.reservation_id}">Cancel</button>
                            <button class="btn btn-view" data-request="${r.requests || 'None'}">View</button>
                          `;
                        }
                      } else if (r.status === "cancelled") {
                        actionsHTML = `<span style="color:gray;">Cancelled</span>`;
                      } else {
                        const displayStatus = r.status
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, c => c.toUpperCase());
                        actionsHTML = `<span class="status-tag ${r.status}">${displayStatus}</span>`;
                      }

                      return `
                        <tr>
                          <td>${r.reservation_id}</td>
                          <td>${r.room_name || "—"}</td>
                          <td>${r.user_name || "—"}</td>
                          <td>${r.guests}</td>
                          <td>${new Date(r.check_in).toLocaleDateString()}</td>
                          <td>${new Date(r.check_out).toLocaleDateString()}</td>
                          <td>${Number(r.total_amount).toLocaleString()}</td>
                          <td>
                            <span class="status-tag ${r.status}">
                              ${r.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </td>
                          <td>${r.created_at}</td>
                          <td class="actions">
                            <div class="action-buttons">${actionsHTML}</div>
                          </td>
                        </tr>
                      `;
                    }).join("")
                  : `<tr><td colspan="10" style="text-align:center;">No reservations found.</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="pagination-controls" id="reservationPagination">
          <button id="prevPageBtn" class="btn add-btn">◀</button>
          <button id="nextPageBtn" class="btn add-btn">▶</button>
        </div>
      </div>

      <!-- CALENDAR VIEW -->
      <div id="calendarView" class="hidden">

          <div class="calendar-header">
              <button id="prevMonthBtn" class="month-btn">◀</button>
              <h3 id="calendarMonthLabel"></h3>
              <button id="nextMonthBtn" class="month-btn">▶</button>
          </div>

          <div id="calendarContainer" class="calendar-container">
              <div id="calendarHeader" class="calendar-header-row"></div>
              <div id="calendarBody" class="calendar-body"></div>
          </div>

      </div>

      <!-- Manual Reservation Modal -->
      <div id="manualReservationModal" class="modal hidden">
        <div class="modal-content">
          <h3>Add Manual Reservation</h3>
          <form id="manualReservationForm">
            <label>Room</label>
            <select id="manualRoomSelect" required>
              <option value="">Select Room</option>
            </select>

            <label>Check-in Date</label>
            <input type="text" id="manualCheckIn" placeholder="Select date" required />

            <label>Check-out Date</label>
            <input type="text" id="manualCheckOut" placeholder="Select date" required />

            <label>Number of Guests</label>
            <input type="number" id="manualGuests" min="1" required />

            <label>Total Amount (₱)</label>
            <input type="text" id="manualTotal" readonly style="background:#f3f3f3;cursor:not-allowed;" />

            <label>Special Requests (optional)</label>
            <textarea id="manualRequests"></textarea>

            <div class="modal-actions">
              <button type="submit" class="btn save-btn">💾 Save</button>
              <button type="button" id="cancelManualReservation" class="btn cancel-btn">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    `;

    // 🟢 Add Manual Reservation Modal
    document.getElementById("addManualReservationBtn").addEventListener("click", async () => {
      const modal = document.getElementById("manualReservationModal");
      const roomSelect = document.getElementById("manualRoomSelect");

      // Load available rooms
      try {
        const res = await fetch("/rooms");
        const rooms = await res.json();

        roomSelect.innerHTML = `<option value="">Select Room</option>` +
          rooms.map(r => `<option value="${r.room_id}" data-max="${r.max_guests}" data-price="${r.price_per_night}">
            ${r.room_name} (${r.room_type})
          </option>`).join("");
      } catch {
        showPopup("❌ Error", "Failed to load rooms.", "error");
      }

      modal.classList.remove("hidden");
      document.body.classList.add("modal-open");
    });

    // 🟠 Cancel Manual Reservation
    document.getElementById("cancelManualReservation").addEventListener("click", () => {
      const modal = document.getElementById("manualReservationModal");
      modal.classList.add("hidden");
      document.body.classList.remove("modal-open");
    });

    // ===============================
    // 🧮 FLATPICKR SETUP + TOTAL AUTO CALC
    // ===============================
    let checkinPicker, checkoutPicker, currentRoomRate = 0, maxGuests = 1;
    const manualCheckIn = document.getElementById("manualCheckIn");
    const manualCheckOut = document.getElementById("manualCheckOut");
    const totalInput = document.getElementById("manualTotal");
    const guestInput = document.getElementById("manualGuests");

    // When a room is selected, update rate, guest limit, and refresh calendar
    document.getElementById("manualRoomSelect").addEventListener("change", async (e) => {
      const roomId = e.target.value;
      if (!roomId) return;

      const selected = e.target.options[e.target.selectedIndex];
      currentRoomRate = parseFloat(selected.dataset.price);
      maxGuests = parseInt(selected.dataset.max) || 1;

      guestInput.max = maxGuests;
      guestInput.value = 1;
      guestInput.placeholder = `Up to ${maxGuests} guest${maxGuests > 1 ? "s" : ""}`;

      // Load reserved dates for this room
      try {
        const res = await fetch(`/rooms/${roomId}/reserved-dates`);
        const reserved = await res.json();

        const disabledDates = reserved
          .filter(d => ["pending", "confirmed", "in_progress"].includes(d.status))
          .map(d => d.date);

        // Destroy existing pickers before recreating
        if (checkinPicker) checkinPicker.destroy();
        if (checkoutPicker) checkoutPicker.destroy();

        // Initialize checkout (disabled initially)
        checkoutPicker = flatpickr("#manualCheckOut", {
          dateFormat: "Y-m-d",
          disable: disabledDates,
          clickOpens: false,
          onReady: function () {
            manualCheckOut.setAttribute("disabled", true);
          },
          onOpen: function () {
            const ciValue = manualCheckIn.value;
            if (!ciValue) {
              this.close();
              alert("⚠️ Please select a check-in date first.");
            }
          },
          onChange: function (selectedDates) {
            updateTotal();
          },
          onDayCreate: function (dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split("T")[0];
            const booked = reserved.find(d => d.date === dateStr);
            if (booked) {
              dayElem.classList.add("flatpickr-disabled-day");
              if (booked.status === "pending") dayElem.style.background = "rgba(255,193,7,0.35)";
              if (booked.status === "confirmed") dayElem.style.background = "rgba(220,53,69,0.35)";
              if (booked.status === "in_progress") dayElem.style.background = "rgba(220,53,69,0.35)";
              dayElem.title = `📅 ${booked.status.toUpperCase()}`;
            }
          },
        });

        // Initialize checkin
        checkinPicker = flatpickr("#manualCheckIn", {
          dateFormat: "Y-m-d",
          minDate: "today",
          disable: disabledDates,
          onChange: function (selectedDates) {
            if (selectedDates.length > 0) {
              const checkinDate = selectedDates[0];
              const nextDay = new Date(checkinDate.getTime() + 86400000);
              manualCheckOut.removeAttribute("disabled");
              checkoutPicker.set("clickOpens", true);
              checkoutPicker.set("minDate", nextDay);
              checkoutPicker.set("disable", disabledDates);
              checkoutPicker.open();
            }
          },
          onDayCreate: function (dObj, dStr, fp, dayElem) {
            const dateStr = dayElem.dateObj.toISOString().split("T")[0];
            const booked = reserved.find(d => d.date === dateStr);
            if (booked) {
              dayElem.classList.add("flatpickr-disabled-day");
              if (booked.status === "pending") dayElem.style.background = "rgba(255,193,7,0.35)";
              if (booked.status === "confirmed") dayElem.style.background = "rgba(220,53,69,0.35)";
              if (booked.status === "in_progress") dayElem.style.background = "rgba(220,53,69,0.35)";
              dayElem.title = `📅 ${booked.status.toUpperCase()}`;
            }
          },
        });

      } catch (err) {
        console.error("❌ Error loading reserved dates:", err);
        showPopup("❌ Error", "Failed to load reserved dates.", "error");
      }
    });

    // 🧮 Total price calculator
    function updateTotal() {
      const ci = new Date(manualCheckIn.value);
      const co = new Date(manualCheckOut.value);
      if (!ci || !co || isNaN(ci) || isNaN(co)) return;

      const diffDays = Math.max(0, (co - ci) / (1000 * 60 * 60 * 24));
      const total = diffDays * currentRoomRate;
      totalInput.value = total > 0 ? `₱${total.toLocaleString()}` : "₱0";
    }

    // ===============================
    // 🟢 Save Manual Reservation
    // ===============================
    document.getElementById("manualReservationForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const room_id = document.getElementById("manualRoomSelect").value;
      const check_in = manualCheckIn.value;
      const check_out = manualCheckOut.value;
      const guests = parseInt(guestInput.value) || 1;
      const requests = document.getElementById("manualRequests").value.trim();
      const total = totalInput.value.replace(/[₱,]/g, "") || 0;

      if (!room_id || !check_in || !check_out) {
        showPopup("⚠️ Missing Fields", "Please fill in all required fields.", "error");
        return;
      }

      try {
        const res = await fetch("/reservations/manual", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id, check_in, check_out, guests, requests, total_amount: total })
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.message);

        showPopup("✅ Success", result.message || "Manual reservation added!", "success");

        // Close modal and refresh
        document.getElementById("manualReservationModal").classList.add("hidden");
        document.body.classList.remove("modal-open");
        await loadReservations();

      } catch (err) {
        console.error("❌ Error adding manual reservation:", err);
        showPopup("❌ Error", "Failed to add manual reservation.", "error");
      }
    });

    // 🟠 Cancel Manual Reservation
    document.getElementById("cancelManualReservation").addEventListener("click", () => {
      const modal = document.getElementById("manualReservationModal");
      modal.classList.add("hidden");
      document.body.classList.remove("modal-open");
    });

    // 🟢 Classic popups instead of Swal.fire
    document.querySelectorAll(".btn-confirm").forEach((btn) =>
      btn.addEventListener("click", () =>
        openConfirmPopup(btn.dataset.id)
      )
    );

    document.querySelectorAll(".btn-cancel").forEach((btn) =>
      btn.addEventListener("click", () =>
        openCancelPopup(btn.dataset.id)
      )
    );

    document.querySelectorAll(".btn-view").forEach((btn) =>
      btn.addEventListener("click", () =>
        openRequestPopup(btn.dataset.request)
      )
    );

  const roomsRes = await fetch("/rooms");
  window.allRooms = await roomsRes.json();
      // 🔥 Attach handlers AFTER content is rendered
  attachCalendarHandlers(data);

  // ===============================
  // ✅ PAGINATION SYSTEM (5 PER PAGE)
  // ===============================
  let currentPage = 0;
  const rowsPerPage = 5;

  const tableBody = document.querySelector("#reservationTableView tbody");
  const rows = tableBody.querySelectorAll("tr");

  let visibleRows = Array.from(rows);

  function filterByStatus(status) {

    // 1️⃣ Show/hide rows
    rows.forEach(row => {
      const tag = row.querySelector(".status-tag");
      if (!tag) return;

      const rowStatus = tag.textContent.trim().toLowerCase().replace(/ /g, "_");

      if (status === "all" || rowStatus === status) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });

    // 2️⃣ Recalculate visible rows
    visibleRows = Array.from(rows).filter(r => r.style.display !== "none");

    // 3️⃣ Reset pagination
    currentPage = 0;

    // 4️⃣ Re-render page using filtered list
    renderPage(currentPage, true);
  }

  const prevBtn = document.getElementById("prevPageBtn");
  const nextBtn = document.getElementById("nextPageBtn");

  function renderPage(page, isFilterMode = false) {
    const list = isFilterMode ? visibleRows : visibleRows;

    // Hide all rows
    rows.forEach(row => row.style.display = "none");

    // Show only rows in the page range
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;

    list.slice(start, end).forEach(row => {
      row.style.display = "";
    });

    updatePaginationButtons(list.length);
  }

  function updatePaginationButtons(totalVisible) {
    const totalPages = Math.ceil(totalVisible / rowsPerPage);

    prevBtn.style.display = currentPage === 0 ? "none" : "inline-block";
    nextBtn.style.display = currentPage >= totalPages - 1 ? "none" : "inline-block";
  }

  prevBtn.onclick = () => {
    currentPage--;
    renderPage(currentPage);
  };

  nextBtn.onclick = () => {
    currentPage++;
    renderPage(currentPage);
  };

  // ✅ INITIAL LOAD (latest 5)
  renderPage(currentPage);

  // 🔵 Apply filter dropdown
  document.getElementById("statusFilter").addEventListener("change", (e) => {
    filterByStatus(e.target.value);
  });

    // ==========================================
    // FIXED: GLOBAL Calendar Handlers
    // ==========================================
    function attachCalendarHandlers(reservations) {
      const tableView = document.getElementById("reservationTableView");
      const calendarView = document.getElementById("calendarView");

      const btnCalendar = document.getElementById("switchCalendarView");
      const btnTable = document.getElementById("switchTableView");

      const prevBtn = document.getElementById("prevMonthBtn");
      const nextBtn = document.getElementById("nextMonthBtn");

      let currentMonth = new Date().getMonth();
      let currentYear = new Date().getFullYear();

      // SWITCH TO CALENDAR
      btnCalendar.onclick = () => {
        tableView.classList.add("hidden");
        calendarView.classList.remove("hidden");

        btnCalendar.classList.add("hidden");
        btnTable.classList.remove("hidden");

        document.getElementById("reservationPagination").classList.add("hidden");

        currentMonth = new Date().getMonth();
        currentYear = new Date().getFullYear();

        renderCalendar(currentMonth, currentYear, reservations);
      };

      // SWITCH TO TABLE
      btnTable.onclick = () => {
        calendarView.classList.add("hidden");
        tableView.classList.remove("hidden");

        btnTable.classList.add("hidden");
        btnCalendar.classList.remove("hidden");

        document.getElementById("reservationPagination").classList.remove("hidden");
      };

      // PREV MONTH
      prevBtn.onclick = () => {
        currentMonth--;
        if (currentMonth < 0) {
          currentMonth = 11;
          currentYear--;
        }
        renderCalendar(currentMonth, currentYear, reservations);
      };

      // NEXT MONTH
      nextBtn.onclick = () => {
        currentMonth++;
        if (currentMonth > 11) {
          currentMonth = 0;
          currentYear++;
        }
        renderCalendar(currentMonth, currentYear, reservations);
      };

      // ⭐ REQUIRED FIX
      renderCalendar(currentMonth, currentYear, reservations);
    
    }

    // ==========================================
    // FIXED: GLOBAL Calendar Renderer
    // ==========================================
    function renderCalendar(month, year, reservations) {
          // ⭐ FILTER ONLY RESERVATIONS THAT BELONG TO THIS MONTH
      const monthReservations = reservations.filter(r => {
          if (["cancelled", "expired"].includes(r.status)) {
          return false;
          }

          const start = new Date(r.check_in);
          const end = new Date(r.check_out);

          return (
              (start.getMonth() === month && start.getFullYear() === year) ||
              (end.getMonth() === month && end.getFullYear() === year) ||
              (start < new Date(year, month + 1, 1) && end >= new Date(year, month, 1))
          );
      });

      const monthNames = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
      ];

      document.getElementById("calendarMonthLabel").textContent =
      `${monthNames[month]} ${year}`;

      const totalDays = new Date(year, month + 1, 0).getDate();

      const headerRow = document.getElementById("calendarHeader");
      const body = document.getElementById("calendarBody");

      headerRow.innerHTML = "";
      body.innerHTML = "";

      // ============================
      // RENDER HEADER DATES (horizontal)
      // ============================
      headerRow.style.gridTemplateColumns = `200px repeat(${totalDays}, 60px)`;

      headerRow.innerHTML = `
          <div class="calendar-room-name"></div>
          ${
              Array.from({ length: totalDays }, (_, i) =>
                  `<div class="calendar-day-cell">${i + 1}</div>`
              ).join("")
          }
      `;

      // ============================
      // GET UNIQUE ROOMS
      // ============================
      const rooms = window.allRooms.map(r => r.room_name);

      // ============================
      // RENDER EACH ROOM ROW
      // ============================
      rooms.forEach(room => {
        const row = document.createElement("div");
        row.classList.add("calendar-room-row");
        row.style.gridTemplateColumns = `200px repeat(${totalDays}, 60px)`;

        // Room Name
        row.innerHTML = `<div class="calendar-room-name">${room}</div>`;

        // Empty cells for the days
        for (let d = 1; d <= totalDays; d++) {
          row.innerHTML += `<div class="calendar-day-cell" data-day="${d}"></div>`;
        }

        body.appendChild(row);

        // ============================
        // ADD RESERVATION BARS (FIXED CLEAN VERSION)
        // ============================
        const roomReservations = monthReservations.filter(r => r.room_name === room);

        const dayWidth = 60;

        roomReservations.forEach(r => {
          const start = new Date(r.check_in);
          const end = new Date(r.check_out);

          // Clamp within month
          const startDay =
            start.getMonth() === month && start.getFullYear() === year
              ? start.getDate()
              : 1;

          const endDay =
            end.getMonth() === month && end.getFullYear() === year
              ? end.getDate()
              : totalDays;

          const stayLength = endDay - startDay + 1;

          const color =
            r.status === "pending" ? "#FFC107" :
            r.status === "confirmed" ? "#28A745" :
            r.status === "in_progress" ? "#35dcbdff" :
            "#007BFF";

          // Create block
          const block = document.createElement("div");
          block.classList.add("reservation-block");
          block.textContent = r.user_name;

          // FIX: make sure bars stay INSIDE the grid
          block.style.position = "absolute";
          block.style.left = `${200 + (startDay - 1) * dayWidth}px`;   // <-- Offset para hindi lumampas
          block.style.width = `${stayLength * dayWidth - 6}px`;      // <-- Para sakto sa loob
          block.style.top = "3px";                                    // <-- Always one line per room
          
          // STYLE
          block.style.height = "34px";
          block.style.lineHeight = "34px";
          block.style.background = color;
          block.style.border = "3px solid white"; // visible separation
          block.style.borderRadius = "8px";
          block.style.fontSize = "12px";
          block.style.fontWeight = "600";
          block.style.color = "#fff";
          block.style.textAlign = "center";
          block.style.overflow = "hidden";

          row.appendChild(block);
        });

        // Row height fixed — no stacking
        row.style.minHeight = "44px";
        row.style.height = "44px";
      });
    }

  } catch (err) {
    console.error("❌ Error loading reservations:", err);
    contentSection.innerHTML = `<p>⚠️ Failed to load reservations.</p>`;
    return;
  }
}

// ------------------------------
// 🔄 Update Reservation Status
// ------------------------------
async function updateReservationStatus(id, status) {
  try {
    const res = await fetch(`/reservations/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    const result = await res.json();
    showPopup("✅ Success", result.message, "success");
    await loadReservations();
  } catch (err) {
    console.error("❌ Error updating reservation:", err);
    showPopup("❌ Error", "Failed to update reservation.", "error");
  }
}

// ------------------------------
// 🟦 Confirm Reservation (Classic Popup)
// ------------------------------
async function openConfirmPopup(id) {
  const confirmed = await showConfirmPopup(
    "✅ Confirm Reservation",
    `Are you sure you want to confirm reservation #${id}?`,
    "confirm"
  );

  if (confirmed) {
    await updateReservationStatus(id, "confirmed");
  } else {
    showPopup("❌ Cancelled", "Reservation not confirmed.", "error");
  }
}

// ------------------------------
// 🟥 Cancel Reservation (Classic Popup)
// ------------------------------
async function openCancelPopup(id) {
  const confirmed = await showConfirmPopup(
    "❌ Cancel Reservation",
    `Are you sure you want to cancel reservation #${id}?`,
    "cancel"
  );

  if (confirmed) {
    await updateReservationStatus(id, "cancelled");
  } else {
    showPopup("⚠️ Cancelled", "Reservation remains active.", "error");
  }
}

// ------------------------------
// 🗑 Delete Manual Reservation (Optional for Admin)
// ------------------------------
async function deleteManualReservation(id) {
  const confirmed = await showConfirmPopup(
    "🗑 Remove Manual Reservation",
    `Are you sure you want to delete manual reservation #${id}?`,
    "delete"
  );

  if (!confirmed) {
    showPopup("❌ Cancelled", "Manual reservation deletion cancelled.", "error");
    return;
  }

  try {
    const res = await fetch(`/reservations/manual/${id}`, { method: "DELETE" });
    const result = await res.json();

    if (!res.ok) throw new Error(result.message);

    showPopup("🗑 Deleted", result.message || "Manual reservation removed!", "success");
    await loadReservations();
  } catch (err) {
    console.error("❌ Error deleting manual reservation:", err);
    showPopup("❌ Error", "Failed to delete manual reservation.", "error");
  }
}

// ------------------------------
// 🗒️ View Customer Request Popup
// ------------------------------
function openRequestPopup(requestText) {
  const popup = document.getElementById("popup");
  const titleEl = document.getElementById("popupTitle");
  const msgEl = document.getElementById("popupMessage");

  titleEl.textContent = "📝 Customer Request";
  msgEl.textContent =
    requestText && requestText !== "None"
      ? requestText
      : "No special requests provided.";

  popup.classList.remove("hidden");
  popup.classList.add("info");

  setTimeout(() => popup.classList.add("hidden"), 3000);
}

// ------------------------------
// 💬 Load Feedbacks (Admin View) — fixed version for /feedback route
// ------------------------------
async function loadFeedbacks() {
  try {
    const res = await fetch("/feedback"); // ✅ correct route (singular)
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const feedbacks = await res.json();

    // ✅ Update section content (remove "Loading..." message)
    contentSection.innerHTML = `
      <div class="room-header">
        <h3> </h3>
        <div style="display:flex;align-items:center;gap:10px;">
          <label for="ratingFilter" style="font-weight:600;">Filter by Rating:</label>
          <select id="ratingFilter" class="btn" style="padding:6px 10px;border-radius:8px;border:1px solid #ccc;">
            <option value="all">All Ratings</option>
            <option value="5">⭐⭐⭐⭐⭐ (5 Stars)</option>
            <option value="4">⭐⭐⭐⭐ (4 Stars)</option>
            <option value="3">⭐⭐⭐ (3 Stars)</option>
            <option value="2">⭐⭐ (2 Stars)</option>
            <option value="1">⭐ (1 Star)</option>
          </select>
        </div>
      </div>

      <div class="table-container feedback-table">
        <table class="table feedback-table-content">
          <thead>
            <tr>
              <th>Feedback ID</th>
              <th>Guest Name</th>
              <th>Rating</th>
              <th>Comment</th>
            </tr>
          </thead>
          <tbody id="feedbackTableBody">
            ${
              feedbacks.length
                ? feedbacks
                    .map(
                      (f) => `
                <tr data-rating="${f.rating}">
                  <td>${f.feedback_id}</td>
                  <td>${f.fullname || "—"}</td>
                  <td>${renderStars(f.rating)} <span style="color:#777;font-size:0.85rem;">(${f.rating})</span></td>
                  <td>${f.comment}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="4" style="text-align:center;">No feedbacks available.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;

    // 🎯 Add Filter Logic
    const ratingFilter = document.getElementById("ratingFilter");
    const tableBody = document.getElementById("feedbackTableBody");

    ratingFilter.addEventListener("change", () => {
      const selected = ratingFilter.value;
      const rows = tableBody.querySelectorAll("tr");

      rows.forEach((row) => {
        const rating = row.dataset.rating;
        if (selected === "all" || rating === selected) {
          row.style.display = "";
        } else {
          row.style.display = "none";
        }
      });
    });

  } catch (err) {
    console.error("❌ Error loading feedbacks:", err);
    contentSection.innerHTML = `<p>⚠️ Failed to load feedbacks.</p>`;
  }
}

// ⭐ Render Stars Function
function renderStars(rating) {
  let stars = "";
  for (let i = 1; i <= 5; i++) {
    stars += i <= rating ? "⭐" : "☆";
  }
  return `<span style="color:#ffb400;font-size:1.2rem;">${stars}</span>`;
}

let currentDate = new Date();

function formatMoney(value) {
  if (value >= 1e12) return "₱" + (value / 1e12).toFixed(1) + "T";
  if (value >= 1e9)  return "₱" + (value / 1e9).toFixed(1) + "B";
  if (value >= 1e6)  return "₱" + (value / 1e6).toFixed(1) + "M";
  return "₱" + value.toLocaleString();
}

//-----Analytics Section----
async function loadAnalytics() {
  try {
    const [roomsRes, reservationsRes, feedbackRes] = await Promise.all([
      fetch("/rooms"),
      fetch("/reservations"),
      fetch("/feedback")
    ]);

    const rooms = await roomsRes.json();
    const reservations = await reservationsRes.json();

    function isSameMonth(dateStr) {
      const d = new Date(dateStr);
      return (
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear()
      );
    }

    // ⭐ Use check_in for month basis, NOT created_at
    const monthlyReservations = reservations.filter(r => 
      isSameMonth(r.check_in) && r.status !== "expired"
    );

    const feedbacks = await feedbackRes.json();

    const totalReservations = reservations.length;
    const pending = monthlyReservations.filter(r => r.status === "pending").length;
    const confirmed = monthlyReservations.filter(r => r.status === "confirmed").length;
    const cancelled = monthlyReservations.filter(r => r.status === "cancelled").length;
    const completed = monthlyReservations.filter(r => r.status === "completed").length;

    const totalRevenue = reservations
      .filter(r => r.status === "completed")
      .reduce((sum, r) => sum + Number(r.total_amount), 0);

    const monthlyRevenue = monthlyReservations
      .filter(r => r.status === "completed")
      .reduce((sum, r) => sum + Number(r.total_amount), 0);

    // ===== MOST RESERVED CUSTOMER =====
    const customerMap = {};

    monthlyReservations.forEach(r => {
      if (!r.user_name) return;

      if (!customerMap[r.user_name]) {
        customerMap[r.user_name] = { count: 0, revenue: 0 };
      }

      // Count ALL reservations (pending/confirmed/cancelled/completed)
      customerMap[r.user_name].count++;

      // Only completed reservations contribute revenue
      if (r.status === "completed") {
        customerMap[r.user_name].revenue += Number(r.total_amount);
      }
    });

    const topCustomer = Object.keys(customerMap)
      .sort((a,b) => customerMap[b].count - customerMap[a].count)[0];

    const topData = customerMap[topCustomer] || { count: 0, revenue: 0 };

    // ===== MOST RESERVED ROOM =====
    const roomMap = {};

    monthlyReservations.forEach(r => {
      if (!r.room_name) return;

      if (!roomMap[r.room_name]) {
        roomMap[r.room_name] = { count: 0, revenue: 0 };
      }

      // Count ALL reservations (pending/confirmed/cancelled/completed)
      roomMap[r.room_name].count++;

      // Only completed reservations contribute revenue
      if (r.status === "completed") {
        roomMap[r.room_name].revenue += Number(r.total_amount);
      }
    });

    const topRoom = Object.keys(roomMap)
      .sort((a, b) => roomMap[b].count - roomMap[a].count)[0];

    const topRoomData = roomMap[topRoom] || { count: 0, revenue: 0 };

    const avgRating = feedbacks.length
      ? (feedbacks.reduce((s,f) => s + f.rating, 0) / feedbacks.length).toFixed(1)
      : "0";

    // ================= HTML LAYOUT =================
    contentSection.innerHTML = `
    <div class="analytics-wrapper">

      <div class="analytics-top-header">
        <button id="prevRevenue">◀</button>
        <span id="currentMonthLabel"></span>
        <button id="nextRevenue">▶</button>
      </div>

      <div class="analytics-grid">
        <div class="stat-card">
          💰 Total Revenue
          <strong>${formatMoney(totalRevenue)}</strong>
        </div>
        <div class="stat-card">
          📆 Revenue This Month
          <strong>${formatMoney(monthlyRevenue)}</strong>
        </div>
        <div class="stat-card">
          📦 Total Reservations
          <strong>${totalReservations}</strong>
        </div>
        <div class="stat-card">
          ✅ Reservations This Month
          <strong>${monthlyReservations.length}</strong>
        </div>
        <div class="stat-card">⭐ Avg Rating
          <strong>${avgRating} / 5</strong>
          <div style="margin-top:4px;">
            ${renderStars(Math.round(avgRating))}
          </div>
        </div>
      </div>

      <div class="analytics-section">
        <h3>Reservation Status</h3>
        <div class="chart-wrapper">
          <canvas id="statusChart"></canvas>
        </div>
      </div>

      <div class="analytics-section">
        <div class="chart-wrapper">
          <canvas id="revenueChart"></canvas>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">

        <div class="analytics-section highlight">
          <h3>🏨 Most Reserved Room</h3>
          <p><strong>${topRoom || "N/A"}</strong></p>
          <p>Reservations: ${topRoomData.count}</p>
        </div>

        <div class="analytics-section highlight">
          <h3>👤 Most Reserved Customer</h3>
          <p><strong>${topCustomer || "N/A"}</strong></p>
          <p>Reservations: ${topData.count}</p>
        </div>

      </div>

      <button id="downloadSummaryBtn" class="btn add-btn">⬇ Download Revenue Summary</button>

    </div>`;

    // ===== FLEXIBLE DOUGHNUT STATUS CHART =====
    const rawStatusData = [
      { label: "Pending", value: pending, color: "#facc15" },
      { label: "Confirmed", value: confirmed, color: "#22c55e" },
      { label: "Cancelled", value: cancelled, color: "#ef4444" },
      { label: "Completed", value: completed, color: "#3b82f6" }
    ];

    // remove zero-value slices
    let filtered = rawStatusData.filter(s => s.value > 0);

    // if ALL are zero → show blank doughnut
    if (filtered.length === 0) {
      filtered = [{
        label: "No Data",
        value: 1,
        color: "#e5e7eb" // light gray blank circle
      }];
    }

    const labels = filtered.map(s => s.label);
    const values = filtered.map(s => s.value);
    const colors = filtered.map(s => s.color);

    new Chart(document.getElementById("statusChart"), {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.label === "No Data") return "No reservations this month";
                return context.label + ": " + context.raw;
              }
            }
          }
        }
      }
    });

    // ===== WORKING REVENUE GRAPH SYSTEM =====
    let currentMode = "month";
    let revenueChart;

    function updateMonthLabel() {
      const label = document.getElementById("currentMonthLabel");
      if (label) {
        label.textContent =
          "Revenue Trend - " +
          currentDate.toLocaleString("default", { month: "long", year: "numeric" });
      }
    }

    // 👇 ADD THIS NEW FUNCTION DIRECTLY AFTER updateMonthLabel()
    function updateMonthControls() {
      const nextBtn = document.getElementById("nextRevenue");
      if (!nextBtn) return;

      const now = new Date();
      const isCurrentMonth =
        currentDate.getMonth() === now.getMonth() &&
        currentDate.getFullYear() === now.getFullYear();
    }

    function generateMonthlyDailyRevenue() {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const labels = [];
      const values = [];

      for (let day = 1; day <= daysInMonth; day++) {
        labels.push(day);

        const total = monthlyReservations
          .filter(r => r.status === "completed")
          .filter(r => new Date(r.created_at).getDate() === day)
          .reduce((sum, r) => sum + Number(r.total_amount), 0);

        values.push(total);
      }

      return { labels, values };
    }
    
    function formatShortNumber(value) {
      if (value >= 1_000_000_000_000) return (value / 1_000_000_000_000).toFixed(1).replace(/\.0$/, '') + "T";
      if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + "B";
      if (value >= 1_000_000) return (value / 1_000_000).toFixed(1).replace(/\.0$/, '') + "M";
      if (value >= 1_000) return (value / 1_000).toFixed(1).replace(/\.0$/, '') + "k";
      return value;
    }

    function renderRevenueChart() {
      const { labels, values } = generateMonthlyDailyRevenue();

      if (revenueChart) revenueChart.destroy();

      revenueChart = new Chart(document.getElementById("revenueChart"), {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Revenue",
            data: values,
            borderColor: "#4f46e5",
            backgroundColor: "rgba(79,70,229,0.15)",
            fill: true,
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              ticks: {
                callback: function(value) {
                  return "₱" + formatShortNumber(value);
                }
              }
            }
          },
          plugins: {
            tooltip: {
              callbacks: {
                label: function(ctx) {
                  return "₱" + ctx.raw.toLocaleString();
                }
              }
            }
          }
        }
      });
    }

    // INITIAL LOAD
    updateMonthLabel();
    renderRevenueChart();
    updateMonthControls();

    // ✅ DOWNLOAD SALES SUMMARY (ACCOUNTING STYLE BY CUSTOMER)
    document.getElementById("downloadSummaryBtn").onclick = () => {
      generateRevenueSummaryExcel(monthlyReservations);
    };

    // PREVIOUS MONTH
    document.getElementById("prevRevenue").onclick = () => {
      currentDate.setMonth(currentDate.getMonth() - 1);
      loadAnalytics(); // RELOAD EVERYTHING BASED ON NEW MONTH
    };

    // NEXT MONTH
    document.getElementById("nextRevenue").onclick = () => {
      currentDate.setMonth(currentDate.getMonth() + 1);
      loadAnalytics(); // RELOAD EVERYTHING BASED ON NEW MONTH
    };

  } catch (err) {
    console.error("Analytics error:", err);
    contentSection.innerHTML = `<p>❌ Failed to load analytics.</p>`;
  }
}

function generateRevenueSummaryExcel(reservations) {
  const completed = reservations.filter(r => r.status === "completed");

  if (completed.length === 0) {
    alert("No completed reservations for this month.");
    return;
  }

  const customerMap = {};
  let grandTotal = 0;

  completed.forEach(r => {
    let customer = r.user_name?.trim() || "(Manual Reservation)";
    const room = r.room_name || "Unknown Room";
    const amount = Number(r.total_amount) || 0;

    if (!customerMap[customer]) {
      customerMap[customer] = { rooms: new Set(), total: 0 };
    }

    customerMap[customer].rooms.add(room);
    customerMap[customer].total += amount;
    grandTotal += amount;
  });

  // ===== Build sheet data =====
  const sheetData = [
    ["Customer", "Rooms Reserved", "Revenue"]
  ];

  for (const customer in customerMap) {
    sheetData.push([
      customer,
      Array.from(customerMap[customer].rooms).join(" | "),
      customerMap[customer].total
    ]);
  }

  // Total row
  sheetData.push(["", "Total Revenue", grandTotal]);

  // ===== Create workbook =====
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // ✅ Auto column width
  ws["!cols"] = [
    { wch: 28 },
    { wch: 45 },
    { wch: 20 }
  ];

  // ✅ Header colors
  ["A1","B1","C1"].forEach(cell => {
    ws[cell].s = {
      fill: { fgColor: { rgb: "4F46E5" } },
      font: { color: { rgb: "FFFFFF" }, bold: true }
    };
  });

  // ✅ Total Revenue row color
  const totalRowIndex = sheetData.length;
  const totalCell = "B" + totalRowIndex;

  ws[totalCell].s = {
    fill: { fgColor: { rgb: "22C55E" } },
    font: { bold: true }
  };

  ws["C" + totalRowIndex].s = {
    fill: { fgColor: { rgb: "DCFCE7" } },
    font: { bold: true }
  };

  XLSX.utils.book_append_sheet(wb, ws, "Revenue Summary");

  const monthName = currentDate.toLocaleString("default", { month: "long" });
  const year = currentDate.getFullYear();

  XLSX.writeFile(wb, `Revenue_Summary_${monthName}_${year}.xlsx`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM fixes ₱ corruption
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ================= USERS SECTION =================
async function loadUsers() {
  document.getElementById("sectionTitle").textContent = "Users";

  const res = await fetch("/admin/users");
  const users = await res.json();

  let html = `
    <table>
      <thead>
        <tr>
          <th>Full Name</th>
          <th>Email</th>
          <th>Contact</th>
          <th>Verification Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(u => {
    const status = u.verified ? "Verified" : "Unverified";
    const statusClass = u.verified ? "status-verified" : "status-unverified";

    html += `
      <tr>
        <td>${u.fullname}</td>
        <td>${u.email}</td>
        <td>${u.contact}</td>
        <td><span class="${statusClass}">${status}</span></td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  document.getElementById("contentSection").innerHTML = html;
}


// ------------------------------
// 🚪 Logout with Popup + Success Animation
// ------------------------------
const logoutBtn = document.getElementById("logoutBtn");
const logoutPopup = document.getElementById("logoutPopup");
const confirmLogout = document.getElementById("confirmLogout");
const cancelLogout = document.getElementById("cancelLogout");
const logoutSuccessPopup = document.getElementById("logoutSuccessPopup");
const logoutProgress = document.getElementById("logoutProgress");

// 🟢 Show confirmation popup
logoutBtn.addEventListener("click", (e) => {
  e.preventDefault();
  logoutPopup.classList.add("show");
});

// 🟢 Confirm logout
confirmLogout.addEventListener("click", () => {
  logoutPopup.classList.remove("show");

  // Clear user data
  sessionStorage.clear();
  localStorage.removeItem("user");

  // Show success popup
  logoutSuccessPopup.classList.add("show");

  // Animate progress bar
  setTimeout(() => {
    logoutProgress.style.width = "100%";
  }, 100);

  // Redirect after 2.2 seconds (matches progress animation)
  setTimeout(() => {
    logoutSuccessPopup.classList.remove("show");
    window.location.href = "/login-page";
  }, 2300);
});

// 🟢 Cancel logout
cancelLogout.addEventListener("click", () => {
  logoutPopup.classList.remove("show");
});

// Auto-refresh reservations every 60 seconds (optional)
setInterval(() => {
  const active = document.querySelector(".sidebar a.active");
  if (active?.dataset.section === "reservations") loadReservations();
}, 60000);

// ===============================
// 🩵 FIX: Prevent Flatpickr calendar clicks from closing modals
// ===============================
window.addEventListener("click", (e) => {
  // ✅ Ignore clicks inside any Flatpickr calendar
  if (e.target.closest(".flatpickr-calendar")) {
    return;
  }

  // ✅ Only close when clicking outside the modal content (the overlay)
  if (e.target.classList.contains("modal")) {
    e.target.classList.add("hidden");
    document.body.classList.remove("modal-open");
  }
});

// ------------------------------
// Default load
// ------------------------------
loadSection("rooms");
