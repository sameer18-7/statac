/* ═══════════════════════════════════════════════════════════
   STATAC — Auth Controller (Frontend)
   Handles API connection, JWT storage, and UI state tweaks.
   ═══════════════════════════════════════════════════════════ */

const STATAC_AUTH = {
  getToken: () => localStorage.getItem('statac_token'),
  getUser: () => JSON.parse(localStorage.getItem('statac_user') || 'null'),
  
  setSession: (token, user) => {
    localStorage.setItem('statac_token', token);
    localStorage.setItem('statac_user', JSON.stringify(user));
  },

  clearSession: () => {
    localStorage.removeItem('statac_token');
    localStorage.removeItem('statac_user');
    window.location.reload();
  },

  register: async (username, email, password) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      STATAC_AUTH.setSession(data.token, data.user);
    }
    return data;
  },

  login: async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok && data.token) {
      STATAC_AUTH.setSession(data.token, data.user);
    }
    return data;
  },

  // Updates global Navbar across all pages
  applyUIState: () => {
    const user = STATAC_AUTH.getUser();
    const ctas = document.querySelectorAll('.nav-cta');

    if (user) {
      // User is logged in
      ctas.forEach(cta => {
        if (cta.tagName === 'A') {
          cta.textContent = `WELCOME, ${user.username.toUpperCase()}`;
          cta.href = '#';
        } else {
          cta.textContent = `WELCOME, ${user.username.toUpperCase()}`;
        }
        
        // Convert to a dropdown or logout action
        cta.title = "Click to Logout";
        cta.onclick = (e) => {
          e.preventDefault();
          if (confirm('Are you sure you want to log out?')) {
            STATAC_AUTH.clearSession();
          }
        };
      });
    } else {
      // User is logged out
      ctas.forEach(cta => {
        cta.textContent = 'PRO ACCESS';
        if (cta.tagName === 'A') {
          cta.href = 'login.html';
        } else {
          cta.onclick = () => window.location.href = 'login.html';
        }
      });
    }
  }
};

// Auto-apply state on any page that includes this script
document.addEventListener('DOMContentLoaded', STATAC_AUTH.applyUIState);
