const userModal = new bootstrap.Modal(document.getElementById('userModal'));
let allUsers = [];

document.addEventListener('DOMContentLoaded', function() {
  firebase.auth().onAuthStateChanged(function(user) {
      if (user) {
          firebase.database().ref('users/' + user.uid + '/isAdmin').once('value')
              .then((snapshot) => {
                  if (snapshot.val() === true) {
                      initializeAdminPanel();
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

async function checkAdminStatus(userId) {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}/isAdmin`).once('value');
        return snapshot.val() === true;
    } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
    }
}

function initializeAdminPanel() {

    loadAllUsers();

    document.getElementById('refresh-btn').addEventListener('click', loadAllUsers);
    document.getElementById('search-btn').addEventListener('click', searchUsers);
    document.getElementById('search-input').addEventListener('keyup', function(e) {
        if (e.key === 'Enter') searchUsers();
    });
    document.getElementById('logout-btn').addEventListener('click', logoutAdmin);
    document.getElementById('save-user-btn').addEventListener('click', saveUserChanges);
    document.getElementById('modalIsSuspended').addEventListener('change', function() {
        document.getElementById('suspensionDetails').style.display = 
            this.checked ? 'block' : 'none';
    });
}

async function loadAllUsers() {
    try {
        showLoading(true);
        const snapshot = await firebase.database().ref('users').once('value');
        allUsers = [];
        
        snapshot.forEach(userSnapshot => {
            const user = userSnapshot.val();
            user.id = userSnapshot.key;
            allUsers.push(user);
        });

        displayUsers(allUsers);
    } catch (error) {
        console.error("Error loading users:", error);
        alert("Failed to load users");
    } finally {
        showLoading(false);
    }
}

function displayUsers(users) {
    const container = document.getElementById('users-container');
    container.innerHTML = '';

    if (users.length === 0) {
        container.innerHTML = '<div class="col"><div class="alert alert-info">No users found</div></div>';
        return;
    }

    users.forEach(user => {
        const userCard = document.createElement('div');
        userCard.className = `col user-card ${user.suspension ? 'suspended' : ''}`;
        
        userCard.innerHTML = `
            <div class="card h-100">
                <div class="card-body">
                    <h5 class="card-title">
                        ${user.fullname || 'No name'}
                        ${user.isAdmin ? '<span class="badge bg-primary admin-badge ms-2">Admin</span>' : ''}
                        ${user.suspension ? '<span class="badge bg-danger admin-badge ms-2">Suspended</span>' : ''}
                    </h5>
                    <h6 class="card-subtitle mb-2 text-muted">${user.email}</h6>
                    <p class="card-text">
                        <small>Username: ${user.username || 'Not set'}</small><br>
                        ${user.suspension ? 
                            `<small class="text-danger">Suspended until: ${new Date(user.suspension.suspendedUntil).toLocaleString()}</small><br>
                             <small>Reason: ${user.suspension.reason || 'No reason provided'}</small>` : ''}
                    </p>
                    <button class="btn btn-sm btn-outline-primary edit-user-btn" data-userid="${user.id}">
                        Edit
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(userCard);
    });

    // Add event listeners to edit buttons
    document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const userId = this.getAttribute('data-userid');
            openUserModal(userId);
        });
    });
}

// Open modal with user details
async function openUserModal(userId) {
    try {
        showLoading(true);
        const user = allUsers.find(u => u.id === userId);
        
        if (!user) {
            alert("User not found");
            return;
        }

        // Populate modal
        document.getElementById('modalUserId').value = user.id;
        document.getElementById('modalFullName').value = user.fullname || '';
        document.getElementById('modalEmail').value = user.email;
        document.getElementById('modalUsername').value = user.username || '';
        document.getElementById('modalIsAdmin').checked = user.isAdmin || false;
        document.getElementById('modalIsSuspended').checked = !!user.suspension;
        document.getElementById('suspensionDetails').style.display = 
            user.suspension ? 'block' : 'none';
        document.getElementById('modalSuspensionReason').value = 
            user.suspension?.reason || '';

        userModal.show();
    } catch (error) {
        console.error("Error opening user modal:", error);
        alert("Failed to load user details");
    } finally {
        showLoading(false);
    }
}

// Save user changes from modal
async function saveUserChanges() {
    try {
        showLoading(true);
        const userId = document.getElementById('modalUserId').value;
        const updates = {
            fullname: document.getElementById('modalFullName').value.trim(),
            username: document.getElementById('modalUsername').value.trim(),
            isAdmin: document.getElementById('modalIsAdmin').checked
        };

        // Handle suspension
        const isSuspended = document.getElementById('modalIsSuspended').checked;
        const suspensionReason = document.getElementById('modalSuspensionReason').value.trim();

        if (isSuspended) {
            updates.suspension = {
                suspendedUntil: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
                reason: suspensionReason || "Admin suspension",
                timestamp: Date.now()
            };
        } else {
            updates.suspension = null;
        }

        // Update in Firebase
        await firebase.database().ref(`users/${userId}`).update(updates);
        
        // Update local data
        const userIndex = allUsers.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            allUsers[userIndex] = { ...allUsers[userIndex], ...updates };
        }

        userModal.hide();
        displayUsers(allUsers);
        alert("User updated successfully");
    } catch (error) {
        console.error("Error saving user changes:", error);
        alert("Failed to save changes");
    } finally {
        showLoading(false);
    }
}

// Search users by name, email or username
function searchUsers() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    
    if (!searchTerm) {
        displayUsers(allUsers);
        return;
    }

    const filteredUsers = allUsers.filter(user => 
        (user.fullname && user.fullname.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.username && user.username.toLowerCase().includes(searchTerm))
    );

    displayUsers(filteredUsers);
}

// Admin logout
function logoutAdmin() {
    firebase.auth().signOut().then(() => {
        window.location.href = '/index.html';
    }).catch(error => {
        console.error("Logout error:", error);
    });
}

// Toggle loading spinner
function showLoading(show) {
    document.getElementById('loading-spinner').style.display = 
        show ? 'block' : 'none';
    document.getElementById('users-container').style.display = 
        show ? 'none' : 'flex';
}