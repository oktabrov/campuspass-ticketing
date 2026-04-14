// ===== State =====
let events = [];
let currentEventId = null;

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
    loadEvents();
    loadStatus();
    setupNav();
    setupModal();
});

// ===== Navigation =====
function setupNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            const view = btn.dataset.view;
            document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
            document.getElementById("view-" + view).classList.add("active");

            if (view === "bookings") loadBookings();
            if (view === "events") loadEvents();
        });
    });
}

// ===== Events =====
async function loadEvents() {
    try {
        const resp = await fetch("/api/events");
        events = await resp.json();
        renderEvents();
    } catch (e) {
        document.getElementById("events-grid").innerHTML =
            '<div class="loading-placeholder">Could not load events</div>';
    }
}

function renderEvents() {
    const grid = document.getElementById("events-grid");

    if (!events.length) {
        grid.innerHTML = '<div class="loading-placeholder">No events available</div>';
        return;
    }

    grid.innerHTML = events.map(ev => {
        const tiersHtml = Object.entries(ev.tiers).map(([tid, t]) => {
            const priceStr = t.price === 0
                ? '<span class="tier-price free">Free</span>'
                : `<span class="tier-price">$${t.price.toFixed(2)}</span>`;

            let remainClass = "";
            let remainText = `${t.remaining} left`;
            if (t.remaining === 0) {
                remainClass = "out";
                remainText = "Sold out";
            } else if (t.remaining <= 5) {
                remainClass = "low";
            }

            return `
                <div class="tier-row">
                    <span class="tier-name">${t.name}</span>
                    <span class="tier-info">
                        ${priceStr}
                        <span class="tier-remaining ${remainClass}">${remainText}</span>
                    </span>
                </div>`;
        }).join("");

        const allSoldOut = Object.values(ev.tiers).every(t => t.remaining === 0);

        let buttonHtml;
        if (!ev.bookings_enabled) {
            buttonHtml = '<button class="book-btn not-available" disabled>Booking not available</button>';
        } else if (allSoldOut) {
            buttonHtml = '<button class="book-btn" disabled>Sold Out</button>';
        } else {
            buttonHtml = `<button class="book-btn" onclick="openBooking('${ev.id}')">Book Tickets</button>`;
        }

        return `
            <div class="event-card">
                <div class="event-card-header">
                    <h2>${ev.name}</h2>
                    <div class="event-meta">
                        <span>📅 ${ev.date}</span>
                        <span>📍 ${ev.location}</span>
                    </div>
                    <p class="event-description">${ev.description}</p>
                </div>
                <div class="tier-list">${tiersHtml}</div>
                <div class="event-card-footer">${buttonHtml}</div>
            </div>`;
    }).join("");
}

// ===== Booking Modal =====
function setupModal() {
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("booking-modal").addEventListener("click", (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
}

function openBooking(eventId) {
    currentEventId = eventId;
    const ev = events.find(e => e.id === eventId);
    if (!ev) return;

    const tierOptions = Object.entries(ev.tiers)
        .filter(([, t]) => t.remaining > 0)
        .map(([tid, t]) => {
            const priceLabel = t.price === 0 ? "Free" : `$${t.price.toFixed(2)}`;
            return `<option value="${tid}">${t.name} — ${priceLabel} (${t.remaining} left)</option>`;
        }).join("");

    document.getElementById("modal-content").innerHTML = `
        <h2>${ev.name}</h2>
        <p class="subtitle">${ev.date} · ${ev.location}</p>
        <form id="booking-form" onsubmit="submitBooking(event)">
            <div class="form-group">
                <label for="email">Email Address</label>
                <input type="email" id="email" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
                <label for="tier">Ticket Type</label>
                <select id="tier" required>${tierOptions}</select>
            </div>
            <div class="form-group">
                <label for="quantity">Quantity</label>
                <input type="number" id="quantity" value="1" min="1" max="10" required>
            </div>
            <div class="form-group">
                <label for="payment_token">Payment Token</label>
                <input type="text" id="payment_token" placeholder="tok_valid_xxxx" value="tok_valid_1234">
            </div>
            <button type="submit" class="submit-btn" id="submit-btn">Confirm Booking</button>
        </form>
        <div id="booking-result"></div>
    `;

    document.getElementById("booking-modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("booking-modal").style.display = "none";
    currentEventId = null;
}

async function submitBooking(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-btn");
    btn.disabled = true;
    btn.textContent = "Processing...";

    const data = {
        email: document.getElementById("email").value,
        tier_name: document.getElementById("tier").value,
        quantity: document.getElementById("quantity").value,
        payment_token: document.getElementById("payment_token").value,
    };

    try {
        const resp = await fetch(`/api/events/${currentEventId}/book`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });

        const result = await resp.json();
        const resultDiv = document.getElementById("booking-result");

        if (resp.ok && result.success) {
            resultDiv.innerHTML = `
                <div class="result-message success">
                    ✅ ${result.message}
                </div>`;
            // Refresh events to update remaining counts
            setTimeout(() => {
                loadEvents();
            }, 500);
        } else {
            let detailsHtml = "";
            const detailKeys = ["event_name", "tier_name", "requested", "remaining",
                                "email", "field", "value", "reason", "deficit",
                                "gateway_name", "reference"];

            const foundDetails = detailKeys.filter(k => result[k] !== undefined);
            if (foundDetails.length > 0) {
                detailsHtml = '<dl class="error-details">' +
                    foundDetails.map(k =>
                        `<dt>${k.replace(/_/g, " ")}:</dt><dd>${result[k]}</dd>`
                    ).join("") + "</dl>";
            }

            let causedByHtml = "";
            if (result.caused_by) {
                causedByHtml = `
                    <div class="caused-by">
                        ⛓️ Caused by: <strong>${result.caused_by.error_type}</strong> — ${result.caused_by.error}
                    </div>`;
            }

            resultDiv.innerHTML = `
                <div class="result-message error">
                    ❌ ${result.error}
                    <div class="error-type">${result.error_type || "Error"}</div>
                    ${detailsHtml}
                    ${causedByHtml}
                </div>`;
        }
    } catch (err) {
        document.getElementById("booking-result").innerHTML = `
            <div class="result-message error">
                ❌ Network error — is the server running?
            </div>`;
    }

    btn.disabled = false;
    btn.textContent = "Confirm Booking";
}

// ===== Bookings =====
async function loadBookings() {
    try {
        const resp = await fetch("/api/bookings");
        const bookings = await resp.json();
        const container = document.getElementById("bookings-list");

        if (!bookings.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📋</span>
                    <p>No bookings yet. Go book some events!</p>
                </div>`;
            return;
        }

        container.innerHTML = bookings.map(b => `
            <div class="booking-card">
                <div class="booking-info">
                    <h3>${b.event_name || b.event_id}</h3>
                    <p>${b.email} · ${b.quantity}× ${b.tier}</p>
                </div>
                <span class="booking-badge">Confirmed</span>
            </div>
        `).join("");
    } catch (e) {
        // Silently fail — bookings tab shows empty state
    }
}

// ===== Module Status =====
async function loadStatus() {
    try {
        const resp = await fetch("/api/status");
        const status = await resp.json();
        const container = document.getElementById("module-status");

        const modules = [
            ["exceptions.py", status.exceptions],
            ["models.py", status.models],
            ["validators.py", status.validators],
            ["gateway.py", status.gateway],
            ["services.py", status.services],
        ];

        container.innerHTML = modules.map(([name, ok]) =>
            `<span class="status-item">
                <span class="status-dot ${ok ? 'ok' : 'pending'}"></span>
                ${name}
            </span>`
        ).join("");
    } catch (e) {
        // Footer status is non-critical
    }
}
