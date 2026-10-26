import fs from '@ohos.file.fs';
import font from '@ohos.font';
import { assFontConfiguration } from '../utils/AssFontConfig';

export interface AssFontSetup { path: string; family: string; configuration: string }

export class AssFonts {
  // Existing cache files are bounded in bytes before reading; XML generation has a separate code-unit budget.
  private static readonly maximumCachedConfigurationReadBytes: number = 1024 * 1024;
  static prepare(cacheDirectory: string): AssFontSetup {
    const config = font.getUIFontConfig();
    const directory = `${cacheDirectory}/ass-fonts`;
    const cache = `${directory}/cache`;
    const content = assFontConfiguration(config, cache);
    const families: string[] = config.generic.map((generic) => generic.family);
    for (const group of config.fallbackGroups) {
      for (const fallback of group.fallback) { families.push(fallback.family); }
    }
    let path = ''; let family = '';
    // Some OS builds return an empty font list while these public family lookups still work.
    for (const name of families) {
      try {
        const info = font.getFontByName(name);
        if (info?.path && fs.accessSync(info.path)) { path = info.path; family = name; break; }
      } catch (e) { /* Try the next family declared by the platform. */ }
    }
    if (!path) { throw new Error('ass_font_unavailable'); }
    if (!fs.accessSync(directory)) { fs.mkdirSync(directory); }
    if (!fs.accessSync(cache)) { fs.mkdirSync(cache); }
    const configuration = `${directory}/fonts.conf`;
    if (!fs.accessSync(configuration) || fs.statSync(configuration).size > AssFonts.maximumCachedConfigurationReadBytes || fs.readTextSync(configuration) !== content) {
      const file = fs.openSync(configuration + '.tmp', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try { fs.writeSync(file.fd, content); fs.fsyncSync(file.fd); } finally { fs.closeSync(file); }
      fs.renameSync(configuration + '.tmp', configuration);
    }
    return { path: path, family: family, configuration: configuration };
  }
}
