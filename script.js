let chart;
let trendChart;
let umpData = {};
let provinceTrends = {};

const chartCanvas = document.getElementById("umpChart");
const provinceSelect = document.getElementById("province-select");
const trendChartCanvas = document.getElementById("trendChart");
const aiExplanationDiv = document.getElementById("ai-explanation");
const chartDescriptionParagraph = document.getElementById("chart-description");


// Elemen-elemen navigasi dan konten
const navButtons = document.querySelectorAll(".nav-button");
const dashboardSection = document.getElementById("dashboard-section");
const trendAnalysisSection = document.getElementById("trend-analysis-section");

/**
 * Helper function to parse UMP values, handling both numbers and formatted strings.
 * @param {any} value The raw UMP value from data.json.
 * @returns {number|null} The parsed numeric value, or null if invalid.
 */
function parseUmpValue(value) {
    if (typeof value === 'number') {
        return value; // If it's already a number, return it
    }
    if (typeof value === 'string') {
        // Remove all non-digit characters except for a single decimal point if needed
        // Assuming UMP is an integer, so remove all dots and commas.
        const cleanedValue = value.replace(/\./g, '').replace(/,/g, '');
        const parsed = parseInt(cleanedValue);
        return isNaN(parsed) ? null : parsed;
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

        // **NEW: Load cached trends from localStorage**
        const cachedTrends = localStorage.getItem('provinceTrendsCache');
        if (cachedTrends) {
            provinceTrends = JSON.parse(cachedTrends);
            console.log("Loaded province trends from cache.");
        } else {
            processDataForTrends(umpData);
            console.log("Processed province trends from data.json.");
        }

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
                provinceTrends[provinsi] = {
                    umpValues: {} // Store UMP values here
                };
            }
            const nilai = data[year][provinsi];
            const numericValue = parseUmpValue(nilai);
            if (numericValue !== null) {
                provinceTrends[provinsi].umpValues[year] = numericValue;
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

    // Update the chart description based on the selected year
    let baseDescription = `Grafik ini perbandingan UMP provinsi di Indonesia pada tahun <span id="selected-year">${year}</span>. Arahkan kursor ke batang grafik untuk melihat detail kenaikan dari tahun sebelumnya.`;

    const excludedProvincesIfBefore2024 = [
        "Papua Barat Daya", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"
    ];

    const excludedProvincesFor2016 = [
        "Jawa Tengah", "Jawa Timur", "DI Yogyakarta"
    ];

    if (year === "2016") {
        baseDescription += `<br><br><strong>Catatan:</strong> Pada tahun ${year}, Jawa Tengah, Jawa Timur, dan DI Yogyakarta tidak mengeluarkan UMP untuk daerah mereka, sehingga dikecualikan dari perhitungan nilai terendah.`;
    }
    
    // Add the general note for years before 2024
    if (parseInt(year) < 2024) {
        baseDescription += `<br><br><strong>Catatan Umum:</strong> Sebelum tahun 2024, empat provinsi baru (Papua Barat Daya, Papua Selatan, Papua Tengah, dan Papua Pegunungan) belum terbentuk dan oleh karena itu tidak termasuk dalam data UMP tahun tersebut.`;
    }


    chartDescriptionParagraph.innerHTML = baseDescription;


    const labels = [];
    const values = [];
    const valuesForComparison = [];
    const labelsForComparison = [];

    for (const [provinsi, nilai] of Object.entries(data)) {
        const numericValue = parseUmpValue(nilai); // Gunakan helper function di sini juga

        if (numericValue !== null) { // Pastikan nilai numerik valid
            labels.push(provinsi);
            values.push(numericValue);

            // Apply specific exclusions for comparison
            const isDOB = excludedProvincesIfBefore2024.includes(provinsi);
            const is2016Excluded = (year === "2016" && excludedProvincesFor2016.includes(provinsi));

            if ((year === "2024" || !isDOB) && !is2016Excluded) {
                labelsForComparison.push(provinsi);
                valuesForComparison.push(numericValue);
            }
        }
    }

    const maxVal = Math.max(...valuesForComparison);
    const minVal = Math.min(...valuesForComparison);
    const maxProv = labelsForComparison[valuesForComparison.indexOf(maxVal)];
    const minProv = labelsForComparison[valuesForComparison.indexOf(minVal)];

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

                            if (nilaiLalu === null) { // Jika nilaiLalu tidak dapat di-parse atau tidak ada
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data pembanding tidak tersedia)`;
                            }

                            if(nilaiLalu === 0) {
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data sebelumnya Rp0)`;
                            }

                            const kenaikan = ((nilaiSekarang - nilaiLalu) / nilaiLalu) * 100;
                            const persen = kenaikan.toFixed(2);
                            return `Rp${nilaiSekarang.toLocaleString("id-ID")} (↑ ${persen}%)`;
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
    const currentProvinceTrendData = provinceTrends[provinsi];
    if (!currentProvinceTrendData || !currentProvinceTrendData.umpValues) {
        console.error(`Data tren untuk ${provinsi} tidak ditemukan.`);
        aiExplanationDiv.innerHTML = `<p class="error-text">Data tren untuk ${provinsi} tidak ditemukan.</p>`;
        return;
    }

    const trendValues = currentProvinceTrendData.umpValues; // Get the UMP values for this province
    const labels = Object.keys(trendValues).sort();
    const values = labels.map(year => trendValues[year]);

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

                            if (index === 0) {
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")}`;
                            }

                            const nilaiLalu = context.dataset.data[index - 1];

                            if (nilaiLalu === 0) {
                                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data sebelumnya Rp0)`;
                            }

                            const kenaikan = ((nilaiSekarang - nilaiLalu) / nilaiLalu) * 100;
                            const persen = kenaikan.toFixed(2);

                            return `Rp${nilaiSekarang.toLocaleString("id-ID")} (↑ ${persen}%)`;
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

    // **NEW: Check if AI explanation is cached**
    if (currentProvinceTrendData.aiExplanation) {
        console.log(`Loading AI explanation for ${provinsi} from cache.`);
        aiExplanationDiv.innerHTML = `<p>${currentProvinceTrendData.aiExplanation}</p>`;
    } else {
        console.log(`Generating AI explanation for ${provinsi}...`);
        generateTrendExplanation(provinsi, trendValues); // Pass only the UMP values for the prompt
    }
}

async function generateTrendExplanation(provinsi, trendValues) { // Renamed parameter to trendValues
    aiExplanationDiv.innerHTML = '<p class="loading-text">Harap tunggu...</p>';

    const trendArray = Object.entries(trendValues) // Use trendValues here
        .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
        .map(([year, value]) => `${year}: Rp${value.toLocaleString("id-ID")}`);

    const prompt = `Berikan analisis singkat dan informatif (maksimal 150 kata) mengenai tren Upah Minimum Provinsi (UMP) untuk ${provinsi} berdasarkan data berikut:\n\n${trendArray.join('\n')}\n\nSertakan poin-poin penting seperti kenaikan/penurunan signifikan, periode stagnasi, dan pertumbuhan keseluruhan. Gunakan bahasa yang mudah dipahami.`;

    try {
        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = { contents: chatHistory };
        // In a real application, consider using a backend to handle API calls to keep API keys secure.
        const apiKey = "AIzaSyCua_9rl4iYQCw0HWN0A_9Ik5KSktM44b8"; // **REMINDER: Use your actual API key and ensure it's secure in production!**
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

            // **NEW: Save the generated explanation to provinceTrends**
            provinceTrends[provinsi].aiExplanation = text;
            // **NEW: Persist provinceTrends to localStorage**
            localStorage.setItem('provinceTrendsCache', JSON.stringify(provinceTrends));
            console.log(`AI explanation for ${provinsi} saved to cache.`);

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