const fs = require('fs');
const lines = fs.readFileSync('./items.txt').toString().split('\n');


const map = {};
for (const l of lines) {
  const [, name,, id] = l.split('|');
  if (!map[id]) {
    map[id] = name;
  }
}

fs.writeFileSync('./items.json', JSON.stringify(map));
