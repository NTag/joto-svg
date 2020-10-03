const fs = require('fs');
const JotoSVG = require('./index');
const { faSun, faCloudRain, faCloudSun, faCloudMoon } = require('@fortawesome/free-solid-svg-icons');

const joto = new JotoSVG();

const cityName = 'Paris, France';
joto.addString({
  x: 250 - cityName.length * 6,
  y: 40,
  size: 30,
  str: cityName,
  align: 'center',
});

joto.addFAIcon({ x: 10, y: 120, size: 80, icon: faSun });
joto.addFAIcon({ x: 140, y: 120, size: 80, icon: faCloudRain });
joto.addFAIcon({ x: 270, y: 120, size: 80, icon: faCloudSun });
joto.addFAIcon({ x: 400, y: 120, size: 80, icon: faCloudMoon });

const svg = joto.getSVG();
fs.writeFileSync('./joto.svg', svg, { encoding: 'utf8' });
