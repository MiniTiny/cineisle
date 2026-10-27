#!/usr/bin/env python3
"""Resolve the repository's DevEco roots; no SDK discovery or fallback to another install."""
import argparse
import json
import os
from pathlib import Path
import sys

DEFAULTS = Path(__file__).resolve().parents[1] / 'config/deveco.json'

def resolve_deveco(environment=None, *, empty_is_default=True):
    env = os.environ if environment is None else environment
    defaults = json.loads(DEFAULTS.read_text())
    def option(key, fallback):
        value = env.get(key)
        return (value or fallback) if empty_is_default else (fallback if value is None else value)
    contents = option('DEVECO_CONTENTS', defaults['defaultContents'])
    sdk = option('DEVECO_SDK_HOME', contents + '/sdk')
    bundled_node = contents + '/tools/node'
    return {'contents': contents, 'sdkHome': sdk, 'bundledNodeHome': bundled_node,
            'nodeHome': option('NODE_HOME', bundled_node),
            'nativeHome': option('OHOS_NDK_HOME', sdk + '/default/openharmony/native')}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--null', action='store_true', help='emit contents, Node and SDK roots with NUL delimiters')
    parser.add_argument('--legacy-empty', action='store_true', help='preserve presence-based Python recipe environment handling')
    args = parser.parse_args()
    resolved = resolve_deveco(empty_is_default=not args.legacy_empty)
    if args.null:
        sys.stdout.buffer.write(('\0'.join(resolved[k] for k in ['contents', 'nodeHome', 'sdkHome']) + '\0').encode())
    else:
        print(json.dumps(resolved))
