import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir, writeFile } from "node:fs/promises";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not configured.");

let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch (error) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const teamRef = db.collection("teams").doc("athletics-club");

function serialise(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value?.toDate === "function") return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialise);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialise(item)]));
  }
  return value;
}

async function readCollection(name) {
  const snapshot = await teamRef.collection(name).get();
  return Object.fromEntries(snapshot.docs.map((doc) => [doc.id, serialise(doc.data())]));
}

const [menus, days, members] = await Promise.all([
  readCollection("menus"),
  readCollection("days"),
  readCollection("members"),
]);

const backup = {
  format: "hamawakiac-firestore-backup-v1",
  projectId: serviceAccount.project_id,
  teamId: "athletics-club",
  createdAt: new Date().toISOString(),
  collections: { menus, days, members },
};

await mkdir("backup", { recursive: true });
await writeFile(
  "backup/hamawakiac-firestore-backup.json",
  JSON.stringify(backup, null, 2),
  "utf8",
);
console.log(`Backup complete: ${Object.keys(menus).length} menus, ${Object.keys(days).length} days, ${Object.keys(members).length} members.`);
