const MAX_TAB_SWITCHES = 5;
const SUSPENSION_DURATION_MS = 60 * 60 * 1000;
let fullscreenAttempts = 0;
const MAX_FULLSCREEN_ATTEMPTS = 5;
let tabSwitchDetected = false;

document.addEventListener('DOMContentLoaded', async function() {

    const suspendedUntil = localStorage.getItem('suspendedUntil');
    if (suspendedUntil && Date.now() < parseInt(suspendedUntil)) {
        handleSuspendedAccess(parseInt(suspendedUntil));
        return;
    }

    firebase.auth().onAuthStateChanged(async function(user) {
        if (user) {
            const suspensionStatus = await checkSuspensionStatus(user.uid);
            if (suspensionStatus && suspensionStatus.suspendedUntil > Date.now()) {
                await handleSuspension(user.uid, suspensionStatus.suspendedUntil);
                return;
            }
            
            displayUserInfo(user.uid);
            initializeMonitoring(user.uid);
        } else {
            redirectToLogin();
        }
    });
});
function handleSuspendedAccess(suspendedUntil) {
    const remainingTime = Math.ceil((suspendedUntil - Date.now()) / (1000 * 60));
    alert(`Your access is suspended. Please try again in ${remainingTime} minutes.`);
    redirectToLogin();
}

async function handleSuspension(userId, suspendedUntil) {
    //save time to local storage to prevent accessing the page during suspension
    localStorage.setItem('suspendedUntil', suspendedUntil);
    
    const remainingTime = Math.ceil((suspendedUntil - Date.now()) / (1000 * 60));
    alert(`You've been suspended for 1 hour (${remainingTime} minutes remaining). Please try again later.`);
    
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
    redirectToLogin();
}

function redirectToLogin() {
    window.location.href = '/index.html';
}

function displayUserInfo(userId) {
    const userRef = firebase.database().ref(`users/${userId}`);

    userRef.once('value').then((snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            const displayName = userData.fullname || userData.username || 'User';
            document.getElementById('user-name').textContent = displayName;
        }
    }).catch((error) => {
        console.error("Error fetching user data:", error);
    });

    document.getElementById('logout-btn').addEventListener('click', async function() {
        const userResponse = confirm("Do you want to logout?");
        if (userResponse) {
            try {
                await firebase.auth().signOut();
                redirectToLogin();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    });
}
function initializeMonitoring(userId) {
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("keydown", (e) => {
        if (e.key === 'F11' || e.key === 'Escape' || 
            (e.ctrlKey && (e.key === 't' || e.key === 'w' || e.key === 'n' || e.key === 'c' || e.key === 'v')) || 
            (e.altKey && e.key === 'Tab')) {
            e.preventDefault();
            logSecurityEvent(userId, "keyboard_shortcut_attempt", e.key);
            showWarning(userId);
        }
    });

    document.addEventListener('click', initializeFullscreen, { once: true });
    window.addEventListener('load', enterFullscreen);

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement) {
            logSecurityEvent(userId, "fullscreen_exited");
            showWarning(userId);
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            logSecurityEvent(userId, "tab_hidden");
            showWarning(userId);
        }
    });

    window.addEventListener('blur', () => {
        if (!document.hasFocus()) {
            logSecurityEvent(userId, "window_blur");
            showWarning(userId);
        }
    });

    window.addEventListener('focus', () => {
        tabSwitchDetected = false;
        document.getElementById("warning").style.display = "none";
        document.title = "&#x26A0; FULLSCREEN REQUIRED &#x26A0;";
    });
}

function initializeFullscreen() {
    enterFullscreen();
    document.getElementById('content').style.display = 'block';
    document.getElementById('fullscreen-message').style.display = 'none';
}

function enterFullscreen() {
    if (!document.fullscreenElement && fullscreenAttempts < MAX_FULLSCREEN_ATTEMPTS) {
        document.documentElement.requestFullscreen().then(() => {
            fullscreenAttempts = 0;
        }).catch(err => {
            console.error("Fullscreen error: ", err);
            fullscreenAttempts++;
            if (fullscreenAttempts < MAX_FULLSCREEN_ATTEMPTS) {
                setTimeout(enterFullscreen, 1000);
            } else {
                alert("YOU MUST ALLOW FULLSCREEN TO CONTINUE. PLEASE REFRESH AND ALLOW FULLSCREEN");
            }
        });
    }
}

async function showWarning(userId) {
    if (tabSwitchDetected) return;

    tabSwitchDetected = true;
    document.getElementById("warning").style.display = "block";
    document.title = "&#x26A0; DO NOT SWITCH TABS &#x26A0;";
    await logSecurityEvent(userId, "tab_switch_detected");

    setTimeout(() => {
        location.reload();
    }, 1000);
}

async function logSecurityEvent(userId, eventType, additionalData = null) {
    if (!userId) return;
    
    const timestamp = Date.now();
    const logData = {
        eventType: eventType,
        timestamp: timestamp,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        fullscreen: !!document.fullscreenElement
    };

    if (additionalData) {
        logData.additionalData = additionalData;
    }

    try {
        await firebase.database().ref(`users/${userId}/securityLogs`).push().set(logData);
        
        if (eventType === 'tab_switch_detected') {
            await checkAndEnforceLimits(userId, timestamp);
        }
    } catch (error) {
        console.error("Error saving security log:", error);
    }
}

async function checkAndEnforceLimits(userId, currentTimestamp) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/securityLogs`)
            .orderByChild('timestamp')
            .startAt(currentTimestamp - SUSPENSION_DURATION_MS)
            .once('value');
        
        let violationCount = 0;
        snapshot.forEach(log => {
            if (log.val().eventType === 'tab_switch_detected') {
                violationCount++;
            }
        });

        if (violationCount >= MAX_TAB_SWITCHES) {
            const suspendedUntil = Date.now() + SUSPENSION_DURATION_MS;
            await suspendUser(userId, suspendedUntil);
        }
    } catch (error) {
        console.error("Error checking violation limits:", error);
    }
}

async function suspendUser(userId, suspendedUntil) {
    try {

        await firebase.database().ref(`users/${userId}/suspension`).set({
            suspendedUntil: suspendedUntil,
            reason: "Excessive tab switching",
            timestamp: Date.now()
        });
            
        localStorage.setItem('suspendedUntil', suspendedUntil);

        alert("You have exceeded the tab switching limit. Your access has been suspended for 1 hour.");
        await firebase.auth().signOut();
        redirectToLogin();
    } catch (error) {
        console.error("Error suspending user:", error);
    }
}

async function checkSuspensionStatus(userId) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/suspension`).once('value');
        const suspension = snapshot.val();
        
        if (suspension && suspension.suspendedUntil > Date.now()) {
            return {
                suspendedUntil: suspension.suspendedUntil,
                reason: suspension.reason
            };
        }
        return null;
    } catch (error) {
        console.error("Error checking suspension status:", error);
        return null;
    }
}

window.addEventListener('load', function() {
    const suspendedUntil = localStorage.getItem('suspendedUntil');
    if (suspendedUntil && Date.now() > parseInt(suspendedUntil)) {
        localStorage.removeItem('suspendedUntil');
    }
});