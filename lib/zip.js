// Чтение отдельных записей из большого zip без загрузки его целиком.
//
// UI.zip весит гигабайт, и readFileSync на нём съедает столько же памяти.
// Здесь читается только хвост с оглавлением, а тела записей — по смещению.
const fs = require('fs');
const zlib = require('zlib');

function readAt(fd, offset, length) {
  const buf = Buffer.alloc(length);
  let got = 0;
  while (got < length) {
    const n = fs.readSync(fd, buf, got, length - got, offset + got);
    if (n === 0) break;
    got += n;
  }
  return got === length ? buf : buf.subarray(0, got);
}

// Zip64: если поле забито 0xffffffff, настоящее значение лежит в extra-поле 0x0001
function zip64Extra(extra, need) {
  const out = [];
  let p = 0;
  while (p + 4 <= extra.length) {
    const id = extra.readUInt16LE(p), len = extra.readUInt16LE(p + 2);
    if (id === 0x0001) {
      let q = p + 4;
      for (let i = 0; i < need && q + 8 <= p + 4 + len; i++, q += 8) out.push(Number(extra.readBigUInt64LE(q)));
      break;
    }
    p += 4 + len;
  }
  return out;
}

function openZip(file) {
  const fd = fs.openSync(file, 'r');
  const size = fs.fstatSync(fd).size;

  // End of Central Directory — в последних 64 КБ (комментарий архива не длиннее)
  const tailLen = Math.min(size, 66 * 1024);
  const tail = readAt(fd, size - tailLen, tailLen);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) { fs.closeSync(fd); throw new Error(`${file}: не найден End of Central Directory`); }

  let total = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOff = tail.readUInt32LE(eocd + 16);

  if (cdOff === 0xffffffff || cdSize === 0xffffffff || total === 0xffff) {
    // Zip64 EOCD locator стоит ровно перед обычным EOCD
    const locOff = tail.readUInt32LE(eocd - 20 + 8);
    const z64 = readAt(fd, locOff, 56);
    total = Number(z64.readBigUInt64LE(32));
    cdSize = Number(z64.readBigUInt64LE(40));
    cdOff = Number(z64.readBigUInt64LE(48));
  }

  const cd = readAt(fd, cdOff, cdSize);
  const entries = new Map();
  const order = [];
  let p = 0;
  for (let i = 0; i < total && p + 46 <= cd.length; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    const method = cd.readUInt16LE(p + 10);
    const nl = cd.readUInt16LE(p + 28), el = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
    let csize = cd.readUInt32LE(p + 20);
    let usize = cd.readUInt32LE(p + 24);
    let lho = cd.readUInt32LE(p + 42);
    const name = cd.toString('utf8', p + 46, p + 46 + nl);

    if (csize === 0xffffffff || usize === 0xffffffff || lho === 0xffffffff) {
      const extra = cd.subarray(p + 46 + nl, p + 46 + nl + el);
      const vals = zip64Extra(extra, 3);
      let vi = 0;
      if (usize === 0xffffffff) usize = vals[vi++];
      if (csize === 0xffffffff) csize = vals[vi++];
      if (lho === 0xffffffff) lho = vals[vi++];
    }

    const key = name.replace(/\\/g, '/');
    entries.set(key, { name, key, method, csize, usize, lho });
    order.push(key);
    p += 46 + nl + el + cl;
  }

  function read(key) {
    const e = entries.get(key.replace(/\\/g, '/'));
    if (!e) throw new Error(`нет записи ${key}`);
    const lh = readAt(fd, e.lho, 30);
    const lnl = lh.readUInt16LE(26), lel = lh.readUInt16LE(28);
    const raw = readAt(fd, e.lho + 30 + lnl + lel, e.csize);
    if (e.method === 0) return raw;
    if (e.method === 8) return zlib.inflateRawSync(raw);
    throw new Error(`${key}: метод сжатия ${e.method} не поддержан`);
  }

  // Первая запись, чьё имя (с прямыми слэшами) подходит под регулярку
  function find(re) {
    for (const key of order) if (re.test(key)) return key;
    return null;
  }

  return { entries, order, read, find, close: () => fs.closeSync(fd) };
}

module.exports = { openZip };
