
export const getUserData = async (userId) => {
    try {
        const snapshot = await firebase.database().ref(`users/${userId}`).once('value');
        return snapshot.val();
    } catch (error) {
        console.error("Error fetching user data:", error);
        throw error;
    }
};

export const updateUserData = async (userId, updates) => {
    try {
        await firebase.database().ref(`users/${userId}`).update(updates);
        return true;
    } catch (error) {
        console.error("Error updating user data:", error);
        throw error;
    }
};