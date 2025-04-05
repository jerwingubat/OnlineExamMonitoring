# Online Exam System with Firebase & Tab Switching Prevention  

![Firebase](https://img.shields.io/badge/Firebase-039BE5?style=for-the-badge&logo=Firebase&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

A secure online examination platform that uses **Firebase Realtime Database** for data storage and enforces **tab-switching prevention** to ensure exam integrity.

---

## 📌 Table of Contents  
- [Features](#-features)  
- [Technologies Used](#-technologies-used)  
- [Setup Instructions](#-setup-instructions)  
  - [Firebase Configuration](#1-firebase-configuration)  
  - [Tab Switching Prevention](#2-tab-switching-prevention-code)  
  - [Firebase Security Rules](#3-firebase-security-rules-example)  
- [Usage](#-usage)  
  - [Student View](#1-student-view)  
  - [Admin/Proctor View](#2-adminproctor-view)  
- [Limitations](#-limitations)  
- [License](#-license)  
- [Contact](#-contact)  

---

## ✨ Features  
✅ **Firebase Realtime Database** – Stores exam questions, answers, and user responses.  
✅ **Tab Switching Detection** – Uses JavaScript's `Page Visibility API` to detect unauthorized tab/window switches.  
✅ **Auto-Submit on Violation** – Forces exam submission if the user switches tabs multiple times.  
✅ **Real-Time Monitoring** – Logs suspicious activity in Firebase for proctor review.  
✅ **Responsive Design** – Works on desktop and modern browsers.  

---

## 🛠️ Technologies Used  
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)  
- **Backend**: Firebase Realtime Database  
- **Security**: Page Visibility API, Event Listeners  
- **Hosting**: Firebase Hosting (optional)  

---

## 🔧 Setup Instructions  

### 1. **Firebase Configuration**  
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/).  
2. Enable **Realtime Database** and **Authentication** (if needed).  
3. Add Firebase SDK to your project:  

```html
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.0/firebase-database-compat.js"></script>
<script>
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    databaseURL: "YOUR_DATABASE_URL",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  };
  firebase.initializeApp(firebaseConfig);
</script>
```

## 📄 Usage

### 1. Student View
- Students log in using their credentials to start the exam.
- The exam interface displays:
  - Questions with multiple-choice options
  - A timer showing remaining time
  - Navigation controls
#### Tab Switching Prevention:
If a student attempts to switch tabs/windows during the exam:
1. ⚠️ **First Attempt**:  
   - A warning popup appears: "Warning: Tab switching detected! This is your first warning."
2. ⚠️ **Second Attempt**:  
   - Stronger warning: "Final warning! Further tab switches will auto-submit your exam."
3. 🚨 **Third Attempt**:  
   - Exam automatically submits with current answers
   - Violation is logged in Firebase
### 2. Admin/Proctor View
Admins can monitor exam integrity through:

#### 🔍 Violation Monitoring:
- Real-time tracking in Firebase under:  
  ```/users/{userId}/securityLogs/{securityLogId}```  
  Example violation log structure:
  ```json
  {
    "timestamp": 1712345678901,
    "action": "tab_switch",
    "IPAddress": "192.168.1.1",
    "systemDetails": "Chrome"
  }
  ```
## 📬 Contact

For support, bug reports, or feature requests:

### 📧 **Email Support**  
✉️ [jerwinfaderanga@gmail.com](jerwinfaderanga@gmail.com)  
*(Response time: 24-48 hours)*

### 🐛 **Bug Reports & Feature Requests**  
📌 [GitHub Issues](https://github.com/your-repo/issues)  
🔧 Please include:
- Detailed description
- Screenshots (if applicable)
- Steps to reproduce

### 💬 **Community & Discussions**  
💬 [Join our Discord Server](https://discord.gg/your-invite-link)  
📢 [GitHub Discussions](https://github.com/your-repo/discussions)

---

🚀 **We appreciate your feedback!**  
*Help us improve the Online Exam System for everyone.*