async function updateApiStatus() {
    const statusNode = document.getElementById("api-status");

    if (!statusNode) {
        return;
    }

    try {
        const response = await fetch("/api/health");

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        statusNode.textContent = `API online: ${data.status} (${data.runtime})`;
    } catch (error) {
        statusNode.textContent = "API not reachable in static-only mode yet. Run Wrangler locally or deploy to Pages to enable Functions.";
        console.error("Health check failed", error);
    }
}

updateApiStatus();
