const loginModeButton = document.getElementById('loginModeButton');
const registerModeButton = document.getElementById('registerModeButton');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginUsernameInput = document.getElementById('loginUsername');
const loginPasswordInput = document.getElementById('loginPassword');
const registerUsernameInput = document.getElementById('registerUsername');
const firstNameInput = document.getElementById('firstName');
const lastNameInput = document.getElementById('lastName');
const registerPasswordInput = document.getElementById('registerPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const loginStatus = document.getElementById('loginStatus');
const registerStatus = document.getElementById('registerStatus');

const apiUrls = ['http://localhost:4000', 'http://127.0.0.1:4000'];
const localUsersKey = 'wavehub.users';
const sessionKey = 'wavehub.session';
const validUsernamePattern = /^[a-z0-9_-]+$/;

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function setMode(mode) {
  const isLogin = mode === 'login';

  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  loginModeButton.classList.toggle('active', isLogin);
  registerModeButton.classList.toggle('active', !isLogin);
  loginModeButton.setAttribute('aria-selected', String(isLogin));
  registerModeButton.setAttribute('aria-selected', String(!isLogin));
  setStatus(loginStatus, '', '');
  setStatus(registerStatus, '', '');

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('mode', mode);
  window.history.replaceState({}, '', nextUrl);

  window.setTimeout(() => {
    (isLogin ? loginUsernameInput : registerUsernameInput).focus();
  }, 0);
}

function setStatus(element, type, message) {
  element.textContent = message;
  element.classList.toggle('error', type === 'error');
  element.classList.toggle('success', type === 'success');
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function postToAuth(path, payload) {
  for (const apiUrl of apiUrls) {
    try {
      const response = await fetchWithTimeout(`${apiUrl}/auth/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
        return { ok: false, error: data?.error || message || 'Server error.' };
      }

      return { ok: true, data };
    } catch (err) {
      console.warn(`Auth API ${path} is unavailable:`, err);
    }
  }

  return { ok: false, offline: true };
}

function cachePublicUser(user) {
  const users = readJson(localUsersKey, []);
  const nextUser = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    createdAt: user.createdAt || new Date().toISOString(),
  };
  const nextUsers = users.some((storedUser) => storedUser.username === user.username)
    ? users.map((storedUser) => (storedUser.username === user.username ? { ...storedUser, ...nextUser } : storedUser))
    : [...users, nextUser];

  writeJson(localUsersKey, nextUsers);
  return nextUser;
}

function purgeStoredCredentials() {
  const users = readJson(localUsersKey, []);
  if (!Array.isArray(users)) return;

  const sanitized = users.map(({ password, passwordHash, ...publicUser }) => publicUser);
  writeJson(localUsersKey, sanitized);
}

function saveSession(user) {
  writeJson(sessionKey, {
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    loggedInAt: new Date().toISOString(),
  });
}

function returnToHome() {
  window.setTimeout(() => {
    window.location.href = 'index.html';
  }, 300);
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(registerStatus, '', '');

  const payload = {
    username: registerUsernameInput.value.trim().toLowerCase(),
    firstName: firstNameInput.value.trim(),
    lastName: lastNameInput.value.trim(),
    password: registerPasswordInput.value,
  };
  const confirmPassword = confirmPasswordInput.value;

  if (!payload.username || !payload.firstName || !payload.lastName || !payload.password || !confirmPassword) {
    setStatus(registerStatus, 'error', 'Please fill every field.');
    return;
  }

  if (!validUsernamePattern.test(payload.username)) {
    setStatus(registerStatus, 'error', 'Username can use lowercase letters, numbers, _ and - only.');
    return;
  }

  if (payload.password.length < 6) {
    setStatus(registerStatus, 'error', 'Password must be at least 6 characters.');
    return;
  }

  if (payload.password !== confirmPassword) {
    setStatus(registerStatus, 'error', 'Passwords do not match.');
    return;
  }

  const serverResult = await postToAuth('register', payload);

  if (!serverResult.ok) {
    setStatus(
      registerStatus,
      'error',
      serverResult.offline ? 'Registration server is unavailable. Please try again later.' : serverResult.error || 'Registration failed.'
    );
    return;
  }

  const savedUser = cachePublicUser(serverResult.data.user);
  saveSession(savedUser);
  setStatus(registerStatus, 'success', 'Account created. Redirecting...');
  returnToHome();
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  setStatus(loginStatus, '', '');

  const username = loginUsernameInput.value.trim().toLowerCase();
  const password = loginPasswordInput.value;

  if (!username || !password) {
    setStatus(loginStatus, 'error', 'Please enter username and password.');
    return;
  }

  const serverResult = await postToAuth('login', { username, password });

  if (serverResult.ok && serverResult.data?.user) {
    const savedUser = cachePublicUser(serverResult.data.user);
    saveSession(savedUser);
    setStatus(loginStatus, 'success', 'Logged in. Redirecting...');
    returnToHome();
    return;
  }

  setStatus(
    loginStatus,
    'error',
    serverResult.offline ? 'Login server is unavailable. Please try again later.' : serverResult.error || 'Username or password is incorrect.'
  );
});

[loginUsernameInput, registerUsernameInput].forEach((input) => {
  input.addEventListener('input', () => {
    input.value = input.value.toLowerCase();
  });
});

loginModeButton.addEventListener('click', () => setMode('login'));
registerModeButton.addEventListener('click', () => setMode('register'));

const initialMode = new URLSearchParams(window.location.search).get('mode') === 'register' ? 'register' : 'login';
purgeStoredCredentials();
setMode(initialMode);
