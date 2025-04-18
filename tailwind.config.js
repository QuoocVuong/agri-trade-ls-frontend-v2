/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}", // Quét các file html và ts trong thư mục src
  ],
  theme: {
    extend: {
      // Thêm các tùy chỉnh theme ở đây nếu cần (màu sắc, font...)
      colors: {
        primary: '#28a745', // Ví dụ màu xanh lá cây chính
        'primary-focus': '#218838', // Màu khi focus/hover
        secondary: '#6c757d',
        accent: '#ffc107',
        // ... thêm các màu khác
      },
      fontFamily: {
        // Ví dụ thêm font Inter
        // sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [
    require("daisyui"), // Kích hoạt plugin DaisyUI
  ],
  // Cấu hình DaisyUI (tùy chọn)
  daisyui: {
    themes: ["light", "emerald", "forest", "corporate", "dark"], // Chọn các theme bạn muốn dùng
    // styled: true,
    // base: true,
    // utils: true,
    // logs: true,
    // rtl: false,
    // prefix: "",
    // darkTheme: "dark",
  },
}
