import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyC69io8RFypxSzx6Q70Wcta9mhx44iOx2s",
  authDomain: "routine-timer-88667.firebaseapp.com",
  projectId: "routine-timer-88667",
  storageBucket: "routine-timer-88667.firebasestorage.app",
  messagingSenderId: "409353232778",
  appId: "1:409353232778:web:f67f66175b192ba12b6873",
  databaseURL: "https://routine-timer-88667-default-rtdb.asia-southeast1.firebasedatabase.app",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);