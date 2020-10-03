# joto-svg: generate SVGs for joto.rocks

Generate SVGs contains text, icons, charts for https://joto.rocks.

## Installation

This module is meant to be used server-side, using NodeJS.

```bash
npm i joto-svg
```

## Usage

The canvas size is 500×500.

```js
const fs = require('fs');
const JotoSVG = require('joto-svg');

const joto = new JotoSVG();

joto.addString({ x: 250, y: 40, size: 30, str: 'Paris, France', align: 'center' });

const svg = joto.getSVG();
fs.writeFileSync('./joto.svg', svg, { encoding: 'utf8' });
```

Check `test.js` for a more complete example. You can especially use icons from Font Awesome. Check `index.js` to get details about usage.

You can use `joto.html` to see how your svg would render on the board.

## Examples

Check `examples/` folder.

<div align="center">
  <img src="https://raw.githubusercontent.com/NTag/joto-svg/master/examples/weather-weekend.svg" width="30%">
  <img src="https://raw.githubusercontent.com/NTag/joto-svg/master/examples/weather-france.svg" width="30%">
  <img src="https://raw.githubusercontent.com/NTag/joto-svg/master/examples/weather-cities.svg" width="30%">
</div>

## Acknowledgment

Code in `./joto-text` comes from Joto's webapp; I made some small changes so it works in a node environment, but all credits go to Joto.

## Related packages

- [joto-api](https://github.com/NTag/joto-api): send SVGs to your Joto with NodeJS
