const ENABLED_KEY = 'contrest_screentime_on';
const MINUTES_KEY = 'contrest_screentime_minutes';

export function isScreenTimeReminderOn(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== 'false'; // on by default, opt-out
  } catch {
    return true;
  }
}

export function setScreenTimeReminderOn(v: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, String(v));
  } catch {
    /* ignore */
  }
}

export function getScreenTimeMinutes(): number {
  try {
    const v = Number(localStorage.getItem(MINUTES_KEY));
    return [20, 40, 60].includes(v) ? v : 40;
  } catch {
    return 40;
  }
}

export function setScreenTimeMinutes(minutes: number): void {
  try {
    localStorage.setItem(MINUTES_KEY, String(minutes));
  } catch {
    /* ignore */
  }
}
