function isValidUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("try-form");
  const input = document.getElementById("site-url");
  const result = document.getElementById("try-result");

  if (!form || !input || !result) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const value = String(input.value || "").trim();
    if (!isValidUrl(value)) {
      result.textContent = "Please enter a valid URL (starting with https://).";
      input.focus();
      return;
    }

    // Placeholder behavior: until you wire the real analyzer endpoint,
    // we provide a clear, non-blocking confirmation message.
    result.textContent = `Got it. You entered: ${value} — connect your analyzer endpoint to run the review.`;
  });
});


