// 🧠 Role-based access control for admin pages
document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));

  // 1️⃣ Not logged in at all
  if (!user) {
    alert("You must log in as an admin to access this page.");
    window.location.href = "/login-page";
    return;
  }

  // 2️⃣ Logged in but not admin
  if (user.role !== "admin") {
    alert("Access denied. Admin privileges required.");
    window.location.href = "/home-page";
    return;
  }

  // 3️⃣ Logged in as admin ✅
  console.log(`✅ Admin verified: ${user.fullname}`);
});
