# Tempo Heist online modes - Firebase setup

The solo game works without Firebase. Firebase is required for the `ONLINE 1V1` and `BATTLE ROYALE` tabs.

## Free setup

1. Create a project in [Firebase Console](https://console.firebase.google.com/).
2. Open `Build > Realtime Database`, create a database, and choose a region.
3. For a private prototype, start in test mode.
4. Copy the database URL shown in Firebase Console.
5. Paste it into `firebase-config.js`:

```js
window.TEMPO_HEIST_FIREBASE = {
  databaseURL: "https://YOUR-PROJECT-default-rtdb.europe-west1.firebasedatabase.app"
};
```

## Prototype rules

These rules allow anonymous room access. They are suitable for a shared prototype, not for a public production launch:

```json
{
  "rules": {
    "tempo-heist": {
      "rooms": {
        ".read": true,
        ".write": true
      },
      "battleRooms": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

For production, add Firebase Authentication and stricter rules before publishing broadly.
