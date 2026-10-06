document.addEventListener("DOMContentLoaded", async () => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    try {
        const response = await fetch("../../shared/footer/footer.html");
        if (!response.ok) return;
        footer.outerHTML = await response.text();
    } catch {
        // Keep the page-specific footer as a local fallback when opened directly.
    }
});
