const MAX_TAB_SWITCHES = 5;
const SUSPENSION_DURATION_MS = 60 * 60 * 1000;
let fullscreenAttempts = 0;
const MAX_FULLSCREEN_ATTEMPTS = 5;
let tabSwitchDetected = false;

document.addEventListener('DOMContentLoaded', async function () {

    const suspendedUntil = localStorage.getItem('suspendedUntil');
    if (suspendedUntil && Date.now() < parseInt(suspendedUntil)) {
        handleSuspendedAccess(parseInt(suspendedUntil));
        return;
    }

    firebase.auth().onAuthStateChanged(async function (user) {
        if (user) {
            const suspensionStatus = await checkSuspensionStatus(user.uid);
            if (suspensionStatus && suspensionStatus.suspendedUntil > Date.now()) {
                await handleSuspension(user.uid, suspensionStatus.suspendedUntil);
                return;
            }

            await storeInitialIP(user.uid);
            displayUserInfo(user.uid);
            initializeMonitoring(user.uid);
        } else {
            redirectToLogin();
        }
    });
});

async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error("Error fetching IP:", error);
        return 'unknown';
    }
}

async function storeInitialIP(userId) {
    try {
        const ip = await getClientIP();
        await firebase.database().ref(`users/${userId}/lastKnownIP`).set({
            ip: ip,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error("Error storing IP:", error);
    }
}
function handleSuspendedAccess(suspendedUntil) {
    const remainingTime = Math.ceil((suspendedUntil - Date.now()) / (1000 * 60));
    alert(`Your access is suspended. Please try again in ${remainingTime} minutes.`);
    redirectToLogin();
}

async function handleSuspension(userId, suspendedUntil, suspensionData) {

    localStorage.setItem('suspendedUntil', suspendedUntil);
    
    const remainingTime = Math.ceil((suspendedUntil - Date.now()) / (1000 * 60));
    let message = `You've been suspended for 1 hour (${remainingTime} minutes remaining).`;
    
    if (suspensionData?.ipAddress) {
        message += `\n\nSuspension details:\n`;
        message += `- IP Address: ${suspensionData.ipAddress}\n`;
        if (suspensionData.location) {
            message += `- Approximate Location: ${suspensionData.location.city}, ${suspensionData.location.region}, ${suspensionData.location.country}\n`;
        }
        message += `- Device: ${suspensionData.deviceInfo?.userAgent || 'Unknown'}`;
    }
    
    alert(message);
    
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
    redirectToLogin();
}

function redirectToLogin() {
    window.location.href = '/public/index.html';
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

    document.getElementById('logout-btn').addEventListener('click', async function () {
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
async function initializeMonitoring(userId) {
    await logSecurityEvent(userId, "session_start");
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
    const ipAddress = await getClientIP();
    
    const logData = {
        eventType: eventType,
        timestamp: timestamp,
        userAgent: navigator.userAgent,
        screenResolution: `${window.screen.width}x${window.screen.height}`,
        fullscreen: !!document.fullscreenElement,
        ipAddress: ipAddress,
        location: await getApproximateLocation(ipAddress)
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
async function getApproximateLocation(ip) {
    if (ip === 'unknown') return null;
    
    try {
        // Try ip-api.com first (more reliable free service)
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        
        if (data.status === 'success') {
            return {
                city: data.city || null,
                region: data.regionName || null,
                country: data.country || null
            };
        }
        
        const fallbackResponse = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!fallbackResponse.ok) {
            throw new Error(`Fallback HTTP error! status: ${fallbackResponse.status}`);
        }
        const fallbackData = await fallbackResponse.json();
        
        if (!fallbackData.error) {
            return {
                city: fallbackData.city || null,
                region: fallbackData.region || null,
                country: fallbackData.country_name || null
            };
        }
        
        return null;
    } catch (error) {
        console.warn(`IP geolocation failed for IP ${ip}:`, error);
        return null;
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
        const ipAddress = await getClientIP();
        let location = null;
        
        try {
            location = await getApproximateLocation(ipAddress);
        } catch (locationError) {
            console.warn('Failed to get location data:', locationError);
        }
        
        const suspensionData = {
            suspendedUntil: suspendedUntil,
            reason: "Excessive tab switching",
            timestamp: Date.now(),
            ipAddress: ipAddress,
            location: location,
            deviceInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language
            }
        };
        
        await firebase.database().ref(`suspensions/${userId}`).set(suspensionData);
        console.log(`User ${userId} suspended until ${new Date(suspendedUntil)}`);
    } catch (error) {
        console.error("Error suspending user:", error);
        const basicSuspensionData = {
            suspendedUntil: suspendedUntil,
            reason: "Excessive tab switching",
            timestamp: Date.now(),
            ipAddress: await getClientIP()
        };
        await firebase.database().ref(`suspensions/${userId}`).set(basicSuspensionData);
    }
}

async function checkSuspensionStatus(userId) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/suspension`).once('value');
        const suspension = snapshot.val();
        
        if (suspension && suspension.suspendedUntil > Date.now()) {
            const currentIP = await getClientIP();
            return {
                suspendedUntil: suspension.suspendedUntil,
                reason: suspension.reason,
                originalIP: suspension.ipAddress,
                currentIP: currentIP,
                isSameIP: suspension.ipAddress === currentIP
            };
        }
        return null;
    } catch (error) {
        console.error("Error checking suspension status:", error);
        return null;
    }
}

window.addEventListener('load', function () {
    const suspendedUntil = localStorage.getItem('suspendedUntil');
    if (suspendedUntil && Date.now() > parseInt(suspendedUntil)) {
        localStorage.removeItem('suspendedUntil');
    }
});