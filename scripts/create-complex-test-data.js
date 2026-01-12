const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { path7za } = require('7zip-bin');

async function createComplexTestData() {
  const testDir = path.join(__dirname, '../test-comics-complex');
  await fs.ensureDir(testDir);
  await fs.ensureDir(path.join(testDir, 'subdir'));

  // Create images
  const images = [
    { name: 'z_last_page.jpg', color: { r: 0, g: 0, b: 0 } }, // schwarz
    { name: 'a_first_page.jpg', color: { r: 0, g: 0, b: 255 } }, // blau
  ];

  for (const img of images) {
    const imgPath = path.join(testDir, img.name);
    await fs.ensureDir(path.dirname(imgPath));
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: img.color
      }
    }).jpeg().toFile(imgPath);
  }

  const cbzPath = path.join(testDir, 'complex.cbz');
  if (fs.existsSync(cbzPath)) fs.removeSync(cbzPath);
  
  // Wir müssen die Dateien einzeln hinzufügen oder das Verzeichnis wechseln, 
  // um die Pfade im Archiv korrekt zu haben.
  process.chdir(testDir);
  execSync(`"${path7za}" a "complex.cbz" "z_last_page.jpg" "a_first_page.jpg"`);

  // Cleanup
  fs.removeSync('z_last_page.jpg');
  fs.removeSync('subdir');
  fs.removeSync('a_first_page.jpg');
  fs.removeSync('cover.jpg');

  console.log('Complex test data created.');
}

createComplexTestData().catch(console.error);
