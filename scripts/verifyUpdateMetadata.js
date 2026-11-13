// scripts/verifyUpdateMetadata.js
// Valida los metadatos de autoactualización generados por electron-builder.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function unquote(value) {
  const text = String(value || '').trim();
  if ((text.startsWith("'") && text.endsWith("'")) || (text.startsWith('"') && text.endsWith('"'))) {
    return text.slice(1, -1);
  }
  return text;
}

function parseChannelFile(text) {
  const result = { version: null, files: [], path: null, sha512: null };
  let inFiles = false;
  let current = null;

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) continue;

    let match = line.match(/^version:\s*(.+)$/);
    if (match) {
      result.version = unquote(match[1]);
      inFiles = false;
      current = null;
      continue;
    }

    if (/^files:\s*$/.test(line)) {
      inFiles = true;
      current = null;
      continue;
    }

    if (inFiles) {
      match = line.match(/^\s+-\s*url:\s*(.+)$/);
      if (match) {
        current = { url: unquote(match[1]), sha512: null, size: null };
        result.files.push(current);
        continue;
      }

      if (current) {
        match = line.match(/^\s+sha512:\s*(.+)$/);
        if (match) {
          current.sha512 = unquote(match[1]);
          continue;
        }
        match = line.match(/^\s+size:\s*(\d+)\s*$/);
        if (match) {
          current.size = Number(match[1]);
          continue;
        }
        if (/^\s+blockMapSize:/.test(line)) continue;
      }

      if (/^\S/.test(line)) {
        inFiles = false;
        current = null;
      } else {
        continue;
      }
    }

    match = line.match(/^path:\s*(.+)$/);
    if (match) {
      result.path = unquote(match[1]);
      continue;
    }

    match = line.match(/^sha512:\s*(.+)$/);
    if (match) {
      result.sha512 = unquote(match[1]);
    }
  }

  return result;
}

function fileHash(filePath) {
  return crypto.createHash('sha512').update(fs.readFileSync(filePath)).digest('base64');
}

function verifyFileEntry(directory, file, errors, label) {
  if (!file.url) {
    errors.push(`${label}: entrada sin url`);
    return null;
  }

  const fileName = path.basename(file.url);
  const filePath = path.join(directory, fileName);
  if (!fs.existsSync(filePath)) {
    errors.push(`${label}: falta ${fileName}`);
    return null;
  }

  const stats = fs.statSync(filePath);
  if (!Number.isInteger(file.size) || stats.size !== file.size) {
    errors.push(`${label}: tamaño incorrecto para ${fileName} (esperado ${file.size}, real ${stats.size})`);
  }

  if (!file.sha512) {
    errors.push(`${label}: falta sha512 para ${fileName}`);
  } else if (fileHash(filePath) !== file.sha512) {
    errors.push(`${label}: sha512 incorrecto para ${fileName}`);
  }

  return file;
}

function verifyChannel(directory, fileName, expectedVersion, options, errors) {
  const channelPath = path.join(directory, fileName);
  if (!fs.existsSync(channelPath)) {
    errors.push(`${fileName}: no existe`);
    return;
  }

  const channel = parseChannelFile(fs.readFileSync(channelPath, 'utf8'));
  if (!channel.version) {
    errors.push(`${fileName}: falta version`);
    return;
  }
  if (channel.version !== expectedVersion) {
    errors.push(`${fileName}: version ${channel.version} != ${expectedVersion}`);
  }

  if (!Array.isArray(channel.files) || channel.files.length === 0) {
    errors.push(`${fileName}: no contiene files`);
    return;
  }

  for (const extension of options.extensions) {
    const entry = channel.files.find((file) => String(file.url).toLowerCase().endsWith(extension.toLowerCase()));
    if (!entry) {
      errors.push(`${fileName}: falta un fichero ${extension}`);
      continue;
    }
    if (options.archPattern && !options.archPattern.test(entry.url)) {
      errors.push(`${fileName}: ${entry.url} no parece de la arquitectura esperada`);
    }
    verifyFileEntry(directory, entry, errors, `${fileName} (${extension})`);
  }

  for (const file of channel.files) {
    verifyFileEntry(directory, file, errors, fileName);
  }

  if (!channel.path) {
    errors.push(`${fileName}: falta path`);
    return;
  }

  const pathEntry = channel.files.find((file) => path.basename(file.url) === path.basename(channel.path));
  if (!pathEntry) {
    errors.push(`${fileName}: path ${channel.path} no está entre los ficheros`);
  } else if (channel.sha512 && pathEntry.sha512 && channel.sha512 !== pathEntry.sha512) {
    errors.push(`${fileName}: sha512 superior no coincide con path`);
  }
}

function verifyUpdateMetadata(directory, expectedVersion) {
  const errors = [];

  verifyChannel(directory, 'latest-linux.yml', expectedVersion, {
    extensions: ['.deb', '.AppImage', '.rpm']
  }, errors);

  verifyChannel(directory, 'latest-linux-arm64.yml', expectedVersion, {
    extensions: ['.deb', '.AppImage', '.rpm'],
    archPattern: /(arm64|aarch64)/i
  }, errors);

  verifyChannel(directory, 'latest-mac.yml', expectedVersion, {
    extensions: ['.dmg']
  }, errors);

  return errors;
}

function main() {
  const directory = process.argv[2];
  if (!directory) {
    console.error('Uso: node scripts/verifyUpdateMetadata.js <directorio>');
    process.exit(2);
  }

  const packageVersion = require('../package.json').version;
  const errors = verifyUpdateMetadata(directory, packageVersion);
  if (errors.length > 0) {
    console.error('Metadatos de actualización inválidos:');
    for (const error of errors) console.error(` - ${error}`);
    process.exit(1);
  }

  console.log(`Metadatos de actualización válidos para ${packageVersion}.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  parseChannelFile,
  verifyUpdateMetadata
};
