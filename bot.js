require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const Groq = require('groq-sdk');
const {
    ChannelType,
    Client,
    Collection,
    EmbedBuilder,
    Events,
    GatewayIntentBits,
    PermissionFlagsBits,
    REST,
    Routes,
    SlashCommandBuilder
} = require('discord.js');
const { commands: movieCommands, handleMovieFeature, handleButton } = require('./movie-features');

const requiredEnv = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID'];
const missingEnv = requiredEnv.filter((name) => !process.env[name]);
if (missingEnv.length > 0) {
    throw new Error(`Environment belum lengkap: ${missingEnv.join(', ')}`);
}

const dataFile = path.join(__dirname, 'films.json');
const settingsFile = path.join(__dirname, 'bot-settings.json');
const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;
const inactivityLimit = 60 * 60 * 1000;
const guildActivity = new Map();
const attentionMessages = [
    'Server terlalu tenang. Pilih satu film untuk movie night, atau biarkan saya memilihkannya.',
    'Satu jam tanpa keributan. Kita bisa memperbaikinya dengan `/trivia` atau `/card gacha`.',
    'Pertanyaan penting: film apa yang layak ditonton malam ini?',
    'Saya sudah menyiapkan popcorn secara metaforis. Ada yang mau `/random`?',
    'Keheningan ini punya potensi. Seseorang jalankan `/poll` dan mari buat keputusan.'
];
const languageInstructions = {
    indonesia: 'Jawab dalam bahasa Indonesia.',
    inggris: 'Answer in English.',
    spanyol: 'Responde en espanol.',
    jepang: '日本語で答えてください。',
    korea: '한국어로 답변하세요.',
    prancis: 'Reponds en francais.'
};
const personalityInstructions = {
    eksekutif: 'Tenang, percaya diri, tajam, persuasif, dan elegan. Gunakan humor kering seperlunya serta sudut pandang strategis.',
    ramah: 'Hangat, ramah, suportif, dan mudah diajak bicara. Buat pengguna merasa diterima.',
    formal: 'Profesional, sopan, terstruktur, dan objektif. Hindari slang dan basa-basi.',
    komedian: 'Ceria dan lucu dengan punchline ringan. Tetap informatif dan jangan mengganggu saat topiknya serius.',
    strategis: 'Analitis, tegas, dan berorientasi solusi. Sajikan pilihan, risiko, dan rekomendasi terbaik.',
    singkat: 'Sangat ringkas dan langsung ke inti. Gunakan maksimal beberapa kalimat kecuali pengguna meminta detail.',
    storyteller: 'Jelaskan dengan alur cerita yang menarik, imajinatif, dan mudah diikuti tanpa mengarang fakta.',
    guru: 'Sabar seperti pengajar yang baik. Jelaskan konsep bertahap dengan contoh sederhana.',
    gamer: 'Antusias seperti gamer, santai, dan memakai istilah gaming seperlunya tanpa berlebihan.',
    noir: 'Misterius, tenang, dan puitis dengan nuansa detektif film noir. Tetap jelas dan membantu.'
};

function loadSettings() {
    if (!fs.existsSync(settingsFile)) return {};
    try {
        return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    } catch {
        return {};
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

function getAssistantPrompt(guildId) {
    const settings = serverSettings[guildId] || {};
    const language = languageInstructions[settings.language] || languageInstructions.indonesia;
    const personality = personalityInstructions[settings.personality] || personalityInstructions.eksekutif;
    return `Kamu adalah Don Grouper Assisstant, asisten Discord untuk server film. ${personality} ${language} Jawab ringkas namun bernas, hindari klaim berlebihan, dan jangan meniru dialog karakter tertentu secara langsung.`;
}

const serverSettings = loadSettings();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
const commands = [
    new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Cek apakah Don Grouper Assisstant aktif'),
    new SlashCommandBuilder()
        .setName('bantuan')
        .setDescription('Tampilkan daftar command bot'),
    new SlashCommandBuilder()
        .setName('server')
        .setDescription('Tampilkan informasi server ini'),
    new SlashCommandBuilder()
        .setName('film')
        .setDescription('Kelola daftar film server')
        .addSubcommand((subcommand) => subcommand
            .setName('tambah')
            .setDescription('Tambahkan film ke daftar')
            .addStringOption((option) => option
                .setName('judul')
                .setDescription('Judul film')
                .setRequired(true))
            .addIntegerOption((option) => option
                .setName('tahun')
                .setDescription('Tahun rilis')
                .setMinValue(1888)
                .setMaxValue(2100)
                .setRequired(true))
            .addStringOption((option) => option
                .setName('genre')
                .setDescription('Genre film')
                .setRequired(true))
            .addIntegerOption((option) => option
                .setName('rating')
                .setDescription('Rating dari 1 sampai 10')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
            .setName('list')
            .setDescription('Tampilkan daftar film server')),
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Atur perilaku bot untuk server ini')
        .addSubcommand((subcommand) => subcommand
            .setName('status')
            .setDescription('Lihat pengaturan bot'))
        .addSubcommand((subcommand) => subcommand
            .setName('inactivity')
            .setDescription('Nyalakan atau matikan pengingat chat sepi')
            .addBooleanOption((option) => option
                .setName('aktif')
                .setDescription('Aktif atau nonaktif')
                .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
            .setName('channel')
            .setDescription('Pilih channel untuk pengingat chat sepi')
            .addChannelOption((option) => option
                .setName('channel')
                .setDescription('Channel teks tujuan')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
            .setName('bahasa')
            .setDescription('Atur bahasa jawaban bot')
            .addStringOption((option) => option
                .setName('pilihan')
                .setDescription('Bahasa jawaban')
                .addChoices(
                    { name: 'Indonesia', value: 'indonesia' },
                    { name: 'English', value: 'inggris' },
                    { name: 'Espanol', value: 'spanyol' },
                    { name: '日本語', value: 'jepang' },
                    { name: '한국어', value: 'korea' },
                    { name: 'Francais', value: 'prancis' }
                )
                .setRequired(true)))
        .addSubcommand((subcommand) => subcommand
            .setName('personality')
            .setDescription('Atur gaya bicara bot')
            .addStringOption((option) => option
                .setName('gaya')
                .setDescription('Gaya bicara bot')
                .addChoices(
                    { name: 'Eksekutif klasik', value: 'eksekutif' },
                    { name: 'Ramah', value: 'ramah' },
                    { name: 'Formal', value: 'formal' },
                    { name: 'Komedian', value: 'komedian' },
                    { name: 'Strategis', value: 'strategis' },
                    { name: 'Sangat singkat', value: 'singkat' },
                    { name: 'Storyteller', value: 'storyteller' },
                    { name: 'Guru', value: 'guru' },
                    { name: 'Gamer', value: 'gamer' },
                    { name: 'Film noir', value: 'noir' }
                )
                .setRequired(true)))
].map((command) => command.toJSON()).concat(movieCommands);

function loadFilms() {
    if (!fs.existsSync(dataFile)) {
        return [];
    }

    try {
        return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    } catch (error) {
        console.error('films.json tidak bisa dibaca:', error.message);
        return [];
    }
}

function saveFilms(films) {
    fs.writeFileSync(dataFile, JSON.stringify(films, null, 2));
}

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
        Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.DISCORD_GUILD_ID),
        { body: commands }
    );
}

function buildHelpEmbed() {
    return new EmbedBuilder()
        .setColor(0x2f80ed)
        .setTitle('Don Grouper Assisstant')
        .setDescription('Siap membantu server ini.')
        .addFields(
            { name: '/ping', value: 'Cek status bot.' },
            { name: '/server', value: 'Lihat informasi server.' },
            { name: '/film tambah', value: 'Simpan film baru ke daftar server.' },
            { name: '/film list', value: 'Lihat semua film yang tersimpan.' },
            { name: '/movie', value: 'Info film lengkap dari TMDB.' },
            { name: '/wherewatch, /trailer', value: 'Cek streaming legal dan trailer.' },
            { name: '/poll, /random, /watchlist', value: 'Movie night, rekomendasi acak, dan daftar tontonan.' },
            { name: '/rate, /trivia, /card', value: 'Review, trivia, dan koleksi kartu.' },
            { name: '/settings', value: 'Atur pengingat, bahasa, dan personality bot (moderator).' }
        );
}

client.once(Events.ClientReady, async (readyClient) => {
    try {
        await registerCommands();
    } catch (error) {
        console.error('Gagal mendaftarkan command. Pastikan bot sudah diundang ke server dan DISCORD_GUILD_ID benar.');
        console.error(error.message);
        return;
    }
    console.log(`${readyClient.user.tag} aktif di ${process.env.DISCORD_GUILD_ID}`);
    readyClient.user.setActivity('melayani Don Grouper Assisstant');
});

setInterval(async () => {
    const now = Date.now();
    for (const [guildId, activity] of guildActivity) {
        const settings = serverSettings[guildId] || {};
        if (settings.inactivityEnabled === false) continue;
        if (now - activity.lastMessageAt < inactivityLimit) continue;
        const channelId = settings.inactivityChannelId || activity.channelId;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (!channel?.isTextBased() || !channel.send) continue;
        await channel.send(attentionMessages[Math.floor(Math.random() * attentionMessages.length)]).catch((error) => {
            console.error(`Tidak bisa mengirim pengingat di guild ${guildId}:`, error.message);
        });
        activity.lastMessageAt = now;
    }
}, 60 * 1000);

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) {
        return;
    }

    guildActivity.set(message.guildId, { lastMessageAt: Date.now(), channelId: message.channelId });

    if (!client.user || !message.mentions.has(client.user)) {
        return;
    }

    const prompt = message.content
        .replace(`<@${client.user.id}>`, '')
        .replace(`<@!${client.user.id}>`, '')
        .trim();

    if (!groq) {
        await message.reply('API Groq belum dipasang. Tambahkan `GROQ_API_KEY` ke file `.env`.');
        return;
    }

    if (!prompt) {
        await message.reply('Halo! Tulis pertanyaan setelah mention aku.');
        return;
    }

    try {
        await message.channel.sendTyping();
        const response = await groq.chat.completions.create({
            model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
            messages: [
                {
                    role: 'system',
                    content: getAssistantPrompt(message.guildId)
                },
                { role: 'user', content: prompt }
            ],
            max_tokens: 500
        });
        const answer = response.choices[0]?.message?.content || 'Maaf, Groq tidak mengembalikan jawaban.';
        await message.reply(answer.slice(0, 2000));
    } catch (error) {
        console.error('Groq API error:', error.message);
        await message.reply('Maaf, Groq sedang tidak bisa menjawab. Periksa API key atau coba lagi nanti.');
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isButton()) {
        try {
            await handleButton(interaction);
        } catch (error) {
            console.error('Button feature error:', error.message);
            if (!interaction.replied) await interaction.reply({ content: 'Aksi tombol gagal diproses.', ephemeral: true });
        }
        return;
    }

    if (!interaction.isChatInputCommand()) {
        return;
    }

    if (['movie', 'wherewatch', 'trailer', 'poll', 'movieevent', 'random', 'watchlist', 'letterboxd', 'rate', 'trivia', 'card'].includes(interaction.commandName)) {
        await handleMovieFeature(interaction);
        return;
    }

    if (interaction.commandName === 'settings') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: 'Hanya moderator dengan izin Manage Server yang dapat mengubah settings.', ephemeral: true });
            return;
        }
        const settings = serverSettings[interaction.guildId] || {};
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'status') {
            const enabled = settings.inactivityEnabled !== false;
            const channel = settings.inactivityChannelId ? `<#${settings.inactivityChannelId}>` : 'channel chat terakhir';
            await interaction.reply({ content: `**Pengaturan Don Grouper Assisstant**\nPengingat chat sepi: **${enabled ? 'aktif' : 'nonaktif'}**\nChannel pengingat: ${channel}\nBahasa: **${settings.language || 'indonesia'}**\nPersonality: **${settings.personality || 'eksekutif'}**`, ephemeral: true });
            return;
        }
        if (subcommand === 'inactivity') {
            settings.inactivityEnabled = interaction.options.getBoolean('aktif');
            serverSettings[interaction.guildId] = settings;
            saveSettings(serverSettings);
            await interaction.reply(`Pengingat chat sepi sekarang **${settings.inactivityEnabled ? 'aktif' : 'nonaktif'}**.`);
            return;
        }
        if (subcommand === 'bahasa') {
            settings.language = interaction.options.getString('pilihan');
            serverSettings[interaction.guildId] = settings;
            saveSettings(serverSettings);
            await interaction.reply(`Bahasa bot diubah menjadi **${settings.language}**.`);
            return;
        }
        if (subcommand === 'personality') {
            settings.personality = interaction.options.getString('gaya');
            serverSettings[interaction.guildId] = settings;
            saveSettings(serverSettings);
            await interaction.reply(`Personality bot diubah menjadi **${settings.personality}**.`);
            return;
        }
        settings.inactivityChannelId = interaction.options.getChannel('channel').id;
        serverSettings[interaction.guildId] = settings;
        saveSettings(serverSettings);
        await interaction.reply(`Pengingat chat sepi akan dikirim ke <#${settings.inactivityChannelId}>.`);
        return;
    }

    if (interaction.commandName === 'ping') {
        await interaction.reply(`Pong! Latensi ${Date.now() - interaction.createdTimestamp} ms.`);
        return;
    }

    if (interaction.commandName === 'bantuan') {
        await interaction.reply({ embeds: [buildHelpEmbed()] });
        return;
    }

    if (interaction.commandName === 'server') {
        const { guild } = interaction;
        const owner = await guild.fetchOwner();
        const embed = new EmbedBuilder()
            .setColor(0x27ae60)
            .setTitle(guild.name)
            .addFields(
                { name: 'Pemilik', value: owner.user.tag, inline: true },
                { name: 'Member', value: String(guild.memberCount), inline: true },
                { name: 'Dibuat', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
        return;
    }

    if (interaction.commandName === 'film') {
        const subcommand = interaction.options.getSubcommand();
        const films = loadFilms();

        if (subcommand === 'tambah') {
            const film = {
                judul: interaction.options.getString('judul'),
                tahun: interaction.options.getInteger('tahun'),
                genre: interaction.options.getString('genre'),
                rating: interaction.options.getInteger('rating'),
                ditambahkanOleh: interaction.user.tag
            };
            films.push(film);
            saveFilms(films);
            await interaction.reply(`Film **${film.judul}** berhasil ditambahkan dengan rating **${film.rating}/10**.`);
            return;
        }

        if (films.length === 0) {
            await interaction.reply('Belum ada film yang tersimpan. Tambahkan dengan `/film tambah`.');
            return;
        }

        const description = films
            .slice(-10)
            .reverse()
            .map((film, index) => `**${index + 1}. ${film.judul}** (${film.tahun}) - ${film.genre}, rating ${film.rating}/10`)
            .join('\n');
        await interaction.reply({
            embeds: [new EmbedBuilder()
                .setColor(0xf2994a)
                .setTitle('Daftar Film Server')
                .setDescription(description)]
        });
    }
});

client.login(process.env.DISCORD_TOKEN);
