const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const { path7za } = require('7zip-bin');

async function createTestData() {
  const testDir = path.join(__dirname, '../test-comics');
  await fs.ensureDir(testDir);

  // 1. Create a dummy image
  const imgPath = path.join(testDir, 'cover.jpg');
  await sharp({
    create: {
      width: 400,
      height: 600,
      channels: 3,
      background: { r: 255, g: 0, b: 0 }
    }
  }).jpeg().toFile(imgPath);

  // 2. Create another dummy image
  const imgPath2 = path.join(testDir, 'page1.jpg');
  await sharp({
    create: {
      width: 400,
      height: 600,
      channels: 3,
      background: { r: 0, g: 255, b: 0 }
    }
  }).jpeg().toFile(imgPath2);

  // 3. Create a CBZ archive (which is just a zip)
  const cbzPath = path.join(testDir, 'test-comic.cbz');
  if (fs.existsSync(cbzPath)) fs.removeSync(cbzPath);
  
  // Use 7z to create the archive
  execSync(`"${path7za}" a "${cbzPath}" "${imgPath}" "${imgPath2}"`);

  // 4. Create a CBR archive (using 7z to create a rar-like archive, though 7z creates .7z or .zip usually, but we can name it .cbr)
  // Note: 7z cannot create RAR files, but it can create 7z files. Let's create a .cb7
  const cb7Path = path.join(testDir, 'test-comic.cb7');
  if (fs.existsSync(cb7Path)) fs.removeSync(cb7Path);
  execSync(`"${path7za}" a "${cb7Path}" "${imgPath}" "${imgPath2}"`);

  // Cleanup loose images
  fs.removeSync(imgPath);
  fs.removeSync(imgPath2);

  console.log('Test data created in test-comics/');
}

createTestData().catch(console.error);
