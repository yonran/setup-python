import * as path from 'path';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as exec from '@actions/exec';
import {ExecOptions} from '@actions/exec/lib/interfaces';
import {IS_WINDOWS, IS_LINUX} from './utils';

const TOKEN = core.getInput('token');
const AUTH = !TOKEN ? undefined : `token ${TOKEN}`;
const MANIFEST_REPO_DEFAULT = 'actions/python-versions@main';

export interface RepositoryReference {
  owner: string;
  repo: string;
  ref: string;
}

// Parse the uses-cpython-manifest field using {{owner}}/{{repo}}@{{ref}}
// basically a small subset of GitHub Manifest jobs.<job_id>.steps[*].uses
// https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsuses
// https://github.com/actions/runner/blob/v2.309.0/src/Sdk/DTPipelines/Pipelines/ObjectTemplating/PipelineTemplateConverter.cs#L522
export function parseUsesManifest(x: string): RepositoryReference {
  const m = /^(?<owner>[^/@]+)\/(?<repo>[^/@]+)@(?<ref>[^@]+)$/.exec(x);
  if (m === null) {
    throw new Error(
      'Expected uses-cpython-manifest to have format {{owner}}/{{repo}}@{{ref}}'
    );
  }
  const {owner, repo, ref} = m.groups!;
  return {owner, repo, ref};
}

export function getMainfestReference(): RepositoryReference {
  const usesManifest = core.getInput('uses-cpython-manifest') || MANIFEST_REPO_DEFAULT;
  const usesManifestReference = parseUsesManifest(usesManifest);
  return usesManifestReference;
}

export function getManifestRawUrl(reference: RepositoryReference) {
  return `https://raw.githubusercontent.com/${reference.owner}/${reference.repo}/${reference.ref}/versions-manifest.json`;
}

export async function findReleaseFromManifest(
  semanticVersionSpec: string,
  architecture: string,
  manifest: tc.IToolRelease[] | null
): Promise<tc.IToolRelease | undefined> {
  if (!manifest) {
    manifest = await getManifest();
  }

  const foundRelease = await tc.findFromManifest(
    semanticVersionSpec,
    false,
    manifest,
    architecture
  );

  return foundRelease;
}

export function getManifest(): Promise<tc.IToolRelease[]> {
  const manifestReference: RepositoryReference = getMainfestReference();
  core.debug(
    `Getting manifest from ${getManifestRawUrl(manifestReference)}`
  );
  return tc.getManifestFromRepo(
    manifestReference.owner,
    manifestReference.repo,
    AUTH,
    manifestReference.ref
  );
}

async function installPython(workingDirectory: string) {
  const options: ExecOptions = {
    cwd: workingDirectory,
    env: {
      ...process.env,
      ...(IS_LINUX && {LD_LIBRARY_PATH: path.join(workingDirectory, 'lib')})
    },
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        core.info(data.toString().trim());
      },
      stderr: (data: Buffer) => {
        core.error(data.toString().trim());
      }
    }
  };

  if (IS_WINDOWS) {
    await exec.exec('powershell', ['./setup.ps1'], options);
  } else {
    await exec.exec('bash', ['./setup.sh'], options);
  }
}

export async function installCpythonFromRelease(release: tc.IToolRelease) {
  const downloadUrl = release.files[0].download_url;

  core.info(`Download from "${downloadUrl}"`);
  let pythonPath = '';
  try {
    pythonPath = await tc.downloadTool(downloadUrl, undefined, AUTH);
    core.info('Extract downloaded archive');
    let pythonExtractedFolder;
    if (IS_WINDOWS) {
      pythonExtractedFolder = await tc.extractZip(pythonPath);
    } else {
      pythonExtractedFolder = await tc.extractTar(pythonPath);
    }

    core.info('Execute installation script');
    await installPython(pythonExtractedFolder);
  } catch (err) {
    if (err instanceof tc.HTTPError) {
      // Rate limit?
      if (err.httpStatusCode === 403 || err.httpStatusCode === 429) {
        core.info(
          `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
        );
      } else {
        core.info(err.message);
      }
      if (err.stack) {
        core.debug(err.stack);
      }
    }
    throw err;
  }
}
