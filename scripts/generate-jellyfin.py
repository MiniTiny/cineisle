"""Generate the application's OpenAPI subset as ArkTS. No network or third-party packages.
Run with --check in CI to detect schema/config/generated output drift.
Unsupported schema and wire formats fail explicitly; they never degrade to any.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
config_path = root / 'openapi/client-config.json'
config = json.loads(config_path.read_text())
spec_bytes = (config_path.parent / config['schema']).read_bytes()
assert hashlib.sha256(spec_bytes).hexdigest() == config['schemaSha256'], 'Schema fingerprint mismatch'
spec = json.loads(spec_bytes)
assert spec['openapi'] == '3.0.1' and spec['info']['version'] == config['schemaVersion']
schemas = spec['components']['schemas']
wanted = config['operations']
assert len(set(wanted)) == len(wanted), 'Duplicate operation selection'
operations = {}
for path, entry in spec['paths'].items():
    for method, op in entry.items():
        if isinstance(op, dict) and op.get('operationId') in wanted:
            assert op['operationId'] not in operations
            operations[op['operationId']] = (path, method.upper(), op)
assert set(operations) == set(wanted), 'Missing selected operation'
compatibility = []
compatibility_documents = {}
for profile in config.get('compatibilitySchemas', []):
    old_bytes = (config_path.parent / profile['schema']).read_bytes()
    assert hashlib.sha256(old_bytes).hexdigest() == profile['schemaSha256'], 'Compatibility schema fingerprint mismatch'
    old = json.loads(old_bytes)
    compatibility_documents[profile['schema']] = old
    assert old['openapi'] == '3.0.1' and old['info']['version'] == profile['schemaVersion']
    assert re.fullmatch(r'\d+\.\d+\.', profile['serverVersionPrefix']), 'Invalid version prefix'
    old_ops = {op['operationId']: (path, method.upper(), op) for path, entry in old['paths'].items()
               for method, op in entry.items() if isinstance(op, dict) and op.get('operationId') in wanted}
    assert set(old_ops) == set(wanted), 'Missing compatible operation'
    compatibility.append((profile, old_ops))
definitions, processing, enum_parsers = {}, set(), {}

def identifier(name):
    assert re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', name), name
    return name

def emit(name, schema):
    identifier(name)
    if name in definitions or name in processing:
        return name
    processing.add(name)
    if 'enum' in schema:
        members, cases, used = [], [], set()
        for index, value in enumerate(schema['enum']):
            assert isinstance(value, (str, int)) and not isinstance(value, bool)
            member = re.sub(r'[^A-Za-z0-9_]', '_', value) if isinstance(value, str) else f'Value{index}'
            if not re.match(r'^[A-Za-z_]', member):
                member = 'Value_' + member
            identifier(member)
            assert member not in used, ('Duplicate enum member', name, member)
            used.add(member)
            members.append(f'  {member} = {json.dumps(value)}')
            cases.append(f'    case {json.dumps(str(value))}: return {name}.{member};')
        source = f'export enum {name} {{\n' + ',\n'.join(members) + '\n}'
        enum_parsers[name] = f'function parse{name}(value: string): {name} {{\n  switch (value) {{\n' + '\n'.join(cases) + "\n    default: throw new Error('api_parameter_invalid');\n  }\n}"
    elif schema.get('type') == 'object' and 'properties' in schema:
        fields = []
        for field, child in schema['properties'].items():
            fields.append(f'  {identifier(field)}{"" if field in schema.get("required", []) else "?"}: {kind(child, name + field)};')
        assert schema.get('additionalProperties') in (None, False), ('Mixed object/dictionary unsupported', name)
        source = f'export interface {name} {{\n' + '\n'.join(fields) + '\n}'
    else:
        source = f'export type {name} = {kind(schema, name + "Value")};'
    definitions[name] = source
    processing.remove(name)
    return name

def kind(schema, hint):
    assert not any(k in schema for k in ['oneOf', 'anyOf', 'not']), ('Unsupported composition', hint)
    if '$ref' in schema:
        prefix = '#/components/schemas/'
        assert schema['$ref'].startswith(prefix), 'External reference unsupported'
        name = schema['$ref'][len(prefix):]
        result = emit(name, schemas[name])
    elif 'enum' in schema:
        result = emit(hint, schema)
    elif 'allOf' in schema:
        assert len(schema['allOf']) == 1, ('Unsupported composition', hint)
        result = kind(schema['allOf'][0], hint)
    elif schema.get('type') in ('string', 'integer', 'number', 'boolean'):
        result = {'string': 'string', 'integer': 'number', 'number': 'number', 'boolean': 'boolean'}[schema['type']]
    elif schema.get('type') == 'array':
        result = f'Array<{kind(schema["items"], hint + "Item")}>'
    elif schema.get('type') == 'object' and 'properties' in schema:
        result = emit(hint, schema)
    elif schema.get('type') == 'object' and isinstance(schema.get('additionalProperties'), dict):
        result = f'Record<string, {kind(schema["additionalProperties"], hint + "Entry")}>'
    else:
        raise ValueError(('Unsupported schema', hint, schema))
    return result + (' | null' if schema.get('nullable') else '')

def resolved(schema):
    if '$ref' in schema:
        return schemas[schema['$ref'].split('/')[-1]]
    return schema

def wire_shape(schema, document):
    if '$ref' in schema:
        return wire_shape(document['components']['schemas'][schema['$ref'].split('/')[-1]], document)
    if 'allOf' in schema:
        assert len(schema['allOf']) == 1
        return wire_shape(schema['allOf'][0], document)
    result = (schema.get('type'), schema.get('format') if schema.get('type') != 'string' else None)
    if schema.get('type') == 'array':
        result += (wire_shape(schema['items'], document),)
    if isinstance(schema.get('additionalProperties'), dict):
        result += (wire_shape(schema['additionalProperties'], document),)
    return result

def scalar_query(value, schema):
    s = resolved(schema)
    if s.get('type') == 'integer':
        return f'apiInteger({value}, {"true" if s.get("format") == "int32" else "false"})'
    if s.get('type') == 'number':
        return f'apiNumber({value})'
    assert s.get('type') in ('string', 'boolean'), ('Unsupported scalar query', schema)
    return f'{value}.toString()'

methods, converters, operation_manifest = [], [], []
for name in wanted:
    path, method, op = operations[name]
    assert method in ('GET', 'POST', 'DELETE'), ('Unsupported method', name)
    params = op.get('parameters', [])
    fields = []
    for p in params:
        assert p['in'] in ('path', 'query') and '$ref' not in p
        fields.append(f'  {identifier(p["name"])}{"" if p.get("required") else "?"}: {kind(p["schema"], name + p["name"])};')
    body = op.get('requestBody')
    if body:
        assert 'application/json' in body['content']
        fields.append(f'  body{"" if body.get("required") else "?"}: {kind(body["content"]["application/json"]["schema"], name + "Body")};')
    request = name + 'Request'
    variants = []
    for index, (profile, old_ops) in enumerate(compatibility):
        old_path, old_method, old_op = old_ops[name]
        assert old_method == method, ('Compatible method changed', name)
        old_params = {p['name']: p for p in old_op.get('parameters', [])}
        new_params = {p['name']: p for p in params}
        assert not any(p.get('required') for field, p in old_params.items() if field not in new_params), ('Required legacy parameter unsupported', name)
        for field, p in old_params.items():
            if field not in new_params:
                continue
            current = new_params[field]
            old_document = compatibility_documents[profile['schema']]
            assert wire_shape(p['schema'], old_document) == wire_shape(current['schema'], spec), ('Compatible parameter wire type changed', name, field)
            assert p.get('style', 'form') == current.get('style', 'form') and p.get('explode', True) == current.get('explode', True)
            assert p['in'] == current['in'] or (field == 'userId' and p['in'] == 'path' and current['in'] == 'query')
        # This profile changes routes/parameter locations only. DTOs remain from the primary schema.
        variants.append((index, old_path, old_params))
    if fields:
        definitions[request] = f'export interface {request} {{\n' + '\n'.join(fields) + '\n}'
    success = [r for status, r in op['responses'].items() if status.isdigit() and 200 <= int(status) < 300]
    assert len(success) == 1, ('Multiple success formats unsupported', name)
    content = success[0].get('content', {})
    if name in config['urlOnly']:
        assert content and all(v['schema'].get('format') == 'binary' for v in content.values())
        response_kind, result, call = 'external-binary-url', 'string', 'this.transport.url'
    elif 'application/json' in content:
        result = kind(content['application/json']['schema'], name + 'Response')
        response_kind, call = 'json', f'this.transport.request<{result}>'
    elif 'text/*' in content:
        assert name == 'GetSubtitle'
        response_kind, result, call = 'text', 'string', 'this.transport.text'
    elif not content:
        response_kind, result, call = 'void', 'void', 'this.transport.request<void>'
    else:
        raise ValueError(('Unsupported response', name, content))
    for p in params:
        if p['in'] == 'path':
            value = f'options.{p["name"]}'
            encoded = scalar_query(value, p['schema'])
            path = path.replace('{' + p['name'] + '}', '${encodeURIComponent(' + encoded + ')}')
    assert not re.search(r'(?<!\$)\{[A-Za-z]', path), ('Unresolved path', name)
    is_url = name in config['urlOnly']
    method_name = name[0].lower() + name[1:] + ('Url' if is_url else '')
    lines = [f'  {"" if is_url else "async "}{method_name}({"options: " + request if fields else ""}): {result if is_url else "Promise<" + result + ">"} {{', '    const query: ApiQuery[] = [];']
    for index, old_path, old_params in variants:
        lines.append(f'    const profile{index} = this.serverVersion.startsWith({json.dumps(compatibility[index][0]["serverVersionPrefix"])});')
    for p in params:
        if p['in'] != 'query':
            continue
        assert p.get('style', 'form') == 'form', ('Unsupported query style', name, p)
        field, schema = p['name'], p['schema']
        value = f'options.{field}'
        if schema.get('type') == 'array':
            element = kind(schema['items'], name + field + 'Item')
            encoding = scalar_query('entry', schema['items'])
            if p.get('explode', True):
                action = f'{value}.forEach((entry: {element}) => {{ query.push({{ key: {json.dumps(field)}, value: {encoding} }}); }});'
            else:
                action = f'query.push({{ key: {json.dumps(field)}, value: {value}.map((entry: {element}) => {encoding}).join(",") }});'
        elif schema.get('type') == 'object':
            assert p.get('explode', True) and isinstance(schema.get('additionalProperties'), dict)
            action = f'const dictionary = {value}; Object.keys(dictionary).forEach((key: string) => {{ const entry = dictionary[key]; if (entry !== undefined && entry !== null) {{ query.push({{ key: key, value: entry.toString() }}); }} }});'
        else:
            action = f'query.push({{ key: {json.dumps(field)}, value: {scalar_query(value, schema)} }});'
        missing = [f'profile{index}' for index, _, old_params in variants if field not in old_params]
        if missing:
            lines.append(f'    if ({value} !== undefined && {value} !== null && ({" || ".join(missing)})) {{ throw new Error("api_parameter_invalid"); }}')
        moved = [f'!profile{index}' for index, _, old_params in variants if field in old_params and old_params[field]['in'] == 'path']
        condition = f'{value} !== undefined && {value} !== null' + ''.join(f' && {entry}' for entry in moved)
        lines.append(f'    if ({condition}) {{ {action} }}')
    payload = "options.body === undefined ? '' : JSON.stringify(options.body)" if body else "''"
    for index, old_path, old_params in variants:
        if old_path == operations[name][0]:
            continue
        lines.append(f'    if (profile{index}) {{')
        for field, p in old_params.items():
            if p['in'] != 'path':
                continue
            value = f'options.{field}'
            if not new_params[field].get('required'):
                lines.append(f'      if (!{value}) {{ throw new Error("api_parameter_invalid"); }}')
            old_path = old_path.replace('{' + field + '}', '${encodeURIComponent(' + scalar_query(value, p['schema']) + ')}')
        assert not re.search(r'(?<!\$)\{[A-Za-z]', old_path), ('Unresolved compatible path', name)
        lines.append(f'      return {call}(`{old_path}`, ' + ('query);' if is_url else f'{json.dumps(method)}, query, {payload});'))
        lines.append('    }')
    if is_url:
        lines.append(f'    return {call}(`{path}`, query);')
    else:
        lines.append(f'    return {call}(`{path}`, {json.dumps(method)}, query, {payload});')
    lines.append('  }')
    methods.append('\n'.join(lines))
    operation_manifest.append({'operationId': name, 'method': method, 'path': operations[name][0], 'response': response_kind})
    operation_manifest[-1]['compatibility'] = [{'serverVersionPrefix': profile['serverVersionPrefix'], 'path': old_ops[name][0], 'method': old_ops[name][1]} for profile, old_ops in compatibility]
    if name in config['legacyQueryConverters']:
        assert all(p['in'] == 'query' and not p.get('required') for p in params)
        lines = [f'export function {method_name}FromQuery(params: ApiQuery[]): {request} {{', f'  const options: {request} = {{}};', '  params.forEach((param: ApiQuery) => {', '    switch (param.key.toLowerCase()) {']
        for p in params:
            schema = p['schema']; is_array = schema.get('type') == 'array'
            value_schema = schema['items'] if is_array else schema
            s = resolved(value_schema); value = 'entry' if is_array else 'param.value'
            if 'enum' in s:
                typ = kind(value_schema, name + p['name'] + 'Item')
                expr = f'parse{typ}({value})'
            elif s['type'] == 'integer':
                expr = f'parseApiInteger({value}, {"true" if s.get("format") == "int32" else "false"})'
            elif s['type'] == 'number':
                expr = f'parseApiNumber({value})'
            elif s['type'] == 'boolean':
                expr = f'parseApiBoolean({value})'
            else:
                assert s['type'] == 'string'
                expr = value
            if is_array:
                expr = f'param.value.split(",").map((entry: string) => {expr})'
            lines.append(f'      case {json.dumps(p["name"].lower())}: options.{p["name"]} = {expr}; break;')
        lines += ["      default: throw new Error('api_parameter_invalid');", '    }', '  });', '  return options;', '}']
        converters.append('\n'.join(lines))

header = '// Generated by scripts/generate-jellyfin.py. Do not edit.\n// Schema: Jellyfin ' + config['schemaVersion'] + '; SHA-256 ' + config['schemaSha256'] + '\n'
models = header + '// int64 uses number; native transport rejects integers outside JS safe range.\n\n' + '\n\n'.join(definitions[key] for key in sorted(definitions)) + '\n'
runtime = '''export interface ApiQuery { key: string; value: string }
export interface ApiTransport {
  request<T>(path: string, method: string, query: ApiQuery[], body: string): Promise<T>;
  text(path: string, method: string, query: ApiQuery[], body: string): Promise<string>;
  url(path: string, query: ApiQuery[]): string;
}
function apiInteger(value: number, int32: boolean): string {
  if (!Number.isSafeInteger(value) || (int32 && (value < -2147483648 || value > 2147483647))) { throw new Error('api_parameter_invalid'); }
  return value.toString();
}
function apiNumber(value: number): string {
  if (!Number.isFinite(value)) { throw new Error('api_parameter_invalid'); }
  return value.toString();
}
function parseApiInteger(value: string, int32: boolean): number {
  if (!/^-?\\d+$/.test(value)) { throw new Error('api_parameter_invalid'); }
  const result = Number(value); apiInteger(result, int32); return result;
}
function parseApiNumber(value: string): number {
  if (!value.trim()) { throw new Error('api_parameter_invalid'); }
  const result = Number(value); apiNumber(result); return result;
}
function parseApiBoolean(value: string): boolean {
  if (value === 'true') { return true; }
  if (value === 'false') { return false; }
  throw new Error('api_parameter_invalid');
}
'''
api = header + "import { " + ', '.join(sorted(definitions)) + " } from './Models';\n\n" + runtime + '\n' + '\n\n'.join(enum_parsers[key] for key in sorted(enum_parsers)) + '\n\n' + '\n\n'.join(converters) + '''
export class JellyfinApi {
  private transport: ApiTransport;
  private serverVersion: string = '';
  constructor(transport: ApiTransport) { this.transport = transport; }
  setServerVersion(version: string): void {
    if (typeof version !== 'string' || !/^\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) { throw new Error('api_response_invalid'); }
    this.serverVersion = version;
  }
''' + '\n\n'.join(methods) + '\n}\n'
manifest = {'schemaVersion': config['schemaVersion'], 'schemaSha256': config['schemaSha256'], 'source': config['source'], 'operations': operation_manifest, 'modelAndRequestDefinitions': len(definitions), 'modelDefinitions': len(definitions) - sum(bool(operations[n][2].get('parameters') or operations[n][2].get('requestBody')) for n in wanted), 'limitations': ['Selected application operations only; not a full Jellyfin SDK', 'Binary responses are URL builders consumed by Image/AVPlayer/system download', 'Subtitle text transport is used for SRT; no bitmap subtitle support', 'DTO types do not perform complete runtime schema validation; transport and domain mapping validate boundaries', 'int64 uses number; unsafe integers are rejected, no arbitrary precision support', 'Unsupported schema or serialization stops generation']}
outputs = {'Models.ets': models, 'JellyfinApi.ets': api, 'manifest.json': json.dumps(manifest, indent=2) + '\n'}
manifest['compatibilitySchemas'] = [profile for profile, _ in compatibility]
outputs['manifest.json'] = json.dumps(manifest, indent=2) + '\n'
output = root / config['output']
if args.check:
    for name, content in outputs.items():
        assert (output / name).read_text() == content, f'Generated output drift: {name}'
    print('OpenAPI generated files are current.')
else:
    output.mkdir(parents=True, exist_ok=True)
    for name, content in outputs.items():
        (output / name).write_text(content)
    print(f'Generated {len(wanted)} operations, {len(definitions)} model/request definitions.')
