    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      const btn = document.getElementById('submit-btn');
      const errBox = document.getElementById('error-box');
      
      errBox.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Authenticating...';

      try {
        const res = await STATAC_AUTH.login(email, pass);
        if (res.token) {
          window.location.href = 'statac.html';
        } else {
          throw new Error(res.error || 'Login failed');
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Continue';
      }
    });
