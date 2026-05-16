const fs = require('fs');
const path = require('path');

const files = [
  'assets/style.css',
  'assets/style_print_fix.css',
  'examwebsite/css/styles.css'
];

const header = `/* stylelint-disable selector-id-pattern, selector-class-pattern, keyframes-name-pattern, no-descending-specificity */\n`;

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Header
  if (!content.includes('stylelint-disable selector-id-pattern')) {
    content = header + content;
  }

  // 2. Modern Color Notations
  content = content.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0?\.\d+)\s*\)/g, (match, r, g, b, a) => {
    let alphaPercent = parseFloat(a) * 100;
    alphaPercent = parseFloat(alphaPercent.toFixed(2));
    return `rgb(${r} ${g} ${b} / ${alphaPercent}%)`;
  });
  // Handle rgba(x,y,z, 1) or rgba(x,y,z, 0)
  content = content.replace(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(1|0)\s*\)/g, (match, r, g, b, a) => {
    let alphaPercent = parseFloat(a) * 100;
    return `rgb(${r} ${g} ${b} / ${alphaPercent}%)`;
  });
  
  content = content.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b/g, '#$1$2$3');

  // 3. Deprecated Properties & Vendor Prefixes
  content = content.replace(/page-break-inside\s*:/g, 'break-inside:');
  content = content.replace(/page-break-before\s*:/g, 'break-before:');
  content = content.replace(/word-wrap\s*:\s*break-word/g, 'overflow-wrap: break-word');
  
  content = content.replace(/-webkit-appearance:\s*([^;]+);/g, (match) => {
      return match + ' appearance: ' + match.split(':')[1].trim() + (match.endsWith(';') ? '' : ';');
  });
  // Clean duplicates if they existed
  content = content.replace(/-webkit-appearance:\s*([^;]+);\s*appearance:\s*\1;\s*appearance:\s*\1;/g, '-webkit-appearance: $1; appearance: $1;');

  content = content.replace(/-webkit-background-clip:\s*([^;]+);/g, (match) => {
      return match + ' background-clip: ' + match.split(':')[1].trim() + (match.endsWith(';') ? '' : ';');
  });
  content = content.replace(/-webkit-background-clip:\s*([^;]+);\s*background-clip:\s*\1;\s*background-clip:\s*\1;/g, '-webkit-background-clip: $1; background-clip: $1;');

  // 4. Modern Media Queries
  content = content.replace(/@media\s*\(\s*max-width\s*:\s*(\d+px)\s*\)/g, '@media (width <= $1)');
  content = content.replace(/@media\s*\(\s*min-width\s*:\s*(\d+px)\s*\)/g, '@media (width >= $1)');

  // 5. Code Formatting & Shorthands
  // Inset
  content = content.replace(/top:\s*0;[\s\n]*right:\s*0;[\s\n]*bottom:\s*0;[\s\n]*left:\s*0;/g, 'inset: 0;');
  content = content.replace(/left:\s*0;[\s\n]*top:\s*0;[\s\n]*width:\s*100%;[\s\n]*height:\s*100%;/g, 'inset: 0; width: 100%; height: 100%;'); // often seen
  
  // Padding/Margin Shorthands
  content = content.replace(/(margin|padding):\s*([^;]+);/g, (match, prop, val) => {
    let parts = val.trim().split(/\s+/);
    if (parts.length === 4) {
      if (parts[0] === parts[2] && parts[1] === parts[3]) {
        if (parts[0] === parts[1]) return `${prop}: ${parts[0]};`;
        return `${prop}: ${parts[0]} ${parts[1]};`;
      }
      if (parts[1] === parts[3]) {
        return `${prop}: ${parts[0]} ${parts[1]} ${parts[2]};`;
      }
    } else if (parts.length === 3) {
      if (parts[0] === parts[2]) {
        return `${prop}: ${parts[0]} ${parts[1]};`;
      }
    } else if (parts.length === 2) {
        if (parts[0] === parts[1]) return `${prop}: ${parts[0]};`;
    }
    return match;
  });

  // Pseudo-elements
  content = content.replace(/(?<!:):(before|after|first-letter|first-line)\b/g, '::$1');

  // Single line max declarations (basic fix: break them with newlines)
  // Find { prop1: val1; prop2: val2; } and turn into multiline
  content = content.replace(/\{([^{}]+)\}/g, (match, inner) => {
      // If it contains multiple semicolons and is on a single line
      if (!inner.includes('\n') && (inner.match(/;/g) || []).length > 1) {
          const parts = inner.split(';').filter(p => p.trim() !== '');
          const formatted = parts.map(p => `\n    ${p.trim()};`).join('') + '\n';
          return `{${formatted}}`;
      }
      return match;
  });
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Processed: ${file}`);
});
