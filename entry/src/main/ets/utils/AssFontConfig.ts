import font from '@ohos.font';

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function directory(value: string): string {
  if (!value || value.length > 4096 || !value.startsWith('/') || /[\u0000-\u001f]/.test(value) || /(^|\/)\.\.?($|\/)/.test(value)) {
    throw new Error('ass_font_configuration_invalid');
  }
  return xml(value);
}

function family(value: string): string {
  if (!value || value.length > 512 || /[\u0000-\u001f]/.test(value)) { throw new Error('ass_font_configuration_invalid'); }
  return `<family>${xml(value)}</family>`;
}

// Only public platform metadata and an app-private cache directory enter the configuration.
// Subtitle contents never become XML, font directories, or include paths.
export function assFontConfiguration(config: font.UIFontConfig, cacheDirectory: string): string {
  if (!config?.fontDir?.length || config.fontDir.length > 32 || !config.generic?.length || config.generic.length > 128) {
    throw new Error('ass_font_configuration_invalid');
  }
  const lines: string[] = ['<?xml version="1.0"?>', '<fontconfig>'];
  for (const path of Array.from(new Set<string>(config.fontDir))) { lines.push(`<dir>${directory(path)}</dir>`); }
  lines.push(`<cachedir>${directory(cacheDirectory)}</cachedir>`);
  lines.push('<config><rescan><int>0</int></rescan></config>');
  const aliases = new Set<string>();
  for (const generic of config.generic) {
    if (!generic.family || generic.family.length > 512 || /[\u0000-\u001f]/.test(generic.family) || generic.alias.length > 128) {
      throw new Error('ass_font_configuration_invalid');
    }
    for (const alias of generic.alias) {
      if (!alias.name || alias.name.length > 512 || /[\u0000-\u001f]/.test(alias.name)) { throw new Error('ass_font_configuration_invalid'); }
      if (alias.name === generic.family || aliases.has(alias.name)) { continue; }
      aliases.add(alias.name);
      lines.push(`<alias><family>${xml(alias.name)}</family><prefer><family>${xml(generic.family)}</family></prefer></alias>`);
    }
  }
  // Fontconfig chooses missing glyphs from the actual scanned character coverage.
  // A fallback directory is not copied wholesale into the renderer's embedded-font heap.
  const fallbacks: string[] = [];
  if (!Array.isArray(config.fallbackGroups) || config.fallbackGroups.length > 64) { throw new Error('ass_font_configuration_invalid'); }
  for (const group of config.fallbackGroups) {
    if (!Array.isArray(group.fallback) || group.fallback.length > 512) { throw new Error('ass_font_configuration_invalid'); }
    const names = Array.from(new Set<string>(group.fallback.map((fallback) => fallback.family)));
    if (group.fontSetName) {
      lines.push(`<alias>${family(group.fontSetName)}<accept>${names.map((name: string) => family(name)).join('')}</accept></alias>`);
    } else { fallbacks.push(...names); }
  }
  // libass caches a sans-serif fallback list without a language. Keep the platform's
  // ordered fallback families here so math/ornamental coverage cannot outrank Arabic etc.
  const preferred = Array.from(new Set<string>([config.generic[0].family, ...fallbacks]));
  lines.push(`<alias><family>sans-serif</family><prefer>${preferred.map((name: string) => family(name)).join('')}</prefer></alias>`);
  lines.push('</fontconfig>');
  const result = lines.join('\n');
  if (result.length > 128 * 1024) { throw new Error('ass_font_configuration_invalid'); }
  return result;
}
