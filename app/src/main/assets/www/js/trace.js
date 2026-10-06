(function (root) {
  var DX = [1, 1, 0, -1, -1, -1, 0, 1];
  var DY = [0, 1, 1, 1, 0, -1, -1, -1];

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function otsu(luma) {
    var hist = new Array(256);
    var i;
    for (i = 0; i < 256; i++) hist[i] = 0;
    for (i = 0; i < luma.length; i++) hist[luma[i]]++;
    var total = luma.length;
    var sum = 0;
    for (i = 0; i < 256; i++) sum += i * hist[i];
    var sumB = 0;
    var wB = 0;
    var best = 0;
    var level = 128;
    for (i = 0; i < 256; i++) {
      wB += hist[i];
      if (!wB) continue;
      var wF = total - wB;
      if (!wF) break;
      sumB += i * hist[i];
      var mB = sumB / wB;
      var mF = (sum - sumB) / wF;
      var between = wB * wF * (mB - mF) * (mB - mF);
      if (between >= best) {
        best = between;
        level = i;
      }
    }
    return level;
  }

  function mean(luma) {
    var s = 0;
    for (var i = 0; i < luma.length; i++) s += luma[i];
    return luma.length ? s / luma.length : 128;
  }
