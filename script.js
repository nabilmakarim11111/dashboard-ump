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
  if (sectionId === "dashboard-section" && !chart) {
    updateChart(document.getElementById("year").value);
  } else if (sectionId === "trend-analysis-section" && (!trendChart || !provinceSelect.value)) {
    // Hanya update trend chart jika belum ada atau jika provinsi belum terpilih
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
    updateChart("2024");

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
      if (nilai && nilai !== "-") {
        provinceTrends[provinsi][year] = parseInt(String(nilai).replace(/,/g, ""));
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

  const excludedProvincesIfBefore2024 = [
    "Papua Barat Daya", "Papua Selatan", "Papua Tengah", "Papua Pegunungan"
  ];

  const labels = [];
  const values = [];
  const valuesForComparison = [];
  const labelsForComparison = [];

  for (const [provinsi, nilai] of Object.entries(data)) {
    if (!nilai || nilai === "-") continue;
    const numericValue = parseInt(String(nilai).replace(/,/g, ""));
    if (!isNaN(numericValue)) {
      labels.push(provinsi);
      values.push(numericValue);
      const isDOB = excludedProvincesIfBefore2024.includes(provinsi);
      if (year === "2024" || !isDOB) {
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
      maintainAspectRatio: false, // Penting untuk responsivitas dalam tata letak baru
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const provinsi = context.label;
              const nilaiSekarang = context.parsed.y;
              const prevYear = (parseInt(year) - 1).toString();
              const prevValueRaw = umpData[prevYear]?.[provinsi];

              if (typeof prevValueRaw !== 'string' || prevValueRaw === "-") {
                return `Rp${nilaiSekarang.toLocaleString("id-ID")} (Data pembanding tidak tersedia)`;
              }

              const nilaiLalu = parseInt(prevValueRaw.replace(/,/g, ""));
              
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
  const trendData = provinceTrends[provinsi];
  if (!trendData) {
    console.error(`Data tren untuk ${provinsi} tidak ditemukan.`);
    aiExplanationDiv.innerHTML = `<p class="error-text">Data tren untuk ${provinsi} tidak ditemukan.</p>`;
    return;
  }

  const labels = Object.keys(trendData).sort();
  const values = labels.map(year => trendData[year]);

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
      maintainAspectRatio: false, // Penting untuk responsivitas dalam tata letak baru
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

  generateTrendExplanation(provinsi, trendData);
}

async function generateTrendExplanation(provinsi, trendData) {
  aiExplanationDiv.innerHTML = '<p class="loading-text">AI sedang menganalisis tren UMP...</p>';

  const trendArray = Object.entries(trendData)
    .sort(([yearA], [yearB]) => parseInt(yearA) - parseInt(yearB))
    .map(([year, value]) => `${year}: Rp${value.toLocaleString("id-ID")}`);

  const prompt = `Berikan analisis singkat dan informatif (maksimal 150 kata) mengenai tren Upah Minimum Provinsi (UMP) untuk ${provinsi} berdasarkan data berikut:\n\n${trendArray.join('\n')}\n\nSertakan poin-poin penting seperti kenaikan/penurunan signifikan, periode stagnasi, dan pertumbuhan keseluruhan. Gunakan bahasa yang mudah dipahami.`;

  try {
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
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
