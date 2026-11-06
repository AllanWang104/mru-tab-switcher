// Clipboard writer. Offscreen documents aren't focused, so navigator.clipboard
// is unavailable; execCommand('copy') on a textarea still works here.
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type !== 'offscreen-copy') return;
  const buf = document.getElementById('buf');
  buf.value = msg.text;
  buf.select();
  reply(document.execCommand('copy'));
});
