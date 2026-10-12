const fs = require('fs');

const svg = fs.readFileSync('public/logo.svg', 'utf-8');

// The emblem paths in public/logo.svg are the first 6 <path .../> elements
const pathMatches = svg.match(/<path[\s\S]*?\/>/g);
console.log('Total path elements in logo.svg:', pathMatches?.length);

if (pathMatches && pathMatches.length >= 6) {
  // First 6 paths make up the emblem (clipboard sheet, 3 lines, pin, wrench)
  const emblemPaths = pathMatches.slice(0, 6);

  // Exact bounds: X[376, 892.5] -> [376.0, 892.5], Y[267.2, 789.8]
  // Square viewBox: "347 241 575 575"
  const emblemSvg = `<svg version="1.0" xmlns="http://www.w3.org/2000/svg"
 width="512" height="512" viewBox="347 241 575 575"
 preserveAspectRatio="xMidYMid meet">
<g transform="translate(0.000000,1254.000000) scale(0.100000,-0.100000)"
fill="#09090b" stroke="none">
${emblemPaths.join('\n')}
</g>
</svg>
`;

  fs.writeFileSync('public/icons/emblem.svg', emblemSvg);
  fs.writeFileSync('public/icons/icon.svg', emblemSvg);
  console.log('Successfully wrote public/icons/emblem.svg and public/icons/icon.svg');
}
