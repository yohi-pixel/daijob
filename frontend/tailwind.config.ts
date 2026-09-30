import type { Config } from 'tailwindcss';

/**
 * 逮JOB 设计 token ——「猎场」
 *
 * 核心纪律：全站只有一个有色相的颜色（signal 信号黄），
 * 只用于「新鲜度 / 热招」这一件事。按钮、导航、选中态一律用墨色。
 * 一旦信号色跑到按钮上，这套视觉就塌回默认后台款了。
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // —— 底与面（刻意偏冷，不用暖米白）——
        background: '#EFF2F6',
        surface: '#FFFFFF',
        'surface-bright': '#FFFFFF',
        'surface-dim': '#E3E9F0',
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F7F9FC',
        'surface-container': '#EDF1F6',
        'surface-container-high': '#E3E9F0',
        'surface-container-highest': '#D9E1EA',
        'surface-variant': '#EDF1F6',
        'surface-tint': '#0E1B2C',

        // —— 文字 ——
        'on-background': '#0E1B2C',
        'on-surface': '#0E1B2C',
        'on-surface-variant': '#5C6B80',
        muted: '#8A97A8',
        ink: '#0E1B2C',

        // —— 描线 ——
        outline: '#94A3B5',
        'outline-variant': '#D9E1EA',
        line: '#D9E1EA',

        // —— 结构色：primary 就是墨。品牌不靠色相，靠像素小人和字标。——
        primary: '#0E1B2C',
        'primary-dim': '#0E1B2C',
        'primary-fixed': '#0E1B2C',
        'primary-fixed-dim': '#0E1B2C',
        'primary-container': '#E5EAF1',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#0E1B2C',
        'on-primary-fixed': '#FFFFFF',
        'on-primary-fixed-variant': '#0E1B2C',
        'inverse-primary': '#FFFFFF',
        'inverse-surface': '#0E1B2C',
        'inverse-on-surface': '#E7ECF2',

        // —— 唯一的色相：新鲜度信号 ——
        signal: '#FFB020',
        'signal-soft': '#FFF3D9',
        'signal-ink': '#7A4C00',
        'signal-dim': '#C98600',

        // —— 语义 ——
        error: '#C2382C',
        'error-dim': '#9B2C22',
        'error-container': '#FCEAE7',
        'on-error': '#FFFFFF',
        'on-error-container': '#7E1D14',

        // —— 保留旧 token 名（少量组件仍在用），统一压到冷灰 ——
        secondary: '#475A73',
        'secondary-dim': '#3A4A5E',
        'secondary-container': '#E5EAF1',
        'on-secondary': '#FFFFFF',
        'on-secondary-container': '#0E1B2C',
        'secondary-fixed': '#E5EAF1',
        'secondary-fixed-dim': '#CFD8E3',
        'on-secondary-fixed': '#0E1B2C',
        'on-secondary-fixed-variant': '#475A73',
        tertiary: '#475A73',
        'tertiary-dim': '#3A4A5E',
        'tertiary-container': '#EDF1F6',
        'on-tertiary': '#FFFFFF',
        'on-tertiary-container': '#0E1B2C',
        'tertiary-fixed': '#EDF1F6',
        'tertiary-fixed-dim': '#D9E1EA',
        'on-tertiary-fixed': '#0E1B2C',
        'on-tertiary-fixed-variant': '#475A73',
      },

      // 三档圆角：控件 6 / 卡片 10 / 弹层 14。全场一个圆角值是层级读不出来的主因。
      borderRadius: {
        none: '0',
        sm: '3px',
        DEFAULT: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
        '2xl': '10px',
        '3xl': '14px',
        full: '9999px',
      },

      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          '"Noto Sans CJK SC"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },

      fontSize: {
        micro: ['11px', { lineHeight: '16px' }],
        meta: ['12px', { lineHeight: '17px' }],
        body: ['14px', { lineHeight: '21px' }],
        title: ['15px', { lineHeight: '22px' }],
        lead: ['17px', { lineHeight: '26px' }],
        h2: ['20px', { lineHeight: '28px' }],
        h1: ['26px', { lineHeight: '34px' }],
        display: ['34px', { lineHeight: '40px' }],
      },

      // 阴影保持安静：默认只做「抬起来一点点」
      boxShadow: {
        sm: '0 1px 2px rgba(14, 27, 44, 0.06)',
        DEFAULT: '0 1px 3px rgba(14, 27, 44, 0.08), 0 1px 2px rgba(14, 27, 44, 0.04)',
        md: '0 2px 8px rgba(14, 27, 44, 0.08)',
        lg: '0 8px 24px rgba(14, 27, 44, 0.10)',
        xl: '0 16px 40px rgba(14, 27, 44, 0.14)',
        none: 'none',
      },

      spacing: {
        18: '4.5rem',
      },

      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')],
} satisfies Config;
