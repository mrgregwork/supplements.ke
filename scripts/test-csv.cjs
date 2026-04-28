var fs = require("fs");
var buf = fs.readFileSync("scripts/products-import.csv");
var hasBOM = buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF;
console.log("Has UTF8 BOM: " + hasBOM);
var text = buf.toString("utf8");
var lines = text.split("\n").map(function(l){return l.trim();}).filter(function(l){return l.length>0;});
console.log("Line count: " + lines.length);
console.log("Line 0: " + JSON.stringify(lines[0].slice(0,60)));
console.log("Line 1: " + JSON.stringify(lines[1].slice(0,80)));

function parseCSVLine(line) {
  var result = [];
  var current = "";
  var inQuotes = false;
  for (var i=0; i<line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else { current += ch; }
  }
  result.push(current);
  return result;
}

var parts = parseCSVLine(lines[1]);
console.log("Parts count: " + parts.length);
console.log("parts[0]: " + JSON.stringify(parts[0]));
console.log("parts[2]: " + JSON.stringify(parts[2]));
var price = parseFloat((parts[2]||"").trim());
console.log("price: " + price + " valid: " + (!isNaN(price) && price > 0));
