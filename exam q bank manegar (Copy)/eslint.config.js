import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    // تحديد بيئة العمل عشان ESLint ميعترضش على حاجات زي window أو document أو console
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node, // لو عندك ملفات بتشتغل بـ Node زي السكريبتات اللي في scratch
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off" // سيبناها off عشان لو بتستخدم console.log في سكريبتات المساعدة
    },
  },
  {
    // استثناء الفولدرات والمكتبات الخارجية اللي مش عايز تعمل لها فحص
    ignores: [
      "**/node_modules/**",
      "lib/arabic-reshaper.js",    // مكتبة خارجية مش بتاعتك
      "src/lib/qrcode.min.js",     // ملف مضغوط جاهز
      "docs/dev-notes/scratch/**", // ملفات تجارب وسكريبتات سريعة
    ],
  },
];