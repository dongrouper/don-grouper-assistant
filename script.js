const defaultClientId = '1548318813790019634';
const invitePermissions = '84992';
const clientIdInput = document.getElementById('clientId');
const configForm = document.getElementById('configForm');
const configStatus = document.getElementById('configStatus');
const inviteButton = document.getElementById('inviteButton');
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.getElementById('mobileMenu');
const menuClose = document.querySelector('.menu-close');

function setMenuState(isOpen) {
    mobileMenu.classList.toggle('is-open', isOpen);
    mobileMenu.setAttribute('aria-hidden', String(!isOpen));
    menuToggle.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('menu-open', isOpen);
}

menuToggle.addEventListener('click', () => setMenuState(true));
menuClose.addEventListener('click', () => setMenuState(false));
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setMenuState(false)));
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
});

function buildInviteUrl(clientId) {
    const params = new URLSearchParams({ client_id: clientId, scope: 'bot applications.commands', permissions: invitePermissions });
    return `https://discord.com/oauth2/authorize?${params}`;
}

function setInviteLink(clientId) {
    const inviteUrl = buildInviteUrl(clientId);
    inviteButton.href = inviteUrl;
    inviteButton.removeAttribute('aria-disabled');
}

clientIdInput.value = localStorage.getItem('discordClientId') || defaultClientId;
setInviteLink(clientIdInput.value);

configForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const clientId = clientIdInput.value.trim();
    if (!/^\d{17,20}$/.test(clientId)) {
        configStatus.textContent = 'Application ID harus berupa 17-20 angka.';
        configStatus.className = 'form-status is-error';
        return;
    }
    localStorage.setItem('discordClientId', clientId);
    setInviteLink(clientId);
    configStatus.textContent = 'Link invite siap. Klik tombol di atas untuk melanjutkan ke Discord.';
    configStatus.className = 'form-status is-success';
    inviteButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

clientIdInput.addEventListener('input', () => {
    configStatus.textContent = '';
    configStatus.className = 'form-status';
});