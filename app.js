(() => {
  'use strict';

  const DEMO_USERS = Object.freeze({
    admin: { password: 'admin123', role: 'Admin' },
    petugas: { password: 'petugas123', role: 'Petugas' }
  });

  const byId = (id) => document.getElementById(id);
  const loginForm = byId('loginForm');
  const loginOverlay = byId('loginOverlay');
  const mainApp = byId('mainApp');
  const usernameInput = byId('usernameInput');
  const passwordInput = byId('passwordInput');
  const logoutButton = byId('logoutBtn');

  if (!loginForm || !loginOverlay || !mainApp || !usernameInput || !passwordInput) {
    console.error('Elemen login tidak ditemukan. Periksa kembali struktur index.html.');
    return;
  }

  // Jangan mengisi password secara otomatis; minta pengguna memasukkannya sendiri.
  usernameInput.value = usernameInput.value || 'admin';
  passwordInput.value = '';
  usernameInput.autocomplete = 'username';
  passwordInput.autocomplete = 'current-password';
  usernameInput.required = true;
  passwordInput.required = true;

  let message = byId('loginMessage');
  if (!message) {
    message = document.createElement('p');
    message.id = 'loginMessage';
    message.setAttribute('role', 'alert');
    message.setAttribute('aria-live', 'polite');
    message.style.cssText = 'min-height:1.4em;margin:8px 0;color:#b42318;font-size:13px;font-weight:600;';
    const submitButton = loginForm.querySelector('button[type="submit"]');
    loginForm.insertBefore(message, submitButton || null);
  }

  function showApp(user) {
    loginOverlay.classList.add('hidden');
    mainApp.classList.remove('hidden');
    const name = byId('currentUserName');
    const role = byId('currentUserRole');
    if (name) name.textContent = user.username;
    if (role) role.textContent = user.role;
    sessionStorage.setItem('rekapRadiologiDemoUser', JSON.stringify(user));
    message.textContent = '';
    passwordInput.value = '';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function showLogin() {
    sessionStorage.removeItem('rekapRadiologiDemoUser');
    mainApp.classList.add('hidden');
    loginOverlay.classList.remove('hidden');
    passwordInput.value = '';
    message.textContent = '';
    usernameInput.focus();
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const account = DEMO_USERS[username];

    if (!account || password !== account.password) {
      message.textContent = 'Username atau password salah. Periksa kembali akun demo yang digunakan.';
      passwordInput.value = '';
      passwordInput.focus();
      return;
    }

    showApp({ username, role: account.role });
  });

  if (logoutButton) logoutButton.addEventListener('click', showLogin);

  // Pulihkan sesi tab ini saja, tanpa menyimpan password.
  try {
    const savedUser = JSON.parse(sessionStorage.getItem('rekapRadiologiDemoUser') || 'null');
    if (savedUser && DEMO_USERS[savedUser.username] && savedUser.role === DEMO_USERS[savedUser.username].role) {
      showApp(savedUser);
    }
  } catch (error) {
    sessionStorage.removeItem('rekapRadiologiDemoUser');
  }
})();
