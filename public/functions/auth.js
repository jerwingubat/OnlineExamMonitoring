document.addEventListener('DOMContentLoaded', function () {
     function handleSignup() {
        const fullname = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const adminCode = document.getElementById('admin-code').value;
        const isAdmin = !!adminCode;

        if (password !== confirmPassword) {
            alert("Passwords don't match!");
            return;
        }

        if (!document.getElementById('terms').checked) {
            alert("You must agree to the terms!");
            return;
        }

        firebase.auth().createUserWithEmailAndPassword(email, password)
            .then((userCredential) => {
                const user = userCredential.user;

                return firebase.database().ref('users/' + user.uid).set({
                    fullname: fullname,
                    email: email,
                    username: username,
                    isAdmin: isAdmin,
                    adminCodeUsed: isAdmin ? adminCode : null,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
            })
            .then(() => {
                alert("Account created successfully!");
                window.location.href = "/index.html";
            })
            .catch((error) => {
                const errorCode = error.code;
                const errorMessage = error.message;
                alert(errorMessage);
            });
    }


    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleSignup();
        });
    }
});

document.addEventListener('DOMContentLoaded', function () {
    if (typeof firebase === 'undefined') {
        console.error("Firebase not loaded");
        return;
    }

    const loginForm = document.getElementById('loginForm');

    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleLogin();
        });
    }
});

function handleLogin() {
    const email = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const rememberMe = document.getElementById('remember').checked;

    const persistence = rememberMe ?
        firebase.auth.Auth.Persistence.LOCAL :
        firebase.auth.Auth.Persistence.SESSION;

    firebase.auth().setPersistence(persistence)
        .then(() => {
            return firebase.auth().signInWithEmailAndPassword(email, password);
        })
        .then((userCredential) => {
            const user = userCredential.user;

            return firebase.database().ref('users/' + user.uid).once('value')
                .then((snapshot) => {
                    const userData = snapshot.val();
                    if (userData && userData.isAdmin) {
                        window.location.href = "/admin.html";
                    } else {
                        window.location.href = `/home.html?uid=${user.uid}`;
                    }
                });
        })
        .catch((error) => {
            const errorCode = error.code;
            const errorMessage = error.message;
            alert(getFriendlyErrorMessage(errorCode));
        });
}

function getFriendlyErrorMessage(errorCode) {
    switch (errorCode) {
        case 'auth/invalid-email':
            return "Please enter a valid email address.";
        case 'auth/user-disabled':
            return "This account has been disabled.";
        case 'auth/user-not-found':
            return "No account found with this email.";
        case 'auth/wrong-password':
            return "Incorrect password. Please try again.";
        case 'auth/too-many-requests':
            return "Too many attempts. Please try again later.";
        default:
            return "Login failed. Please try again.";
    }
}

// Check authentication state
firebase.auth().onAuthStateChanged(function(user) {
    if (user) {
        console.log('User is signed in:', user.email);
    } else {
        console.log('No user is signed in');
        if (!window.location.pathname.includes('index.html') && 
            !window.location.pathname.includes('signup.html')) {
            window.location.href = '/index.html';
        }
    }
});

function signOut() {
    firebase.auth().signOut().then(() => {

        window.location.href = '/index.html';
    }).catch((error) => {
        console.error('Sign out error:', error);
    });
}

