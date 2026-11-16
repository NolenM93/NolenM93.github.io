(function () {
  var btn = document.getElementById("menu-btn");
  var links = document.getElementById("nav-links");
  if (!btn || !links) return;

  btn.addEventListener("click", function () {
    var open = links.classList.toggle("is-open");
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });

  links.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      links.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
    });
  });
})();
