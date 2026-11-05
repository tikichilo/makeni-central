'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const MAP_FILE = path.join(PUBLIC_DIR, 'image-map.json');
const REPORT_FILE = path.join(ROOT, 'image-migration-report.json');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);
const EXTERNAL_IMAGES = [
  {
    key: 'https://www.clubministries.org/wp-content/uploads/LittleLambLogo.png',
    publicId: 'little-lamb-logo',
  },
  {
    key: 'https://www.clubministries.org/wp-content/uploads/EagerBeaverLogo.png',
    publicId: 'eager-beaver-logo',
  },
  {
    key: 'https://www.clubministries.org/wp-content/uploads/BusyBeeLogo.png',
    publicId: 'busy-bee-logo',
  },
  {
    key: 'https://www.clubministries.org/wp-content/uploads/SunbeamLogo.png',
    publicId: 'sunbeam-logo',
  },
  {
    key: 'https://www.clubministries.org/wp-content/uploads/BuilderLogo.png',
    publicId: 'builder-logo',
  },
  {
    key: 'https://www.clubministries.org/wp-content/uploads/HelpingHandLogo.png',
    publicId: 'helping-hand-logo',
  },
  {
    key: 'https://i.pinimg.com/736x/ea/3a/3e/ea3a3e7d184d98efa9e5eb5e6670c201.jpg',
    publicId: 'pathfinders-pinterest',
  },
];
const REFERENCED_MISSING_ASSETS = [
  '/slideshow/ay5.jpg',
  '/slideshow/ch17.jpg',
  '/images/ch1.jpg',
];
const LEADER_IMAGE_NAMES = new Set([
  'pastor.jpeg', 'chilimina.jpg', 'chilomo.jpg', 'aori.jpg', 'hantumbu.jpg',
  'kalonga.jpg', 'tembo.jpg', 'mrs zimindo.jpg', 'hamatimba.jpg', 'nsinde.jpg',
  'nyasulu.jpg', 'sterwardship.jpg', 'mrs chilomo.jpg', 'bester.jpg',
  'enock.jpg', 'moyo.jpg', 'youth leader.jpg', 'chimuka.jpg', 'tiki.jpg',
]);

const dryRun = process.argv.includes('--dry-run');
const staticOnly = process.argv.includes('--static-only');
const imageMap = {};
const report = {
  dryRun,
  databaseSkipped: staticOnly,
  uploaded: [],
  skipped: [],
  missing: [],
  unchangedDatabaseRecords: [],
};
function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

function stablePublicId(relativePath, hasCollision) {
  const parsed = path.parse(relativePath);
  const base = slugify(parsed.name);
  if (!hasCollision) return base;
  const suffix = crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 8);
  return `${base}-${suffix}`;
}

function deliveryWidth(localPath) {
  if (localPath.startsWith('/slideshow/')) return 1600;
  if (/logo/i.test(path.basename(localPath)) || ['sda.png', 'indexlogo.png'].includes(path.basename(localPath).toLowerCase())) return 400;
  if (localPath.startsWith('/images/')) {
    return LEADER_IMAGE_NAMES.has(path.basename(localPath).toLowerCase()) ? 400 : 800;
  }
  if (localPath.startsWith('/external/')) return 800;
  return 800;
}

function optimizedUrl(url, width) {
  return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width}/`);
}

function localMapKey(filePath) {
  return '/' + path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
}

function listImageFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listImageFiles(fullPath);
    return entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
      ? [fullPath]
      : [];
  });
}

function cloudinaryResourceUrl(resource) {
  if (resource.secure_url) return resource.secure_url;
  if (resource.url) return resource.url.replace(/^http:/, 'https:');
  const config = cloudinary.config();
  if (!config.cloud_name || !resource.version || !resource.public_id || !resource.format) {
    throw new Error(`Could not construct a secure delivery URL for ${resource.public_id || 'Cloudinary resource'}`);
  }
  return `https://res.cloudinary.com/${config.cloud_name}/image/upload/v${resource.version}/${resource.public_id}.${resource.format}`;
}

async function uploadOrReuse(source, options) {
  if (dryRun) {
    return { plannedUrl: null, publicId: `${options.folder}/${options.publicId}` };
  }

  let resource;
  try {
    resource = await cloudinary.api.resource(`${options.folder}/${options.publicId}`, {
      resource_type: 'image',
    });
    report.skipped.push(source);
  } catch (err) {
    const status = err.http_code || (err.error && err.error.http_code);
    if (status !== 404) throw err;
    if (options.remoteUrl) {
      resource = await cloudinary.uploader.upload(options.remoteUrl, {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: 'image',
        overwrite: false,
        use_filename: false,
      });
    } else {
      resource = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: options.folder,
          public_id: options.publicId,
          resource_type: 'image',
          overwrite: false,
          use_filename: false,
        }, (uploadError, result) => {
          if (uploadError) return reject(uploadError);
          if (!result) return reject(new Error(`Cloudinary returned no result for ${source}`));
          resolve(result);
        });
        fs.createReadStream(options.filePath).pipe(stream);
        stream.on('error', reject);
      });
    }
    report.uploaded.push(source);
  }

  const url = cloudinaryResourceUrl(resource);
  imageMap[source] = optimizedUrl(url, deliveryWidth(source));
  return { url: imageMap[source], publicId: resource.public_id };
}

async function migrateStaticImages() {
  const groups = [
    { directory: path.join(PUBLIC_DIR, 'slideshow'), folder: 'church/slideshow' },
    { directory: path.join(PUBLIC_DIR, 'images'), folder: 'church/images' },
    { directory: path.join(PUBLIC_DIR, 'dorcas'), folder: 'church/dorcas' },
    { directory: PUBLIC_DIR, folder: 'church/misc', rootOnly: true },
  ];

  for (const group of groups) {
    const files = group.rootOnly
      ? fs.readdirSync(group.directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map(entry => path.join(group.directory, entry.name))
      : listImageFiles(group.directory);
    const slugCounts = new Map();
    files.forEach(filePath => {
      const base = slugify(path.parse(path.relative(group.directory, filePath)).name);
      slugCounts.set(base, (slugCounts.get(base) || 0) + 1);
    });
    for (const filePath of files) {
      const localPath = localMapKey(filePath);
      const relativePath = path.relative(group.directory, filePath);
      const base = slugify(path.parse(relativePath).name);
      const publicId = stablePublicId(relativePath, slugCounts.get(base) > 1);
      if (dryRun) {
        console.log(`[dry-run] upload ${localPath} -> ${group.folder}/${publicId}`);
        continue;
      }
      await uploadOrReuse(localPath, { filePath, folder: group.folder, publicId });
    }
  }
}

async function migrateExternalImages() {
  for (const image of EXTERNAL_IMAGES) {
    if (dryRun) {
      console.log(`[dry-run] copy ${image.key} -> church/external/${image.publicId}`);
      continue;
    }
    await uploadOrReuse(image.key, {
      folder: 'church/external',
      publicId: image.publicId,
      remoteUrl: image.key,
    });
  }
}

function databasePathToLocalFile(value) {
  let pathname;
  try {
    pathname = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/uploads/')) return null;
  const filePath = path.resolve(PUBLIC_DIR, `.${pathname}`);
  return filePath.startsWith(PUBLIC_DIR + path.sep) ? filePath : null;
}

async function mapDatabaseImage(value, recordLabel) {
  const filePath = databasePathToLocalFile(value);
  if (!filePath) return value;
  const key = localMapKey(filePath);
  if (!fs.existsSync(filePath)) {
    report.missing.push({ path: key, record: recordLabel });
    return null;
  }
  if (!imageMap[key]) {
    const folderName = path.basename(path.dirname(filePath));
    const folder = `church/uploads/${slugify(folderName)}`;
    const publicId = stablePublicId(path.relative(path.dirname(filePath), filePath), false);
    if (dryRun) {
      console.log(`[dry-run] upload ${key} -> ${folder}/${publicId}; update ${recordLabel}`);
      return value;
    }
    await uploadOrReuse(key, { filePath, folder, publicId });
  }
  return imageMap[key];
}

async function migrateDatabase() {
  const Event = mongoose.model('Event', new mongoose.Schema({}, { strict: false }));
  const Recap = mongoose.model('Recap', new mongoose.Schema({}, { strict: false }));
  const GalleryPhoto = mongoose.model('GalleryPhoto', new mongoose.Schema({}, { strict: false }));

  const events = await Event.find({ posterUrl: /\/uploads\// }).lean();
  for (const event of events) {
    const nextUrl = await mapDatabaseImage(event.posterUrl, `Event:${event._id}.posterUrl`);
    if (nextUrl && nextUrl !== event.posterUrl && !dryRun) {
      await Event.updateOne({ _id: event._id }, { $set: { posterUrl: nextUrl } });
    }
  }

  const recaps = await Recap.find({ images: /\/uploads\// }).lean();
  for (const recap of recaps) {
    const nextImages = [];
    let hasMissingImage = false;
    for (const url of recap.images || []) {
      const nextUrl = await mapDatabaseImage(url, `Recap:${recap._id}.images`);
      if (!nextUrl) hasMissingImage = true;
      nextImages.push(nextUrl || url);
    }
    if (hasMissingImage) {
      report.unchangedDatabaseRecords.push(`Recap:${recap._id}`);
    } else if (!dryRun && nextImages.some((url, index) => url !== recap.images[index])) {
      await Recap.updateOne({ _id: recap._id }, { $set: { images: nextImages } });
    }
  }

  const photos = await GalleryPhoto.find({ imageUrl: /\/uploads\// }).lean();
  for (const photo of photos) {
    const nextUrl = await mapDatabaseImage(photo.imageUrl, `GalleryPhoto:${photo._id}.imageUrl`);
    if (nextUrl && nextUrl !== photo.imageUrl && !dryRun) {
      await GalleryPhoto.updateOne({ _id: photo._id }, { $set: { imageUrl: nextUrl } });
    }
  }
}

async function main() {
  if (!staticOnly && !process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required to inspect and migrate image records.');
  }

  if (!dryRun) {
    const config = process.env.CLOUDINARY_URL
      ? cloudinary.config()
      : cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      throw new Error('Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.');
    }
  }

  if (!staticOnly) await mongoose.connect(process.env.MONGO_URI);
  for (const localPath of REFERENCED_MISSING_ASSETS) {
    if (!fs.existsSync(path.join(PUBLIC_DIR, localPath.slice(1)))) {
      report.missing.push({ path: localPath, reason: 'Referenced by site source but not present locally' });
    }
  }

  await migrateStaticImages();
  await migrateExternalImages();
  if (!staticOnly) await migrateDatabase();

  if (!dryRun) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(imageMap, null, 2) + '\n');
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
    console.log(`Wrote ${path.relative(ROOT, MAP_FILE)} and ${path.relative(ROOT, REPORT_FILE)}.`);
  }
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch(err => {
    console.error('Image migration failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
