const fs = require('fs');
const code = fs.readFileSync('old_cases.tsx', 'utf8');

const startStr = '{showEditor && (';
const startIdx = code.indexOf(startStr);

if (startIdx === -1) {
    console.log('Not found');
    process.exit(1);
}

// Find matching `)` for the `(` after `showEditor && `
let openCount = 0;
let matchIdx = -1;

for (let i = startIdx + '{showEditor && '.length; i < code.length; i++) {
    if (code[i] === '(') openCount++;
    if (code[i] === ')') openCount--;
    
    if (openCount === 0) {
        matchIdx = i;
        break;
    }
}

if (matchIdx !== -1) {
    // The closing is at matchIdx.
    // What line is it on?
    const lines = code.substring(0, matchIdx).split('\n');
    console.log('Matching closing parenthesis is at line:', lines.length);
    console.log('Content around it:');
    console.log(code.substring(matchIdx - 50, matchIdx + 50));
} else {
    console.log('No matching parenthesis found');
}
