document.addEventListener('DOMContentLoaded', () => {

  //  SPA VIEW TOGGLE LOGIC
  const loginView = document.getElementById('loginView');
  const signupView = document.getElementById('signupView');
  const switchToSignup = document.getElementById('switchToSignup');
  const switchToLogin = document.getElementById('switchToLogin');

  if (switchToSignup && switchToLogin) {
    switchToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      loginView?.classList.remove('active-view');
      signupView?.classList.add('active-view');
    });

    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      signupView?.classList.remove('active-view');
      loginView?.classList.add('active-view');
    });
  }

//  PASSWORD VISIBILITY TOGGLE
  
  const togglePasswordImgs = document.querySelectorAll('.toggle-password-img');

  togglePasswordImgs.forEach(img => {
    img.addEventListener('click', () => {
      const targetId = img.getAttribute('data-target');
      const input = document.getElementById(targetId);

      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        img.src = isPassword ? 'Eye.png' : 'EyeClosed.png';
      }
    });
  });

  // 3. LOGIN FORM VALIDATION

  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const emailInput = document.getElementById('loginEmail');
      const passwordInput = document.getElementById('loginPassword');

      let isValid = true;

      // Email Validation
      if (emailInput) {
        const emailValue = emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailValue === '') {
          showError(emailInput, 'Email address is required');
          isValid = false;
        } else if (!emailRegex.test(emailValue)) {
          showError(emailInput, 'Incorrect email address');
          isValid = false;
        } else {
          setValid(emailInput);
        }
      }

      // Password Validation
      if (!passwordInput || passwordInput.value.trim() === '') {
        if (passwordInput) showError(passwordInput, 'Password is required');
        isValid = false;
      } else {
        setValid(passwordInput);
      }

      if (isValid) {
        const payload = {
          email: emailInput.value.trim(),
          password: passwordInput.value.trim()
        };

        if (typeof sendDataToApi === 'function') {
          sendDataToApi(payload);
        } else {
          console.log('Login Data:', payload);
        }
      }
    });
  }



  // 4. SIGNUP FORM VALIDATION
  
  const signupForm = document.getElementById('signupForm');

  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const firstName = document.getElementById('firstName');
      const lastName = document.getElementById('lastName');
      const email = document.getElementById('signupEmail');
      const password = document.getElementById('signupPassword');
      const terms = document.getElementById('terms');

      let isValid = true;

      // First Name
      if (!firstName || firstName.value.trim() === '') {
        if (firstName) showError(firstName, 'First name is required');
        isValid = false;
      } else {
        setValid(firstName);
      }

      // Last Name
      if (!lastName || lastName.value.trim() === '') {
        if (lastName) showError(lastName, 'Last name is required');
        isValid = false;
      } else {
        setValid(lastName);
      }

      // Email
      if (email) {
        const emailValue = email.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailValue === '') {
          showError(email, 'Email address is required');
          isValid = false;
        } else if (!emailRegex.test(emailValue)) {
          showError(email, 'Incorrect email');
          isValid = false;
        } else {
          setValid(email);
        }
      }

      // Password
      if (!password || password.value.trim() === '') {
        if (password) showError(password, 'Password is required');
        isValid = false;
      } else {
        setValid(password);
      }

      // Terms Checkbox
      const termsGroup = terms ? terms.closest('.terms-group') : null;
      if (!terms || !terms.checked) {
        if (termsGroup) termsGroup.classList.add('has-error');
        isValid = false;
      } else if (termsGroup) {
        termsGroup.classList.remove('has-error');
      }

      if (isValid) {
        const payload = {
          firstName: firstName.value.trim(),
          lastName: lastName.value.trim(),
          email: email.value.trim(),
          password: password.value.trim()
        };

        if (typeof sendDataToApi === 'function') {
          sendDataToApi(payload);
        } else {
          console.log('Signup Data:', payload);
        }
      }
    });
  }

});



// 5. HELPER FUNCTIONS

function showError(inputElement, message) {
  inputElement.classList.remove('is-valid');
  inputElement.classList.add('is-invalid');
  
  const formGroup = inputElement.closest('.form-group');
  if (formGroup) {
    formGroup.classList.add('has-error');
    const errorTarget = formGroup.querySelector('.error-message') || formGroup.querySelector('.error-text');
    if (errorTarget && message) {
      errorTarget.textContent = message;
    }
  }
}

function setValid(inputElement) {
  inputElement.classList.remove('is-invalid');
  inputElement.classList.add('is-valid');
  
  const formGroup = inputElement.closest('.form-group');
  if (formGroup) {
    formGroup.classList.remove('has-error');
  }
}
