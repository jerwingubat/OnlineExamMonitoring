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
            { 
                data: 'tabSwitches',
                render: function(data, type, row) {
                    return data ? `<span class="badge bg-info">${data} tab switches</span>` : '<span class="text-muted">N/A</span>';
                }
            },
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
    if (!confirm("WARNING: This will delete ALL security logs for ALL users. This action cannot be undone. Continue?")) {
        return;
    }

    try {
        showLoading(true, "Deleting all security logs...");

        const usersSnapshot = await firebase.database().ref('users').once('value');
        const updates = {};
        const now = Date.now();
        const adminId = firebase.auth().currentUser.uid;
        
        usersSnapshot.forEach(userSnapshot => {
            const userId = userSnapshot.key;
            
            // Record deletion action before deleting
            /*updates[`users/${userId}/securityLogs/deletion_${now}`] = {
                eventType: "admin_action",
                action: "bulk_delete_all_logs",
                timestamp: now,
                adminId: adminId,
                ipAddress: await getIPAddress()
            };*/
            
            if (userSnapshot.child('securityLogs').exists()) {
                Object.keys(userSnapshot.child('securityLogs').val()).forEach(logId => {
                    if (!logId.startsWith('deletion_')) {
                        updates[`users/${userId}/securityLogs/${logId}`] = null;
                    }
                });
            }
        });

        await firebase.database().ref().update(updates);

        allUsers.forEach(user => {
            user.securityLogs = {};
            if (user.tabSwitches) user.tabSwitches = 0;
        });
        
        populateDataTable();
        showAlert("All security logs have been deleted", "success");
        
    } catch (error) {
        console.error("Error deleting all security logs:", error);
        showAlert("Failed to delete all security logs", "danger");
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

    if (!confirm(`Are you sure you want to delete ALL security logs for ${user.fullname || user.email}? This action cannot be undone.`)) {
        return;
    }

    try {
        showLoading(true, "Deleting security logs...");

        await firebase.database().ref(`users/${userId}/securityLogs`).remove();

        if (user.securityLogs) {
            user.securityLogs = {};
            user.tabSwitches = 0;
        }
y
        document.getElementById('securityLogsContainer').innerHTML = 
            '<p class="text-muted">No security logs found.</p>';
        
        showAlert("All security logs have been deleted", "success");
        populateDataTable();
        
    } catch (error) {
        console.error("Error deleting security logs:", error);
        showAlert("Failed to delete security logs", "danger");
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

    $(document).on('click', '.tab-switch-count', function() {
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
            actions: `
                <button class="btn btn-sm btn-outline-primary edit-user-btn" data-userid="${user.id}">
                    <i class="bi bi-pencil"></i> Edit
                </button>
            `
        };
    });

    usersTable.clear().rows.add(tableData).draw();

    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function () {
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
    
    if (logs.length === 0) {
        container.innerHTML = '<p class="text-muted">No valid log entries found</p>';
        return;
    }

    const logsList = document.createElement('div');
    logsList.className = 'list-group';
    
    logs.forEach(log => {
        const logItem = document.createElement('div');
        logItem.className = 'list-group-item';
        
        const logDate = new Date(log.timestamp).toLocaleString();
        const eventType = log.eventType || 'unknown';
        
        logItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-capitalize">${eventType.replace(/_/g, ' ')}</h6>
                <small class="text-muted">${logDate}</small>
            </div>
            ${log.userAgent ? `<small class="text-muted d-block">${log.userAgent.split(' ')[0]}</small>` : ''}
            ${log.screenResolution ? `<small class="text-muted">Resolution: ${log.screenResolution}</small>` : ''}
        `;
        
        logsList.appendChild(logItem);
    });
    
    container.appendChild(logsList);
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

        await loadSecurityLogs(userId);

        userModal.show();
    } catch (error) {
        console.error("Error opening user modal:", error);
        showAlert("Failed to load user details", "danger");
    } finally {
        showLoading(false);
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

        //need ng Firebase Admin SDK para mag function
        //This is just a placeholder for the UI flow.
        showAlert(`Password reset email sent to ${user.email}`, "success");

        //in a real implementation:
        // await firebase.auth().sendPasswordResetEmail(user.email);
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