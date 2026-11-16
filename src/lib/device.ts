import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'kerf.deviceId';

let deviceId: Promise<string> | undefined;

/**
 * This app install's device ID. It is generated on first use and kept in storage, and is sent at
 * sign-in so the server can tell which device each session belongs to. It is not the tape
 * measure's ID, which is stored with each measurement.
 */
export function getDeviceId() {
  deviceId ??= AsyncStorage.getItem(STORAGE_KEY)
    .catch(() => null)
    .then((saved) => {
      if (saved) return saved;
      const created = `app-${Math.random().toString(36).slice(2, 10)}`;
      AsyncStorage.setItem(STORAGE_KEY, created).catch(() => {});
      return created;
    });
  return deviceId;
}
