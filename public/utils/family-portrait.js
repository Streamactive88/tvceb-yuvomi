import { brandMarkSvg } from '/utils/brand-mark.js';

let ready = false;
const imageHtml = '<img class="family-portrait" src="/assets/family/family.png" alt="" width="1402" height="1122" />';
// Keep the built-in mark until the private image has actually loaded. A clean
// source build therefore never renders a broken image or requires private data.
if (typeof Image !== 'undefined') {
  const image = new Image();
  image.onload = () => {
    ready = true;
    document.querySelectorAll('[data-family-mark]').forEach(mark => {
      mark.replaceChildren(); mark.insertAdjacentHTML('beforeend', imageHtml);
    });
  };
  image.src = '/assets/family/family.png';
}

export function familyMarkHtml() { return ready ? imageHtml : brandMarkSvg(); }
