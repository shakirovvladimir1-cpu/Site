document.getElementById('year').textContent = new Date().getFullYear();

// Заглушка: бэкенда нет. Форма собирает письмо в почтовом клиенте.
// Замените адрес на реальный или подключите обработчик (n8n webhook, Formspree и т.п.).
const MAIL_TO = 'hello@example.com';

const form = document.getElementById('form');
const status = document.getElementById('status');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = (data.get('name') || '').trim();
  const contact = (data.get('contact') || '').trim();
  const task = (data.get('task') || '').trim();

  if (!name || !contact || !task) {
    status.textContent = 'Заполните все поля.';
    return;
  }

  const subject = encodeURIComponent('Задача от ' + name);
  const body = encodeURIComponent(task + '\n\nКонтакт: ' + contact);
  window.location.href = 'mailto:' + MAIL_TO + '?subject=' + subject + '&body=' + body;
  status.textContent = 'Открываем почтовый клиент…';
});
