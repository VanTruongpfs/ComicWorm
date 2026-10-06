/**
 * Admin Login - mock authentication.
 * Tài khoản demo: admin@bookmooch.vn / manager@bookmooch.vn (mật khẩu bất kỳ >= 6 ký tự)
 */
(function () {
    const form = document.getElementById('adminLoginForm');
    const errorBox = document.getElementById('gateError');
    const errorText = document.getElementById('gateErrorText');
    const submitBtn = document.getElementById('gateSubmitBtn');
    const pwInput = document.getElementById('adminPassword');
    const toggleBtn = document.getElementById('togglePw');

    toggleBtn.addEventListener('click', () => {
        const isPw = pwInput.type === 'password';
        pwInput.type = isPw ? 'text' : 'password';
        toggleBtn.querySelector('.material-symbols-outlined').textContent = isPw ? 'visibility_off' : 'visibility';
    });

    const demoAccounts = {
        'admin@bookmooch.vn': { role: 'ADMIN', name: 'Nguyễn Minh Admin' },
        'manager@bookmooch.vn': { role: 'MANAGER', name: 'Trần Thị Quản Lý' },
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('adminEmail').value.trim().toLowerCase();
        const password = pwInput.value;
        errorBox.classList.remove('show');

        if (!email || !password || password.length < 6) {
            showFormError('Vui lòng nhập email và mật khẩu tối thiểu 6 ký tự.');
            return;
        }

        submitBtn.classList.add('btn-loading');
        submitBtn.disabled = true;

        setTimeout(() => {
            const account = demoAccounts[email];
            submitBtn.classList.remove('btn-loading');
            submitBtn.disabled = false;

            if (!account) {
                showFormError('Email hoặc mật khẩu không chính xác. Dùng admin@bookmooch.vn hoặc manager@bookmooch.vn để demo.');
                return;
            }

            completeLogin(account.role, account.name);
        }, 900);
    });

    function showFormError(msg) {
        errorText.textContent = msg;
        errorBox.classList.add('show');
        form.closest('.gate-card').classList.add('shake-error');
        setTimeout(() => form.closest('.gate-card').classList.remove('shake-error'), 400);
    }

    function completeLogin(role, name) {
        localStorage.setItem('bm_admin_session', 'true');
        localStorage.setItem('bm_admin_role', role === 'ADMIN' ? 'Super Admin' : 'Manager');
        localStorage.setItem('bm_admin_name', name);
        showToast(`Đăng nhập thành công, xin chào ${name}!`, 'success');
        setTimeout(() => { window.location.href = 'dashboard.html'; }, 700);
    }

    window.quickLogin = function (role) {
        const account = role === 'ADMIN'
            ? { role: 'ADMIN', name: 'Nguyễn Minh Admin' }
            : { role: 'MANAGER', name: 'Trần Thị Quản Lý' };
        completeLogin(account.role, account.name);
    };
})();