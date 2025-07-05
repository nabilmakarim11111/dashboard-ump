let chart;
let trendChart;
let umpData = {};
let provinceTrends = {};

const chartCanvas = document.getElementById("umpChart");
const provinceSelect = document.getElementById("province-select");
const trendChartCanvas = document.getElementById("trendChart");
const aiExplanationDiv = document.getElementById("ai-explanation");

// Elemen-elemen navigasi dan konten
const navButtons = document.querySelectorAll(".nav-button");
const dashboardSection = document.getElementById("dashboard-section");
const trendAnalysisSection = document.getElementById("trend-analysis-section");

/**
 * Helper function to parse UMP values, handling both numbers and formatted strings.
 * It will return 0 if the parsed value is 0, otherwise the numeric value or null if invalid.
 * @param {any} value The raw UMP value from data.json.
 * @returns {number|null} The parsed numeric value, 0, or null if invalid.
 */
function parseUmpValue(value) {
    if (typeof value === 'number') {
        return value; // If it's already a number, return it (0 is allowed here)
    }
    if (typeof value === 'string') {
        // Remove all non-digit characters except for a single decimal point if needed
        // Assuming UMP is an integer, so remove all dots and commas.
        const cleanedValue = value.replace(/\./g, '').replace(/,/g, '');
        const parsed = parseInt(cleanedValue);
        return isNaN(parsed) ? null : parsed; // Return 0 if it's 0, null if NaN
    }
    return null;
}


/**
 * Menampilkan bagian konten yang dipilih dan menyembunyikan yang lain.
 * @param {string} sectionId ID dari bagian konten yang akan ditampilkan.
 */
function showSection(sectionId) {
    // Sembunyikan semua bagian konten
    document.querySelectorAll(".content-section").forEach(section => {
        section.classList.remove("active");
    });

    // Tampilkan bagian konten yang dipilih
    document.getElementById(sectionId).classList.add("active");

    // Perbarui status 'active' pada tombol navigasi
    navButtons.forEach(button => {
        if (button.dataset.section === sectionId) {
            button.classList.add("active");
        } else {
            button.classList.remove("active");
        }
    });

    // Memastikan grafik diinisialisasi ulang atau di-render ulang
    // Ini penting karena Chart.js mungkin mengalami masalah rendering saat elemen disembunyikan/ditampilkan
    if (sectionId === "dashboard-section") {
        updateChart(document.getElementById("year").value);
    } else if (sectionId === "trend-analysis-section" && (!trendChart || !provinceSelect.value)) {
        // Only update trend chart if it doesn't exist or no province is selected
        if (provinceSelect.options.length > 0) {
            updateTrendChart(provinceSelect.value);
        }
    }
}

async function fetchData() {
    try {
        const response = await fetch("data.json");
        if (!response.ok) throw new Error("Gagal memuat data.json");
        umpData = await response.json();

        processDataForTrends(umpData);
        populateProvinceDropdown();

        // Inisialisasi chart utama saat data dimuat (untuk section dashboard)
        updateChart("2024"); // Tahun default saat pertama kali dimuat

        // Inisialisasi trend chart jika ada provinsi yang dipilih (untuk section trend analysis)
        if (provinceSelect.options.length > 0) {
            updateTrendChart(provinceSelect.value);
        }

        // Tampilkan bagian dashboard secara default setelah data dimuat
        showSection("dashboard-section");

    } catch (error) {
        console.error("Fetch error:", error);
        aiExplanationDiv.innerHTML = `<p class="error-text">Gagal memuat data UMP. Pastikan data.json ada dan benar.</p>`;
        // Tampilkan pesan error di kedua bagian jika terjadi kesalahan fatal
        dashboardSection.innerHTML = `<p class="error-text">Gagal memuat data UMP. Pastikan data.json ada dan benar.</p>`;
        trendAnalysisSection.innerHTML = `<p class="error-text">Gagal memuat data UMP. Pastikan data.json ada dan benar.</p>`;
    }
}

function processDataForTrends(data) {
    provinceTrends = {};
    for (const year in data) {
        for (const provinsi in data[year]) {
            if (!provinceTrends[provinsi]) {
                provinceTrends[provinsi] = {};
            }
            const nilai = data[year][provinsi];
            const numericValue = parseUmpValue(nilai); // Gunakan helper function
            if (numericValue !== null) { // Check if parsing was successful (0 is allowed here)
                provinceTrends[provinsi][year] = numericValue;
            }
        }
    }
}

function populateProvinceDropdown() {
    const provinceNames = Object.keys(provinceTrends).sort();

    provinceSelect.innerHTML = '';
    provinceNames.forEach(provinsi => {
        const option = document.createElement('option');
        option.value = provinsi;
        option.innerText = provinsi;
        provinceSelect.appendChild(option);
    });
}

function updateChart(year) {
    const data = umpData[year];
    if (!data) return;

    // Perbarui teks tahun pada deskripsi chart setiap kali fungsi dipanggil
    const selectedYearSpan = document.getElementById("selected-year");
    if (selectedYearSpan) {
        selectedYearSpan.textContent = year;
    }

    const excludedProvincesIfBefore2024 = [
        "Papua Barat Daya", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"
    ];

    const labels = [];
    const values = [];
    const valuesForComparison = []; // This will include 0 if present
    const labelsForComparison = [];

    for (const [provinsi, nilai] of Object.entries(data)) {
        const numericValue = parseUmpValue(nilai); // Gunakan helper function di sini juga

        if (numericValue !== null) { // Pastikan nilai numerik valid (null, but 0 is allowed)
            labels.push(provinsi);
            values.push(numericValue);
            const isDOB = excludedProvincesIfBefore2024.includes(provinsi);
            if (year === "2024" || !isDOB) {
                labelsForComparison.push(provinsi);
                valuesForComparison.push(numericValue);
            }
        }
    }

    // Filter out 0 values for min/max calculation, but keep them for display
    const validValuesForMinMax = valuesForComparison.filter(val => val > 0);

    let maxVal = 0;
    let minVal = 0;
    let maxProv = "N/A";
    let minProv = "N/A";

    if (validValuesForMinMax.length > 0) {
        maxVal = Math.max(...validValuesForMinMax);
        minVal = Math.min(...validValuesForMinMax);

        // Find the corresponding province names for max and min values
        maxProv = labelsForComparison[valuesForComparison.indexOf(maxVal)];
        minProv = labelsForComparison[valuesForComparison.indexOf(minVal)];
    } else {
         // Handle case where no valid (non-zero) UMP data is available for comparison
        document.getElementById("highest").innerText = `Data tidak tersedia`;
        document.getElementById("lowest").innerText = `Data tidak tersedia`;
        if (chart) chart.destroy();
        return;
    }

    document.getElementById("highest").innerText = `${maxProv} - Rp${maxVal.toLocaleString("id-ID")}`;
    document.getElementById("lowest").innerText = `${minProv} - Rp${minVal.toLocaleString("id-ID")}`;

    if (chart) chart.destroy();

    chart = new Chart(chartCanvas, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [{
                label: `UMP Tahun ${year}`,
                data: values,
                backgroundColor: "rgba(54, 162, 235, 0.6)",
                borderColor: "rgba(54, 162, 235, 1)",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const provinsi = context.label;
                            const nilaiSekarang = context.parsed.y;
                            const prevYear = (parseInt(year) - 1).toString();
                            const prevValueRaw = umpData[prevYear]?.[provinsi];
                            
                            const nilaiLalu = parseUmpValue(prevValueRaw); // Gunakan helper function

                            if (nilaiLalu === null || nilaiLalu === 0) { // Jika nilaiLalu tidak dapat di-parse, tidak ada, atau 0
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data pembanding tidak tersedia)`;
                            }

                            const kenaikan = ((nilaiSekarang - nilaiLalu) / nilaiLalu) * 100;
                            const persen = kenaikan.toFixed(2);
                            return `Rp${nilaiSekarang.toLocaleString("id-ID")} (${kenaikan >= 0 ? '↑' : '↓'} ${persen}%)`;
                        }
                    }
                },
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: value => "Rp" + value.toLocaleString("id-ID") }
                },
                x: {
                    barPercentage: 0.8,
                    categoryPercentage: 0.8
                }
            }
        }
    });
}

function updateTrendChart(provinsi) {
    const trendData = provinceTrends[provinsi];
    if (!trendData) {
        console.error(`Data tren untuk ${provinsi} tidak ditemukan.`);
        aiExplanationDiv.innerHTML = `<p class="error-text">Data tren untuk ${provinsi} tidak ditemukan.</p>`;
        if (trendChart) trendChart.destroy(); // Destroy previous chart if no data
        return;
    }

    const labels = Object.keys(trendData).sort();
    const values = labels.map(year => trendData[year]);

    // Ensure there are at least two data points to show a trend and calculate percentage change
    // If only one or zero points, still display the chart but with limited tooltip info
    if (values.length < 1) {
         aiExplanationDiv.innerHTML = `<p class="info-text">Tidak ada data untuk menampilkan tren ${provinsi}.</p>`;
         if (trendChart) trendChart.destroy();
         return;
    }


    if (trendChart) trendChart.destroy();

    trendChart = new Chart(trendChartCanvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Tren UMP ${provinsi}`,
                data: values,
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Tren UMP Provinsi ${provinsi}`
                },
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const index = context.dataIndex;
                            const nilaiSekarang = context.parsed.y;

                            if (index === 0) { // First data point has no previous value for comparison
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")}`;
                            }

                            const nilaiLalu = context.dataset.data[index - 1];

                            if (nilaiLalu === null || nilaiLalu === 0) { // Jika nilaiLalu tidak valid atau 0
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data sebelumnya tidak tersedia atau nol)`;
                            }

                            const kenaikan = ((nilaiSekarang - nilaiLalu) / nilaiLalu) * 100;
                            const persen = kenaikan.toFixed(2);

                            return `Rp${nilaiSekarang.toLocaleString("id-ID")} (${kenaikan >= 0 ? '↑' : '↓'} ${persen}%)`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: value => "Rp" + value.toLocaleString("id-ID") }
                }
            }
        }
    });

    generateTrendExplanation(provinsi, trendData);
}

async function generateTrendExplanation(provinsi, trendData) {
    aiExplanationDiv.innerHTML = '<p class="loading-text">Harap tunggu...</p>';

    const trendArray = Object.entries(trendData)
        .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
        .map(([year, value]) => `${year}: Rp${value.toLocaleString("id-ID")}`);

    const prompt = `Berikan analisis singkat dan informatif (maksimal 150 kata) mengenai tren Upah Minimum Provinsi (UMP) untuk ${provinsi} berdasarkan data berikut:\n\n${trendArray.join('\n')}\n\nSertakan poin-poin penting seperti kenaikan/penurunan signifikan, periode stagnasi, dan pertumbuhan keseluruhan. Gunakan bahasa yang mudah dipahami. Jelaskan jika ada data yang menunjukkan UMP 0 atau tidak tersedia untuk periode tertentu.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        // Use the API key provided in the original code, ensure it's correct
        const apiKey = "AIzaSyDDQNgVqXdPn0bpVqQ6dEN29eORlb_w3h0"; 
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const text = result.candidates[0].content.parts[0].text;
            aiExplanationDiv.innerHTML = `<p>${text}</p>`;
        } else {
            aiExplanationDiv.innerHTML = '<p class="error-text">Gagal mendapatkan analisis dari AI. Coba lagi nanti.</p>';
            console.error("Unexpected AI response structure:", result);
        }
    } catch (error) {
        aiExplanationDiv.innerHTML = '<p class="error-text">Terjadi kesalahan saat menghubungi AI. Periksa koneksi Anda atau coba lagi.</p>';
        console.error("Error calling AI API:", error);
    }
}

// Event Listeners
document.getElementById("year").addEventListener("change", e => {
    updateChart(e.target.value);
});

provinceSelect.addEventListener("change", (e) => {
    updateTrendChart(e.target.value);
});

// Tambahkan event listener untuk tombol navigasi
navButtons.forEach(button => {
    button.addEventListener("click", (e) => {
        e.preventDefault(); // Mencegah perilaku default link
        const sectionId = e.target.dataset.section;
        showSection(sectionId);
    });
});

fetchData();

window.addEventListener('DOMContentLoaded', async () => {
    await tsParticles.load("tsparticles", {
        background: {
            color: {
                value: "#f5f7fb",
            },
        },
        fpsLimit: 60,
        interactivity: {
            events: {
                onHover: {
                    enable: true,
                    mode: "repulse",
                },
            },
            modes: {
                repulse: {
                    distance: 100,
                    duration: 0.4,
                },
            },
        },
        particles: {
            color: {
                value: "#2b4b8b",
            },
            links: {
                color: "#2b4b8b",
                distance: 150,
                enable: true,
                opacity: 0.2,
                width: 1,
            },
            move: {
                direction: "none",
                enable: true,
                outModes: {
                    default: "bounce",
                },
                random: false,
                speed: 1,
                straight: false,
            },
            number: {
                density: {
                    enable: true,
                },
                value: 50,
            },
            opacity: {
                value: 0.3,
            },
            shape: {
                type: "circle",
            },
            size: {
                value: { min: 1, max: 5 },
            },
        },
        detectRetina: true,
    });
});