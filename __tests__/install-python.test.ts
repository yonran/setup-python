import * as installer from '../src/install-python';

jest.mock('@actions/core', () => ({
  ...jest.requireActual('@actions/core'),
}))

describe('parseUsesManifest', () => {
  it('throw if format is wrong', () => {
    expect(() => installer.parseUsesManifest('')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('/')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('/@')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a/b')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a/b@')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a/@c')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('/b@c')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a/b@c@d')).toThrow('{{owner}}/{{repo}}@{{ref}}');
    expect(() => installer.parseUsesManifest('a/b/c@d')).toThrow('{{owner}}/{{repo}}@{{ref}}');
  });
  it('parses', () => {
    expect(installer.parseUsesManifest('a/b@c')).toEqual({owner: 'a', repo: 'b', ref: 'c'});
    expect(installer.parseUsesManifest('owner/repo@ref')).toEqual({owner: 'owner', repo: 'repo', ref: 'ref'});
  });
  it('allows ref with /', () => {
    expect(installer.parseUsesManifest('a/b@c/d')).toEqual({owner: 'a', repo: 'b', ref: 'c/d'});
  });
});

describe('getManifestRawUrl', () => {
  it('return the right value', () => {
    expect(installer.getManifestRawUrl({owner: 'actions', repo: 'python-versions', ref: 'main'})).toBe(
      'https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json'
    );
  });
});
