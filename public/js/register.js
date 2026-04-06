    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('username').value;
      const email = document.getElementById('email').value;
      const pass = document.getElementById('password').value;
      
      const btn = document.getElementById('submit-btn');
      const errBox = document.getElementById('error-box');
      
      errBox.style.display = 'none';
      btn.disabled = true;
      btn.textContent = 'Creating...';

      try {
        const res = await STATAC_AUTH.register(user, email, pass);
        if (res.token) {
          window.location.href = 'statac.html';
        } else {
          throw new Error(res.error || 'Registration failed');
        }
      } catch (err) {
        errBox.textContent = err.message;
        errBox.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Join STATAC';
      }
    });
