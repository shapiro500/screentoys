(() => {
const wordmark = document.querySelector('.wordmark-text');
const wordmarkBox = document.querySelector('.brand-name');
const header = document.querySelector('.header');
const intro = document.querySelector('.intro-row');
const baselineMarker = document.createElement('span');
baselineMarker.className = 'wordmark-baseline';
baselineMarker.setAttribute('aria-hidden', 'true');
wordmark.append(baselineMarker);
const textMeasure = document.createElement('canvas').getContext('2d');
let fitFrame;
function measureWordmark(fontSize) {
  wordmark.style.fontSize = fontSize + 'px';
  const style = getComputedStyle(wordmark);
  textMeasure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  textMeasure.letterSpacing = style.letterSpacing;
  textMeasure.fontKerning = style.fontKerning;
  const ink = textMeasure.measureText(wordmark.textContent);
  const body = textMeasure.measureText('s');
  const inkHeight = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent;
  const bodyHeight = body.actualBoundingBoxAscent + body.actualBoundingBoxDescent;
  const box = wordmark.getBoundingClientRect();
  const baseline = baselineMarker.getBoundingClientRect().top - box.top;
  // Trim the font's built-in leading and side bearings. Padding then measures
  // from the visible letters, including the y descender, rather than the em box.
  wordmark.style.marginTop = -(baseline - ink.actualBoundingBoxAscent) + 'px';
  wordmark.style.marginBottom = -(box.height - baseline - ink.actualBoundingBoxDescent) + 'px';
  wordmark.style.marginLeft = ink.actualBoundingBoxLeft + 'px';
  wordmark.style.marginRight = -(box.width - ink.actualBoundingBoxRight) + 'px';
  // Match the side inset to the breathing room around the lowercase body.
  // Center that body optically; t and y extend into the surrounding whitespace.
  wordmarkBox.style.setProperty('--wordmark-side-extra', (inkHeight - bodyHeight) / 2 + 'px');
  const opticalShift = (ink.actualBoundingBoxDescent - ink.actualBoundingBoxAscent
    - body.actualBoundingBoxDescent + body.actualBoundingBoxAscent) / 2;
  wordmark.style.transform = `translateY(${opticalShift}px)`;
  return {
    width: ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight,
    height: inkHeight,
    bodyHeight
  };
}
function fitWordmark() {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(() => {
    const style = getComputedStyle(wordmarkBox);
    const padding = parseFloat(style.paddingTop);
    const mobile = matchMedia('(max-width:700px)').matches;
    const besideTitle = true;
    const requested = mobile ? 56 : 110;
    const requestedInk = measureWordmark(requested);
    const widthPerPixel = requestedInk.width / requested;
    const heightPerPixel = requestedInk.height / requested;
    const sideExtraPerPixel = (requestedInk.height - requestedInk.bodyHeight) / requested;
    // The square follows the text's natural height, including equal padding.
    // Solve width and height together so neither larger type nor a wrapped
    // greeting gets squeezed into a fixed-height header.
    for (let pass = 0; pass < 6; pass++) {
      const greetingHeight = besideTitle ? 0 : intro.getBoundingClientRect().height;
      const fittingSize = (header.clientWidth - 4 * padding - greetingHeight - 2) / (widthPerPixel + heightPerPixel + sideExtraPerPixel);
      const fontSize = Math.max(12, Math.floor(Math.min(requested, fittingSize) * 10) / 10);
      const ink = measureWordmark(fontSize);
      const square = ink.height + 2 * padding + greetingHeight;
      document.documentElement.style.setProperty('--logo-cell', square + 'px');
    }
  });
}

const headerObserver = new ResizeObserver(fitWordmark);
headerObserver.observe(header);
headerObserver.observe(intro);
document.fonts.addEventListener('loadingdone', fitWordmark);
fitWordmark();
document.fonts.ready.then(fitWordmark);

})();
