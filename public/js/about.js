// 🏨 Load About Page Content from Database
async function loadAboutContent() {
  try {
    const response = await fetch("/about");
    const data = await response.json();
    const container = document.getElementById("aboutSection");

    if (!data.length) {
      container.innerHTML = "<p style='color:white;'>⚠️ No about content available.</p>";
      return;
    }

    container.innerHTML = data
      .map(
        (item) => `
          <div class="about-container">
            <h2>${item.section_title}</h2>
            <p>${item.content}</p>
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("❌ Error fetching about data:", error);
    document.getElementById("aboutSection").innerHTML =
      "<p style='color:white;'>⚠️ Unable to load about content. Please try again later.</p>";
  }
}

// 🚀 Load about content when page loads
loadAboutContent();
