const Typr = require('./Typr/Typr.U');
const svgpath = require('svgpath');
const fs = require('fs');
const path = require('path');

const font = Typr.parse(fs.readFileSync(path.join(__dirname, 'SingleLine.otf')));

module.exports = function (fontOveride, str, size, align, lineHeight, color, x, y, typescale, rotate) {
  str = str.replace(/(<br>\s*)+$/, '');
  let fontFile = font[0];
  var gls = Typr.U.stringToGlyphs(fontFile, str);

  //  gls.reverse();  // reverse if Right-to-Left
  var path = Typr.U.glyphsToPath(fontFile, gls, lineHeight * fontFile.head.unitsPerEm, align);
  var scale = size / fontFile.head.unitsPerEm;
  const svg = Typr.U.pathToSVG(path);

  //SINGLE LINE PATHS
  const charArray = svg.split('none');
  // const charArray = svg.split("#");
  // const transformPaths = charArray.map(path => {
  //  CLOSED PATHS
  // const processedPaths = transformPaths.map(path => {
  //   console.log(path);
  //   let cleanPath = path.replace(
  //     "M",
  //     '<path fill="none" stroke="#000000" d="M'
  //   );
  //   cleanPath = `${cleanPath}X"/>`;

  //   //cleanPath = cleanPath.replace("Z", 'Z"/>');
  //   return cleanPath;
  // });

  // Filter array for single line path data denoted by red stroke color <- needs a better method standardising single line data within font file
  // const singleLines = charArray.filter(charString => {
  //   console.log(charString);
  //   const hexCode = charString.substring(0, 6);
  //   return hexCode === "none";
  // });

  const processedPaths = charArray.map((singleLinePath) => {
    let cleanPath = singleLinePath.replace(/^[^M]+/i, '');
    let transformed = svgpath(cleanPath)
      // DON'T NEED TO FLIP SINGLE LINE
      .scale(scale * typescale, scale * typescale)
      .translate(x * typescale, y * typescale)
      .rotate(rotate)
      .round(2)
      .toString();

    return transformed;
    // return `<path fill="none" stroke="#000000" d="${transformed}"/>`;
  });

  let allPaths = processedPaths.join('');
  return allPaths;

  return `<svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="500" height="500"><g xmlns="http://www.w3.org/2000/svg" fill="none" fill-rule="nonzero" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" font-family="none" font-weight="none" font-size="none" text-anchor="none" style="mix-blend-mode: normal">${allPaths}</g></svg>`;
};
