// Regenerate products-import.csv without BOM, with proper UTF-8 encoding
var fs = require("fs");
var path = require("path");

var inputPath = path.join(__dirname, "products-import.csv");
var outputPath = path.join(__dirname, "products-clean.csv");

var buf = fs.readFileSync(inputPath);

// Strip UTF-8 BOM if present
var text = buf.toString("utf8");
if (text.charCodeAt(0) === 0xFEFF) {
  text = text.slice(1);
  console.log("Stripped BOM");
}

// Normalize line endings to \n only
text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
console.log("Total lines (including header):", lines.length);

// Write clean version without BOM, UTF-8
fs.writeFileSync(outputPath, text, { encoding: "utf8" });
console.log("Written to:", outputPath);

// Quick validation
var dataLines = lines.slice(1);
var validCount = 0;
dataLines.forEach(function(line) {
  // Simple check: has price-like number
  var parts = [];
  var current = "";
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      parts.push(current); current = "";
    } else { current += ch; }
  }
  parts.push(current);
  var price = parseFloat((parts[2] || "").trim());
  if (!isNaN(price) && price > 0) validCount++;
});
console.log("Valid rows:", validCount, "/", dataLines.length);
