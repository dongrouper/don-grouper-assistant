// Data film disimpan di array
let films = [];

// Ambil elemen DOM
const filmForm = document.getElementById('filmForm');
const judulInput = document.getElementById('judul');
const tahunInput = document.getElementById('tahun');
const genreInput = document.getElementById('genre');
const ratingInput = document.getElementById('rating');
const ratingValue = document.getElementById('ratingValue');
const filmList = document.getElementById('filmList');
const emptyMessage = document.getElementById('emptyMessage');
const totalFilm = document.getElementById('totalFilm');
const avgRating = document.getElementById('avgRating');

// Update tampilan nilai rating saat slider digeser
ratingInput.addEventListener('input', function() {
    ratingValue.textContent = this.value;
});

// Load data dari localStorage saat halaman dibuka
function loadFilms() {
    const saved = localStorage.getItem('films');
    if (saved) {
        films = JSON.parse(saved);
    }
    renderFilms();
}

// Simpan data ke localStorage
function saveFilms() {
    localStorage.setItem('films', JSON.stringify(films));
}

// Tentukan warna rating
function getRatingClass(rating) {
    if (rating >= 8) return 'rating-high';
    if (rating >= 5) return 'rating-mid';
    return 'rating-low';
}

// Buat bintang berdasarkan rating
function getStars(rating) {
    const stars = Math.round(rating / 2); // Konversi 1-10 ke 1-5 bintang
    return '⭐'.repeat(stars);
}

// Tampilkan daftar film
function renderFilms() {
    filmList.innerHTML = '';

    if (films.length === 0) {
        emptyMessage.style.display = 'block';
        totalFilm.textContent = 'Total: 0 film';
        avgRating.textContent = 'Rata-rata: -';
        return;
    }

    emptyMessage.style.display = 'none';

    films.forEach((film, index) => {
        const filmItem = document.createElement('div');
        filmItem.className = 'film-item';
        filmItem.innerHTML = `
            <div class="film-info">
                <div class="film-title">${escapeHtml(film.judul)}</div>
                <div class="film-meta">
                    <span>📅 ${film.tahun}</span>
                    <span class="genre-tag">${escapeHtml(film.genre)}</span>
                </div>
            </div>
            <div class="film-rating">
                <div class="rating-number ${getRatingClass(film.rating)}">${film.rating}</div>
                <div class="rating-stars">${getStars(film.rating)}</div>
            </div>
            <button class="btn-delete" onclick="deleteFilm(${index})" title="Hapus">🗑️</button>
        `;
        filmList.appendChild(filmItem);
    });

    updateStats();
}

// Update statistik
function updateStats() {
    totalFilm.textContent = `Total: ${films.length} film`;
    if (films.length > 0) {
        const total = films.reduce((sum, f) => sum + Number(f.rating), 0);
        const avg = (total / films.length).toFixed(1);
        avgRating.textContent = `Rata-rata: ${avg}/10`;
    } else {
        avgRating.textContent = 'Rata-rata: -';
    }
}

// Hapus film
function deleteFilm(index) {
    if (confirm('Yakin ingin menghapus film ini?')) {
        films.splice(index, 1);
        saveFilms();
        renderFilms();
    }
}

// Escape HTML untuk keamanan
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle submit form
filmForm.addEventListener('submit', function(e) {
    e.preventDefault();

    const newFilm = {
        judul: judulInput.value.trim(),
        tahun: tahunInput.value,
        genre: genreInput.value,
        rating: ratingInput.value
    };

    films.push(newFilm);
    saveFilms();
    renderFilms();

    // Reset form
    filmForm.reset();
    ratingInput.value = 5;
    ratingValue.textContent = '5';

    // Fokus ke input judul lagi
    judulInput.focus();
});

// Jalankan saat halaman dimuat
loadFilms();