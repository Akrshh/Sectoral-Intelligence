const fs = require('fs');
const code = fs.readFileSync('app.js', 'utf8');
const lines = code.split('\n');
let depth = 0;
// Track depth at function declarations
for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevDepth = depth;
    for (const c of line) {
        if (c === '{') depth++;
        if (c === '}') depth--;
    }
    // Show lines where functions start or depth changes significantly
    if (line.match(/^\s*(async\s+)?function\s/) || line.match(/^\s+function\s+\w+\s*\(/) || (prevDepth !== depth && line.trim().match(/^(function|}\s*$|return\s*\{)/))) {
        console.log(`L${String(i+1).padStart(3)}: d${prevDepth}->${depth} | ${line.trimEnd().substring(0,80)}`);
    }
}
console.log('\nFinal depth:', depth);
