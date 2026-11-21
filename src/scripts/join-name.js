/* global document */
document.getElementById("newsletter").addEventListener("submit", function (event) {
  var form = event.target.elements;
  form.name.value = [form.first_name.value.trim(), form.last_name.value.trim()].filter(Boolean).join(" ");
});
