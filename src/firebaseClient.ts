import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyCpG-jibUuhZbqzqHCDR7PeSOddxoNF4sg",
    authDomain: "studiment-tracking.firebaseapp.com",
    databaseURL: "https://studiment-tracking-default-rtdb.firebaseio.com",
    projectId: "studiment-tracking"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
