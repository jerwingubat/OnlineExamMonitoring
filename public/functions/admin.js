const userModal = new bootstrap.Modal(document.getElementById('userModal'));
const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
let usersTable;
let allUsers = [];

document.addEventListener('DOMContentLoaded', function () {
    firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
            checkAdminStatus(user.uid).then(isAdmin => {
                if (isAdmin) {
                    initializeAdminPanel();
                    initializeDataTable();
                } else {
                    alert("You don't have admin privileges");
                    window.location.href = "/home.html";
                }
            });
        } else {
            window.location.href = "/index.html";
        }
    });
});


async function openIPModal(userId) {
    try {
        document.getElementById('ipTableBody').innerHTML = '<tr><td colspan="5" class="text-center">Loading IP data...</td></tr>';

        const ipModal = new bootstrap.Modal(document.getElementById('ipModal'));
        ipModal.show();

        const ipDetails = await loadIPInformation(userId);
        renderIPTable(ipDetails);
    } catch (error) {
        console.error("Error in openIPModal:", error);
        document.getElementById('ipTableBody').innerHTML = `
            <tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>
        `;
    }
}

document.addEventListener('click', function (e) {
    if (e.target.closest('.view-ip-btn')) {
        const userId = e.target.closest('.view-ip-btn').getAttribute('data-userid');
        openIPModal(userId);
    }
});


function renderIPTable(ipDetails) {
    const tbody = document.getElementById('ipTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    if (ipDetails && ipDetails.length > 0) {
        ipDetails.forEach(ip => {
            let locationText = 'Unknown';
            if (ip.location) {
                locationText = `${ip.location.city}, ${ip.location.region}, ${ip.location.country}`;
            }

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="border px-3 py-2">${ip.ip || 'N/A'}</td>
                <td class="border px-3 py-2">${locationText}</td>
                <td class="border px-3 py-2">${ip.timestamp ? new Date(ip.timestamp).toLocaleString() : 'Unknown'}</td>
                <td class="border px-3 py-2">${ip.usageCount || 'N/A'}</td>
                <td class="border px-3 py-2">${ip.source || 'System'}</td>
            `;
            tbody.appendChild(row);
        });
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted border px-3 py-2">No IP data available</td></tr>';
    }
    
    const modalIpDetails = document.getElementById('modalIpDetails');
    if (modalIpDetails) {
        modalIpDetails.value = JSON.stringify(ipDetails, null, 2);
    }

    const table = document.getElementById('ipTable');
    if (table) {
        table.classList.add('table-bordered', 'w-100');
    }
    
    const modalDialog = document.querySelector('#ipModal .modal-dialog');
    if (modalDialog) {
        modalDialog.classList.add('modal-lg');
    }
    
    const headers = table ? table.querySelectorAll('th') : [];
    headers.forEach(header => {
        header.classList.add('border', 'bg-light', 'px-3', 'py-2');
    });
}

async function openIPModal(userId) {
    try {
        const ipTableBody = document.getElementById('ipTableBody');
        ipTableBody.innerHTML = '<tr><td colspan="5" class="text-center">Loading IP data...</td></tr>';

        const ipModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('ipModal'));
        ipModal.show();

        const ipDetails = await loadIPInformation(userId);

        renderIPTable(ipDetails);

        document.getElementById('modalIpDetails').value = JSON.stringify(ipDetails, null, 2);

    } catch (error) {
        console.error("Error in openIPModal:", error);
        document.getElementById('ipTableBody').innerHTML = `
            <tr><td colspan="5" class="text-center text-danger">Error: ${error.message}</td></tr>
        `;
    }
}



function initializeDataTable() {
    usersTable = $('#users-table').DataTable({
        responsive: true,
        columns: [
            { data: 'name' },
            { data: 'email' },
            { data: 'username' },
            { data: 'role' },
            { data: 'status' },
            { data: 'lastActive' },
            { data: 'tabSwitches' },
            { data: 'ipInfo' },
            { data: 'actions', orderable: false }
        ],
        language: {
            emptyTable: "No users found",
            zeroRecords: "No matching users found"
        }
    });
}

async function checkAdminStatus(userId) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/isAdmin`).once('value');
        return snapshot.val() === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

async function deleteAllUsersSecurityLogs() {
    if (!confirm("WARNING: This will delete ALL security logs, IP information, and location data for ALL users. This action cannot be undone. Continue?")) {
        return;
    }

    try {
        showLoading(true, "Deleting all security logs and IP information...");

        const usersSnapshot = await firebase.database().ref('users').once('value');
        const updates = {};
        const now = Date.now();
        const adminId = firebase.auth().currentUser.uid;

        usersSnapshot.forEach(userSnapshot => {
            const userId = userSnapshot.key;

            updates[`users/${userId}/securityLogs`] = null;
            updates[`users/${userId}/lastKnownIP`] = null;
            updates[`users/${userId}/location`] = null;
            updates[`users/${userId}/suspension`] = null;
        });

        await firebase.database().ref().update(updates);

        allUsers.forEach(user => {
            user.securityLogs = {};
            user.lastKnownIP = null;
            user.location = null;
            user.tabSwitches = 0;
            user.suspension = null;
        });

        localStorage.removeItem('suspendedUntil');

        populateDataTable();
        showAlert("All security logs and IP information have been deleted for all users", "success");

    } catch (error) {
        console.error("Error deleting all security logs and IP information:", error);
        showAlert("Failed to delete all security logs and IP information", "danger");
    } finally {
        showLoading(false);
    }
}
async function deleteAllSecurityLogs() {
    const userId = document.getElementById('modalUserId').value;
    const user = allUsers.find(u => u.id === userId);

    if (!userId || !user) {
        showAlert("No user selected", "warning");
        return;
    }

    if (!confirm(`Are you sure you want to delete ALL security logs and IP information for ${user.fullname || user.email}? This action cannot be undone.`)) {
        return;
    }

    try {
        showLoading(true, "Deleting security logs and IP information...");

        const updates = {
            [`users/${userId}/securityLogs`]: null,
            [`users/${userId}/lastKnownIP`]: null,
            [`users/${userId}/location`]: null,
            [`users/${userId}/suspension`]: null
        };

        await firebase.database().ref().update(updates);

        if (user) {
            user.securityLogs = {};
            user.lastKnownIP = null;
            user.location = null;
            user.tabSwitches = 0;
            user.suspension = null;
        }

        localStorage.removeItem('suspendedUntil');

        document.getElementById('securityLogsContainer').innerHTML =
            '<p class="text-muted">No security logs found.</p>';

        const ipTableBody = document.getElementById('ipTableBody');
        if (ipTableBody) {
            ipTableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No IP data available</td></tr>';
        }

        showAlert("All security logs and IP information have been deleted", "success");
        populateDataTable();

    } catch (error) {
        console.error("Error deleting security logs and IP information:", error);
        showAlert("Failed to delete security logs and IP information", "danger");
    } finally {
        showLoading(false);
    }
}


function initializeAdminPanel() {
    loadAllUsers();

    document.getElementById('refresh-btn').addEventListener('click', loadAllUsers);
    document.getElementById('export-btn').addEventListener('click', exportUsers);
    document.getElementById('search-input').addEventListener('keyup', function (e) {
        usersTable.search(this.value).draw();
    });
    document.getElementById('filter-status').addEventListener('change', filterUsers);
    document.getElementById('filter-role').addEventListener('change', filterUsers);
    document.getElementById('logout-btn').addEventListener('click', logoutAdmin);
    document.getElementById('save-user-btn').addEventListener('click', saveUserChanges);
    document.getElementById('reset-password-btn').addEventListener('click', resetUserPassword);
    document.getElementById('modalIsSuspended').addEventListener('change', toggleSuspensionFields);
    document.getElementById('modalSuspensionDuration').addEventListener('change', toggleCustomSuspension);
    document.getElementById('delete-logs-btn').addEventListener('click', deleteAllSecurityLogs);
    document.getElementById('delete-all-logs-btn').addEventListener('click', deleteAllUsersSecurityLogs);

    $(document).on('click', '.tab-switch-count', function () {
        const userId = $(this).closest('tr').find('.edit-user-btn').data('userid');
        if (userId) {
            openUserModal(userId);
            setTimeout(() => {
                document.getElementById('securityLogFilter').value = 'window_blur';
                const filterEvent = new Event('change');
                document.getElementById('securityLogFilter').dispatchEvent(filterEvent);
            }, 300);
        }
    });

}

async function loadAllUsers() {
    try {
        showLoading(true, "Loading users...");
        const snapshot = await firebase.database().ref('users').once('value');
        allUsers = [];

        snapshot.forEach(userSnapshot => {
            const user = userSnapshot.val();
            user.id = userSnapshot.key;

            if (user.securityLogs) {
                user.tabSwitches = Object.values(user.securityLogs)
                    .filter(log => log.eventType === 'window_blur')
                    .length;
            } else {
                user.tabSwitches = 0;
            }

            allUsers.push(user);
        });

        updateStats();
        populateDataTable();
    } catch (error) {
        console.error("Error loading users:", error);
        showAlert("Failed to load users", "danger");
    } finally {
        showLoading(false);
    }
}



function updateStats() {
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    document.getElementById('total-users').textContent = allUsers.length;
    document.getElementById('active-users').textContent = allUsers.filter(u =>
        u.lastLogin && (now - u.lastLogin) < oneDay
    ).length;
    document.getElementById('admin-users').textContent = allUsers.filter(u =>
        u.isAdmin
    ).length;
    document.getElementById('suspended-users').textContent = allUsers.filter(u =>
        u.suspension && u.suspension.suspendedUntil > now
    ).length;
}

function populateDataTable() {
    const now = Date.now();
    const tableData = allUsers.map(user => {
        const lastKnownIP = user.lastKnownIP?.ip || 'Unknown';
        const lastIPTimestamp = user.lastKnownIP?.timestamp ? new Date(user.lastKnownIP.timestamp).toLocaleString() : 'Never';
        
        return {
            name: `
                <div class="d-flex align-items-center">
                    <img src="${user.photoURL || 'https://placehold.co/50x50'}" class="user-avatar me-3" alt="User Avatar">
                    <div>
                        <strong>${user.fullname || 'No name'}</strong>
                        ${user.isAdmin ? '<span class="badge bg-primary ms-2">Admin</span>' : ''}
                    </div>
                </div>
            `,
            email: user.email,
            username: user.username || 'N/A',
            role: user.isAdmin ? 'Admin' : 'User',
            status: user.suspension && user.suspension.suspendedUntil > now ?
                `<span class="badge bg-danger">Suspended</span>` :
                `<span class="badge bg-success">Active</span>`,
            lastActive: user.lastLogin ?
                `<span class="last-active">${formatDate(user.lastLogin)}</span>` :
                'Never',
            tabSwitches: user.tabSwitches || 0,
            ipInfo: `
                <button class="btn btn-sm btn-info view-ip-btn" data-userid="${user.id}">
                    <i class="bi bi-globe"></i> View IP
                </button>
            `,
            actions: `
                <button class="btn btn-sm btn-outline-primary edit-user-btn" data-userid="${user.id}">
                    <i class="bi bi-pencil"></i> Edit
                </button>
            `
        };
    });

    usersTable.clear().rows.add(tableData).draw();

    document.querySelectorAll('.view-ip-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            openIPModal(userId);
        });
    });

    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            openUserModal(userId);
        });
    });
}

function filterUsers() {
    const statusFilter = document.getElementById('filter-status').value;
    const roleFilter = document.getElementById('filter-role').value;

    $.fn.dataTable.ext.search.push(
        function (settings, data, dataIndex) {
            const user = allUsers[dataIndex];
            const now = Date.now();

            if (statusFilter === 'active' && user.suspension && user.suspension.suspendedUntil > now) {
                return false;
            }
            if (statusFilter === 'suspended' && (!user.suspension || user.suspension.suspendedUntil <= now)) {
                return false;
            }

            if (roleFilter === 'admin' && !user.isAdmin) {
                return false;
            }
            if (roleFilter === 'user' && user.isAdmin) {
                return false;
            }

            return true;
        }
    );

    usersTable.draw();
    $.fn.dataTable.ext.search.pop();
}




async function loadSecurityLogs(userId) {
    console.log(`[DEBUG] Attempting to load security logs for user: ${userId}`);

    try {
        const logsRef = firebase.database().ref(`users/${userId}/securityLogs`);
        const snapshot = await logsRef.once('value');

        console.log('[DEBUG] Raw Firebase snapshot:', snapshot);
        console.log('[DEBUG] Snapshot exists:', snapshot.exists());
        console.log('[DEBUG] Snapshot value:', snapshot.val());

        if (!snapshot.exists()) {
            console.log('[DEBUG] No security logs found in database');
            document.getElementById('securityLogsContainer').innerHTML =
                '<p class="text-muted">No security logs found</p>';
            return;
        }

        const logs = [];
        snapshot.forEach(logSnapshot => {
            const log = logSnapshot.val();
            console.log(`[DEBUG] Processing log with key ${logSnapshot.key}:`, log);

            if (log.timestamp && log.eventType) {
                logs.push({
                    id: logSnapshot.key,
                    ...log
                });
            } else {
                console.warn('[DEBUG] Skipping malformed log entry:', log);
            }
        });

        logs.sort((a, b) => b.timestamp - a.timestamp);

        console.log('[DEBUG] Processed logs (sorted):', logs);

        renderLogs(logs);

    } catch (error) {
        console.error('[ERROR] Failed to load security logs:', error);
        document.getElementById('securityLogsContainer').innerHTML =
            `<p class="text-danger">Error loading logs: ${error.message}</p>`;
    }
}

function renderLogs(logs) {
    const container = document.getElementById('securityLogsContainer');
    container.innerHTML = '';

    const filterContainer = document.createElement('div');
    filterContainer.className = 'mb-3';
    filterContainer.innerHTML = `
        <div class="d-flex align-items-center gap-2">
            <label for="logTypeFilter" class="form-label mb-0">Filter by type:</label>
            <select id="logTypeFilter" class="form-select form-select-sm w-auto">
                <option value="all">All Activities</option>
                <option value="session_start">Session Start</option>
                <option value="keyboard_shortcut_attempt">Keyboard Shortcut Attempt</option>
                <option value="fullscreen_exited">Fullscreen Exited</option>
                <option value="tab_hidden">Tab Hidden</option>
                <option value="window_blur">Window Blur</option>
                <option value="tab_switch_detected">Tab Switch Detected</option>
                <option value="login">Login</option>
                <option value="logout">Logout</option>
                <option value="admin_action">Admin Actions</option>
            </select>
        </div>
    `;
    container.appendChild(filterContainer);

    const logsList = document.createElement('div');
    logsList.className = 'list-group';
    logsList.id = 'logsListContainer';

    function filterAndDisplayLogs(selectedType) {
        const filteredLogs = selectedType === 'all' 
            ? logs 
            : logs.filter(log => log.eventType === selectedType);

        logsList.innerHTML = '';

        if (filteredLogs.length === 0) {
            logsList.innerHTML = '<p class="text-muted p-3">No matching log entries found</p>';
            return;
        }

        filteredLogs.forEach(log => {
            const logItem = document.createElement('div');
            logItem.className = 'list-group-item';
            logItem.setAttribute('data-log-type', log.eventType);

            const logDate = new Date(log.timestamp).toLocaleString();
            const eventType = log.eventType || 'unknown';

            const formattedEventType = eventType
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            logItem.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${formattedEventType}</h6>
                    <small class="text-muted">${logDate}</small>
                </div>
                ${log.userAgent ? `<small class="text-muted d-block">${log.userAgent.split(' ')[0]}</small>` : ''}
                ${log.screenResolution ? `<small class="text-muted">Resolution: ${log.screenResolution}</small>` : ''}
                ${log.ipAddress ? `<small class="text-muted d-block">IP: ${log.ipAddress}</small>` : ''}
            `;

            logsList.appendChild(logItem);
        });
    }

    const filterSelect = filterContainer.querySelector('#logTypeFilter');
    filterSelect.addEventListener('change', (e) => {
        filterAndDisplayLogs(e.target.value);
    });

    container.appendChild(logsList);
    
    filterAndDisplayLogs('all');
}
async function recordAdminAction(adminId, userId, actionType, details) {
    const logEntry = {
        eventType: actionType,
        timestamp: Date.now(),
        adminId: adminId,
        ...details
    };
    if (navigator) {
        logEntry.userAgent = navigator.userAgent;
        logEntry.screenResolution = `${window.screen.width}x${window.screen.height}`;
        logEntry.fullscreen = !!document.fullscreenElement;
    }

    await firebase.database().ref(`users/${userId}/securityLogs`).push(logEntry);
}


async function openUserModal(userId) {
    try {
        showLoading(true, "Loading user data...");

        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            showAlert("User not found", "danger");
            return;
        }

        document.getElementById('modalTitle').textContent = `Edit User: ${user.fullname || user.email}`;
        document.getElementById('modalUserId').value = user.id;
        document.getElementById('modalFullName').value = user.fullname || '';
        document.getElementById('modalEmail').value = user.email;
        document.getElementById('modalUsername').value = user.username || '';
        document.getElementById('modalPhone').value = user.phone || '';
        document.getElementById('modalUserNotes').value = user.notes || '';
        document.getElementById('modalUserAvatar').src = user.photoURL || 'https://placehold.co/50x50';
        document.getElementById('modalIsAdmin').checked = user.isAdmin || false;

        const isSuspended = user.suspension && user.suspension.suspendedUntil > Date.now();
        document.getElementById('modalIsSuspended').checked = isSuspended;
        toggleSuspensionFields();
        if (isSuspended) {
            document.getElementById('modalSuspensionReason').value = user.suspension.reason || '';
        }
        await loadIPInformation(userId);
        await loadSecurityLogs(userId);

        userModal.show();
    } catch (error) {
        console.error("Error opening user modal:", error);
        showAlert("Failed to load user details", "danger");
    } finally {
        showLoading(false);
    }
}

async function loadIPInformation(userId) {
    try {
        const userRef = firebase.database().ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val();

        if (!userData) {
            throw new Error('User not found');
        }

        const ipDetails = [];

        if (userData.lastKnownIP && userData.securityLogs) {
            const logs = Object.values(userData.securityLogs);
            const logWithLocation = logs.find(log => log.location);
            
            ipDetails.push({
                ip: userData.lastKnownIP.ip,
                location: logWithLocation ? {
                    city: logWithLocation.location.city || 'Unknown',
                    region: logWithLocation.location.region || 'Unknown',
                    country: logWithLocation.location.country || 'Unknown'
                } : {
                    city: 'Unknown',
                    region: 'Unknown',
                    country: 'Unknown'
                },
                timestamp: userData.lastKnownIP.timestamp,
                usageCount: 1,
                source: 'Last Known'
            });
        }

        return ipDetails;
    } catch (error) {
        console.error('Error loading IP information:', error);
        throw error;
    }
}

async function getApproximateLocation(ip) {
    if (ip === 'unknown') return null;

    try {
        const response = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        if (data.error) {
            throw new Error(data.reason || 'IP API error');
        }

        return {
            city: data.city || null,
            region: data.region || null,
            country: data.country_name || null
        };
    } catch (error) {
        console.error(`Error getting location for IP ${ip}:`, error);
        throw error;
    }
}

async function getLastUsedTimestamp(userId, ip) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/securityLogs`)
            .orderByChild('ipAddress')
            .equalTo(ip)
            .once('value');

        let lastUsed = 0;
        if (snapshot.exists()) {
            snapshot.forEach(log => {
                if (log.val().timestamp > lastUsed) {
                    lastUsed = log.val().timestamp;
                }
            });
        }
        return lastUsed;
    } catch (error) {
        console.error(`Error getting last used timestamp for IP ${ip}:`, error);
        return 0;
    }
}

async function getIPUsageCount(userId, ip) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/securityLogs`)
            .orderByChild('ipAddress')
            .equalTo(ip)
            .once('value');

        return snapshot.exists() ? snapshot.numChildren() : 0;
    } catch (error) {
        console.error(`Error getting usage count for IP ${ip}:`, error);
        return 0;
    }
}

function toggleSuspensionFields() {
    const isSuspended = document.getElementById('modalIsSuspended').checked;
    document.getElementById('suspensionDetails').style.display = isSuspended ? 'block' : 'none';
}

function toggleCustomSuspension() {
    const duration = document.getElementById('modalSuspensionDuration').value;
    document.getElementById('customSuspension').style.display = duration === 'custom' ? 'block' : 'none';
}

async function saveUserChanges() {
    try {
        showLoading(true, "Saving changes...");
        const userId = document.getElementById('modalUserId').value;
        const updates = {
            fullname: document.getElementById('modalFullName').value.trim(),
            username: document.getElementById('modalUsername').value.trim(),
            phone: document.getElementById('modalPhone').value.trim(),
            notes: document.getElementById('modalUserNotes').value.trim(),
            isAdmin: document.getElementById('modalIsAdmin').checked,
            lastUpdated: Date.now()
        };

        const isSuspended = document.getElementById('modalIsSuspended').checked;
        const suspensionReason = document.getElementById('modalSuspensionReason').value.trim();

        if (isSuspended) {
            let suspendedUntil;
            const duration = document.getElementById('modalSuspensionDuration').value;

            if (duration === 'custom') {
                const customDate = document.getElementById('modalCustomSuspensionDate').value;
                suspendedUntil = new Date(customDate).getTime();
            } else {
                suspendedUntil = Date.now() + parseInt(duration);
            }

            updates.suspension = {
                suspendedUntil,
                reason: suspensionReason || "Admin suspension",
                timestamp: Date.now()
            };
        } else {
            updates.suspension = null;
        }

        await firebase.database().ref(`users/${userId}`).update(updates);

        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updates };
        }

        userModal.hide();
        updateStats();
        populateDataTable();
        showAlert("User updated successfully", "success");
    } catch (error) {
        console.error("Error saving user changes:", error);
        showAlert("Failed to save changes", "danger");
    } finally {
        showLoading(false);
    }
}

async function resetUserPassword() {
    const userId = document.getElementById('modalUserId').value;
    const user = allUsers.find(u => u.id === userId);

    if (!user || !user.email) {
        showAlert("No email address found for this user", "warning");
        return;
    }

    if (!confirm(`Are you sure you want to reset password for ${user.email}? A reset link will be sent to their email.`)) {
        return;
    }

    try {
        showLoading(true, "Sending password reset email...");
        showAlert(`Password reset email sent to ${user.email}`, "success");

        await firebase.auth().sendPasswordResetEmail(user.email);
    } catch (error) {
        console.error("Error resetting password:", error);
        showAlert("Failed to send reset email", "danger");
    } finally {
        showLoading(false);
    }
}

function exportUsers() {
    const data = allUsers.map(user => {
        return {
            'Full Name': user.fullname || '',
            'Email': user.email,
            'Username': user.username || '',
            'Phone': user.phone || '',
            'Role': user.isAdmin ? 'Admin' : 'User',
            'Status': user.suspension && user.suspension.suspendedUntil > Date.now() ?
                'Suspended' : 'Active',
            'Suspension Reason': user.suspension ? user.suspension.reason : '',
            'Last Active': user.lastLogin ? formatDate(user.lastLogin) : 'Never',
            'Registered': user.createdAt ? formatDate(user.createdAt) : 'Unknown'
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Users");
    XLSX.writeFile(workbook, "users_export.xlsx");
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString();
}

function showAlert(message, type) {
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show fixed-top mx-auto mt-3`;
    alert.style.maxWidth = '500px';
    alert.style.zIndex = '2000';
    alert.role = 'alert';
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    document.body.appendChild(alert);

    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 3000);
}

function showLoading(show, message = "Loading...") {
    const modal = document.getElementById('loadingModal');
    if (show) {
        document.getElementById('loadingMessage').textContent = message;
        loadingModal.show();
    } else {
        loadingModal.hide();

        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.remove();
    }
}


function logoutAdmin() {
    firebase.auth().signOut().then(() => {
        window.location.href = '/index.html';
    }).catch(error => {
        console.error("Logout error:", error);
        showAlert("Failed to logout", "danger");
    });
}

