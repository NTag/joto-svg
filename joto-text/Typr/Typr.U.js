const Typr = require('./Typr.js');

if (Typr.U == null) Typr.U = {};

Typr.U.codeToGlyph = function (font, code) {
  let cmap = font.cmap;

  let tind = -1;
  if (cmap.p0e4 != null) tind = cmap.p0e4;
  else if (cmap.p3e1 != null) tind = cmap.p3e1;
  else if (cmap.p1e0 != null) tind = cmap.p1e0;
  else if (cmap.p0e3 != null) tind = cmap.p0e3;

  if (tind == -1) throw 'no familiar platform and encoding!';

  let tab = cmap.tables[tind];
  if (tab.format == 0) {
    if (code >= tab.map.length) return 0;
    return tab.map[code];
  } else if (tab.format == 4) {
    let sind = -1;
    for (let i = 0; i < tab.endCount.length; i++)
      if (code <= tab.endCount[i]) {
        sind = i;
        break;
      }
    if (sind == -1) {
      return 0;
    }
    if (tab.startCount[sind] > code) {
      return 0;
    }

    let gli = 0;
    if (tab.idRangeOffset[sind] != 0)
      gli =
        tab.glyphIdArray[
        code - tab.startCount[sind] + (tab.idRangeOffset[sind] >> 1) - (tab.idRangeOffset.length - sind)
        ];
    else {
      gli = code + tab.idDelta[sind];
      return gli & 0xffff;
    }
  } else if (tab.format == 12) {
    if (code > tab.groups[tab.groups.length - 1][1]) return 0;
    for (let i = 0; i < tab.groups.length; i++) {
      let grp = tab.groups[i];
      if (grp[0] <= code && code <= grp[1]) return grp[2] + (code - grp[0]);
    }
    return 0;
  } else throw 'unknown cmap table format ' + tab.format;
};

Typr.U.glyphToPath = function (font, gid) {
  let path = { cmds: [], crds: [] };
  if (font.SVG && font.SVG.entries[gid]) {
    let p = font.SVG.entries[gid];
    if (p == null) return path;
    if (typeof p == 'string') {
      p = Typr.SVG.toPath(p);
      font.SVG.entries[gid] = p;
    }
    return p;
  } else if (font.CFF) {
    let state = {
      x: 0,
      y: 0,
      stack: [],
      nStems: 0,
      haveWidth: false,
      width: font.CFF.Private ? font.CFF.Private.defaultWidthX : 0,
      open: false,
    };
    let cff = font.CFF,
      pdct = font.CFF.Private;
    if (cff.ROS) {
      let gi = 0;
      while (cff.FDSelect[gi + 2] <= gid) gi += 2;
      pdct = cff.FDArray[cff.FDSelect[gi + 1]].Private;
    }
    Typr.U._drawCFF(font.CFF.CharStrings[gid], state, cff, pdct, path);
  } else if (font.glyf) {
    Typr.U._drawGlyf(gid, font, path);
  }
  return path;
};

Typr.U._drawGlyf = function (gid, font, path) {
  let gl = font.glyf[gid];
  if (gl == null) gl = font.glyf[gid] = Typr.glyf._parseGlyf(font, gid);
  if (gl != null) {
    if (gl.noc > -1) Typr.U._simpleGlyph(gl, path);
    else Typr.U._compoGlyph(gl, font, path);
  }
};
Typr.U._simpleGlyph = function (gl, p) {
  for (let c = 0; c < gl.noc; c++) {
    let i0 = c == 0 ? 0 : gl.endPts[c - 1] + 1;
    let il = gl.endPts[c];

    for (let i = i0; i <= il; i++) {
      let pr = i == i0 ? il : i - 1;
      let nx = i == il ? i0 : i + 1;
      let onCurve = gl.flags[i] & 1;
      let prOnCurve = gl.flags[pr] & 1;
      let nxOnCurve = gl.flags[nx] & 1;

      let x = gl.xs[i],
        y = gl.ys[i];

      if (i == i0) {
        if (onCurve) {
          if (prOnCurve) Typr.U.P.moveTo(p, gl.xs[pr], gl.ys[pr]);
          else {
            Typr.U.P.moveTo(p, x, y);
            continue; /*  will do curveTo at il  */
          }
        } else {
          if (prOnCurve) Typr.U.P.moveTo(p, gl.xs[pr], gl.ys[pr]);
          else Typr.U.P.moveTo(p, (gl.xs[pr] + x) / 2, (gl.ys[pr] + y) / 2);
        }
      }
      if (onCurve) {
        if (prOnCurve) Typr.U.P.lineTo(p, x, y);
      } else {
        if (nxOnCurve) Typr.U.P.qcurveTo(p, x, y, gl.xs[nx], gl.ys[nx]);
        else Typr.U.P.qcurveTo(p, x, y, (x + gl.xs[nx]) / 2, (y + gl.ys[nx]) / 2);
      }
    }
    Typr.U.P.closePath(p);
  }
};
Typr.U._compoGlyph = function (gl, font, p) {
  for (let j = 0; j < gl.parts.length; j++) {
    let path = { cmds: [], crds: [] };
    let prt = gl.parts[j];
    Typr.U._drawGlyf(prt.glyphIndex, font, path);

    let m = prt.m;
    for (let i = 0; i < path.crds.length; i += 2) {
      let x = path.crds[i],
        y = path.crds[i + 1];
      p.crds.push(x * m.a + y * m.b + m.tx);
      p.crds.push(x * m.c + y * m.d + m.ty);
    }
    for (let i = 0; i < path.cmds.length; i++) p.cmds.push(path.cmds[i]);
  }
};

Typr.U._getGlyphClass = function (g, cd) {
  let intr = Typr._lctf.getInterval(cd, g);
  return intr == -1 ? 0 : cd[intr + 2];
  //for(let i=0; i<cd.start.length; i++)
  //	if(cd.start[i]<=g && cd.end[i]>=g) return cd.class[i];
  //return 0;
};

Typr.U.getPairAdjustment = function (font, g1, g2) {
  //return 0;
  if (font.GPOS) {
    let gpos = font['GPOS'];
    let llist = gpos.lookupList,
      flist = gpos.featureList;
    let tused = [];
    for (let i = 0; i < flist.length; i++) {
      let fl = flist[i]; //console.log(fl);
      if (fl.tag != 'kern') continue;
      for (let ti = 0; ti < fl.tab.length; ti++) {
        if (tused[fl.tab[ti]]) continue;
        tused[fl.tab[ti]] = true;
        let tab = llist[fl.tab[ti]];
        //console.log(tab);

        for (let j = 0; j < tab.tabs.length; j++) {
          if (tab.tabs[i] == null) continue;
          let ltab = tab.tabs[j],
            ind;
          if (ltab.coverage) {
            ind = Typr._lctf.coverageIndex(ltab.coverage, g1);
            if (ind == -1) continue;
          }

          if (tab.ltype == 1) {
            //console.log(ltab);
          } else if (tab.ltype == 2) {
            let adj;
            if (ltab.fmt == 1) {
              let right = ltab.pairsets[ind];
              for (let i = 0; i < right.length; i++) if (right[i].gid2 == g2) adj = right[i];
            } else if (ltab.fmt == 2) {
              let c1 = Typr.U._getGlyphClass(g1, ltab.classDef1);
              let c2 = Typr.U._getGlyphClass(g2, ltab.classDef2);
              adj = ltab.matrix[c1][c2];
            }
            //if(adj) console.log(ltab, adj);
            if (adj && adj.val2) return adj.val2[2];
          }
        }
      }
    }
  }
  if (font.kern) {
    let ind1 = font.kern.glyph1.indexOf(g1);
    if (ind1 != -1) {
      let ind2 = font.kern.rval[ind1].glyph2.indexOf(g2);
      if (ind2 != -1) return font.kern.rval[ind1].vals[ind2];
    }
  }

  return 0;
};

function toUTF16(codePoint) {
  var TEN_BITS = parseInt('1111111111', 2);
  function u(codeUnit) {
    return '\\u' + codeUnit.toString(16).toUpperCase();
  }

  if (codePoint <= 0xffff) {
    return u(codePoint);
  }
  codePoint -= 0x10000;

  // Shift right to get to most significant 10 bits
  var leadSurrogate = 0xd800 + (codePoint >> 10);

  // Mask to get least significant 10 bits
  var tailSurrogate = 0xdc00 + (codePoint & TEN_BITS);

  return u(leadSurrogate) + u(tailSurrogate);
}

Typr.U.stringToGlyphs = function (font, str) {
  let gls = [];
  for (let i = 0; i < str.length; i++) {
    let cc = str.codePointAt(i);
    if (cc > 0xffff) i++;

    // 		let hexString = cc.toString(16);
    // console.log(`u${hexString}`);

    gls.push(Typr.U.codeToGlyph(font, cc));
  }
  for (let i = 0; i < str.length; i++) {
    let cc = str.codePointAt(i);
    if (cc == 2367) {
      let t = gls[i - 1];
      gls[i - 1] = gls[i];
      gls[i] = t;
    }
    //if(cc==2381) {  let t=gls[i+1];  gls[i+1]=gls[i];  gls[i]=t;  }
    if (cc > 0xffff) i++;
  }
  //console.log(gls.slice(0));

  //console.log(gls);  return gls;

  let gsub = font['GSUB'];
  if (gsub == null) return gls;
  let llist = gsub.lookupList,
    flist = gsub.featureList;

  let cligs = [
    'rlig',
    'liga',
    'mset',
    'isol',
    'init',
    'fina',
    'medi',
    'half',
    'pres',
    'blws' /* Tibetan fonts like Himalaya.ttf */,
  ];

  //console.log(gls.slice(0));
  let tused = [];
  for (let fi = 0; fi < flist.length; fi++) {
    let fl = flist[fi];
    if (cligs.indexOf(fl.tag) == -1) continue;
    //if(fl.tag=="blwf") continue;
    //console.log(fl);
    //console.log(fl.tag);
    for (let ti = 0; ti < fl.tab.length; ti++) {
      if (tused[fl.tab[ti]]) continue;
      tused[fl.tab[ti]] = true;
      let tab = llist[fl.tab[ti]];
      //console.log(fl.tab[ti], tab.ltype);
      //console.log(fl.tag, tab);
      for (let ci = 0; ci < gls.length; ci++) {
        let feat = Typr.U._getWPfeature(str, ci);
        if ('isol,init,fina,medi'.indexOf(fl.tag) != -1 && fl.tag != feat) continue;

        Typr.U._applySubs(gls, ci, tab, llist);
      }
    }
  }
  return gls;
};
Typr.U._getWPfeature = function (str, ci) {
  // get Word Position feature
  let wsep = '\n\t" ,.:;!?()  ،';
  let R =
    'آأؤإاةدذرزوٱٲٳٵٶٷڈډڊڋڌڍڎڏڐڑڒړڔڕږڗژڙۀۃۄۅۆۇۈۉۊۋۍۏےۓەۮۯܐܕܖܗܘܙܞܨܪܬܯݍݙݚݛݫݬݱݳݴݸݹࡀࡆࡇࡉࡔࡧࡩࡪࢪࢫࢬࢮࢱࢲࢹૅેૉ૊૎૏ૐ૑૒૝ૡ૤૯஁ஃ஄அஉ஌எஏ஑னப஫஬';
  let L = 'ꡲ્૗';

  let slft = ci == 0 || wsep.indexOf(str[ci - 1]) != -1;
  let srgt = ci == str.length - 1 || wsep.indexOf(str[ci + 1]) != -1;

  if (!slft && R.indexOf(str[ci - 1]) != -1) slft = true;
  if (!srgt && R.indexOf(str[ci]) != -1) srgt = true;

  if (!srgt && L.indexOf(str[ci + 1]) != -1) srgt = true;
  if (!slft && L.indexOf(str[ci]) != -1) slft = true;

  let feat = null;
  if (slft) feat = srgt ? 'isol' : 'init';
  else feat = srgt ? 'fina' : 'medi';

  return feat;
};
Typr.U._applySubs = function (gls, ci, tab, llist) {
  let rlim = Math.min(3, gls.length - ci - 1);
  //if(ci==0) console.log("++++ ", tab.ltype);
  for (let j = 0; j < tab.tabs.length; j++) {
    if (tab.tabs[j] == null) continue;
    let ltab = tab.tabs[j],
      ind;
    if (ltab.coverage) {
      ind = Typr._lctf.coverageIndex(ltab.coverage, gls[ci]);
      if (ind == -1) continue;
    }
    //if(ci==0) console.log(ind, ltab);
    //*
    if (tab.ltype == 1) {
      let gl = gls[ci];
      if (ltab.fmt == 1) gls[ci] = gls[ci] + ltab.delta;
      else gls[ci] = ltab.newg[ind];
      //console.log("applying ... 1", ci, gl, gls[ci]);
    } //*
    else if (tab.ltype == 4) {
      let vals = ltab.vals[ind];

      for (let k = 0; k < vals.length; k++) {
        let lig = vals[k],
          rl = lig.chain.length;
        if (rl > rlim) continue;
        let good = true,
          em1 = 0;
        for (let l = 0; l < rl; l++) {
          while (gls[ci + em1 + (1 + l)] == -1) em1++;
          if (lig.chain[l] != gls[ci + em1 + (1 + l)]) good = false;
        }
        if (!good) continue;
        gls[ci] = lig.nglyph;
        for (let l = 0; l < rl + em1; l++) gls[ci + l + 1] = -1;
        break; // first character changed, other ligatures do not apply anymore
        //console.log("lig", ci, lig.chain, lig.nglyph);
        //console.log("applying ...");
      }
    } else if (tab.ltype == 5 && ltab.fmt == 2) {
      let cind = Typr._lctf.getInterval(ltab.cDef, gls[ci]);
      let cls = ltab.cDef[cind + 2],
        scs = ltab.scset[cls];
      for (let i = 0; i < scs.length; i++) {
        let sc = scs[i],
          inp = sc.input;
        if (inp.length > rlim) continue;
        let good = true;
        for (let l = 0; l < inp.length; l++) {
          let cind2 = Typr._lctf.getInterval(ltab.cDef, gls[ci + 1 + l]);
          if (cind == -1 && ltab.cDef[cind2 + 2] != inp[l]) {
            good = false;
            break;
          }
        }
        if (!good) continue;
        //console.log(ci, gl);
        let lrs = sc.substLookupRecords;
        for (let k = 0; k < lrs.length; k += 2) {
          let gi = lrs[k],
            tabi = lrs[k + 1];
          //Typr.U._applyType1(gls, ci+gi, llist[tabi]);
          //console.log(tabi, gls[ci+gi], llist[tabi]);
        }
      }
    } else if (tab.ltype == 6 && ltab.fmt == 3) {
      //if(ltab.backCvg.length==0) return;
      if (!Typr.U._glsCovered(gls, ltab.backCvg, ci - ltab.backCvg.length)) continue;
      if (!Typr.U._glsCovered(gls, ltab.inptCvg, ci)) continue;
      if (!Typr.U._glsCovered(gls, ltab.ahedCvg, ci + ltab.inptCvg.length)) continue;
      //console.log(ci, ltab);
      let lr = ltab.lookupRec; //console.log(ci, gl, lr);
      for (let i = 0; i < lr.length; i += 2) {
        let cind = lr[i],
          tab2 = llist[lr[i + 1]];
        //console.log("-", lr[i+1], tab2);
        Typr.U._applySubs(gls, ci + cind, tab2, llist);
      }
    }
    //else console.log("Unknown table", tab.ltype, ltab.fmt);
    //*/
  }
};

Typr.U._glsCovered = function (gls, cvgs, ci) {
  for (let i = 0; i < cvgs.length; i++) {
    let ind = Typr._lctf.coverageIndex(cvgs[i], gls[ci + i]);
    if (ind == -1) return false;
  }
  return true;
};

Typr.U.glyphsToPath = function (font, gls, lineHeight, align, clr) {
  //gls = gls.reverse();//gls.slice(0,12).concat(gls.slice(12).reverse());
  let tpath = { cmds: [], crds: [] };
  //JIM EDIT - was y=0;
  let lineTotals = [];
  let lineOffsets = [];
  let lineX = 0;
  let lineY = 0;
  let longestLine = 0;

  let glyphLength = 0;

  //KEEP TRACK OF ALL THE LINE LENGTHS AND HEIGHTS
  for (let i = 0; i < gls.length; i++) {
    //console.log("outside", gls[i]);

    // JIM HACK MULTI-GLYPTH fix
    //if (gls[i] != -1) {
    lineX += font.hmtx.aWidth[gls[i]]; // - font.hmtx.lsBearing[gid];
    //}

    // JIM HACK MULTI-GLYPTH fix
    //glyphLength++;

    if (gls[i] === 2) {
      // console.log("line break", lineHeight);
      lineY += lineHeight; // - font.hmtx.lsBearing[gid];
      lineTotals.push({ x: lineX, y: lineY });
      if (lineX > longestLine) {
        longestLine = lineX;
      }
      lineX = 0;
    }

    // JIM HACK MULTI-GLYPTH fix
    // gls.length swap for glyphLength

    if (i === gls.length - 1) {
      lineY += lineHeight; // - font.hmtx.lsBearing[gid];
      lineTotals.push({ x: lineX, y: lineY });
      if (lineX > longestLine) {
        longestLine = lineX;
      }
    }
  }

  for (let l = 0; l < lineTotals.length; l++) {
    lineOffsets.push({ x: (longestLine - lineTotals[l].x) / 2, y: lineTotals[l].y });
  }

  let x = 0;
  let y = 0;

  if (lineTotals.length != 0) {
    switch (align) {
      case 'left':
        x = 0;
        y = lineOffsets[0].y;
        break;
      case 'center':
        x = lineOffsets[0].x;
        y = lineOffsets[0].y;
        break;
      // case "right":
      // 	console.log(longestLine);
      // 	console.log(lineOffsets[0].x);
      // 	x = longestLine-lineOffsets[0].x;
      // 	console.log(x);
      // 	y = lineOffsets[0].y;
      //break;
    }

  }
  let line = 1;

  for (let i = 0; i < gls.length; i++) {
    let gid = gls[i];
    if (gid == -1) continue;
    let gid2 = i < gls.length - 1 && gls[i + 1] != -1 ? gls[i + 1] : 0;
    let path = Typr.U.glyphToPath(font, gid);

    for (let j = 0; j < path.crds.length; j += 2) {
      tpath.crds.push(path.crds[j] + x);
      tpath.crds.push(path.crds[j + 1] + y);
    }
    if (clr) tpath.cmds.push(clr);

    for (let j = 0; j < path.cmds.length; j++) {
      tpath.cmds.push(path.cmds[j]);
    }
    if (clr) tpath.cmds.push('X');

    // MULTILINE FIX
    x += font.hmtx.aWidth[gid]; // - font.hmtx.lsBearing[gid];
    if (i < gls.length - 1) x += Typr.U.getPairAdjustment(font, gid, gid2);

    if (gls[i] === 2) {
      // console.log(lineOffsets[line].x);

      switch (align) {
        case 'left':
          x = 0;
          y = lineOffsets[line].y;
          break;
        case 'center':
          x = lineOffsets[line].x;
          y = lineOffsets[line].y;
          break;
        // case "right":
        // 	x = longestLine - lineOffsets[line].x;
        // 	y = lineOffsets[line].y;
        // break;
      }
      line++;
    }
  }

  return tpath;
};

Typr.U.pathToSVG = function (path, prec) {
  if (prec == null) prec = 5;
  let out = [],
    co = 0,
    lmap = { M: 2, L: 2, Q: 4, C: 6 };
  for (let i = 0; i < path.cmds.length; i++) {
    let cmd = path.cmds[i],
      cn = co + (lmap[cmd] ? lmap[cmd] : 0);
    out.push(cmd);
    while (co < cn) {
      let c = path.crds[co++];
      out.push(parseFloat(c.toFixed(prec)) + (co == cn ? '' : ' '));
    }
  }
  return out.join('');
};

Typr.U.pathToContext = function (path, ctx) {
  let c = 0,
    crds = path.crds;

  for (let j = 0; j < path.cmds.length; j++) {
    let cmd = path.cmds[j];
    if (cmd == 'M') {
      ctx.moveTo(crds[c], crds[c + 1]);
      c += 2;
    } else if (cmd == 'L') {
      ctx.lineTo(crds[c], crds[c + 1]);
      c += 2;
    } else if (cmd == 'C') {
      ctx.bezierCurveTo(crds[c], crds[c + 1], crds[c + 2], crds[c + 3], crds[c + 4], crds[c + 5]);
      c += 6;
    } else if (cmd == 'Q') {
      ctx.quadraticCurveTo(crds[c], crds[c + 1], crds[c + 2], crds[c + 3]);
      c += 4;
    } else if (cmd.charAt(0) == '#') {
      ctx.beginPath();
      ctx.fillStyle = cmd;
    } else if (cmd == 'Z') {
      ctx.closePath();
    } else if (cmd == 'X') {
      ctx.fill();
    }
  }
};

Typr.U.P = {};
Typr.U.P.moveTo = function (p, x, y) {
  p.cmds.push('M');
  p.crds.push(x, y);
};
Typr.U.P.lineTo = function (p, x, y) {
  p.cmds.push('L');
  p.crds.push(x, y);
};
Typr.U.P.curveTo = function (p, a, b, c, d, e, f) {
  p.cmds.push('C');
  p.crds.push(a, b, c, d, e, f);
};
Typr.U.P.qcurveTo = function (p, a, b, c, d) {
  p.cmds.push('Q');
  p.crds.push(a, b, c, d);
};
Typr.U.P.closePath = function (p) {
  p.cmds.push('Z');
};

Typr.U._drawCFF = function (cmds, state, font, pdct, p) {
  let stack = state.stack;
  let nStems = state.nStems,
    haveWidth = state.haveWidth,
    width = state.width,
    open = state.open;
  let i = 0;
  let x = state.x,
    y = state.y,
    c1x = 0,
    c1y = 0,
    c2x = 0,
    c2y = 0,
    c3x = 0,
    c3y = 0,
    c4x = 0,
    c4y = 0,
    jpx = 0,
    jpy = 0;

  let o = { val: 0, size: 0 };
  //console.log(cmds);
  while (i < cmds.length) {
    Typr.CFF.getCharString(cmds, i, o);
    let v = o.val;
    i += o.size;

    if (false) {
    } else if (v == 'o1' || v == 'o18') {
      //  hstem || hstemhm
      let hasWidthArg;

      // The number of stem operators on the stack is always even.
      // If the value is uneven, that means a width is specified.
      hasWidthArg = stack.length % 2 !== 0;
      if (hasWidthArg && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
      }

      nStems += stack.length >> 1;
      stack.length = 0;
      haveWidth = true;
    } else if (v == 'o3' || v == 'o23') {
      // vstem || vstemhm
      let hasWidthArg;

      // The number of stem operators on the stack is always even.
      // If the value is uneven, that means a width is specified.
      hasWidthArg = stack.length % 2 !== 0;
      if (hasWidthArg && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
      }

      nStems += stack.length >> 1;
      stack.length = 0;
      haveWidth = true;
    } else if (v == 'o4') {
      if (stack.length > 1 && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
        haveWidth = true;
      }
      if (open) Typr.U.P.closePath(p);

      y += stack.pop();
      Typr.U.P.moveTo(p, x, y);
      open = true;
    } else if (v == 'o5') {
      while (stack.length > 0) {
        x += stack.shift();
        y += stack.shift();
        Typr.U.P.lineTo(p, x, y);
      }
    } else if (v == 'o6' || v == 'o7') {
      // hlineto || vlineto
      let count = stack.length;
      let isX = v == 'o6';

      for (let j = 0; j < count; j++) {
        let sval = stack.shift();

        if (isX) x += sval;
        else y += sval;
        isX = !isX;
        Typr.U.P.lineTo(p, x, y);
      }
    } else if (v == 'o8' || v == 'o24') {
      // rrcurveto || rcurveline
      let count = stack.length;
      let index = 0;
      while (index + 6 <= count) {
        c1x = x + stack.shift();
        c1y = y + stack.shift();
        c2x = c1x + stack.shift();
        c2y = c1y + stack.shift();
        x = c2x + stack.shift();
        y = c2y + stack.shift();
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
        index += 6;
      }
      if (v == 'o24') {
        x += stack.shift();
        y += stack.shift();
        Typr.U.P.lineTo(p, x, y);
      }
    } else if (v == 'o11') break;
    else if (v == 'o1234' || v == 'o1235' || v == 'o1236' || v == 'o1237') {
      //if((v+"").slice(0,3)=="o12")
      if (v == 'o1234') {
        c1x = x + stack.shift(); // dx1
        c1y = y; // dy1
        c2x = c1x + stack.shift(); // dx2
        c2y = c1y + stack.shift(); // dy2
        jpx = c2x + stack.shift(); // dx3
        jpy = c2y; // dy3
        c3x = jpx + stack.shift(); // dx4
        c3y = c2y; // dy4
        c4x = c3x + stack.shift(); // dx5
        c4y = y; // dy5
        x = c4x + stack.shift(); // dx6
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
        Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
      }
      if (v == 'o1235') {
        c1x = x + stack.shift(); // dx1
        c1y = y + stack.shift(); // dy1
        c2x = c1x + stack.shift(); // dx2
        c2y = c1y + stack.shift(); // dy2
        jpx = c2x + stack.shift(); // dx3
        jpy = c2y + stack.shift(); // dy3
        c3x = jpx + stack.shift(); // dx4
        c3y = jpy + stack.shift(); // dy4
        c4x = c3x + stack.shift(); // dx5
        c4y = c3y + stack.shift(); // dy5
        x = c4x + stack.shift(); // dx6
        y = c4y + stack.shift(); // dy6
        stack.shift(); // flex depth
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
        Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
      }
      if (v == 'o1236') {
        c1x = x + stack.shift(); // dx1
        c1y = y + stack.shift(); // dy1
        c2x = c1x + stack.shift(); // dx2
        c2y = c1y + stack.shift(); // dy2
        jpx = c2x + stack.shift(); // dx3
        jpy = c2y; // dy3
        c3x = jpx + stack.shift(); // dx4
        c3y = c2y; // dy4
        c4x = c3x + stack.shift(); // dx5
        c4y = c3y + stack.shift(); // dy5
        x = c4x + stack.shift(); // dx6
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
        Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
      }
      if (v == 'o1237') {
        c1x = x + stack.shift(); // dx1
        c1y = y + stack.shift(); // dy1
        c2x = c1x + stack.shift(); // dx2
        c2y = c1y + stack.shift(); // dy2
        jpx = c2x + stack.shift(); // dx3
        jpy = c2y + stack.shift(); // dy3
        c3x = jpx + stack.shift(); // dx4
        c3y = jpy + stack.shift(); // dy4
        c4x = c3x + stack.shift(); // dx5
        c4y = c3y + stack.shift(); // dy5
        if (Math.abs(c4x - x) > Math.abs(c4y - y)) {
          x = c4x + stack.shift();
        } else {
          y = c4y + stack.shift();
        }
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, jpx, jpy);
        Typr.U.P.curveTo(p, c3x, c3y, c4x, c4y, x, y);
      }
    } else if (v == 'o14') {
      if (stack.length > 0 && !haveWidth) {
        width = stack.shift() + font.nominalWidthX;
        haveWidth = true;
      }
      if (stack.length == 4) {
        // seac = standard encoding accented character
        let asb = 0;
        let adx = stack.shift();
        let ady = stack.shift();
        let bchar = stack.shift();
        let achar = stack.shift();

        let bind = Typr.CFF.glyphBySE(font, bchar);
        let aind = Typr.CFF.glyphBySE(font, achar);

        //console.log(bchar, bind);
        //console.log(achar, aind);
        //state.x=x; state.y=y; state.nStems=nStems; state.haveWidth=haveWidth; state.width=width;  state.open=open;

        Typr.U._drawCFF(font.CharStrings[bind], state, font, pdct, p);
        state.x = adx;
        state.y = ady;
        Typr.U._drawCFF(font.CharStrings[aind], state, font, pdct, p);

        //x=state.x; y=state.y; nStems=state.nStems; haveWidth=state.haveWidth; width=state.width;  open=state.open;
      }
      if (open) {
        Typr.U.P.closePath(p);
        open = false;
      }
    } else if (v == 'o19' || v == 'o20') {
      let hasWidthArg;

      // The number of stem operators on the stack is always even.
      // If the value is uneven, that means a width is specified.
      hasWidthArg = stack.length % 2 !== 0;
      if (hasWidthArg && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
      }

      nStems += stack.length >> 1;
      stack.length = 0;
      haveWidth = true;

      i += (nStems + 7) >> 3;
    } else if (v == 'o21') {
      if (stack.length > 2 && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
        haveWidth = true;
      }

      y += stack.pop();
      x += stack.pop();

      if (open) Typr.U.P.closePath(p);
      Typr.U.P.moveTo(p, x, y);
      open = true;
    } else if (v == 'o22') {
      if (stack.length > 1 && !haveWidth) {
        width = stack.shift() + pdct.nominalWidthX;
        haveWidth = true;
      }

      x += stack.pop();

      if (open) Typr.U.P.closePath(p);
      Typr.U.P.moveTo(p, x, y);
      open = true;
    } else if (v == 'o25') {
      while (stack.length > 6) {
        x += stack.shift();
        y += stack.shift();
        Typr.U.P.lineTo(p, x, y);
      }

      c1x = x + stack.shift();
      c1y = y + stack.shift();
      c2x = c1x + stack.shift();
      c2y = c1y + stack.shift();
      x = c2x + stack.shift();
      y = c2y + stack.shift();
      Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
    } else if (v == 'o26') {
      if (stack.length % 2) {
        x += stack.shift();
      }

      while (stack.length > 0) {
        c1x = x;
        c1y = y + stack.shift();
        c2x = c1x + stack.shift();
        c2y = c1y + stack.shift();
        x = c2x;
        y = c2y + stack.shift();
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
      }
    } else if (v == 'o27') {
      if (stack.length % 2) {
        y += stack.shift();
      }

      while (stack.length > 0) {
        c1x = x + stack.shift();
        c1y = y;
        c2x = c1x + stack.shift();
        c2y = c1y + stack.shift();
        x = c2x + stack.shift();
        y = c2y;
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
      }
    } else if (v == 'o10' || v == 'o29') {
      // callsubr || callgsubr
      let obj = v == 'o10' ? pdct : font;
      if (stack.length == 0) {
        console.log('error: empty stack');
      } else {
        let ind = stack.pop();
        let subr = obj.Subrs[ind + obj.Bias];
        state.x = x;
        state.y = y;
        state.nStems = nStems;
        state.haveWidth = haveWidth;
        state.width = width;
        state.open = open;
        Typr.U._drawCFF(subr, state, font, pdct, p);
        x = state.x;
        y = state.y;
        nStems = state.nStems;
        haveWidth = state.haveWidth;
        width = state.width;
        open = state.open;
      }
    } else if (v == 'o30' || v == 'o31') {
      // vhcurveto || hvcurveto
      let count,
        count1 = stack.length;
      let index = 0;
      let alternate = v == 'o31';

      count = count1 & ~2;
      index += count1 - count;

      while (index < count) {
        if (alternate) {
          c1x = x + stack.shift();
          c1y = y;
          c2x = c1x + stack.shift();
          c2y = c1y + stack.shift();
          y = c2y + stack.shift();
          if (count - index == 5) {
            x = c2x + stack.shift();
            index++;
          } else x = c2x;
          alternate = false;
        } else {
          c1x = x;
          c1y = y + stack.shift();
          c2x = c1x + stack.shift();
          c2y = c1y + stack.shift();
          x = c2x + stack.shift();
          if (count - index == 5) {
            y = c2y + stack.shift();
            index++;
          } else y = c2y;
          alternate = true;
        }
        Typr.U.P.curveTo(p, c1x, c1y, c2x, c2y, x, y);
        index += 4;
      }
    } else if ((v + '').charAt(0) == 'o') {
      console.log('Unknown operation: ' + v, cmds);
      throw v;
    } else stack.push(v);
  }
  //console.log(cmds);
  state.x = x;
  state.y = y;
  state.nStems = nStems;
  state.haveWidth = haveWidth;
  state.width = width;
  state.open = open;
};

module.exports = Typr;
