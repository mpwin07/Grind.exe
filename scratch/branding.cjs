const fs = require('fs');
const path = require('path');

const walk = (dir) => {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
};

const files = walk('d:/leetcode/src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace texts
  content = content.replace(/LeetCode Gamification/g, 'grind.exe');
  content = content.replace(/LeetCode journey/gi, 'grind.exe');
  
  // Update favicon in __root.tsx
  if (file.endsWith('__root.tsx')) {
    if (!content.includes('rel: "icon"')) {
      content = content.replace(
        /links: \[\s*\{/,
        'links: [\n      { rel: "icon", href: "/logo.png" },\n      {'
      );
    }
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
}
