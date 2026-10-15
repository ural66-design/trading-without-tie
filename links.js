// Add the owner's real destination URLs here. Empty entries show a clear notice.
const destinations = {
  trading: '',
  robots: '',
  youtube: 'http://www.youtube.com/@vladimir.lifestyle',
  instagram: 'https://www.instagram.com/vladimir.lifestyle'
};
const notice = document.querySelector('#link-notice');
document.querySelectorAll('[data-link]').forEach(button => {
  const url = destinations[button.dataset.link];
  if (url && /^https?:\/\//i.test(url)) {
    const link = document.createElement('a');
    link.className = button.className;
    link.href = url;
    link.innerHTML = button.innerHTML;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    button.replaceWith(link);
  } else {
    button.addEventListener('click', () => notice.showModal());
  }
});
notice.querySelectorAll('button').forEach(button => button.addEventListener('click', () => notice.close()));
notice.addEventListener('click', event => { if (event.target === notice) { const r = notice.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) notice.close(); } });
