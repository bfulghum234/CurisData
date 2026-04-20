// Get all checkboxes and display elements
const checkboxes = document.querySelectorAll('input[type="checkbox"]');
const selectedCountElement = document.getElementById('selected-count');
const totalPriceElement = document.getElementById('total-price');
const checkoutButton = document.getElementById('checkout-btn');

// Sample data for each dataset type
const sampleData = {
    clinics: [
        { name: "Riverside Family Clinic", address: "1245 Oak Street, Austin, TX 78701", physicians: 8, hours: "Mon-Fri 8AM-6PM" },
        { name: "Summit Health Center", address: "3890 Pine Avenue, Houston, TX 77002", physicians: 12, hours: "Mon-Sat 7AM-8PM" },
        { name: "Parkview Medical Group", address: "567 Maple Drive, Dallas, TX 75201", physicians: 15, hours: "Mon-Fri 9AM-5PM" },
        { name: "Lakeside Wellness Clinic", address: "2134 Elm Boulevard, San Antonio, TX 78205", physicians: 6, hours: "Tue-Sat 10AM-7PM" },
        { name: "Downtown Primary Care", address: "789 Main Street, Fort Worth, TX 76102", physicians: 10, hours: "Mon-Fri 8AM-6PM" }
    ],
    physicians: [
        { name: "Dr. Sarah Johnson", address: "456 Medical Plaza, Austin, TX 78702", physicians: 1, hours: "Mon-Thu 9AM-4PM" },
        { name: "Dr. Michael Chen", address: "901 Healthcare Way, Houston, TX 77003", physicians: 1, hours: "Mon-Fri 8AM-5PM" },
        { name: "Dr. Emily Rodriguez", address: "234 Wellness Court, Dallas, TX 75202", physicians: 1, hours: "Tue-Sat 10AM-6PM" },
        { name: "Dr. James Williams", address: "678 Provider Lane, San Antonio, TX 78206", physicians: 1, hours: "Mon-Wed-Fri 9AM-3PM" },
        { name: "Dr. Lisa Anderson", address: "345 Doctor Drive, Fort Worth, TX 76103", physicians: 1, hours: "Mon-Fri 7AM-4PM" }
    ],
    hospitals: [
        { name: "Memorial Regional Hospital", address: "1500 Hospital Parkway, Austin, TX 78703", physicians: 250, hours: "24/7" },
        { name: "Texas General Medical Center", address: "2800 Health Boulevard, Houston, TX 77004", physicians: 400, hours: "24/7" },
        { name: "St. Mary's Hospital", address: "1100 Medical Center Drive, Dallas, TX 75203", physicians: 320, hours: "24/7" },
        { name: "Citywide Medical Center", address: "4500 Emergency Lane, San Antonio, TX 78207", physicians: 180, hours: "24/7" },
        { name: "North Texas Healthcare", address: "890 Hospital Road, Fort Worth, TX 76104", physicians: 275, hours: "24/7" }
    ],
    urgent_care: [
        { name: "QuickCare Urgent Care", address: "555 Urgent Way, Austin, TX 78704", physicians: 4, hours: "Daily 8AM-10PM" },
        { name: "FastMed Express", address: "777 Rapid Street, Houston, TX 77005", physicians: 5, hours: "Daily 7AM-11PM" },
        { name: "Immediate Health Services", address: "222 Quick Avenue, Dallas, TX 75204", physicians: 6, hours: "Mon-Sun 9AM-9PM" },
        { name: "Emergency Plus Clinic", address: "999 Prompt Road, San Antonio, TX 78208", physicians: 3, hours: "Daily 8AM-8PM" },
        { name: "Rapid Response Care", address: "333 Speedy Lane, Fort Worth, TX 76105", physicians: 4, hours: "Mon-Fri 7AM-9PM, Sat-Sun 9AM-6PM" }
    ]
};

function updateSummary() {
    if (!selectedCountElement || !totalPriceElement || !checkoutButton) return;

    let selectedCount = 0;
    let totalPrice = 0;

    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            selectedCount++;
            totalPrice += parseInt(checkbox.getAttribute('data-price'), 10) || 0;
        }
    });

    selectedCountElement.textContent = selectedCount;
    totalPriceElement.textContent = '$' + totalPrice;
    checkoutButton.disabled = selectedCount === 0;
}

function showSampleModal(dataset) {
    const data = sampleData[dataset];

    if (!data) {
        console.error('No sample data found for:', dataset);
        return;
    }

    const displayName = dataset.replace('_', ' ').split(' ')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    let tableHTML = `
        <div class="modal-overlay" onclick="closeModal()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <span class="close-btn" onclick="closeModal()">&times;</span>
                <h2>Sample Data: ${displayName}</h2>
                <table class="sample-table">
                    <thead>
                        <tr>
                            <th>Practice Name</th>
                            <th>Practice Address</th>
                            <th>Nbr Physicians</th>
                            <th>Hours</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    data.forEach((row) => {
        tableHTML += `
            <tr>
                <td>${row.name}</td>
                <td>${row.address}</td>
                <td>${row.physicians}</td>
                <td>${row.hours}</td>
            </tr>
        `;
    });

    tableHTML += `
                    </tbody>
                </table>
            </div>
        </div>
    `;

    closeModal();
    document.body.insertAdjacentHTML('beforeend', tableHTML);
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) modal.remove();
}

function handleCheckoutClick() {
    const selectedDatasets = [];

    checkboxes.forEach((checkbox) => {
        if (checkbox.checked) {
            const row = checkbox.closest('tr');
            if (!row) return;
            const datasetName = row.querySelector('td:nth-child(2)')?.textContent || 'Dataset';
            const price = checkbox.getAttribute('data-price') || '0';
            selectedDatasets.push({ name: datasetName, price });
        }
    });

    if (!selectedDatasets.length) return;

    let message = 'You selected:\n\n';
    let total = 0;

    selectedDatasets.forEach((dataset) => {
        message += `${dataset.name} - $${dataset.price}\n`;
        total += parseInt(dataset.price, 10) || 0;
    });

    message += `\nTotal: $${total}`;
    alert(message);
}

function initHealthDataPage() {
    checkboxes.forEach((checkbox) => {
        checkbox.addEventListener('change', updateSummary);
    });

    if (checkoutButton) {
        checkoutButton.addEventListener('click', handleCheckoutClick);
    }

    // Event delegation makes sample links work even if rows are re-rendered later.
    document.addEventListener('click', (event) => {
        const link = event.target.closest('.sample-link');
        if (!link) return;

        event.preventDefault();
        const dataset = link.getAttribute('data-dataset');
        showSampleModal(dataset);
    });

    updateSummary();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHealthDataPage);
} else {
    initHealthDataPage();
}

// Expose modal controls for inline onclick handlers in generated HTML.
window.showSampleModal = showSampleModal;
window.closeModal = closeModal;
