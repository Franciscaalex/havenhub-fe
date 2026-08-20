console.log("app.js is connected");

fetch("header.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("header-placeholder").innerHTML = data;
  });


fetch("footer.html")
  .then(res => res.text())
  .then(data => {
    document.getElementById("footer-placeholder").innerHTML = data;
  });



function loginUser(username) {
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("username", username);
}

function logoutUser() {
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("username");
}

function isUserLoggedIn() {
  return localStorage.getItem("isLoggedIn") === "true";
}

function getCurrentUsername() {
  return localStorage.getItem("username");
}