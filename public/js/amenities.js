// ===== LOAD OUTDOOR AMENITIES =====
async function loadOutdoorAmenities() {
  const container = document.getElementById("outdoorAmenities");
  container.innerHTML = `<p class="loading-text">Loading outdoor amenities...</p>`;

  try {
    const res = await fetch("/outdoor-amenities");
    if (!res.ok) throw new Error("Failed to fetch outdoor amenities");
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<p>No outdoor amenities available.</p>`;
      return;
    }

    // ✅ Render outdoor amenities
    container.innerHTML = data
      .map(
        (a) => `
        <div class="amenity-card">
          <img 
            src="${a.icon_url || 'images/default-amenity.jpg'}" 
            alt="${a.amenity_name || 'Amenity'}" />
          <h4>${a.amenity_name || "Unnamed Amenity"}</h4>
          <p>${a.description || "No description available."}</p>
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("❌ Outdoor amenities error:", err);
    container.innerHTML = `<p>⚠️ Unable to load outdoor amenities. Please try again later.</p>`;
  }
}

// ===== LOAD INDOOR AMENITIES (UNIQUE BY NAME) =====
async function loadIndoorAmenities() {
  const container = document.getElementById("indoorAmenities");
  container.innerHTML = `<p class="loading-text">Loading indoor amenities...</p>`;

  try {
    const res = await fetch("/indoor-amenities");
    if (!res.ok) throw new Error("Failed to fetch indoor amenities");
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<p>No indoor amenities available.</p>`;
      return;
    }

    // ✅ Filter out duplicates by amenity_name
    const uniqueAmenities = Array.from(
      new Map(data.map((item) => [item.amenity_name, item])).values()
    );

    // ✅ Render only unique indoor amenities
    container.innerHTML = uniqueAmenities
      .map(
        (a) => `
        <div class="amenity-card">
          <img 
            src="${a.icon_url || 'images/default-amenity.jpg'}" 
            alt="${a.amenity_name || 'Amenity'}" />
          <h4>${a.amenity_name || "Unnamed Amenity"}</h4>
          <p>${a.description || "No description available."}</p>
        </div>
      `
      )
      .join("");
  } catch (err) {
    console.error("❌ Indoor amenities error:", err);
    container.innerHTML = `<p>⚠️ Unable to load indoor amenities. Please try again later.</p>`;
  }
}

// ===== INITIALIZE =====
document.addEventListener("DOMContentLoaded", () => {
  loadOutdoorAmenities();
  loadIndoorAmenities();
});

// ===== ENSURE AUTH CHECK (Login/Logout Buttons) =====
document.addEventListener("DOMContentLoaded", () => {
  loadOutdoorAmenities();
  loadIndoorAmenities();

  // ✅ Wait until auth-check.js is loaded, then re-run handleAuthButtons
  if (typeof handleAuthButtons === "function") {
    handleAuthButtons(); // Reinitialize login/logout visibility + events
  }
});
