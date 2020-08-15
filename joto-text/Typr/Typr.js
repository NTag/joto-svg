const { JSDOM } = require('jsdom');
const svgFlatten = require('./flatten/lib');
const svgpath = require("svgpath");

const DOMParser = new JSDOM().window.DOMParser


let Typr = {};
let window = [];

Typr.parse = function(buff)
{
	let bin = Typr._bin;
	let data = new Uint8Array(buff);

	let tag = bin.readASCII(data, 0, 4);
	if(tag=="ttcf") {
		let offset = 4;
		let majV = bin.readUshort(data, offset);  offset+=2;
		let minV = bin.readUshort(data, offset);  offset+=2;
		let numF = bin.readUint  (data, offset);  offset+=4;
		let fnts = [];
		for(let i=0; i<numF; i++) {
			let foff = bin.readUint  (data, offset);  offset+=4;
			fnts.push(Typr._readFont(data, foff));
		}
		return fnts;
	}
	else return [Typr._readFont(data, 0)];
}

Typr._readFont = function(data, offset) {
	let bin = Typr._bin;
	let ooff = offset;

	let sfnt_version = bin.readFixed(data, offset);
	offset += 4;
	let numTables = bin.readUshort(data, offset);
	offset += 2;
	let searchRange = bin.readUshort(data, offset);
	offset += 2;
	let entrySelector = bin.readUshort(data, offset);
	offset += 2;
	let rangeShift = bin.readUshort(data, offset);
	offset += 2;

	let tags = [
		"cmap",
		"head",
		"hhea",
		"maxp",
		"hmtx",
		"name",
		"OS/2",
		"post",

		//"cvt",
		//"fpgm",
		"loca",
		"glyf",
		"kern",

		//"prep"
		//"gasp"

		"CFF ",


		"GPOS",
		"GSUB",

		"SVG "
		//"VORG",
		];

	let obj = {_data:data, _offset:ooff};
	//console.log(sfnt_version, numTables, searchRange, entrySelector, rangeShift);

	let tabs = {};

	for(let i=0; i<numTables; i++)
	{
		let tag = bin.readASCII(data, offset, 4);   offset += 4;
		let checkSum = bin.readUint(data, offset);  offset += 4;
		let toffset = bin.readUint(data, offset);   offset += 4;
		let length = bin.readUint(data, offset);    offset += 4;
		tabs[tag] = {offset:toffset, length:length};

		//if(tags.indexOf(tag)==-1) console.log("unknown tag", tag, length);
	}

	for(let i=0; i< tags.length; i++)
	{
		let t = tags[i];
		//console.log(t);
		//if(tabs[t]) console.log(t, tabs[t].offset, tabs[t].length);
		if(tabs[t]) obj[t.trim()] = Typr[t.trim()].parse(data, tabs[t].offset, tabs[t].length, obj);
	}

	return obj;
}

Typr._tabOffset = function(data, tab, foff)
{
	let bin = Typr._bin;
	let numTables = bin.readUshort(data, foff+4);
	let offset = foff+12;
	for(let i=0; i<numTables; i++)
	{
		let tag = bin.readASCII(data, offset, 4);   offset += 4;
		let checkSum = bin.readUint(data, offset);  offset += 4;
		let toffset = bin.readUint(data, offset);   offset += 4;
		let length = bin.readUint(data, offset);    offset += 4;
		if(tag==tab) return toffset;
	}
	return 0;
}





Typr._bin = {
	readFixed : function(data, o)
	{
		return ((data[o]<<8) | data[o+1]) +  (((data[o+2]<<8)|data[o+3])/(256*256+4));
	},
	readF2dot14 : function(data, o)
	{
		let num = Typr._bin.readShort(data, o);
		return num / 16384;
	},
	readInt : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		let a = Typr._bin.t.uint8;
		a[0] = buff[p+3];
		a[1] = buff[p+2];
		a[2] = buff[p+1];
		a[3] = buff[p];
		return Typr._bin.t.int32[0];
	},

	readInt8 : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		let a = Typr._bin.t.uint8;
		a[0] = buff[p];
		return Typr._bin.t.int8[0];
	},
	readShort : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		let a = Typr._bin.t.uint8;
		a[1] = buff[p]; a[0] = buff[p+1];
		return Typr._bin.t.int16[0];
	},
	readUshort : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		return (buff[p]<<8) | buff[p+1];
	},
	readUshorts : function(buff, p, len)
	{
		let arr = [];
		for(let i=0; i<len; i++) arr.push(Typr._bin.readUshort(buff, p+i*2));
		return arr;
	},
	readUint : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		let a = Typr._bin.t.uint8;
		a[3] = buff[p];  a[2] = buff[p+1];  a[1] = buff[p+2];  a[0] = buff[p+3];
		return Typr._bin.t.uint32[0];
	},
	readUint64 : function(buff, p)
	{
		//if(p>=buff.length) throw "error";
		return (Typr._bin.readUint(buff, p)*(0xffffffff+1)) + Typr._bin.readUint(buff, p+4);
	},
	readASCII : function(buff, p, l)	// l : length in Characters (not Bytes)
	{
		//if(p>=buff.length) throw "error";
		let s = "";
		for(let i = 0; i < l; i++) s += String.fromCharCode(buff[p+i]);
		return s;
	},
	readUnicode : function(buff, p, l)
	{
		//if(p>=buff.length) throw "error";
		let s = "";
		for(let i = 0; i < l; i++)
		{
			let c = (buff[p++]<<8) | buff[p++];
			s += String.fromCharCode(c);
		}
		return s;
	},
	_tdec : window["TextDecoder"] ? new window["TextDecoder"]() : null,
	readUTF8 : function(buff, p, l) {
		let tdec = Typr._bin._tdec;
		if(tdec && p==0 && l==buff.length) return tdec["decode"](buff);
		return Typr._bin.readASCII(buff,p,l);
	},
	readBytes : function(buff, p, l)
	{
		//if(p>=buff.length) throw "error";
		let arr = [];
		for(let i=0; i<l; i++) arr.push(buff[p+i]);
		return arr;
	},
	readASCIIArray : function(buff, p, l)	// l : length in Characters (not Bytes)
	{
		//if(p>=buff.length) throw "error";
		let s = [];
		for(let i = 0; i < l; i++)
			s.push(String.fromCharCode(buff[p+i]));
		return s;
	}
};

Typr._bin.t = {
	buff: new ArrayBuffer(8),
};
Typr._bin.t.int8   = new Int8Array  (Typr._bin.t.buff);
Typr._bin.t.uint8  = new Uint8Array (Typr._bin.t.buff);
Typr._bin.t.int16  = new Int16Array (Typr._bin.t.buff);
Typr._bin.t.uint16 = new Uint16Array(Typr._bin.t.buff);
Typr._bin.t.int32  = new Int32Array (Typr._bin.t.buff);
Typr._bin.t.uint32 = new Uint32Array(Typr._bin.t.buff);





// OpenType Layout Common Table Formats

Typr._lctf = {};

Typr._lctf.parse = function(data, offset, length, font, subt)
{
	let bin = Typr._bin;
	let obj = {};
	let offset0 = offset;
	let tableVersion = bin.readFixed(data, offset);  offset += 4;

	let offScriptList  = bin.readUshort(data, offset);  offset += 2;
	let offFeatureList = bin.readUshort(data, offset);  offset += 2;
	let offLookupList  = bin.readUshort(data, offset);  offset += 2;


	obj.scriptList  = Typr._lctf.readScriptList (data, offset0 + offScriptList);
	obj.featureList = Typr._lctf.readFeatureList(data, offset0 + offFeatureList);
	obj.lookupList  = Typr._lctf.readLookupList (data, offset0 + offLookupList, subt);

	return obj;
}

Typr._lctf.readLookupList = function(data, offset, subt)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = [];
	let count = bin.readUshort(data, offset);  offset+=2;
	for(let i=0; i<count; i++)
	{
		let noff = bin.readUshort(data, offset);  offset+=2;
		let lut = Typr._lctf.readLookupTable(data, offset0 + noff, subt);
		obj.push(lut);
	}
	return obj;
}

Typr._lctf.readLookupTable = function(data, offset, subt)
{
	//console.log("Parsing lookup table", offset);
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {tabs:[]};

	obj.ltype = bin.readUshort(data, offset);  offset+=2;
	obj.flag  = bin.readUshort(data, offset);  offset+=2;
	let cnt   = bin.readUshort(data, offset);  offset+=2;

	for(let i=0; i<cnt; i++)
	{
		let noff = bin.readUshort(data, offset);  offset+=2;
		let tab = subt(data, obj.ltype, offset0 + noff);
		//console.log(obj.type, tab);
		obj.tabs.push(tab);
	}
	return obj;
}

Typr._lctf.numOfOnes = function(n)
{
	let num = 0;
	for(let i=0; i<32; i++) if(((n>>>i)&1) != 0) num++;
	return num;
}

Typr._lctf.readClassDef = function(data, offset)
{
	let bin = Typr._bin;
	let obj = [];
	let format = bin.readUshort(data, offset);  offset+=2;
	if(format==1)
	{
		let startGlyph  = bin.readUshort(data, offset);  offset+=2;
		let glyphCount  = bin.readUshort(data, offset);  offset+=2;
		for(let i=0; i<glyphCount; i++)
		{
			obj.push(startGlyph+i);
			obj.push(startGlyph+i);
			obj.push(bin.readUshort(data, offset));  offset+=2;
		}
	}
	if(format==2)
	{
		let count = bin.readUshort(data, offset);  offset+=2;
		for(let i=0; i<count; i++)
		{
			obj.push(bin.readUshort(data, offset));  offset+=2;
			obj.push(bin.readUshort(data, offset));  offset+=2;
			obj.push(bin.readUshort(data, offset));  offset+=2;
		}
	}
	return obj;
}
Typr._lctf.getInterval = function(tab, val)
{
	for(let i=0; i<tab.length; i+=3)
	{
		let start = tab[i], end = tab[i+1], index = tab[i+2];
		if(start<=val && val<=end) return i;
	}
	return -1;
}


Typr._lctf.readCoverage = function(data, offset)
{
	let bin = Typr._bin;
	let cvg = {};
	cvg.fmt   = bin.readUshort(data, offset);  offset+=2;
	let count = bin.readUshort(data, offset);  offset+=2;
	//console.log("parsing coverage", offset-4, format, count);
	if(cvg.fmt==1) cvg.tab = bin.readUshorts(data, offset, count);
	if(cvg.fmt==2) cvg.tab = bin.readUshorts(data, offset, count*3);
	return cvg;
}

Typr._lctf.coverageIndex = function(cvg, val)
{
	let tab = cvg.tab;
	if(cvg.fmt==1) return tab.indexOf(val);
	if(cvg.fmt==2) {
		let ind = Typr._lctf.getInterval(tab, val);
		if(ind!=-1) return tab[ind+2] + (val - tab[ind]);
	}
	return -1;
}

Typr._lctf.readFeatureList = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = [];

	let count = bin.readUshort(data, offset);  offset+=2;

	for(let i=0; i<count; i++)
	{
		let tag = bin.readASCII(data, offset, 4);  offset+=4;
		let noff = bin.readUshort(data, offset);  offset+=2;
		obj.push({tag: tag.trim(), tab:Typr._lctf.readFeatureTable(data, offset0 + noff)});
	}
	return obj;
}

Typr._lctf.readFeatureTable = function(data, offset)
{
	let bin = Typr._bin;

	let featureParams = bin.readUshort(data, offset);  offset+=2;	// = 0
	let lookupCount = bin.readUshort(data, offset);  offset+=2;

	let indices = [];
	for(let i=0; i<lookupCount; i++) indices.push(bin.readUshort(data, offset+2*i));
	return indices;
}


Typr._lctf.readScriptList = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {};

	let count = bin.readUshort(data, offset);  offset+=2;

	for(let i=0; i<count; i++)
	{
		let tag = bin.readASCII(data, offset, 4);  offset+=4;
		let noff = bin.readUshort(data, offset);  offset+=2;
		obj[tag.trim()] = Typr._lctf.readScriptTable(data, offset0 + noff);
	}
	return obj;
}

Typr._lctf.readScriptTable = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {};

	let defLangSysOff = bin.readUshort(data, offset);  offset+=2;
	obj.default = Typr._lctf.readLangSysTable(data, offset0 + defLangSysOff);

	let langSysCount = bin.readUshort(data, offset);  offset+=2;

	for(let i=0; i<langSysCount; i++)
	{
		let tag = bin.readASCII(data, offset, 4);  offset+=4;
		let langSysOff = bin.readUshort(data, offset);  offset+=2;
		obj[tag.trim()] = Typr._lctf.readLangSysTable(data, offset0 + langSysOff);
	}
	return obj;
}

Typr._lctf.readLangSysTable = function(data, offset)
{
	let bin = Typr._bin;
	let obj = {};

	let lookupOrder = bin.readUshort(data, offset);  offset+=2;
	//if(lookupOrder!=0)  throw "lookupOrder not 0";
	obj.reqFeature = bin.readUshort(data, offset);  offset+=2;
	//if(obj.reqFeature != 0xffff) throw "reqFeatureIndex != 0xffff";

	//console.log(lookupOrder, obj.reqFeature);

	let featureCount = bin.readUshort(data, offset);  offset+=2;
	obj.features = bin.readUshorts(data, offset, featureCount);
	return obj;
}

	Typr.CFF = {};
	Typr.CFF.parse = function(data, offset, length)
	{
		let bin = Typr._bin;

		data = new Uint8Array(data.buffer, offset, length);
		offset = 0;

		// Header
		let major = data[offset];  offset++;
		let minor = data[offset];  offset++;
		let hdrSize = data[offset];  offset++;
		let offsize = data[offset];  offset++;
		//console.log(major, minor, hdrSize, offsize);

		// Name INDEX
		let ninds = [];
		offset = Typr.CFF.readIndex(data, offset, ninds);
		let names = [];

		for(let i=0; i<ninds.length-1; i++) names.push(bin.readASCII(data, offset+ninds[i], ninds[i+1]-ninds[i]));
		offset += ninds[ninds.length-1];


		// Top DICT INDEX
		let tdinds = [];
		offset = Typr.CFF.readIndex(data, offset, tdinds);  //console.log(tdinds);
		// Top DICT Data
		let topDicts = [];
		for(let i=0; i<tdinds.length-1; i++) topDicts.push( Typr.CFF.readDict(data, offset+tdinds[i], offset+tdinds[i+1]) );
		offset += tdinds[tdinds.length-1];
		let topdict = topDicts[0];
		//console.log(topdict);

		// String INDEX
		let sinds = [];
		offset = Typr.CFF.readIndex(data, offset, sinds);
		// String Data
		let strings = [];
		for(let i=0; i<sinds.length-1; i++) strings.push(bin.readASCII(data, offset+sinds[i], sinds[i+1]-sinds[i]));
		offset += sinds[sinds.length-1];

		// Global Subr INDEX  (subroutines)
		Typr.CFF.readSubrs(data, offset, topdict);

		// charstrings
		if(topdict.CharStrings)
		{
			offset = topdict.CharStrings;
			let sinds = [];
			offset = Typr.CFF.readIndex(data, offset, sinds);

			let cstr = [];
			for(let i=0; i<sinds.length-1; i++) cstr.push(bin.readBytes(data, offset+sinds[i], sinds[i+1]-sinds[i]));
			//offset += sinds[sinds.length-1];
			topdict.CharStrings = cstr;
			//console.log(topdict.CharStrings);
		}

		// CID font
		if(topdict.ROS) {
			offset = topdict.FDArray;
			let fdind = [];
			offset = Typr.CFF.readIndex(data, offset, fdind);

			topdict.FDArray = [];
			for(let i=0; i<fdind.length-1; i++) {
				let dict = Typr.CFF.readDict(data, offset+fdind[i], offset+fdind[i+1]);
				Typr.CFF._readFDict(data, dict, strings);
				topdict.FDArray.push( dict );
			}
			offset += fdind[fdind.length-1];

			offset = topdict.FDSelect;
			topdict.FDSelect = [];
			let fmt = data[offset];  offset++;
			if(fmt==3) {
				let rns = bin.readUshort(data, offset);  offset+=2;
				for(let i=0; i<rns+1; i++) {
					topdict.FDSelect.push(bin.readUshort(data, offset), data[offset+2]);  offset+=3;
				}
			}
			else throw fmt;
		}

		// Encoding
		if(topdict.Encoding) topdict.Encoding = Typr.CFF.readEncoding(data, topdict.Encoding, topdict.CharStrings.length);

		// charset
		if(topdict.charset ) topdict.charset  = Typr.CFF.readCharset (data, topdict.charset , topdict.CharStrings.length);

		Typr.CFF._readFDict(data, topdict, strings);
		return topdict;
	}
	Typr.CFF._readFDict = function(data, dict, ss) {
		let offset;
		if(dict.Private) {
			offset = dict.Private[1];
			dict.Private = Typr.CFF.readDict(data, offset, offset+dict.Private[0]);
			if(dict.Private.Subrs)  Typr.CFF.readSubrs(data, offset+dict.Private.Subrs, dict.Private);
		}
		for(let p in dict) if(["FamilyName","FontName","FullName","Notice","version","Copyright"].indexOf(p)!=-1)  dict[p]=ss[dict[p] -426 + 35];
	}

	Typr.CFF.readSubrs = function(data, offset, obj)
	{
		let bin = Typr._bin;
		let gsubinds = [];
		offset = Typr.CFF.readIndex(data, offset, gsubinds);

		let bias, nSubrs = gsubinds.length;
		if (false) bias = 0;
		else if (nSubrs <  1240) bias = 107;
		else if (nSubrs < 33900) bias = 1131;
		else bias = 32768;
		obj.Bias = bias;

		obj.Subrs = [];
		for(let i=0; i<gsubinds.length-1; i++) obj.Subrs.push(bin.readBytes(data, offset+gsubinds[i], gsubinds[i+1]-gsubinds[i]));
		//offset += gsubinds[gsubinds.length-1];
	}

	Typr.CFF.tableSE = [
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      1,   2,   3,   4,   5,   6,   7,   8,
      9,  10,  11,  12,  13,  14,  15,  16,
     17,  18,  19,  20,  21,  22,  23,  24,
     25,  26,  27,  28,  29,  30,  31,  32,
     33,  34,  35,  36,  37,  38,  39,  40,
     41,  42,  43,  44,  45,  46,  47,  48,
     49,  50,  51,  52,  53,  54,  55,  56,
     57,  58,  59,  60,  61,  62,  63,  64,
     65,  66,  67,  68,  69,  70,  71,  72,
     73,  74,  75,  76,  77,  78,  79,  80,
     81,  82,  83,  84,  85,  86,  87,  88,
     89,  90,  91,  92,  93,  94,  95,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0,  96,  97,  98,  99, 100, 101, 102,
    103, 104, 105, 106, 107, 108, 109, 110,
      0, 111, 112, 113, 114,   0, 115, 116,
    117, 118, 119, 120, 121, 122,   0, 123,
      0, 124, 125, 126, 127, 128, 129, 130,
    131,   0, 132, 133,   0, 134, 135, 136,
    137,   0,   0,   0,   0,   0,   0,   0,
      0,   0,   0,   0,   0,   0,   0,   0,
      0, 138,   0, 139,   0,   0,   0,   0,
    140, 141, 142, 143,   0,   0,   0,   0,
      0, 144,   0,   0,   0, 145,   0,   0,
    146, 147, 148, 149,   0,   0,   0,   0
  ];

	Typr.CFF.glyphByUnicode = function(cff, code)
	{
		for(let i=0; i<cff.charset.length; i++) if(cff.charset[i]==code) return i;
		return -1;
	}

	Typr.CFF.glyphBySE = function(cff, charcode)	// glyph by standard encoding
	{
		if ( charcode < 0 || charcode > 255 ) return -1;
		return Typr.CFF.glyphByUnicode(cff, Typr.CFF.tableSE[charcode]);
	}

	Typr.CFF.readEncoding = function(data, offset, num)
	{
		let bin = Typr._bin;

		let array = ['.notdef'];
		let format = data[offset];  offset++;
		//console.log("Encoding");
		//console.log(format);

		if(format==0)
		{
			let nCodes = data[offset];  offset++;
			for(let i=0; i<nCodes; i++)  array.push(data[offset+i]);
		}
		/*
		else if(format==1 || format==2)
		{
			while(charset.length<num)
			{
				let first = bin.readUshort(data, offset);  offset+=2;
				let nLeft=0;
				if(format==1) {  nLeft = data[offset];  offset++;  }
				else          {  nLeft = bin.readUshort(data, offset);  offset+=2;  }
				for(let i=0; i<=nLeft; i++)  {  charset.push(first);  first++;  }
			}
		}
		*/
		else throw "error: unknown encoding format: " + format;

		return array;
	}

	Typr.CFF.readCharset = function(data, offset, num)
	{
		let bin = Typr._bin;

		let charset = ['.notdef'];
		let format = data[offset];  offset++;

		if(format==0)
		{
			for(let i=0; i<num; i++)
			{
				let first = bin.readUshort(data, offset);  offset+=2;
				charset.push(first);
			}
		}
		else if(format==1 || format==2)
		{
			while(charset.length<num)
			{
				let first = bin.readUshort(data, offset);  offset+=2;
				let nLeft=0;
				if(format==1) {  nLeft = data[offset];  offset++;  }
				else          {  nLeft = bin.readUshort(data, offset);  offset+=2;  }
				for(let i=0; i<=nLeft; i++)  {  charset.push(first);  first++;  }
			}
		}
		else throw "error: format: " + format;

		return charset;
	}

	Typr.CFF.readIndex = function(data, offset, inds)
	{
		let bin = Typr._bin;

		let count = bin.readUshort(data, offset)+1;  offset+=2;
		let offsize = data[offset];  offset++;

		if     (offsize==1) for(let i=0; i<count; i++) inds.push( data[offset+i] );
		else if(offsize==2) for(let i=0; i<count; i++) inds.push( bin.readUshort(data, offset+i*2) );
		else if(offsize==3) for(let i=0; i<count; i++) inds.push( bin.readUint  (data, offset+i*3 - 1) & 0x00ffffff );
		else if(count!=1) throw "unsupported offset size: " + offsize + ", count: " + count;

		offset += count*offsize;
		return offset-1;
	}

	Typr.CFF.getCharString = function(data, offset, o)
	{
		let bin = Typr._bin;

		let b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
		let vs = 1;
		let op=null, val=null;
		// operand
		if(b0<=20) { op = b0;  vs=1;  }
		if(b0==12) { op = b0*100+b1;  vs=2;  }
		//if(b0==19 || b0==20) { op = b0/*+" "+b1*/;  vs=2; }
		if(21 <=b0 && b0<= 27) { op = b0;  vs=1; }
		if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
		if(29 <=b0 && b0<= 31) { op = b0;  vs=1; }
		if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
		if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
		if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
		if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;   }

		o.val = val!=null ? val : "o"+op;
		o.size = vs;
	}

	Typr.CFF.readCharString = function(data, offset, length)
	{
		let end = offset + length;
		let bin = Typr._bin;
		let arr = [];

		while(offset<end)
		{
			let b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
			let vs = 1;
			let op=null, val=null;
			// operand
			if(b0<=20) { op = b0;  vs=1;  }
			if(b0==12) { op = b0*100+b1;  vs=2;  }
			if(b0==19 || b0==20) { op = b0/*+" "+b1*/;  vs=2; }
			if(21 <=b0 && b0<= 27) { op = b0;  vs=1; }
			if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
			if(29 <=b0 && b0<= 31) { op = b0;  vs=1; }
			if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
			if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
			if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
			if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;   }

			arr.push(val!=null ? val : "o"+op);
			offset += vs;

			//let cv = arr[arr.length-1];
			//if(cv==undefined) throw "error";
			//console.log()
		}
		return arr;
	}

	Typr.CFF.readDict = function(data, offset, end)
	{
		let bin = Typr._bin;
		//let dict = [];
		let dict = {};
		let carr = [];

		while(offset<end)
		{
			let b0 = data[offset], b1 = data[offset+1], b2 = data[offset+2], b3 = data[offset+3], b4=data[offset+4];
			let vs = 1;
			let key=null, val=null;
			// operand
			if(b0==28) { val = bin.readShort(data,offset+1);  vs=3; }
			if(b0==29) { val = bin.readInt  (data,offset+1);  vs=5; }
			if(32 <=b0 && b0<=246) { val = b0-139;  vs=1; }
			if(247<=b0 && b0<=250) { val = (b0-247)*256+b1+108;  vs=2; }
			if(251<=b0 && b0<=254) { val =-(b0-251)*256-b1-108;  vs=2; }
			if(b0==255) {  val = bin.readInt(data, offset+1)/0xffff;  vs=5;  throw "unknown number";  }

			if(b0==30)
			{
				let nibs = [];
				vs = 1;
				while(true)
				{
					let b = data[offset+vs];  vs++;
					let nib0 = b>>4, nib1 = b&0xf;
					if(nib0 != 0xf) nibs.push(nib0);  if(nib1!=0xf) nibs.push(nib1);
					if(nib1==0xf) break;
				}
				let s = "";
				let chars = [0,1,2,3,4,5,6,7,8,9,".","e","e-","reserved","-","endOfNumber"];
				for(let i=0; i<nibs.length; i++) s += chars[nibs[i]];
				//console.log(nibs);
				val = parseFloat(s);
			}

			if(b0<=21)	// operator
			{
				let keys = ["version", "Notice", "FullName", "FamilyName", "Weight", "FontBBox", "BlueValues", "OtherBlues", "FamilyBlues","FamilyOtherBlues",
					"StdHW", "StdVW", "escape", "UniqueID", "XUID", "charset", "Encoding", "CharStrings", "Private", "Subrs",
					"defaultWidthX", "nominalWidthX"];

				key = keys[b0];  vs=1;
				if(b0==12) {
					let keys = [ "Copyright", "isFixedPitch", "ItalicAngle", "UnderlinePosition", "UnderlineThickness", "PaintType", "CharstringType", "FontMatrix", "StrokeWidth", "BlueScale",
					"BlueShift", "BlueFuzz", "StemSnapH", "StemSnapV", "ForceBold", 0,0, "LanguageGroup", "ExpansionFactor", "initialRandomSeed",
					"SyntheticBase", "PostScript", "BaseFontName", "BaseFontBlend", 0,0,0,0,0,0,
					"ROS", "CIDFontVersion", "CIDFontRevision", "CIDFontType", "CIDCount", "UIDBase", "FDArray", "FDSelect", "FontName"];
					key = keys[b1];  vs=2;
				}
			}

			if(key!=null) {  dict[key] = carr.length==1 ? carr[0] : carr;  carr=[]; }
			else  carr.push(val);

			offset += vs;
		}
		return dict;
	}


Typr.cmap = {};
Typr.cmap.parse = function(data, offset, length)
{
	data = new Uint8Array(data.buffer, offset, length);
	offset = 0;

	let offset0 = offset;
	let bin = Typr._bin;
	let obj = {};
	let version   = bin.readUshort(data, offset);  offset += 2;
	let numTables = bin.readUshort(data, offset);  offset += 2;

	//console.log(version, numTables);

	let offs = [];
	obj.tables = [];


	for(let i=0; i<numTables; i++)
	{
		let platformID = bin.readUshort(data, offset);  offset += 2;
		let encodingID = bin.readUshort(data, offset);  offset += 2;
		let noffset = bin.readUint(data, offset);       offset += 4;

		let id = "p"+platformID+"e"+encodingID;

		//console.log("cmap subtable", platformID, encodingID, noffset);


		let tind = offs.indexOf(noffset);

		if(tind==-1)
		{
			tind = obj.tables.length;
			let subt;
			offs.push(noffset);
			let format = bin.readUshort(data, noffset);
			if     (format== 0) subt = Typr.cmap.parse0(data, noffset);
			else if(format== 4) subt = Typr.cmap.parse4(data, noffset);
			else if(format== 6) subt = Typr.cmap.parse6(data, noffset);
			else if(format==12) subt = Typr.cmap.parse12(data,noffset);
			else console.log("unknown format: "+format, platformID, encodingID, noffset);
			obj.tables.push(subt);
		}

		if(obj[id]!=null) throw "multiple tables for one platform+encoding";
		obj[id] = tind;
	}
	return obj;
}

Typr.cmap.parse0 = function(data, offset)
{
	let bin = Typr._bin;
	let obj = {};
	obj.format = bin.readUshort(data, offset);  offset += 2;
	let len    = bin.readUshort(data, offset);  offset += 2;
	let lang   = bin.readUshort(data, offset);  offset += 2;
	obj.map = [];
	for(let i=0; i<len-6; i++) obj.map.push(data[offset+i]);
	return obj;
}

Typr.cmap.parse4 = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {};

	obj.format = bin.readUshort(data, offset);  offset+=2;
	let length = bin.readUshort(data, offset);  offset+=2;
	let language = bin.readUshort(data, offset);  offset+=2;
	let segCountX2 = bin.readUshort(data, offset);  offset+=2;
	let segCount = segCountX2/2;
	obj.searchRange = bin.readUshort(data, offset);  offset+=2;
	obj.entrySelector = bin.readUshort(data, offset);  offset+=2;
	obj.rangeShift = bin.readUshort(data, offset);  offset+=2;
	obj.endCount   = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	offset+=2;
	obj.startCount = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	obj.idDelta = [];
	for(let i=0; i<segCount; i++) {obj.idDelta.push(bin.readShort(data, offset));  offset+=2;}
	obj.idRangeOffset = bin.readUshorts(data, offset, segCount);  offset += segCount*2;
	obj.glyphIdArray = [];
	while(offset< offset0+length) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}
	return obj;
}

Typr.cmap.parse6 = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {};

	obj.format = bin.readUshort(data, offset);  offset+=2;
	let length = bin.readUshort(data, offset);  offset+=2;
	let language = bin.readUshort(data, offset);  offset+=2;
	obj.firstCode = bin.readUshort(data, offset);  offset+=2;
	let entryCount = bin.readUshort(data, offset);  offset+=2;
	obj.glyphIdArray = [];
	for(let i=0; i<entryCount; i++) {obj.glyphIdArray.push(bin.readUshort(data, offset));  offset+=2;}

	return obj;
}

Typr.cmap.parse12 = function(data, offset)
{
	let bin = Typr._bin;
	let offset0 = offset;
	let obj = {};

	obj.format = bin.readUshort(data, offset);  offset+=2;
	offset += 2;
	let length = bin.readUint(data, offset);  offset+=4;
	let lang   = bin.readUint(data, offset);  offset+=4;
	let nGroups= bin.readUint(data, offset);  offset+=4;
	obj.groups = [];

	for(let i=0; i<nGroups; i++)
	{
		let off = offset + i * 12;
		let startCharCode = bin.readUint(data, off+0);
		let endCharCode   = bin.readUint(data, off+4);
		let startGlyphID  = bin.readUint(data, off+8);
		obj.groups.push([  startCharCode, endCharCode, startGlyphID  ]);
	}
	return obj;
}

Typr.glyf = {};
Typr.glyf.parse = function(data, offset, length, font)
{
	let obj = [];
	for(let g=0; g<font.maxp.numGlyphs; g++) obj.push(null);
	return obj;
}

Typr.glyf._parseGlyf = function(font, g)
{
	let bin = Typr._bin;
	let data = font._data;

	let offset = Typr._tabOffset(data, "glyf", font._offset) + font.loca[g];

	if(font.loca[g]==font.loca[g+1]) return null;

	let gl = {};

	gl.noc  = bin.readShort(data, offset);  offset+=2;		// number of contours
	gl.xMin = bin.readShort(data, offset);  offset+=2;
	gl.yMin = bin.readShort(data, offset);  offset+=2;
	gl.xMax = bin.readShort(data, offset);  offset+=2;
	gl.yMax = bin.readShort(data, offset);  offset+=2;

	if(gl.xMin>=gl.xMax || gl.yMin>=gl.yMax) return null;

	if(gl.noc>0)
	{
		gl.endPts = [];
		for(let i=0; i<gl.noc; i++) { gl.endPts.push(bin.readUshort(data,offset)); offset+=2; }

		let instructionLength = bin.readUshort(data,offset); offset+=2;
		if((data.length-offset)<instructionLength) return null;
		gl.instructions = bin.readBytes(data, offset, instructionLength);   offset+=instructionLength;

		let crdnum = gl.endPts[gl.noc-1]+1;
		gl.flags = [];
		for(let i=0; i<crdnum; i++ )
		{
			let flag = data[offset];  offset++;
			gl.flags.push(flag);
			if((flag&8)!=0)
			{
				let rep = data[offset];  offset++;
				for(let j=0; j<rep; j++) { gl.flags.push(flag); i++; }
			}
		}
		gl.xs = [];
		for(let i=0; i<crdnum; i++) {
			let i8=((gl.flags[i]&2)!=0), same=((gl.flags[i]&16)!=0);
			if(i8) { gl.xs.push(same ? data[offset] : -data[offset]);  offset++; }
			else
			{
				if(same) gl.xs.push(0);
				else { gl.xs.push(bin.readShort(data, offset));  offset+=2; }
			}
		}
		gl.ys = [];
		for(let i=0; i<crdnum; i++) {
			let i8=((gl.flags[i]&4)!=0), same=((gl.flags[i]&32)!=0);
			if(i8) { gl.ys.push(same ? data[offset] : -data[offset]);  offset++; }
			else
			{
				if(same) gl.ys.push(0);
				else { gl.ys.push(bin.readShort(data, offset));  offset+=2; }
			}
		}
		let x = 0, y = 0;
		for(let i=0; i<crdnum; i++) { x += gl.xs[i]; y += gl.ys[i];  gl.xs[i]=x;  gl.ys[i]=y; }
		//console.log(endPtsOfContours, instructionLength, instructions, flags, xCoordinates, yCoordinates);
	}
	else
	{
		let ARG_1_AND_2_ARE_WORDS	= 1<<0;
		let ARGS_ARE_XY_VALUES		= 1<<1;
		let ROUND_XY_TO_GRID		= 1<<2;
		let WE_HAVE_A_SCALE			= 1<<3;
		let RESERVED				= 1<<4;
		let MORE_COMPONENTS			= 1<<5;
		let WE_HAVE_AN_X_AND_Y_SCALE= 1<<6;
		let WE_HAVE_A_TWO_BY_TWO	= 1<<7;
		let WE_HAVE_INSTRUCTIONS	= 1<<8;
		let USE_MY_METRICS			= 1<<9;
		let OVERLAP_COMPOUND		= 1<<10;
		let SCALED_COMPONENT_OFFSET	= 1<<11;
		let UNSCALED_COMPONENT_OFFSET	= 1<<12;

		gl.parts = [];
		let flags;
		let arg1;
		let arg2;
		do {
			flags = bin.readUshort(data, offset);  offset += 2;
			let part = { m:{a:1,b:0,c:0,d:1,tx:0,ty:0}, p1:-1, p2:-1 };  gl.parts.push(part);
			part.glyphIndex = bin.readUshort(data, offset);  offset += 2;
			if ( flags & ARG_1_AND_2_ARE_WORDS) {
				 arg1 = bin.readShort(data, offset);  offset += 2;
				 arg2 = bin.readShort(data, offset);  offset += 2;
			} else {
				 arg1 = bin.readInt8(data, offset);  offset ++;
				 arg2 = bin.readInt8(data, offset);  offset ++;
			}

			if(flags & ARGS_ARE_XY_VALUES) { part.m.tx = arg1;  part.m.ty = arg2; }
			else  {  part.p1=arg1;  part.p2=arg2;  }
			//part.m.tx = arg1;  part.m.ty = arg2;
			//else { throw "params are not XY values"; }

			if ( flags & WE_HAVE_A_SCALE ) {
				part.m.a = part.m.d = bin.readF2dot14(data, offset);  offset += 2;
			} else if ( flags & WE_HAVE_AN_X_AND_Y_SCALE ) {
				part.m.a = bin.readF2dot14(data, offset);  offset += 2;
				part.m.d = bin.readF2dot14(data, offset);  offset += 2;
			} else if ( flags & WE_HAVE_A_TWO_BY_TWO ) {
				part.m.a = bin.readF2dot14(data, offset);  offset += 2;
				part.m.b = bin.readF2dot14(data, offset);  offset += 2;
				part.m.c = bin.readF2dot14(data, offset);  offset += 2;
				part.m.d = bin.readF2dot14(data, offset);  offset += 2;
			}
		} while ( flags & MORE_COMPONENTS )
		if (flags & WE_HAVE_INSTRUCTIONS){
			let numInstr = bin.readUshort(data, offset);  offset += 2;
			gl.instr = [];
			for(let i=0; i<numInstr; i++) { gl.instr.push(data[offset]);  offset++; }
		}
	}
	return gl;
}


Typr.GPOS = {};
Typr.GPOS.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GPOS.subt);  }


Typr.GPOS.subt = function(data, ltype, offset)	// lookup type
{
	let bin = Typr._bin, offset0 = offset, tab = {};

	tab.fmt  = bin.readUshort(data, offset);  offset+=2;

	//console.log(ltype, tab.fmt);

	if(ltype==1 || ltype==2 || ltype==3 || ltype==7 || (ltype==8 && tab.fmt<=2)) {
		let covOff  = bin.readUshort(data, offset);  offset+=2;
		tab.coverage = Typr._lctf.readCoverage(data, covOff+offset0);
	}
	if(ltype==1 && tab.fmt==1) {
		let valFmt1 = bin.readUshort(data, offset);  offset+=2;
		let ones1 = Typr._lctf.numOfOnes(valFmt1);
		if(valFmt1!=0)  tab.pos = Typr.GPOS.readValueRecord(data, offset, valFmt1);
	}
	else if(ltype==2) {
		let valFmt1 = bin.readUshort(data, offset);  offset+=2;
		let valFmt2 = bin.readUshort(data, offset);  offset+=2;
		let ones1 = Typr._lctf.numOfOnes(valFmt1);
		let ones2 = Typr._lctf.numOfOnes(valFmt2);
		if(tab.fmt==1)
		{
			tab.pairsets = [];
			let psc = bin.readUshort(data, offset);  offset+=2;  // PairSetCount

			for(let i=0; i<psc; i++)
			{
				let psoff = offset0 + bin.readUshort(data, offset);  offset+=2;

				let pvc = bin.readUshort(data, psoff);  psoff+=2;
				let arr = [];
				for(let j=0; j<pvc; j++)
				{
					let gid2 = bin.readUshort(data, psoff);  psoff+=2;
					let value1, value2;
					if(valFmt1!=0) {  value1 = Typr.GPOS.readValueRecord(data, psoff, valFmt1);  psoff+=ones1*2;  }
					if(valFmt2!=0) {  value2 = Typr.GPOS.readValueRecord(data, psoff, valFmt2);  psoff+=ones2*2;  }
					//if(value1!=null) throw "e";
					arr.push({gid2:gid2, val1:value1, val2:value2});
				}
				tab.pairsets.push(arr);
			}
		}
		if(tab.fmt==2)
		{
			let classDef1 = bin.readUshort(data, offset);  offset+=2;
			let classDef2 = bin.readUshort(data, offset);  offset+=2;
			let class1Count = bin.readUshort(data, offset);  offset+=2;
			let class2Count = bin.readUshort(data, offset);  offset+=2;

			tab.classDef1 = Typr._lctf.readClassDef(data, offset0 + classDef1);
			tab.classDef2 = Typr._lctf.readClassDef(data, offset0 + classDef2);

			tab.matrix = [];
			for(let i=0; i<class1Count; i++)
			{
				let row = [];
				for(let j=0; j<class2Count; j++)
				{
					let value1 = null, value2 = null;
					if(tab.valFmt1!=0) { value1 = Typr.GPOS.readValueRecord(data, offset, tab.valFmt1);  offset+=ones1*2; }
					if(tab.valFmt2!=0) { value2 = Typr.GPOS.readValueRecord(data, offset, tab.valFmt2);  offset+=ones2*2; }
					row.push({val1:value1, val2:value2});
				}
				tab.matrix.push(row);
			}
		}
	}
	else if(ltype==4) {

	}
	return tab;
}


Typr.GPOS.readValueRecord = function(data, offset, valFmt)
{
	let bin = Typr._bin;
	let arr = [];
	arr.push( (valFmt&1) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&1) ? 2 : 0;  // X_PLACEMENT
	arr.push( (valFmt&2) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&2) ? 2 : 0;  // Y_PLACEMENT
	arr.push( (valFmt&4) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&4) ? 2 : 0;  // X_ADVANCE
	arr.push( (valFmt&8) ? bin.readShort(data, offset) : 0 );  offset += (valFmt&8) ? 2 : 0;  // Y_ADVANCE
	return arr;
}

Typr.GSUB = {};
Typr.GSUB.parse = function(data, offset, length, font) {  return Typr._lctf.parse(data, offset, length, font, Typr.GSUB.subt);  }


Typr.GSUB.subt = function(data, ltype, offset)	// lookup type
{
	let bin = Typr._bin, offset0 = offset, tab = {};

	tab.fmt  = bin.readUshort(data, offset);  offset+=2;

	if(ltype!=1 && ltype!=4 && ltype!=5 && ltype!=6) return null;

	if(ltype==1 || ltype==4 || (ltype==5 && tab.fmt<=2) || (ltype==6 && tab.fmt<=2)) {
		let covOff  = bin.readUshort(data, offset);  offset+=2;
		tab.coverage = Typr._lctf.readCoverage(data, offset0+covOff);	// not always is coverage here
	}

	if(false) {}
	//  Single Substitution Subtable
	else if(ltype==1) {
		if(tab.fmt==1) {
			tab.delta = bin.readShort(data, offset);  offset+=2;
		}
		else if(tab.fmt==2) {
			let cnt = bin.readUshort(data, offset);  offset+=2;
			tab.newg = bin.readUshorts(data, offset, cnt);  offset+=tab.newg.length*2;
		}
	}
	//  Ligature Substitution Subtable
	else if(ltype==4) {
		tab.vals = [];
		let cnt = bin.readUshort(data, offset);  offset+=2;
		for(let i=0; i<cnt; i++) {
			let loff = bin.readUshort(data, offset);  offset+=2;
			tab.vals.push(Typr.GSUB.readLigatureSet(data, offset0+loff));
		}
		//console.log(tab.coverage);
		//console.log(tab.vals);
	}
	//  Contextual Substitution Subtable
	else if(ltype==5) {
		if(tab.fmt==2) {
			let cDefOffset = bin.readUshort(data, offset);  offset+=2;
			tab.cDef = Typr._lctf.readClassDef(data, offset0 + cDefOffset);
			tab.scset = [];
			let subClassSetCount = bin.readUshort(data, offset);  offset+=2;
			for(let i=0; i<subClassSetCount; i++)
			{
				let scsOff = bin.readUshort(data, offset);  offset+=2;
				tab.scset.push(  scsOff==0 ? null : Typr.GSUB.readSubClassSet(data, offset0 + scsOff)  );
			}
		}
		//else console.log("unknown table format", tab.fmt);
	}
	//*
	else if(ltype==6) {
		/*
		if(tab.fmt==2) {
			let btDef = bin.readUshort(data, offset);  offset+=2;
			let inDef = bin.readUshort(data, offset);  offset+=2;
			let laDef = bin.readUshort(data, offset);  offset+=2;

			tab.btDef = Typr._lctf.readClassDef(data, offset0 + btDef);
			tab.inDef = Typr._lctf.readClassDef(data, offset0 + inDef);
			tab.laDef = Typr._lctf.readClassDef(data, offset0 + laDef);

			tab.scset = [];
			let cnt = bin.readUshort(data, offset);  offset+=2;
			for(let i=0; i<cnt; i++) {
				let loff = bin.readUshort(data, offset);  offset+=2;
				tab.scset.push(Typr.GSUB.readChainSubClassSet(data, offset0+loff));
			}
		}
		*/
		if(tab.fmt==3) {
			for(let i=0; i<3; i++) {
				let cnt = bin.readUshort(data, offset);  offset+=2;
				let cvgs = [];
				for(let j=0; j<cnt; j++) cvgs.push(  Typr._lctf.readCoverage(data, offset0 + bin.readUshort(data, offset+j*2))   );
				offset+=cnt*2;
				if(i==0) tab.backCvg = cvgs;
				if(i==1) tab.inptCvg = cvgs;
				if(i==2) tab.ahedCvg = cvgs;
			}
			let cnt = bin.readUshort(data, offset);  offset+=2;
			tab.lookupRec = Typr.GSUB.readSubstLookupRecords(data, offset, cnt);
		}
		//console.log(tab);
	} //*/
	//if(tab.coverage.indexOf(3)!=-1) console.log(ltype, fmt, tab);

	return tab;
}

Typr.GSUB.readSubClassSet = function(data, offset)
{
	let rUs = Typr._bin.readUshort, offset0 = offset, lset = [];
	let cnt = rUs(data, offset);  offset+=2;
	for(let i=0; i<cnt; i++) {
		let loff = rUs(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readSubClassRule(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readSubClassRule= function(data, offset)
{
	let rUs = Typr._bin.readUshort, offset0 = offset, rule = {};
	let gcount = rUs(data, offset);  offset+=2;
	let scount = rUs(data, offset);  offset+=2;
	rule.input = [];
	for(let i=0; i<gcount-1; i++) {
		rule.input.push(rUs(data, offset));  offset+=2;
	}
	rule.substLookupRecords = Typr.GSUB.readSubstLookupRecords(data, offset, scount);
	return rule;
}
Typr.GSUB.readSubstLookupRecords = function(data, offset, cnt)
{
	let rUs = Typr._bin.readUshort;
	let out = [];
	for(let i=0; i<cnt; i++) {  out.push(rUs(data, offset), rUs(data, offset+2));  offset+=4;  }
	return out;
}

Typr.GSUB.readChainSubClassSet = function(data, offset)
{
	let bin = Typr._bin, offset0 = offset, lset = [];
	let cnt = bin.readUshort(data, offset);  offset+=2;
	for(let i=0; i<cnt; i++) {
		let loff = bin.readUshort(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readChainSubClassRule(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readChainSubClassRule= function(data, offset)
{
	let bin = Typr._bin, offset0 = offset, rule = {};
	let pps = ["backtrack", "input", "lookahead"];
	for(let pi=0; pi<pps.length; pi++) {
		let cnt = bin.readUshort(data, offset);  offset+=2;  if(pi==1) cnt--;
		rule[pps[pi]]=bin.readUshorts(data, offset, cnt);  offset+= rule[pps[pi]].length*2;
	}
	let cnt = bin.readUshort(data, offset);  offset+=2;
	rule.subst = bin.readUshorts(data, offset, cnt*2);  offset += rule.subst.length*2;
	return rule;
}

Typr.GSUB.readLigatureSet = function(data, offset)
{
	let bin = Typr._bin, offset0 = offset, lset = [];
	let lcnt = bin.readUshort(data, offset);  offset+=2;
	for(let j=0; j<lcnt; j++) {
		let loff = bin.readUshort(data, offset);  offset+=2;
		lset.push(Typr.GSUB.readLigature(data, offset0+loff));
	}
	return lset;
}
Typr.GSUB.readLigature = function(data, offset)
{
	let bin = Typr._bin, lig = {chain:[]};
	lig.nglyph = bin.readUshort(data, offset);  offset+=2;
	let ccnt = bin.readUshort(data, offset);  offset+=2;
	for(let k=0; k<ccnt-1; k++) {  lig.chain.push(bin.readUshort(data, offset));  offset+=2;  }
	return lig;
}



Typr.head = {};
Typr.head.parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let obj = {};
	let tableVersion = bin.readFixed(data, offset);  offset += 4;
	obj.fontRevision = bin.readFixed(data, offset);  offset += 4;
	let checkSumAdjustment = bin.readUint(data, offset);  offset += 4;
	let magicNumber = bin.readUint(data, offset);  offset += 4;
	obj.flags = bin.readUshort(data, offset);  offset += 2;
	obj.unitsPerEm = bin.readUshort(data, offset);  offset += 2;
	obj.created  = bin.readUint64(data, offset);  offset += 8;
	obj.modified = bin.readUint64(data, offset);  offset += 8;
	obj.xMin = bin.readShort(data, offset);  offset += 2;
	obj.yMin = bin.readShort(data, offset);  offset += 2;
	obj.xMax = bin.readShort(data, offset);  offset += 2;
	obj.yMax = bin.readShort(data, offset);  offset += 2;
	obj.macStyle = bin.readUshort(data, offset);  offset += 2;
	obj.lowestRecPPEM = bin.readUshort(data, offset);  offset += 2;
	obj.fontDirectionHint = bin.readShort(data, offset);  offset += 2;
	obj.indexToLocFormat  = bin.readShort(data, offset);  offset += 2;
	obj.glyphDataFormat   = bin.readShort(data, offset);  offset += 2;
	return obj;
}


Typr.hhea = {};
Typr.hhea.parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let obj = {};
	let tableVersion = bin.readFixed(data, offset);  offset += 4;
	obj.ascender  = bin.readShort(data, offset);  offset += 2;
	obj.descender = bin.readShort(data, offset);  offset += 2;
	obj.lineGap = bin.readShort(data, offset);  offset += 2;

	obj.advanceWidthMax = bin.readUshort(data, offset);  offset += 2;
	obj.minLeftSideBearing  = bin.readShort(data, offset);  offset += 2;
	obj.minRightSideBearing = bin.readShort(data, offset);  offset += 2;
	obj.xMaxExtent = bin.readShort(data, offset);  offset += 2;

	obj.caretSlopeRise = bin.readShort(data, offset);  offset += 2;
	obj.caretSlopeRun  = bin.readShort(data, offset);  offset += 2;
	obj.caretOffset    = bin.readShort(data, offset);  offset += 2;

	offset += 4*2;

	obj.metricDataFormat = bin.readShort (data, offset);  offset += 2;
	obj.numberOfHMetrics = bin.readUshort(data, offset);  offset += 2;
	return obj;
}


Typr.hmtx = {};
Typr.hmtx.parse = function(data, offset, length, font)
{
	let bin = Typr._bin;
	let obj = {};

	obj.aWidth = [];
	obj.lsBearing = [];


	let aw = 0, lsb = 0;

	for(let i=0; i<font.maxp.numGlyphs; i++)
	{
		if(i<font.hhea.numberOfHMetrics) {  aw=bin.readUshort(data, offset);  offset += 2;  lsb=bin.readShort(data, offset);  offset+=2;  }
		obj.aWidth.push(aw);
		obj.lsBearing.push(lsb);
	}

	return obj;
}


Typr.kern = {};
Typr.kern.parse = function(data, offset, length, font)
{
	let bin = Typr._bin;

	let version = bin.readUshort(data, offset);  offset+=2;
	if(version==1) return Typr.kern.parseV1(data, offset-2, length, font);
	let nTables = bin.readUshort(data, offset);  offset+=2;

	let map = {glyph1: [], rval:[]};
	for(let i=0; i<nTables; i++)
	{
		offset+=2;	// skip version
		let length  = bin.readUshort(data, offset);  offset+=2;
		let coverage = bin.readUshort(data, offset);  offset+=2;
		let format = coverage>>>8;
		/* I have seen format 128 once, that's why I do */ format &= 0xf;
		if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
		else throw "unknown kern table format: "+format;
	}
	return map;
}

Typr.kern.parseV1 = function(data, offset, length, font)
{
	let bin = Typr._bin;

	let version = bin.readFixed(data, offset);  offset+=4;
	let nTables = bin.readUint(data, offset);  offset+=4;

	let map = {glyph1: [], rval:[]};
	for(let i=0; i<nTables; i++)
	{
		let length = bin.readUint(data, offset);   offset+=4;
		let coverage = bin.readUshort(data, offset);  offset+=2;
		let tupleIndex = bin.readUshort(data, offset);  offset+=2;
		let format = coverage>>>8;
		/* I have seen format 128 once, that's why I do */ format &= 0xf;
		if(format==0) offset = Typr.kern.readFormat0(data, offset, map);
		else throw "unknown kern table format: "+format;
	}
	return map;
}

Typr.kern.readFormat0 = function(data, offset, map)
{
	let bin = Typr._bin;
	let pleft = -1;
	let nPairs        = bin.readUshort(data, offset);  offset+=2;
	let searchRange   = bin.readUshort(data, offset);  offset+=2;
	let entrySelector = bin.readUshort(data, offset);  offset+=2;
	let rangeShift    = bin.readUshort(data, offset);  offset+=2;
	for(let j=0; j<nPairs; j++)
	{
		let left  = bin.readUshort(data, offset);  offset+=2;
		let right = bin.readUshort(data, offset);  offset+=2;
		let value = bin.readShort (data, offset);  offset+=2;
		if(left!=pleft) { map.glyph1.push(left);  map.rval.push({ glyph2:[], vals:[] }) }
		let rval = map.rval[map.rval.length-1];
		rval.glyph2.push(right);   rval.vals.push(value);
		pleft = left;
	}
	return offset;
}



Typr.loca = {};
Typr.loca.parse = function(data, offset, length, font)
{
	let bin = Typr._bin;
	let obj = [];

	let ver = font.head.indexToLocFormat;
	//console.log("loca", ver, length, 4*font.maxp.numGlyphs);
	let len = font.maxp.numGlyphs+1;

	if(ver==0) for(let i=0; i<len; i++) obj.push(bin.readUshort(data, offset+(i<<1))<<1);
	if(ver==1) for(let i=0; i<len; i++) obj.push(bin.readUint  (data, offset+(i<<2))   );

	return obj;
}


Typr.maxp = {};
Typr.maxp.parse = function(data, offset, length)
{
	//console.log(data.length, offset, length);

	let bin = Typr._bin;
	let obj = {};

	// both versions 0.5 and 1.0
	let ver = bin.readUint(data, offset); offset += 4;
	obj.numGlyphs = bin.readUshort(data, offset);  offset += 2;

	// only 1.0
	if(ver == 0x00010000)
	{
		obj.maxPoints             = bin.readUshort(data, offset);  offset += 2;
		obj.maxContours           = bin.readUshort(data, offset);  offset += 2;
		obj.maxCompositePoints    = bin.readUshort(data, offset);  offset += 2;
		obj.maxCompositeContours  = bin.readUshort(data, offset);  offset += 2;
		obj.maxZones              = bin.readUshort(data, offset);  offset += 2;
		obj.maxTwilightPoints     = bin.readUshort(data, offset);  offset += 2;
		obj.maxStorage            = bin.readUshort(data, offset);  offset += 2;
		obj.maxFunctionDefs       = bin.readUshort(data, offset);  offset += 2;
		obj.maxInstructionDefs    = bin.readUshort(data, offset);  offset += 2;
		obj.maxStackElements      = bin.readUshort(data, offset);  offset += 2;
		obj.maxSizeOfInstructions = bin.readUshort(data, offset);  offset += 2;
		obj.maxComponentElements  = bin.readUshort(data, offset);  offset += 2;
		obj.maxComponentDepth     = bin.readUshort(data, offset);  offset += 2;
	}

	return obj;
}


Typr.name = {};
Typr.name.parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let obj = {};
	let format = bin.readUshort(data, offset);  offset += 2;
	let count  = bin.readUshort(data, offset);  offset += 2;
	let stringOffset = bin.readUshort(data, offset);  offset += 2;

	//console.log(format,count);

	let names = [
		"copyright",
		"fontFamily",
		"fontSubfamily",
		"ID",
		"fullName",
		"version",
		"postScriptName",
		"trademark",
		"manufacturer",
		"designer",
		"description",
		"urlVendor",
		"urlDesigner",
		"licence",
		"licenceURL",
		"---",
		"typoFamilyName",
		"typoSubfamilyName",
		"compatibleFull",
		"sampleText",
		"postScriptCID",
		"wwsFamilyName",
		"wwsSubfamilyName",
		"lightPalette",
		"darkPalette"
	];

	let offset0 = offset;

	for(let i=0; i<count; i++)
	{
		let platformID = bin.readUshort(data, offset);  offset += 2;
		let encodingID = bin.readUshort(data, offset);  offset += 2;
		let languageID = bin.readUshort(data, offset);  offset += 2;
		let nameID     = bin.readUshort(data, offset);  offset += 2;
		let slen       = bin.readUshort(data, offset);  offset += 2;
		let noffset    = bin.readUshort(data, offset);  offset += 2;
		//console.log(platformID, encodingID, languageID.toString(16), nameID, length, noffset);

		let cname = names[nameID];
		let soff = offset0 + count*12 + noffset;
		let str;
		if(false){}
		else if(platformID == 0) str = bin.readUnicode(data, soff, slen/2);
		else if(platformID == 3 && encodingID == 0) str = bin.readUnicode(data, soff, slen/2);
		else if(encodingID == 0) str = bin.readASCII  (data, soff, slen);
		else if(encodingID == 1) str = bin.readUnicode(data, soff, slen/2);
		else if(encodingID == 3) str = bin.readUnicode(data, soff, slen/2);

		else if(platformID == 1) { str = bin.readASCII(data, soff, slen);  console.log("reading unknown MAC encoding "+encodingID+" as ASCII") }
		else throw "unknown encoding "+encodingID + ", platformID: "+platformID;

		let tid = "p"+platformID+","+(languageID).toString(16);//Typr._platforms[platformID];
		if(obj[tid]==null) obj[tid] = {};
		obj[tid][cname] = str;
		obj[tid]._lang = languageID;
		//console.log(tid, obj[tid]);
	}
	/*
	if(format == 1)
	{
		let langTagCount = bin.readUshort(data, offset);  offset += 2;
		for(let i=0; i<langTagCount; i++)
		{
			let length  = bin.readUshort(data, offset);  offset += 2;
			let noffset = bin.readUshort(data, offset);  offset += 2;
		}
	}
	*/

	//console.log(obj);

	for(let p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0409) return obj[p];		// United States
	for(let p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0000) return obj[p];		// Universal
	for(let p in obj) if(obj[p].postScriptName!=null && obj[p]._lang==0x0c0c) return obj[p];		// Canada
	for(let p in obj) if(obj[p].postScriptName!=null) return obj[p];

	let tname;
	for(let p in obj) { tname=p; break; }
	console.log("returning name table with languageID "+ obj[tname]._lang);
	return obj[tname];
}


Typr["OS/2"] = {};
Typr["OS/2"].parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let ver = bin.readUshort(data, offset); offset += 2;

	let obj = {};
	if     (ver==0) Typr["OS/2"].version0(data, offset, obj);
	else if(ver==1) Typr["OS/2"].version1(data, offset, obj);
	else if(ver==2 || ver==3 || ver==4) Typr["OS/2"].version2(data, offset, obj);
	else if(ver==5) Typr["OS/2"].version5(data, offset, obj);
	else throw "unknown OS/2 table version: "+ver;

	return obj;
}

Typr["OS/2"].version0 = function(data, offset, obj)
{
	let bin = Typr._bin;
	obj.xAvgCharWidth = bin.readShort(data, offset); offset += 2;
	obj.usWeightClass = bin.readUshort(data, offset); offset += 2;
	obj.usWidthClass  = bin.readUshort(data, offset); offset += 2;
	obj.fsType = bin.readUshort(data, offset); offset += 2;
	obj.ySubscriptXSize = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptYSize = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptXOffset = bin.readShort(data, offset); offset += 2;
	obj.ySubscriptYOffset = bin.readShort(data, offset); offset += 2;
	obj.ySuperscriptXSize = bin.readShort(data, offset); offset += 2;
	obj.ySuperscriptYSize = bin.readShort(data, offset); offset += 2;
	obj.ySuperscriptXOffset = bin.readShort(data, offset); offset += 2;
	obj.ySuperscriptYOffset = bin.readShort(data, offset); offset += 2;
	obj.yStrikeoutSize = bin.readShort(data, offset); offset += 2;
	obj.yStrikeoutPosition = bin.readShort(data, offset); offset += 2;
	obj.sFamilyClass = bin.readShort(data, offset); offset += 2;
	obj.panose = bin.readBytes(data, offset, 10);  offset += 10;
	obj.ulUnicodeRange1	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange2	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange3	= bin.readUint(data, offset);  offset += 4;
	obj.ulUnicodeRange4	= bin.readUint(data, offset);  offset += 4;
	obj.achVendID = [bin.readInt8(data, offset), bin.readInt8(data, offset+1),bin.readInt8(data, offset+2),bin.readInt8(data, offset+3)];  offset += 4;
	obj.fsSelection	 = bin.readUshort(data, offset); offset += 2;
	obj.usFirstCharIndex = bin.readUshort(data, offset); offset += 2;
	obj.usLastCharIndex = bin.readUshort(data, offset); offset += 2;
	obj.sTypoAscender = bin.readShort(data, offset); offset += 2;
	obj.sTypoDescender = bin.readShort(data, offset); offset += 2;
	obj.sTypoLineGap = bin.readShort(data, offset); offset += 2;
	obj.usWinAscent = bin.readUshort(data, offset); offset += 2;
	obj.usWinDescent = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr["OS/2"].version1 = function(data, offset, obj)
{
	let bin = Typr._bin;
	offset = Typr["OS/2"].version0(data, offset, obj);

	obj.ulCodePageRange1 = bin.readUint(data, offset); offset += 4;
	obj.ulCodePageRange2 = bin.readUint(data, offset); offset += 4;
	return offset;
}

Typr["OS/2"].version2 = function(data, offset, obj)
{
	let bin = Typr._bin;
	offset = Typr["OS/2"].version1(data, offset, obj);

	obj.sxHeight = bin.readShort(data, offset); offset += 2;
	obj.sCapHeight = bin.readShort(data, offset); offset += 2;
	obj.usDefault = bin.readUshort(data, offset); offset += 2;
	obj.usBreak = bin.readUshort(data, offset); offset += 2;
	obj.usMaxContext = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr["OS/2"].version5 = function(data, offset, obj)
{
	let bin = Typr._bin;
	offset = Typr["OS/2"].version2(data, offset, obj);

	obj.usLowerOpticalPointSize = bin.readUshort(data, offset); offset += 2;
	obj.usUpperOpticalPointSize = bin.readUshort(data, offset); offset += 2;
	return offset;
}

Typr.post = {};
Typr.post.parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let obj = {};

	obj.version           = bin.readFixed(data, offset);  offset+=4;
	obj.italicAngle       = bin.readFixed(data, offset);  offset+=4;
	obj.underlinePosition = bin.readShort(data, offset);  offset+=2;
	obj.underlineThickness = bin.readShort(data, offset);  offset+=2;

	return obj;
}
Typr.SVG = {};
Typr.SVG.parse = function(data, offset, length)
{
	let bin = Typr._bin;
	let obj = { entries: []};

	let offset0 = offset;

	let tableVersion = bin.readUshort(data, offset);	offset += 2;
	let svgDocIndexOffset = bin.readUint(data, offset);	offset += 4;
	let reserved = bin.readUint(data, offset); offset += 4;

	offset = svgDocIndexOffset + offset0;

	let numEntries = bin.readUshort(data, offset);	offset += 2;

	for(let i=0; i<numEntries; i++)
	{
		let startGlyphID = bin.readUshort(data, offset);  offset += 2;
		let endGlyphID   = bin.readUshort(data, offset);  offset += 2;
		let svgDocOffset = bin.readUint  (data, offset);  offset += 4;
		let svgDocLength = bin.readUint  (data, offset);  offset += 4;

		let sbuf = new Uint8Array(data.buffer, offset0 + svgDocOffset + svgDocIndexOffset, svgDocLength);
		let svg = bin.readUTF8(sbuf, 0, sbuf.length);

		for(let f=startGlyphID; f<=endGlyphID; f++) {
			obj.entries[f] = svg;
		}
	}
	return obj;
}

Typr.SVG.toPath = function(str)
{
	// console.log(str);
	str = new svgFlatten(str).pathify().value();
	let pth = {cmds:[], crds:[]};
	if(str==null) return pth;

	let prsr = new DOMParser();
	let doc = prsr["parseFromString"](str,"image/svg+xml");

	let svg = doc.firstChild;
	while(svg.tagName!="svg") svg = svg.nextSibling;
	let vb = svg.getAttribute("viewBox");
	if (vb) vb = vb.trim().split(" ").map(parseFloat); else vb = [0, 0, 1000, 1000];


	Typr.SVG._toPath(svg.children, pth);
	for(let i=0; i<pth.crds.length; i+=2) {
		let x = pth.crds[i], y = pth.crds[i+1];
		x -= vb[0];
		y -= vb[1];
		//HACK
		// y = -y;
		pth.crds[i] = x;
		pth.crds[i+1] = y;
	}
	return pth;
}

Typr.SVG._toPath = function(nds, pth, fill) {

	for(let ni=0; ni<nds.length; ni++) {
		let nd = nds[ni], tn = nd.tagName;
		let cfl = nd.getAttribute("fill");  if(cfl==null) cfl = fill;
		if(tn=="g") Typr.SVG._toPath(nd.children, pth, cfl);
		else if(tn=="path") {
			pth.cmds.push(cfl?cfl:"#000000");
			let d = nd.getAttribute("d");
			d = svgpath(d).unarc().toString();
			let toks = Typr.SVG._tokens(d);
			Typr.SVG._toksToPath(toks, pth); //pth.cmds.push("X"); //JIM HACK remove X from end

		}
		else if(tn=="defs") {}
		else console.log(tn, nd);
	}
}

Typr.SVG._tokens = function(d) {
	let ts = [], off = 0, rn=false, cn="";  // reading number, current number
	while(off<d.length){
		let cc=d.charCodeAt(off), ch = d.charAt(off);  off++;
		let isNum = (48<=cc && cc<=57) || ch=="." || ch=="-";

		if(rn) {
			if(ch=="-") {  ts.push(parseFloat(cn));  cn=ch;  }
			else if(isNum) cn+=ch;
			else {  ts.push(parseFloat(cn));  if(ch!="," && ch!=" ") ts.push(ch);  rn=false;  }
		}
		else {
			if(isNum) {  cn=ch;  rn=true;  }
			else if(ch!="," && ch!=" ") ts.push(ch);
		}
	}
	if(rn) ts.push(parseFloat(cn));
	return ts;
}

Typr.SVG._toksToPath = function(ts, pth) {
	let i = 0, x = 0, y = 0, ox = 0, oy = 0;
	let pc = {"M":2,"L":2,"H":1,"V":1,   "S":4,   "C":6};
	let cmds = pth.cmds, crds = pth.crds;
	while(i<ts.length) {
		let cmd = ts[i];  i++;
		if(cmd=="z") {  cmds.push("Z");  x=ox;  y=oy;  }
		else if(typeof cmd !== "string"){ return cmd}
		else {

			let cmu = cmd.toUpperCase();
			let ps = pc[cmu], reps = Typr.SVG._reps(ts, i, ps);

			for(let j=0; j<reps; j++) {
				let xi = 0, yi = 0;   if(cmd!=cmu) {  xi=x;  yi=y;  }

				if(false) {}
				else if(cmu=="M") {  x = xi+ts[i++];  y = yi+ts[i++];  cmds.push("M");  crds.push(x,y);  ox=x;  oy=y; }
				else if(cmu=="L") {  x = xi+ts[i++];  y = yi+ts[i++];  cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="H") {  x = xi+ts[i++];                   cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="V") {  y = yi+ts[i++];                   cmds.push("L");  crds.push(x,y);  }
				else if(cmu=="C") {
					let x1=xi+ts[i++], y1=yi+ts[i++], x2=xi+ts[i++], y2=yi+ts[i++], x3=xi+ts[i++], y3=yi+ts[i++];
					cmds.push("C");  crds.push(x1,y1,x2,y2,x3,y3);  x=x3;  y=y3;
				}
				else if(cmu=="S") {
					let co = Math.max(crds.length-4, 0);
					let x1 = x+x-crds[co], y1 = y+y-crds[co+1];
					let x2=xi+ts[i++], y2=yi+ts[i++], x3=xi+ts[i++], y3=yi+ts[i++];
					cmds.push("C");  crds.push(x1,y1,x2,y2,x3,y3);  x=x3;  y=y3;
				}
				else console.log("Unknown SVG command "+cmd);
			}
		}
	}
}
Typr.SVG._reps = function(ts, off, ps) {
	let i = off;
	while(i<ts.length) {  if((typeof ts[i]) == "string") break;  i+=ps;  }
	return (i-off)/ps;
}

module.exports = Typr;