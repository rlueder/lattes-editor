const sharp = require('sharp');
const path = require('path');
(async () => {
  for (const name of ['construction-grid', 'clean-preview']) {
    await sharp(path.join(__dirname, name + '.svg'))
      .png().toFile(path.join(__dirname, name + '.png'));
  }
})().catch(error => { console.error(error); process.exit(1); });
