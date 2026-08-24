const ALARM_FREQUENCIES = [880, 660, 880];

async function playAlarmPattern(): Promise<void> {
  const audioContext = new AudioContext();
  await audioContext.resume();
  const startAt = audioContext.currentTime + 0.04;

  ALARM_FREQUENCIES.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const toneStart = startAt + index * 0.38;
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, toneStart);
    gain.gain.exponentialRampToValueAtTime(0.28, toneStart + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, toneStart + 0.27);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(toneStart);
    oscillator.stop(toneStart + 0.3);
  });

  globalThis.setTimeout(() => void audioContext.close(), 1_500);
}

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (
    typeof message === "object" &&
    message !== null &&
    "target" in message &&
    "type" in message &&
    message.target === "offscreen" &&
    message.type === "PLAY_ALARM"
  ) {
    void playAlarmPattern();
  }
  return false;
});
