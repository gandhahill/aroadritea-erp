// Mengaktifkan strict typing untuk next-intl
// Menggunakan bahasa utama (ID) sebagai source of truth.
// Jika menggunakan Union Type, TypeScript akan menghasilkan error tersembunyi (TS2312).
// Gunakan script eksternal untuk sinkronisasi en.json & zh.json.
type Messages = typeof import('./messages/id.json');

declare interface IntlMessages extends Messages {}
