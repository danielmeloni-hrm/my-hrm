import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import fs from 'fs';

const css = fs.readFileSync('src/app/globals.css', 'utf8');

const res = await postcss([tailwind()]).process(css, { from: 'src/app/globals.css' });
const out = res.css;

const check = (name, needle) =>
  console.log(name.padEnd(34), out.includes(needle) ? 'OK' : 'MANCANTE');

check('variabile superficie', '--surface-1');
check('blocco tema scuro', '.dark');
check('override bianco', '--color-white: var(--surface-1)');
check('scala slate invertita', '--color-slate-900: #eef2f8');
console.log('dimensione css generato:', out.length, 'caratteri');
