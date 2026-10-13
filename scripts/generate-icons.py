#!/usr/bin/env python3
"""CineIsle original icon geometry. No external images, fonts or icon libraries."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / 'entry/src/main/resources/base/media'
NAV = {
    'home': '<path d="M3.8 15.1C6.4 15.1 7.1 12.2 9.4 12.2C11.6 12.2 11.5 8.6 13.7 8.6C15.9 8.6 16.8 12.1 18.4 12.7L20.2 14.7C16.5 18.2 7.8 18.6 3.8 15.1Z"/><path d="M7.1 20C10.2 21.1 14.4 21.1 17.3 20"/><circle cx="18" cy="5.3" r="1.5"/>',
    'star': '<path d="M12 3.3C12.6 8.9 15.1 11.4 20.7 12C15.1 12.6 12.6 15.1 12 20.7C11.4 15.1 8.9 12.6 3.3 12C8.9 11.4 11.4 8.9 12 3.3Z"/>',
    'library': '<path d="M7.8 4.2H17.2C18.6 4.2 19.8 5.4 19.8 6.8V16.2"/><rect x="4.2" y="7.4" width="12.5" height="12.4" rx="2.4"/><path d="M8 12H12.9M8 15.8H11.6"/>',
    'user': '<circle cx="12" cy="7.8" r="3.1"/><path d="M4.4 19.7C4.9 15.6 7.3 13.5 12 13.5C16.7 13.5 19.1 15.6 19.6 19.7M8.6 20H15.4"/>',
    'more': '<circle cx="7.8" cy="7.8" r="2"/><circle cx="16.2" cy="7.8" r="2"/><circle cx="7.8" cy="16.2" r="2"/><circle cx="16.2" cy="16.2" r="2"/>',
    'search': '<circle cx="10.5" cy="10.5" r="6.2"/><path d="M15.2 15.2L20.1 20.1"/>',
    'check': '<circle cx="12" cy="12" r="8.3"/><path d="M7.9 12.3L10.8 15.2L16.3 9.3"/>',
}
HEART = '<path d="M12 20C8.1 17.4 4.1 13.5 4.1 9.3C4.1 6.7 5.8 4.8 8.2 4.8C9.9 4.8 11.1 5.7 12 7C12.9 5.7 14.1 4.8 15.8 4.8C18.2 4.8 19.9 6.7 19.9 9.3C19.9 13.5 15.9 17.4 12 20Z"/>'
DETAIL = {
    'play': '<path d="M8.1 5.1C8.1 4.4 8.8 4 9.4 4.4L19 10.9C19.8 11.4 19.8 12.6 19 13.1L9.4 19.6C8.8 20 8.1 19.6 8.1 18.9Z"/>',
    'film': '<rect x="4.4" y="9.4" width="15.2" height="10.7" rx="2.3"/><path d="M4.4 9.4L3.6 5.8C3.4 5 3.9 4.4 4.7 4.3L17.4 2.7C18.2 2.6 18.8 3 19 3.8L19.6 7.2ZM8.8 3.8L10.1 8.1M14 3.2L15.3 7.5"/><path d="M10.2 12.7L14.7 14.7L10.2 17Z"/>',
    'download': '<path d="M12 4.2V14.3M8.4 10.8L12 14.5L15.6 10.8M4.4 16.2V18C4.4 19.2 5.2 20 6.4 20H17.6C18.8 20 19.6 19.2 19.6 18V16.2"/>',
    'trash': '<path d="M12.8 3.8H6.8C5.5 3.8 4.6 4.7 4.6 6V18C4.6 19.3 5.5 20.2 6.8 20.2H11.2M12.8 3.8V8H17V10.2L12.8 3.8Z"/><circle cx="17" cy="16.9" r="4.4"/><path d="M14.7 16.9H19.3"/>',
    'remove': '<path d="M4.8 7.2H19.2M9.1 7.2V4.1H14.9V7.2M6.4 7.2L7.2 18.4C7.3 19.6 8 20.2 9.2 20.2H14.8C16 20.2 16.7 19.6 16.8 18.4L17.6 7.2M10.1 10.9V16.6M13.9 10.9V16.6"/>',
    'heart': HEART,
    'heart_filled': HEART,
}

# Original management symbols extend the same rounded, 24-unit CineIsle family.
MENU = {
    'settings': '<path d="M4.2 6.3H6M10 6.3H19.8M4.2 12H14M18 12H19.8M4.2 17.7H8M12 17.7H19.8"/><circle cx="8" cy="6.3" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="17.7" r="2"/>',
    'sync': '<path d="M5.1 9C6.3 5.9 9 4.3 12.2 4.3C15.5 4.3 18.2 6 19.4 8.9M19.4 8.9V4.7M19.4 8.9H15.2M18.9 15C17.7 18.1 15 19.7 11.8 19.7C8.5 19.7 5.8 18 4.6 15.1M4.6 15.1V19.3M4.6 15.1H8.8"/>',
    'upload': '<path d="M12 15V4.5M8.4 8.1L12 4.5L15.6 8.1M4.4 15.8V18C4.4 19.2 5.2 20 6.4 20H17.6C18.8 20 19.6 19.2 19.6 18V15.8"/>',
    'accounts': '<circle cx="8.7" cy="7.4" r="2.8"/><path d="M3.8 18.9C4.1 14.6 6 12.7 9 12.7C10.4 12.7 11.6 13.1 12.5 14"/><rect x="14.4" y="10.8" width="5.8" height="9.3" rx="1.5"/><path d="M16.6 14H18M16.6 17H18"/>',
    'logout': '<path d="M10.1 4.3H6.4C5.1 4.3 4.3 5.1 4.3 6.4V17.6C4.3 18.9 5.1 19.7 6.4 19.7H10.1M10 12H20M16.3 8.3L20 12L16.3 15.7"/>',
    'cancel': '<circle cx="12" cy="12" r="8.3"/><path d="M8.7 8.7L15.3 15.3M15.3 8.7L8.7 15.3"/>',
    'chevron': '<path d="M9.4 5.7L15.7 12L9.4 18.3"/>',
}


def svg(geometry, color, filled=False):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">\n'
            f'  <g fill="{color if filled else "none"}" stroke="{color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">\n'
            f'    {geometry}\n  </g>\n</svg>\n')


def outputs():
    colors = {c['name']: c['value'] for c in json.loads((ROOT / 'entry/src/main/resources/base/element/color.json').read_text())['color']}
    result = {}
    for name, geometry in NAV.items():
        for state, color in [('active', colors['brand_accent']), ('muted', colors['brand_muted'])]:
            result[f'nav_{name}_{state}.svg'] = svg(geometry, color)
    for name, geometry in DETAIL.items():
        color = colors['brand_danger'] if name == 'remove' else colors['brand_warm'] if name == 'heart_filled' else colors['brand_accent']
        result[f'detail_{name}.svg'] = svg(geometry, color, name == 'heart_filled')
    for name, geometry in MENU.items():
        color = colors['brand_warm'] if name == 'logout' else colors['brand_muted'] if name == 'chevron' else colors['brand_accent']
        result[f'menu_{name}.svg'] = svg(geometry, color)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    stale = []
    for name, content in outputs().items():
        file = MEDIA / name
        if args.check:
            if not file.exists() or file.read_text() != content:
                stale.append(name)
        else:
            if file.exists():
                file.read_text()  # Inspect existing resource before replacing it.
            file.write_text(content)
    if stale:
        raise SystemExit('CineIsle icons require regeneration: ' + ', '.join(stale))
    print(f'{len(outputs())} CineIsle original icons ' + ('are current.' if args.check else 'generated.'))


if __name__ == '__main__':
    main()
