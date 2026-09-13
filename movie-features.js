const fs = require('node:fs');
const path = require('node:path');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    SlashCommandBuilder
} = require('discord.js');

const dataFile = path.join(__dirname, 'movie-data.json');
const tmdbBaseUrl = 'https://api.themoviedb.org/3';
const cards = [
    { name: 'Don Vito Corleone', movie: 'The Godfather' },
    { name: 'Ellen Ripley', movie: 'Alien' },
    { name: 'Marty McFly', movie: 'Back to the Future' },
    { name: 'The Bride', movie: 'Kill Bill: Vol. 1' },
    { name: 'Tyler Durden', movie: 'Fight Club' },
    { name: 'Clarice Starling', movie: 'The Silence of the Lambs' },
    { name: 'Indiana Jones', movie: 'Raiders of the Lost Ark' },
    { name: 'Amelie', movie: 'Amelie' }
];
const genres = {
    action: 28, adventure: 12, animation: 16, comedy: 35, crime: 80,
    drama: 18, horror: 27, romance: 10749, 'sci-fi': 878, thriller: 53
};

function loadData() {
    if (!fs.existsSync(dataFile)) {
        return { watchlists: {}, ratings: [], polls: {}, letterboxd: {}, cards: {}, trivia: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch {
        return { watchlists: {}, ratings: [], polls: {}, letterboxd: {}, cards: {}, trivia: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function requireTmdb() {
    if (!process.env.TMDB_API_TOKEN) {
        throw new Error('TMDB_API_TOKEN belum diatur');
    }
}

async function tmdb(endpoint, params = {}) {
    requireTmdb();
    const url = new URL(`${tmdbBaseUrl}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${process.env.TMDB_API_TOKEN}` }
    });
    if (!response.ok) {
        throw new Error(`TMDB ${response.status}: ${await response.text()}`);
    }
    return response.json();
}

function imageUrl(pathname) {
    return pathname ? `https://image.tmdb.org/t/p/w500${pathname}` : null;
}

async function findMovie(title, year) {
    const result = await tmdb('/search/movie', { query: title, year: year || '', language: 'id-ID' });
    return result.results?.[0];
}

function movieFields(movie) {
    const credits = movie.credits || {};
    const cast = (credits.cast || []).slice(0, 5).map((person) => person.name).join(', ') || '-';
    const directors = (credits.crew || []).filter((person) => person.job === 'Director').map((person) => person.name).join(', ') || '-';
    const runtime = movie.runtime ? `${movie.runtime} menit` : '-';
    return { cast, directors, runtime };
}

function detailEmbed(movie) {
    const { cast, directors, runtime } = movieFields(movie);
    return new EmbedBuilder()
        .setColor(0xd4a72c)
        .setTitle(`${movie.title}${movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : ''}`)
        .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
        .setDescription(movie.overview || 'Sinopsis belum tersedia.')
        .setThumbnail(imageUrl(movie.poster_path))
        .addFields(
            { name: 'Sutradara', value: directors, inline: true },
            { name: 'Durasi', value: runtime, inline: true },
            { name: 'Rating TMDB', value: `${movie.vote_average?.toFixed(1) || '-'}/10`, inline: true },
            { name: 'Pemeran', value: cast }
        )
        .setFooter({ text: 'Data: TMDB' });
}

function movieCommand(name, description) {
    return new SlashCommandBuilder().setName(name).setDescription(description);
}

const commands = [
    movieCommand('movie', 'Tampilkan informasi lengkap sebuah film')
        .addStringOption((option) => option.setName('judul').setDescription('Judul film').setRequired(true))
        .addIntegerOption((option) => option.setName('tahun').setDescription('Tahun rilis').setMinValue(1888).setMaxValue(2100)),
    movieCommand('wherewatch', 'Cek platform streaming legal sebuah film')
        .addStringOption((option) => option.setName('judul').setDescription('Judul film').setRequired(true))
        .addStringOption((option) => option.setName('negara').setDescription('Kode negara, contoh ID atau US').setMaxLength(2)),
    movieCommand('trailer', 'Cari trailer resmi sebuah film')
        .addStringOption((option) => option.setName('judul').setDescription('Judul film').setRequired(true)),
    movieCommand('poll', 'Buat voting movie night')
        .addStringOption((option) => option.setName('film1').setDescription('Pilihan film pertama').setRequired(true))
        .addStringOption((option) => option.setName('film2').setDescription('Pilihan film kedua').setRequired(true))
        .addStringOption((option) => option.setName('film3').setDescription('Pilihan film ketiga')),
    movieCommand('movieevent', 'Buat jadwal event movie night')
        .addStringOption((option) => option.setName('judul').setDescription('Nama event').setRequired(true))
        .addStringOption((option) => option.setName('waktu').setDescription('ISO waktu UTC, contoh 2026-10-01T14:00:00Z').setRequired(true))
        .addStringOption((option) => option.setName('deskripsi').setDescription('Deskripsi event'))
        .addRoleOption((option) => option.setName('role').setDescription('Role yang diberi pengingat')),
    movieCommand('random', 'Pilih film acak dari TMDB')
        .addStringOption((option) => option.setName('genre').setDescription('Contoh: sci-fi, comedy, horror'))
        .addIntegerOption((option) => option.setName('rating_min').setDescription('Rating minimum 0-10').setMinValue(0).setMaxValue(10))
        .addIntegerOption((option) => option.setName('dekade').setDescription('Contoh: 1990')),
    new SlashCommandBuilder()
        .setName('watchlist').setDescription('Kelola daftar tontonan')
        .addSubcommand((sub) => sub.setName('tambah').setDescription('Tambah film').addStringOption((o) => o.setName('judul').setDescription('Judul film').setRequired(true)).addBooleanOption((o) => o.setName('shared').setDescription('Simpan ke daftar server')))
        .addSubcommand((sub) => sub.setName('list').setDescription('Lihat daftar').addBooleanOption((o) => o.setName('shared').setDescription('Lihat daftar server')))
        .addSubcommand((sub) => sub.setName('hapus').setDescription('Hapus film').addStringOption((o) => o.setName('judul').setDescription('Judul film').setRequired(true)).addBooleanOption((o) => o.setName('shared').setDescription('Hapus dari daftar server'))),
    movieCommand('letterboxd', 'Hubungkan atau baca profil Letterboxd')
        .addSubcommand((sub) => sub.setName('set').setDescription('Simpan username Letterboxd').addStringOption((o) => o.setName('username').setDescription('Username Letterboxd').setRequired(true)))
        .addSubcommand((sub) => sub.setName('latest').setDescription('Tampilkan log terbaru')),
    movieCommand('rate', 'Beri rating film untuk server')
        .addStringOption((option) => option.setName('judul').setDescription('Judul film').setRequired(true))
        .addIntegerOption((option) => option.setName('bintang').setDescription('Nilai 1 sampai 5').setMinValue(1).setMaxValue(5).setRequired(true))
        .addStringOption((option) => option.setName('ulasan').setDescription('Ulasan singkat').setMaxLength(500).setRequired(true)),
    movieCommand('trivia', 'Main tebak film singkat'),
    movieCommand('card', 'Gacha dan koleksi kartu karakter')
        .addSubcommand((sub) => sub.setName('gacha').setDescription('Tarik satu kartu'))
        .addSubcommand((sub) => sub.setName('koleksi').setDescription('Lihat koleksi kartu'))
        .addSubcommand((sub) => sub.setName('tukar').setDescription('Tukar kartu ke user lain').addUserOption((o) => o.setName('user').setDescription('Penerima').setRequired(true)).addStringOption((o) => o.setName('kartu').setDescription('Nama kartu').setRequired(true)))
].map((command) => command.toJSON());

function streamingNames(movie, country) {
    const providers = movie['watch/providers']?.results?.[country]?.flatrate || [];
    return providers.map((provider) => provider.provider_name).join(', ');
}

async function handleMovieCommand(interaction) {
    const title = interaction.options.getString('judul');
    const movie = await findMovie(title, interaction.options.getInteger('tahun'));
    if (!movie) return interaction.reply(`Film **${title}** tidak ditemukan.`);
    const fullMovie = await tmdb(`/movie/${movie.id}`, { append_to_response: 'credits,videos,watch/providers', language: 'id-ID' });

    if (interaction.commandName === 'movie') return interaction.reply({ embeds: [detailEmbed(fullMovie)] });
    if (interaction.commandName === 'wherewatch') {
        const country = (interaction.options.getString('negara') || 'ID').toUpperCase();
        const names = streamingNames(fullMovie, country);
        return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x27ae60).setTitle(`Tempat menonton: ${fullMovie.title}`).setDescription(names ? `Tersedia secara legal di **${names}** untuk wilayah **${country}**.` : `Provider streaming legal untuk **${country}** tidak ditemukan di TMDB.`).setFooter({ text: 'Data: TMDB Watch Providers' })] });
    }
    const trailer = (fullMovie.videos?.results || []).find((video) => video.site === 'YouTube' && video.type === 'Trailer' && video.official) || (fullMovie.videos?.results || []).find((video) => video.site === 'YouTube' && video.type === 'Trailer');
    if (!trailer) return interaction.reply('Trailer resmi tidak ditemukan di TMDB.');
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe62117).setTitle(`Trailer: ${fullMovie.title}`).setURL(`https://www.youtube.com/watch?v=${trailer.key}`).setDescription(`[Tonton trailer resmi di YouTube](https://www.youtube.com/watch?v=${trailer.key})`)] });
}

async function handleRandom(interaction) {
    const genreName = interaction.options.getString('genre')?.toLowerCase();
    const params = { sort_by: 'vote_average.desc', 'vote_count.gte': 100, 'vote_average.gte': interaction.options.getInteger('rating_min') || 0 };
    if (genreName && genres[genreName]) params.with_genres = genres[genreName];
    const decade = interaction.options.getInteger('dekade');
    if (decade) { params['primary_release_date.gte'] = `${decade}-01-01`; params['primary_release_date.lte'] = `${decade + 9}-12-31`; }
    const result = await tmdb('/discover/movie', params);
    const movie = result.results[Math.floor(Math.random() * result.results.length)];
    if (!movie) return interaction.reply('Tidak ada film yang cocok dengan filter itu.');
    return interaction.reply({ content: 'Pilihan malam ini:', embeds: [detailEmbed(movie)] });
}

function listKey(interaction, shared) { return shared ? `guild:${interaction.guildId}` : `user:${interaction.user.id}`; }
async function handleWatchlist(interaction) {
    const data = loadData();
    const shared = interaction.options.getBoolean('shared') || false;
    const key = listKey(interaction, shared);
    data.watchlists[key] ||= [];
    const sub = interaction.options.getSubcommand();
    if (sub === 'tambah') { const title = interaction.options.getString('judul'); data.watchlists[key].push({ title, addedBy: interaction.user.tag }); saveData(data); return interaction.reply(`**${title}** masuk ke ${shared ? 'watchlist server' : 'watchlist pribadimu'}.`); }
    if (sub === 'hapus') { const title = interaction.options.getString('judul'); data.watchlists[key] = data.watchlists[key].filter((item) => item.title.toLowerCase() !== title.toLowerCase()); saveData(data); return interaction.reply(`**${title}** dihapus dari watchlist.`); }
    const list = data.watchlists[key]; return interaction.reply(list.length ? `**${shared ? 'Watchlist Server' : 'Watchlist Kamu'}**\n${list.map((item, index) => `${index + 1}. ${item.title}`).join('\n')}` : 'Watchlist masih kosong.');
}

async function handlePoll(interaction) {
    const options = ['film1', 'film2', 'film3'].map((name) => interaction.options.getString(name)).filter(Boolean);
    const id = `${interaction.id}`;
    const data = loadData(); data.polls[id] = { options, votes: {} }; saveData(data);
    const row = new ActionRowBuilder().addComponents(options.map((title, index) => new ButtonBuilder().setCustomId(`moviepoll:${id}:${index}`).setLabel(`${index + 1}. ${title}`.slice(0, 80)).setStyle(ButtonStyle.Primary)));
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle('Movie Night Poll').setDescription(options.map((title, index) => `${index + 1}. **${title}**`).join('\n')).setFooter({ text: 'Pilih satu film dengan tombol di bawah.' })], components: [row] });
}

async function handleButton(interaction) {
    if (interaction.customId.startsWith('moviepoll:')) {
        const [, id, index] = interaction.customId.split(':'); const data = loadData(); const poll = data.polls[id];
        if (!poll) return interaction.reply({ content: 'Poll sudah tidak tersedia.', ephemeral: true });
        poll.votes[interaction.user.id] = Number(index); saveData(data);
        const counts = poll.options.map((title, position) => `${position + 1}. **${title}**: ${Object.values(poll.votes).filter((vote) => vote === position).length} suara`).join('\n');
        return interaction.reply({ content: `Suaramu tercatat.\n${counts}`, ephemeral: true });
    }

    if (interaction.customId.startsWith('trivia:answer:')) {
        const [, , triviaId, optionIndex] = interaction.customId.split(':');
        const data = loadData();
        const trivia = data.trivia[triviaId];
        if (!trivia) return interaction.reply({ content: 'Trivia sudah tidak tersedia.', ephemeral: true });

        const selected = trivia.options[Number(optionIndex)];
        const isCorrect = selected === trivia.answer;
        return interaction.reply({
            content: isCorrect
                ? `Benar, ${interaction.user}! Jawabannya **${trivia.answer}**.`
                : `Belum tepat, ${interaction.user}. Jawaban yang benar adalah **${trivia.answer}**.`,
            ephemeral: true
        });
    }
}

async function handleCard(interaction) {
    const data = loadData(); const userId = interaction.user.id; data.cards[userId] ||= [];
    if (interaction.options.getSubcommand() === 'gacha') {
        const card = cards[Math.floor(Math.random() * cards.length)];
        const movie = await findMovie(card.movie);
        const collectedCard = { name: card.name, movie: card.movie, poster: imageUrl(movie?.poster_path) };
        data.cards[userId].push(collectedCard);
        saveData(data);
        const embed = new EmbedBuilder()
            .setColor(0xd4a72c)
            .setTitle('Kartu Baru Didapat!')
            .setDescription(`**${collectedCard.name}**\nKarakter dari **${collectedCard.movie}**`)
            .setFooter({ text: `Total koleksi: ${data.cards[userId].length} kartu` });
        if (collectedCard.poster) embed.setImage(collectedCard.poster);
        return interaction.reply({ embeds: [embed] });
    }
    if (interaction.options.getSubcommand() === 'koleksi') {
        if (!data.cards[userId].length) return interaction.reply('Koleksimu masih kosong. Gunakan `/card gacha`.');
        const collection = data.cards[userId].map((card, index) => {
            const name = typeof card === 'string' ? card : card.name;
            const movie = typeof card === 'string' ? '' : ` (${card.movie})`;
            return `${index + 1}. **${name}**${movie}`;
        }).join('\n');
        return interaction.reply(`**Koleksi kamu**\n${collection}`);
    }
    const recipient = interaction.options.getUser('user'); const cardName = interaction.options.getString('kartu');
    const position = data.cards[userId].findIndex((card) => (typeof card === 'string' ? card : card.name).toLowerCase() === cardName.toLowerCase());
    if (position < 0) return interaction.reply({ content: 'Kamu tidak memiliki kartu itu.', ephemeral: true });
    const card = data.cards[userId].splice(position, 1)[0]; data.cards[recipient.id] ||= []; data.cards[recipient.id].push(card); saveData(data);
    return interaction.reply(`${interaction.user} menukar kartu **${typeof card === 'string' ? card : card.name}** kepada ${recipient}.`);
}

async function handleLetterboxd(interaction) {
    const data = loadData(); const sub = interaction.options.getSubcommand();
    if (sub === 'set') { const username = interaction.options.getString('username').replace(/[^a-zA-Z0-9_-]/g, ''); data.letterboxd[interaction.user.id] = username; saveData(data); return interaction.reply(`Profil Letterboxd **${username}** tersimpan.`); }
    const username = data.letterboxd[interaction.user.id]; if (!username) return interaction.reply('Hubungkan profil dulu dengan `/letterboxd set username:kamu`.');
    const response = await fetch(`https://letterboxd.com/${username}/rss/`); if (!response.ok) return interaction.reply('Profil Letterboxd tidak ditemukan atau RSS tidak tersedia.');
    const xml = await response.text(); const match = xml.match(/<item>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>[\s\S]*?<link>(.*?)<\/link>/); if (!match) return interaction.reply(`Belum ada log tontonan terbaru untuk **${username}**.`);
    return interaction.reply(`Log terbaru **${username}**: [${match[1]}](${match[2]})`);
}

async function handleRate(interaction) {
    const data = loadData(); data.ratings.push({ guildId: interaction.guildId, title: interaction.options.getString('judul'), stars: interaction.options.getInteger('bintang'), review: interaction.options.getString('ulasan'), user: interaction.user.tag }); saveData(data);
    return interaction.reply(`Review **${interaction.options.getString('judul')}** tersimpan: ${'⭐'.repeat(interaction.options.getInteger('bintang'))}`);
}

async function handleTrivia(interaction) {
    const result = await tmdb('/discover/movie', {
        language: 'id-ID',
        sort_by: 'vote_average.desc',
        'vote_count.gte': 300,
        'primary_release_date.lte': new Date().toISOString().slice(0, 10),
        page: Math.floor(Math.random() * 5) + 1
    });
    const movie = result.results[Math.floor(Math.random() * result.results.length)];
    const distractors = result.results
        .filter((candidate) => candidate.id !== movie.id && candidate.title)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map((candidate) => candidate.title);
    const options = [...distractors, movie.title].sort(() => Math.random() - 0.5);
    const triviaId = interaction.id;
    const data = loadData();
    data.trivia[triviaId] = { answer: movie.title, options };
    saveData(data);
    const buttons = options.map((title, index) => new ButtonBuilder()
        .setCustomId(`trivia:answer:${triviaId}:${index}`)
        .setLabel(`${index + 1}. ${title}`.slice(0, 80))
        .setStyle(ButtonStyle.Primary));
    return interaction.reply({
        embeds: [new EmbedBuilder()
            .setColor(0x9b59b6)
            .setTitle('Tebak Film')
            .setDescription(`Petunjuk: film ini dirilis tahun **${movie.release_date?.slice(0, 4) || '?'}** dan memiliki rating **${movie.vote_average?.toFixed(1)}/10**. Pilih judul yang benar!`)
            .setImage(imageUrl(movie.backdrop_path))],
        components: [new ActionRowBuilder().addComponents(buttons)]
    });
}

async function handleMovieFeature(interaction) {
    try {
        if (['movie', 'wherewatch', 'trailer'].includes(interaction.commandName)) return await handleMovieCommand(interaction);
        if (interaction.commandName === 'random') return await handleRandom(interaction);
        if (interaction.commandName === 'watchlist') return await handleWatchlist(interaction);
        if (interaction.commandName === 'poll') return await handlePoll(interaction);
        if (interaction.commandName === 'card') return await handleCard(interaction);
        if (interaction.commandName === 'letterboxd') return await handleLetterboxd(interaction);
        if (interaction.commandName === 'rate') return await handleRate(interaction);
        if (interaction.commandName === 'trivia') return await handleTrivia(interaction);
        if (interaction.commandName === 'movieevent') {
            const start = new Date(interaction.options.getString('waktu'));
            if (Number.isNaN(start.getTime()) || start <= new Date()) return interaction.reply({ content: 'Waktu harus ISO yang valid dan berada di masa depan.', ephemeral: true });
            const event = await interaction.guild.scheduledEvents.create({ name: interaction.options.getString('judul'), scheduledStartTime: start, scheduledEndTime: new Date(start.getTime() + 3 * 60 * 60 * 1000), privacyLevel: 2, entityType: 3, entityMetadata: { location: 'Discord voice channel' }, description: interaction.options.getString('deskripsi') || 'Movie night bersama server.' });
            const role = interaction.options.getRole('role'); return interaction.reply(`${role ? `${role} ` : ''}Event movie night dibuat: ${event.url}`);
        }
    } catch (error) {
        console.error('Movie feature error:', error.message);
        return interaction.reply({ content: `Fitur gagal dijalankan: ${error.message.includes('TMDB_API_TOKEN') ? 'Tambahkan TMDB_API_TOKEN di environment.' : 'periksa konfigurasi dan coba lagi.'}`, ephemeral: true });
    }
}

module.exports = { commands, handleMovieFeature, handleButton };
