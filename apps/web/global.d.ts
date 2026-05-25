// Mengaktifkan strict typing untuk next-intl
// Menggunakan Union Type (|) untuk ketiga bahasa.
// TypeScript hanya akan mengizinkan key yang ADA DI KETIGA FILE.
// Jika ada key yang missing di salah satu file, maka akan menjadi error saat dicompile.
type MessagesId = typeof import('./messages/id.json');
type MessagesEn = typeof import('./messages/en.json');
type MessagesZh = typeof import('./messages/zh.json');

type Messages = MessagesId | MessagesEn | MessagesZh;

declare interface IntlMessages extends Messages {}
