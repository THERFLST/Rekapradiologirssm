(() => {
  'use strict';

  // This is a client-side access gate, not server-side authentication.
  // Credentials are visible to anyone who can inspect this public site's source.
  const USERNAME = 'Radiologi';
  const PASSWORD = 'petugas123';
  const SESSION_KEY = 'radiologi-auth-session';

  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('loginUsername');
  const passwordInput = document.getElementById('loginPassword');
  const errorMessage = document.getElementById('loginError');
  const logoutButton = document.getElementById('logoutButton');

  function unlock() {
    document.body.classList.remove('app-locked');
    document.getElementById('loginScreen').hidden = true;
  }

  function lock() {
    sessionStorage.removeItem(SESSION_KEY);
    document.body.classList.add('app-locked');
    document.getElementById('loginScreen').hidden = false;
    form.reset();
    errorMessage.textContent = '';
    usernameInput.focus();
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (usernameInput.value.trim() !== USERNAME || passwordInput.value !== PASSWORD) {
      errorMessage.textContent = 'Username atau password tidak sesuai.';
      passwordInput.select();
      return;
    }

    sessionStorage.setItem(SESSION_KEY, 'authenticated');
    errorMessage.textContent = '';
    unlock();
  });

  logoutButton.addEventListener('click', lock);

  if (sessionStorage.getItem(SESSION_KEY) === 'authenticated') {
    unlock();
  } else {
    document.getElementById('loginScreen').hidden = false;
  }
})();
