// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCM9hJ69HpvV_gCdapm2UmkxrumeNsJhgw",
  authDomain: "frisco-web.firebaseapp.com",
  projectId: "frisco-web",
  storageBucket: "frisco-web.firebasestorage.app",
  messagingSenderId: "1001144206780",
  appId: "1:1001144206780:web:ca8e0a1e5cd792ee0057b9",
  measurementId: "G-T534ZTPKYT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
